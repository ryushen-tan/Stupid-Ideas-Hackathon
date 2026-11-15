import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { createHash, randomUUID } from "node:crypto";
import { PoolClient } from "pg";
import { Temporal } from "@js-temporal/polyfill";
import * as OTPAuth from "otpauth";
import { z } from "zod";
import {
  accountInputSchema,
  AuthenticatorAccount,
  dailyInputSchema,
  DailyFit,
  DailyPiece,
  proofInputSchema,
  UnlockChallenge,
} from "../shared/authenticator";
import { ClothingItem, pageSize } from "../shared/model";
import { parseTag } from "../shared/tags";
import { Store } from "./database";
import { ComparePhotos } from "./vision";
import { secretCipher } from "./secrets";
import { parseAccount } from "../shared/totp";

export class VaultError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
interface DailyRow {
  id: string;
  day: string;
  expiresAt: number;
}
interface ChallengeRow {
  id: string;
  accountId: string;
  dailyId: string;
  sessionToken: string;
  expiresAt: number;
  attempts: number;
  redeemed: boolean;
}
interface DailyReference extends ClothingItem {
  dailyItemId: string;
  photoDigest: string | null;
}
interface StoredAccount extends AuthenticatorAccount {
  secretCiphertext: string;
}
export interface VaultOptions {
  encryptionKey: string;
  timezone: string;
  now?: () => number;
}
const accountColumns = 'id,issuer,label,algorithm,digits,period,"createdAt"';
const digest = (photo: string) =>
  createHash("sha256")
    .update(Buffer.from(photo.split(",")[1], "base64"))
    .digest("hex");

