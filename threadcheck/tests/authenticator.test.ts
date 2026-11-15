import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import supertest from "supertest";
import * as OTPAuth from "otpauth";
import { createApp } from "../server/app";
import { secretCipher, parseAccount } from "../server/secrets";
import { testDatabase, vaultOptions } from "./database";
import {
  AuthenticatorAccount,
  DailyFit,
  UnlockChallenge,
} from "../shared/authenticator";
import { ClothingItem } from "../shared/model";

const fixture = await testDatabase();
const store = fixture.store;
let timestamp = Date.parse("2026-11-15T15:00:01Z");
let verdict: "consistent" | "mismatch" | "uncertain" = "consistent";
let providerFails = false;
const app = createApp(
  store,
  "654321",
  async (_item, _photo, offBody) => {
    if (providerFails) throw new Error("Vision unavailable");
    assert.equal(offBody, true);
    return {
      verdict,
      explanation:
        verdict === "consistent"
          ? "Garment matches, no person visible."
          : "Lay the matching garment on a surface with no person visible.",
      observations: ["Visible garment details"],
    };
  },
  { ...vaultOptions, now: () => timestamp },
);
let token = "";
let otherToken = "";
let account: AuthenticatorAccount;
let garment: ClothingItem;
let daily: DailyFit;
const photo = (value: string) =>
  `data:image/png;base64,${Buffer.from(value).toString("base64")}`;
const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
const call = (path: string) =>
  supertest(app).post(`/api/vault${path}`).auth(token, { type: "bearer" });
before(async () => {
  token = (await supertest(app).post("/api/pair").send({ code: "654321" })).body
    .token;
  otherToken = (await supertest(app).post("/api/pair").send({ code: "654321" }))
    .body.token;
  garment = await store.createItem({
    name: "Sage tee",
    brand: "Test",
    barcode: "TEE-123",
    color: "Sage",
    size: "M",
    serial: "",
    category: "Tops",
    kind: "shirt",
    photo: photo("catalog"),
  });
  await store.createItem({
    name: "Zero sugar can",
    brand: "Test",
    barcode: "00012345678905",
    color: "Zero sugar",
    size: "500ml",
    serial: "",
    category: "Snacks",
    kind: "can",
    photo: null,
  });
  await store.createItem({
    name: "Mystery chips",
    brand: "Test",
    barcode: "CHIPS-456",
    color: "Mystery",
    size: "100g",
    serial: "",
    category: "Snacks",
    kind: "snack",
    photo: null,
  });
});
after(() => fixture.close());

