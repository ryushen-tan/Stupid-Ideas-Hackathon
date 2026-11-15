import { createHash, randomBytes, randomInt, randomUUID } from "node:crypto";
import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import {
  bridgeSetupSchema,
  browserOriginSchema,
  BrowserRequest,
  clothingBarcodeSchema,
  garmentSlot,
} from "../shared/bridge";
import { outfits, placements } from "../shared/drip";
import { parseTag } from "../shared/tags";
import { Store } from "./database";
import { secretCipher } from "./secrets";
import { VaultError } from "./vault";

export function browserBridge(
  store: Store,
  encryptionKey: string,
  now = Date.now,
) {
  const browser = Router();
  const phone = Router();
  const cipher = secretCipher(encryptionKey);
  browser.use((_request, response, next) => {
    response.set("Cache-Control", "no-store");
    next();
  });
  phone.use((_request, response, next) => {
    response.set("Cache-Control", "no-store");
    next();
  });
  browser.post(
    "/pair",
    rateLimit({ windowMs: 60_000, limit: 10 }),
    async (request, response) => {
      const { name } = z
        .object({ name: z.string().trim().min(1).max(80) })
        .parse(request.body);
      await store.database.query(
        'DELETE FROM browser_connections WHERE "expiresAt" <= $1 OR ("sessionToken" IS NULL AND "pairExpiresAt" <= $1)',
        [now()],
      );
      const token = randomBytes(32).toString("hex");
      const pairCode = String(randomInt(10000000, 100000000));
      const expiresAt = now() + 180_000;
      await store.database.query(
        'INSERT INTO browser_connections (id,name,"tokenHash","pairCode","pairExpiresAt","expiresAt") VALUES ($1,$2,$3,$4,$5,$6)',
        [
          randomUUID(),
          name,
          createHash("sha256").update(token).digest("hex"),
          pairCode,
          expiresAt,
          now() + 30 * 86400_000,
        ],
      );
      response.status(201).json({ token, pairCode, expiresAt });
    },
  );
  browser.use(async (request, response, next) => {
    const token = request.headers.authorization?.replace(/^Bearer /, "") ?? "";
    const result = await store.database.query<{
      id: string;
      sessionToken: string | null;
      pairExpiresAt: number;
    }>(
      'SELECT b.id,b."sessionToken",b."pairExpiresAt" FROM browser_connections b LEFT JOIN sessions s ON s.token=b."sessionToken" WHERE b."tokenHash"=$1 AND b."expiresAt">$2 AND ((b."sessionToken" IS NULL AND b."pairExpiresAt">$2) OR s."expiresAt">$2)',
      [createHash("sha256").update(token).digest("hex"), now()],
    );
    if (!result.rows[0])
      throw new VaultError(401, "Reconnect this browser in Drip.");
    response.locals.browser = result.rows[0];
    next();
  });
  browser.get("/status", (_request, response) =>
    response.json({ paired: Boolean(response.locals.browser.sessionToken) }),
  );
  browser.delete("/connection", async (_request, response) => {
    await store.database.query("DELETE FROM browser_connections WHERE id=$1", [
      response.locals.browser.id,
    ]);
    response.status(204).end();
  });
  browser.post(
    "/requests",
    rateLimit({ windowMs: 60_000, limit: 12 }),
    async (request, response) => {
      if (!response.locals.browser.sessionToken)
        throw new VaultError(403, "Pair this browser with Drip first.");
      const { origin } = z
        .object({ origin: browserOriginSchema })
        .parse(request.body);
      await store.database.query(
        'DELETE FROM browser_requests WHERE "expiresAt"<=$1',
        [now()],
      );
      const id = randomUUID();
      const expiresAt = now() + 180_000;
      await store.database.query(
        'INSERT INTO browser_requests (id,"browserId",origin,"expiresAt") VALUES ($1,$2,$3,$4)',
        [id, response.locals.browser.id, origin, expiresAt],
      );
      response.status(201).json({ id, expiresAt });
    },
  );
  browser.get("/requests/:id", async (request, response) => {
    const delivered = await store.database.query<{
      codeCiphertext: string;
      validUntil: number;
      origin: string;
    }>(
      `UPDATE browser_requests SET status='delivered',"codeCiphertext"=NULL,setup=NULL FROM (SELECT id,"codeCiphertext" AS encrypted FROM browser_requests WHERE id=$1) previous WHERE browser_requests.id=previous.id AND "browserId"=$2 AND status='ready' AND "expiresAt">$3 AND "validUntil">$3 RETURNING previous.encrypted AS "codeCiphertext","validUntil",origin`,
      [request.params.id, response.locals.browser.id, now()],
    );
    if (delivered.rows[0]) {
      const result = delivered.rows[0];
      response.json({
        status: "ready",
        code: cipher.decrypt(result.codeCiphertext, request.params.id),
        validUntil: result.validUntil,
        origin: result.origin,
      });
      return;
    }
    const result = await store.database.query<{
      status: string;
      expiresAt: number;
      validUntil: number | null;
    }>(
      'SELECT status,"expiresAt","validUntil" FROM browser_requests WHERE id=$1 AND "browserId"=$2',
      [request.params.id, response.locals.browser.id],
    );
    const current = result.rows[0];
    if (
      !current ||
      current.expiresAt <= now() ||
      (current.validUntil !== null && current.validUntil <= now())
    )
      throw new VaultError(410, "This request expired. Request a new code.");
    response.json({ status: current.status });
  });
  browser.delete("/requests/:id", async (request, response) => {
    await store.database.query(
      'DELETE FROM browser_requests WHERE id=$1 AND "browserId"=$2',
      [request.params.id, response.locals.browser.id],
    );
    response.status(204).end();
  });
  phone.post(
    "/pair",
    rateLimit({ windowMs: 60_000, limit: 10 }),
    async (request, response) => {
      const { code } = z
        .object({ code: z.string().regex(/^\d{8}$/) })
        .parse(request.body);
      const result = await store.database.query<{ id: string; name: string }>(
        'UPDATE browser_connections SET "sessionToken"=$1,"pairCode"=NULL WHERE "pairCode"=$2 AND "pairExpiresAt">$3 AND "sessionToken" IS NULL RETURNING id,name',
        [response.locals.tokenHash, code, now()],
      );
      if (!result.rows[0])
        throw new VaultError(
          404,
          "That browser pairing code expired or was already used.",
        );
      response.json(result.rows[0]);
    },
  );
  phone.get("/inbox", async (_request, response) => {
    await store.database.query(
      'DELETE FROM browser_requests WHERE "expiresAt"<=$1',
      [now()],
    );
    const browsers = await store.database.query(
      'SELECT id,name FROM browser_connections WHERE "sessionToken"=$1 AND "expiresAt">$2 ORDER BY id LIMIT 20',
      [response.locals.tokenHash, now()],
    );
    const requests = await store.database.query<BrowserRequest>(
      `SELECT r.id,b.name AS "browserName",r.origin,r."expiresAt",r.status,r.setup,r."matchedCount" FROM browser_requests r JOIN browser_connections b ON b.id=r."browserId" WHERE b."sessionToken"=$1 AND b."expiresAt">$2 AND r."expiresAt">$2 AND r.status IN ('pending','prepared','verified') ORDER BY r."expiresAt" LIMIT 10`,
      [response.locals.tokenHash, now()],
    );
    response.json({ browsers: browsers.rows, requests: requests.rows });
  });
  phone.delete("/connections/:id", async (request, response) => {
    await store.database.query(
      'DELETE FROM browser_connections WHERE id=$1 AND "sessionToken"=$2',
      [request.params.id, response.locals.tokenHash],
    );
    response.status(204).end();
  });
  phone.use("/requests/:id", async (request, response, next) => {
    const result = await store.database.query<BrowserRequest>(
      'SELECT r.* FROM browser_requests r JOIN browser_connections b ON b.id=r."browserId" WHERE r.id=$1 AND b."sessionToken"=$2 AND b."expiresAt">$3 AND r."expiresAt">$3',
      [request.params.id, response.locals.tokenHash, now()],
    );
    if (!result.rows[0])
      throw new VaultError(
        404,
        "This browser request expired or is no longer available.",
      );
    response.locals.browserRequest = result.rows[0];
    next();
  });
  phone.post("/requests/:id/prepare", async (request, response) => {
    const setup = bridgeSetupSchema.parse(request.body);
    const result = await store.database.query(
      `UPDATE browser_requests SET setup=$2,status='prepared' WHERE id=$1 AND status='pending' RETURNING id`,
      [request.params.id, JSON.stringify(setup)],
    );
    if (!result.rowCount)
      throw new VaultError(
        409,
        "This request is already prepared. Start a new request to change accounts.",
      );
    response.json({ setup });
  });
  phone.post(
    "/requests/:id/proof",
    rateLimit({ windowMs: 60_000, limit: 30 }),
    async (request, response) => {
      const { code } = z
        .object({ code: clothingBarcodeSchema })
        .parse(request.body);
      const current: BrowserRequest = response.locals.browserRequest;
      if (!current.setup || current.status !== "prepared")
        throw new VaultError(
          409,
          "Start a clothing scan before submitting a barcode.",
        );
      const placement = placements[current.matchedCount];
      const garment = outfits[current.setup.outfitIndex][placement];
      const expected = parseTag(current.setup.barcodes[garmentSlot[garment]]);
      if (code.barcode !== expected.barcode || code.serial !== expected.serial)
        throw new VaultError(
          422,
          `Wrong item. Scan the clothing shown at ${placement}.`,
        );
      const updated = await store.database.query<{
        matchedCount: number;
        status: BrowserRequest["status"];
      }>(
        `UPDATE browser_requests SET "matchedCount"="matchedCount"+1,status=CASE WHEN "matchedCount"=2 THEN 'verified' ELSE 'prepared' END WHERE id=$1 AND status='prepared' AND "matchedCount"=$2 AND "expiresAt">$3 RETURNING "matchedCount",status`,
        [current.id, current.matchedCount, now()],
      );
      if (!updated.rows[0])
        throw new VaultError(
          409,
          "This scan changed or expired. Reopen the request.",
        );
      response.json(updated.rows[0]);
    },
  );
  phone.post("/requests/:id/complete", async (request, response) => {
    const { code, validUntil } = z
      .object({
        code: z.string().regex(/^(\d{6}|\d{8})$/),
        validUntil: z.number().int(),
      })
      .parse(request.body);
    if (validUntil <= now() + 2000 || validUntil > now() + 120_000)
      throw new VaultError(400, "Wait for a fresh code and try again.");
    const result = await store.database.query(
      `UPDATE browser_requests SET status='ready',"codeCiphertext"=$2,"validUntil"=$3,setup=NULL WHERE id=$1 AND status='verified' AND "expiresAt">$4 RETURNING id`,
      [
        request.params.id,
        cipher.encrypt(code, request.params.id),
        validUntil,
        now(),
      ],
    );
    if (!result.rowCount)
      throw new VaultError(
        409,
        "Complete a fresh clothing check before sending a code.",
      );
    response.json({ sent: true });
  });
  phone.post("/requests/:id/reject", async (request, response) => {
    await store.database.query(
      `UPDATE browser_requests SET status='rejected',"codeCiphertext"=NULL,setup=NULL WHERE id=$1`,
      [request.params.id],
    );
    response.status(204).end();
  });
  return { browser, phone };
}