export function vaultRouter(
  store: Store,
  comparePhotos: ComparePhotos | null,
  options: VaultOptions,
) {
  const router = Router();
  const cipher = secretCipher(options.encryptionKey);
  const now = options.now ?? Date.now;
  function today() {
    const zoned = Temporal.Instant.fromEpochMilliseconds(
      now(),
    ).toZonedDateTimeISO(options.timezone);
    return {
      day: zoned.toPlainDate().toString(),
      expiresAt: zoned.add({ days: 1 }).startOfDay().epochMilliseconds,
    };
  }
  async function compareOutfitPhoto(item: ClothingItem, photo: string) {
    if (!comparePhotos)
      throw new VaultError(
        503,
        "Configure Backboard photo checks before using outfit challenges.",
      );
    try {
      return await comparePhotos(item, photo, true);
    } catch (error) {
      throw new VaultError(
        502,
        error instanceof Error
          ? error.message
          : "Photo verification failed. Please retry.",
      );
    }
  }
  async function transaction<T>(
    operation: (connection: PoolClient) => Promise<T>,
  ) {
    const connection = await store.database.connect();
    try {
      await connection.query("BEGIN");
      const result = await operation(connection);
      await connection.query("COMMIT");
      return result;
    } catch (error) {
      await connection.query("ROLLBACK");
      throw error;
    } finally {
      connection.release();
    }
  }
  async function dailyFit(): Promise<DailyFit | null> {
    const daily = (
      await store.database.query<DailyRow>(
        'SELECT id,day,"expiresAt" FROM daily_fits WHERE day=$1',
        [today().day],
      )
    ).rows[0];
    if (!daily || daily.expiresAt <= now()) return null;
    const items = (
      await store.database.query<DailyPiece>(
        'SELECT d.id,d."itemId",i.name,i.kind,i.category,d.position FROM daily_items d JOIN items i ON i.id=d."itemId" WHERE d."dailyId"=$1 ORDER BY d.position',
        [daily.id],
      )
    ).rows;
    return { ...daily, items };
  }
  async function ownedChallenge(
    connection: PoolClient,
    id: string,
    token: string,
  ) {
    const challenge = (
      await connection.query<ChallengeRow>(
        'SELECT * FROM challenges WHERE id=$1 AND "sessionToken"=$2 FOR UPDATE',
        [id, token],
      )
    ).rows[0];
    if (!challenge)
      throw new VaultError(
        404,
        "This unlock request was not found on this device.",
      );
    if (challenge.redeemed || challenge.expiresAt <= now())
      throw new VaultError(
        410,
        "This unlock request has ended. Start a fresh scan.",
      );
    if (challenge.attempts >= 20)
      throw new VaultError(
        429,
        "Too many attempts. Start a new unlock request.",
      );
    return challenge;
  }
  async function challengeView(
    challenge: ChallengeRow,
  ): Promise<UnlockChallenge> {
    const items = (
      await store.database.query<DailyPiece & { matched: boolean }>(
        'SELECT d.id,d."itemId",i.name,i.kind,i.category,d.position,(p."challengeId" IS NOT NULL) AS matched FROM daily_items d JOIN items i ON i.id=d."itemId" LEFT JOIN proofs p ON p."dailyItemId"=d.id AND p."challengeId"=$2 WHERE d."dailyId"=$1 ORDER BY d.position',
        [challenge.dailyId, challenge.id],
      )
    ).rows;
    return {
      id: challenge.id,
      accountId: challenge.accountId,
      expiresAt: challenge.expiresAt,
      items,
      serverTime: now(),
    };
  }
  router.use((_request, response, next) => {
    response.setHeader("Cache-Control", "no-store");
    next();
  });
  router.get("/overview", async (request, response) => {
    const offset = z.coerce
      .number()
      .int()
      .min(0)
      .parse(request.query.offset ?? 0);
    const accounts = (
      await store.database.query<AuthenticatorAccount>(
        `SELECT ${accountColumns} FROM accounts ORDER BY "createdAt" DESC,id LIMIT $1 OFFSET $2`,
        [pageSize + 1, offset],
      )
    ).rows;
    response.json({
      accounts: accounts.slice(0, pageSize),
      hasMore: accounts.length > pageSize,
      daily: await dailyFit(),
      day: today().day,
      timezone: options.timezone,
      serverTime: now(),
    });
  });
  router.post("/accounts", async (request, response) => {
    let parsed: ReturnType<typeof parseAccount>;
    try {
      parsed = parseAccount(accountInputSchema.parse(request.body));
    } catch {
      throw new VaultError(
        400,
        "Use a valid TOTP setup QR or Base32 key. Supported: SHA1/256/512, 6 or 8 digits, 15–120 second periods.",
      );
    }
    const id = randomUUID();
    const result = await store.database.query<AuthenticatorAccount>(
      `INSERT INTO accounts VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(issuer,label) DO NOTHING RETURNING ${accountColumns}`,
      [
        id,
        parsed.issuer,
        parsed.label,
        parsed.algorithm,
        parsed.digits,
        parsed.period,
        cipher.encrypt(parsed.secret, id),
        new Date(now()).toISOString(),
      ],
    );
    if (!result.rowCount)
      throw new VaultError(
        409,
        "That account is already in your authenticator.",
      );
    response.status(201).json(result.rows[0]);
  });
  router.post(
    "/daily",
    rateLimit({ windowMs: 60_000, limit: 6 }),
    async (request, response) => {
      const input = dailyInputSchema.parse(request.body);
      if (
        new Set(input.pieces.map((piece) => piece.itemId)).size !==
        input.pieces.length
      )
        throw new VaultError(400, "Choose each garment only once.");
      if (await dailyFit())
        throw new VaultError(
          409,
          "Today’s outfit is already set. It resets at midnight.",
        );
      if (!comparePhotos)
        throw new VaultError(
          503,
          "Configure Backboard photo checks on the server before enrolling an outfit.",
        );
      const day = today();
      const snacks = (
        await store.database.query<ClothingItem>(
          "SELECT * FROM items WHERE category='Snacks' AND id NOT LIKE 'sample-%' ORDER BY random() LIMIT 2",
        )
      ).rows;
      if (snacks.length !== 2)
        throw new VaultError(
          409,
          "Add at least two snacks with different barcodes to your stash first.",
        );
      const pieces: {
        item: ClothingItem;
        photo: string;
        photoDigest: string;
      }[] = [];
      for (const piece of input.pieces) {
        const item = await store.getItem(piece.itemId);
        if (
          !item ||
          item.category === "Snacks" ||
          item.id.startsWith("sample-") ||
          !item.photo
        )
          throw new VaultError(
            400,
            "Choose registered clothes with reference photos. Sample pieces cannot be enrolled.",
          );
        const review = await compareOutfitPhoto(item, piece.photo);
        if (review.verdict !== "consistent")
          throw new VaultError(422, `${item.name}: ${review.explanation}`);
        pieces.push({
          item,
          photo: piece.photo,
          photoDigest: digest(piece.photo),
        });
      }
      const id = randomUUID();
      await transaction(async (connection) => {
        if (today().day !== day.day)
          throw new VaultError(
            410,
            "Midnight passed during enrollment. Please start today’s outfit again.",
          );
        const inserted = await connection.query(
          "INSERT INTO daily_fits VALUES ($1,$2,$3,$4) ON CONFLICT(day) DO NOTHING RETURNING id",
          [id, day.day, day.expiresAt, new Date(now()).toISOString()],
        );
        if (!inserted.rowCount)
          throw new VaultError(
            409,
            "Today’s outfit was already enrolled on another screen.",
          );
        let position = 0;
        for (const piece of pieces)
          await connection.query(
            "INSERT INTO daily_items VALUES ($1,$2,$3,$4,$5,$6)",
            [
              randomUUID(),
              id,
              piece.item.id,
              position++,
              piece.photo,
              piece.photoDigest,
            ],
          );
        for (const snack of snacks)
          await connection.query(
            "INSERT INTO daily_items VALUES ($1,$2,$3,$4,NULL,NULL)",
            [randomUUID(), id, snack.id, position++],
          );
        await connection.query("DELETE FROM daily_fits WHERE day<$1", [
          day.day,
        ]);
      });
      response.status(201).json(await dailyFit());
    },
  );
  router.post(
    "/challenges",
    rateLimit({ windowMs: 60_000, limit: 8 }),
    async (request, response) => {
      const { accountId } = z
        .object({ accountId: z.string() })
        .parse(request.body);
      const daily = await dailyFit();
      if (!daily)
        throw new VaultError(
          409,
          "Enroll your outfit for today before unlocking an account.",
        );
      const account = await store.database.query(
        "SELECT id FROM accounts WHERE id=$1",
        [accountId],
      );
      if (!account.rowCount)
        throw new VaultError(404, "This authenticator account was not found.");
      const challenge = await transaction(async (connection) => {
        await connection.query(
          "SELECT token FROM sessions WHERE token=$1 FOR UPDATE",
          [response.locals.tokenHash],
        );
        await connection.query(
          'UPDATE challenges SET redeemed=true WHERE "sessionToken"=$1 AND "accountId"=$2',
          [response.locals.tokenHash, accountId],
        );
        return (
          await connection.query<ChallengeRow>(
            'INSERT INTO challenges (id,"accountId","dailyId","sessionToken","expiresAt") VALUES ($1,$2,$3,$4,$5) RETURNING *',
            [
              randomUUID(),
              accountId,
              daily.id,
              response.locals.tokenHash,
              Math.min(now() + 300_000, daily.expiresAt),
            ],
          )
        ).rows[0];
      });
      response.status(201).json(await challengeView(challenge));
    },
  );
  router.post(
    "/challenges/:id/proofs",
    rateLimit({ windowMs: 60_000, limit: 20 }),
    async (request, response) => {
      const input = proofInputSchema.parse(request.body);
      const challenge = await transaction(async (connection) => {
        const owned = await ownedChallenge(
          connection,
          z.string().parse(request.params.id),
          response.locals.tokenHash,
        );
        await connection.query(
          "UPDATE challenges SET attempts=attempts+1 WHERE id=$1",
          [owned.id],
        );
        return owned;
      });
      const reference = (
        await store.database.query<DailyReference>(
          'SELECT i.*,d.id AS "dailyItemId",d.photo,d."photoDigest" FROM daily_items d JOIN items i ON i.id=d."itemId" WHERE d.id=$1 AND d."dailyId"=$2',
          [input.dailyItemId, challenge.dailyId],
        )
      ).rows[0];
      if (!reference)
        throw new VaultError(
          400,
          "This item is not part of today’s challenge.",
        );
      let photoDigest: string | null = null;
      if (reference.category === "Snacks") {
        if (input.source !== "store")
          throw new VaultError(
            400,
            "Use the connected store scanner for snacks.",
          );
        const identity = parseTag(input.code);
        if (
          identity.barcode !== reference.barcode ||
          identity.serial !== reference.serial
        )
          throw new VaultError(
            422,
            `That barcode does not match ${reference.name}. Check the flavor and package size.`,
          );
      } else {
        if (input.source !== "photo")
          throw new VaultError(
            400,
            "Take a fresh photo of this garment laid on a surface.",
          );
        photoDigest = digest(input.photo);
        const reused = await store.database.query(
          'SELECT "challengeId" FROM proofs WHERE "photoDigest"=$1',
          [photoDigest],
        );
        if (photoDigest === reference.photoDigest || reused.rowCount)
          throw new VaultError(
            422,
            "This photo was already used. Take a new photo of the garment off your body.",
          );
        if (!comparePhotos)
          throw new VaultError(
            503,
            "Photo verification is unavailable. Your codes remain locked.",
          );
        const review = await compareOutfitPhoto(reference, input.photo);
        if (review.verdict !== "consistent")
          throw new VaultError(422, review.explanation);
      }
      await transaction(async (connection) => {
        await ownedChallenge(
          connection,
          challenge.id,
          response.locals.tokenHash,
        );
        const saved = await connection.query(
          'INSERT INTO proofs VALUES ($1,$2,$3) ON CONFLICT DO NOTHING RETURNING "challengeId"',
          [challenge.id, reference.dailyItemId, photoDigest],
        );
        if (!saved.rowCount)
          throw new VaultError(
            409,
            "That scan has already been used. Capture a fresh scan.",
          );
      });
      response.json(await challengeView(challenge));
    },
  );
  router.post("/challenges/:id/redeem", async (request, response) => {
    const unlocked = await transaction(async (connection) => {
      const challenge = await ownedChallenge(
        connection,
        z.string().parse(request.params.id),
        response.locals.tokenHash,
      );
      const missing = await connection.query(
        'SELECT d.id FROM daily_items d LEFT JOIN proofs p ON p."dailyItemId"=d.id AND p."challengeId"=$2 WHERE d."dailyId"=$1 AND p."challengeId" IS NULL LIMIT 1',
        [challenge.dailyId, challenge.id],
      );
      if (missing.rowCount)
        throw new VaultError(
          403,
          "Scan every garment and snack before revealing your code.",
        );
      const account = (
        await connection.query<StoredAccount>(
          "SELECT * FROM accounts WHERE id=$1",
          [challenge.accountId],
        )
      ).rows[0];
      const timestamp = now();
      const totp = new OTPAuth.TOTP({
        ...account,
        secret: cipher.decrypt(account.secretCiphertext, account.id),
      });
      await connection.query(
        "UPDATE challenges SET redeemed=true WHERE id=$1",
        [challenge.id],
      );
      return {
        code: totp.generate({ timestamp }),
        validUntil: Math.min(
          timestamp + totp.remaining({ timestamp }),
          challenge.expiresAt,
        ),
        serverTime: timestamp,
      };
    });
    response.json(unlocked);
  });
  return router;
}