test("TOTP matches RFC 6238 vectors and encrypted secrets reject tampering", () => {
  const totp = new OTPAuth.TOTP({
    secret,
    digits: 8,
    period: 30,
    algorithm: "SHA1",
  });
  assert.equal(totp.generate({ timestamp: 59_000 }), "94287082");
  assert.equal(totp.generate({ timestamp: 1111111109000 }), "07081804");
  const encryption = secretCipher(vaultOptions.encryptionKey);
  const encrypted = encryption.encrypt(secret, "account-1");
  assert.ok(!encrypted.includes(secret));
  assert.equal(encryption.decrypt(encrypted, "account-1"), secret);
  assert.throws(() => encryption.decrypt(encrypted, "account-2"));
  const tampered = Buffer.from(encrypted, "base64");
  tampered[30] ^= 1;
  assert.throws(() =>
    encryption.decrypt(tampered.toString("base64"), "account-1"),
  );
  assert.throws(() =>
    parseAccount({
      method: "qr",
      uri: `otpauth://hotp/Test:user?secret=${secret}&counter=0`,
    }),
  );
});
test("account registration stores only encrypted secrets and metadata never exposes them", async () => {
  await supertest(app).post("/api/vault/accounts").send({}).expect(401);
  await call("/accounts")
    .send({ method: "qr", uri: "https://example.com" })
    .expect(400);
  const response = await call("/accounts")
    .send({
      method: "qr",
      uri: `otpauth://totp/Test:alice?secret=${secret}&issuer=Test`,
    })
    .expect(201);
  account = response.body;
  assert.equal(account.issuer, "Test");
  assert.equal(account.digits, 6);
  assert.ok(!JSON.stringify(response.body).includes(secret));
  assert.equal(response.body.secretCiphertext, undefined);
  const stored = (
    await store.database.query<{ secretCiphertext: string }>(
      'SELECT "secretCiphertext" FROM accounts WHERE id=$1',
      [account.id],
    )
  ).rows[0];
  assert.equal(
    secretCipher(vaultOptions.encryptionKey).decrypt(
      stored.secretCiphertext,
      account.id,
    ),
    secret,
  );
  await call("/accounts")
    .send({ method: "manual", issuer: "Test", label: "alice", secret })
    .expect(409);
  await call("/challenges").send({ accountId: account.id }).expect(409);
});
test("morning enrollment rejects duplicates, samples and failed off-body photos", async () => {
  await call("/daily")
    .send({
      pieces: [
        { itemId: garment.id, photo: photo("morning") },
        { itemId: garment.id, photo: photo("other") },
      ],
    })
    .expect(400);
  await call("/daily")
    .send({ pieces: [{ itemId: "sample-hoodie", photo: photo("morning") }] })
    .expect(400);
  verdict = "mismatch";
  await call("/daily")
    .send({
      pieces: [{ itemId: garment.id, photo: photo("person-wearing-shirt") }],
    })
    .expect(422);
  verdict = "consistent";
});
test("daily enrollment fixes the garment set and two snacks until Toronto midnight", async () => {
  const response = await call("/daily")
    .send({ pieces: [{ itemId: garment.id, photo: photo("morning") }] })
    .expect(201);
  daily = response.body;
  assert.equal(daily.day, "2026-11-15");
  assert.equal(daily.expiresAt, Date.parse("2026-11-16T05:00:00Z"));
  assert.equal(
    daily.items.filter((item) => item.category === "Snacks").length,
    2,
  );
  const repeat = await call("/daily")
    .send({ pieces: [{ itemId: garment.id, photo: photo("morning-again") }] })
    .expect(409);
  assert.ok(repeat.body || repeat.text);
  const overview = await supertest(app)
    .get("/api/vault/overview")
    .auth(token, { type: "bearer" })
    .expect(200);
  assert.equal(overview.body.daily.id, daily.id);
  assert.ok(!JSON.stringify(overview.body).includes(secret));
});
let challenge: UnlockChallenge;
test("unlock rejects missing proofs, another session, wrong items and wrong scanner sources", async () => {
  challenge = (
    await call("/challenges").send({ accountId: account.id }).expect(201)
  ).body;
  await call(`/challenges/${challenge.id}/redeem`).expect(403);
  await supertest(app)
    .post(`/api/vault/challenges/${challenge.id}/redeem`)
    .auth(otherToken, { type: "bearer" })
    .expect(404);
  await call(`/challenges/${challenge.id}/proofs`)
    .send({ dailyItemId: "not-in-fit", source: "photo", photo: photo("new") })
    .expect(400);
  const clothing = challenge.items.find((item) => item.category !== "Snacks")!;
  await call(`/challenges/${challenge.id}/proofs`)
    .send({ dailyItemId: clothing.id, source: "store", code: garment.barcode })
    .expect(400);
  const food = challenge.items.find((item) => item.category === "Snacks")!;
  await call(`/challenges/${challenge.id}/proofs`)
    .send({ dailyItemId: food.id, source: "photo", photo: photo("food") })
    .expect(400);
  await call(`/challenges/${challenge.id}/proofs`)
    .send({ dailyItemId: food.id, source: "store", code: "wrong-flavor" })
    .expect(422);
});
test("reference reuse, uncertain photos and provider failure cannot unlock a code", async () => {
  const clothing = challenge.items.find((item) => item.category !== "Snacks")!;
  await call(`/challenges/${challenge.id}/proofs`)
    .send({
      dailyItemId: clothing.id,
      source: "photo",
      photo: photo("morning"),
    })
    .expect(422);
  verdict = "uncertain";
  await call(`/challenges/${challenge.id}/proofs`)
    .send({ dailyItemId: clothing.id, source: "photo", photo: photo("blur") })
    .expect(422);
  verdict = "consistent";
  providerFails = true;
  await call(`/challenges/${challenge.id}/proofs`)
    .send({ dailyItemId: clothing.id, source: "photo", photo: photo("fresh") })
    .expect(502);
  providerFails = false;
  await call(`/challenges/${challenge.id}/redeem`).expect(403);
});
test("full fresh-photo and store-scanner flow reveals the expected code once", async () => {
  for (const item of challenge.items) {
    const registered = await store.getItem(item.itemId);
    const proof =
      item.category === "Snacks"
        ? { source: "store", code: registered.barcode }
        : { source: "photo", photo: photo("fresh-off-body") };
    const response = await call(`/challenges/${challenge.id}/proofs`)
      .send({ dailyItemId: item.id, ...proof })
      .expect(200);
    assert.ok(
      response.body.items.find(
        (piece: { id: string; matched: boolean }) => piece.id === item.id,
      ).matched,
    );
  }
  const response = await call(`/challenges/${challenge.id}/redeem`).expect(200);
  assert.equal(
    response.body.code,
    new OTPAuth.TOTP({ secret }).generate({ timestamp }),
  );
  assert.equal(
    response.body.validUntil,
    Math.floor(timestamp / 30_000) * 30_000 + 30_000,
  );
  assert.equal(response.headers["cache-control"], "no-store");
  await call(`/challenges/${challenge.id}/redeem`).expect(410);
});
test("new challenges require fresh scans and supersede older attempts", async () => {
  const first: UnlockChallenge = (
    await call("/challenges").send({ accountId: account.id }).expect(201)
  ).body;
  await call(`/challenges/${first.id}/redeem`).expect(403);
  const clothing = first.items.find((item) => item.category !== "Snacks")!;
  await call(`/challenges/${first.id}/proofs`)
    .send({
      dailyItemId: clothing.id,
      source: "photo",
      photo: photo("fresh-off-body"),
    })
    .expect(422);
  const second: UnlockChallenge = (
    await call("/challenges").send({ accountId: account.id }).expect(201)
  ).body;
  await call(`/challenges/${first.id}/redeem`).expect(410);
  timestamp += 301_000;
  await call(`/challenges/${second.id}/redeem`).expect(410);
});
test("midnight invalidates the daily fit and prevents a new unlock without enrollment", async () => {
  timestamp = Date.parse("2026-11-16T05:00:00Z");
  const overview = await supertest(app)
    .get("/api/vault/overview")
    .auth(token, { type: "bearer" })
    .expect(200);
  assert.equal(overview.body.daily, null);
  assert.equal(overview.body.day, "2026-11-16");
  await call("/challenges").send({ accountId: account.id }).expect(409);
});
