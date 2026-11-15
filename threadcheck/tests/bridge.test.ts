import assert from "node:assert/strict";
import { after, test } from "node:test";
import supertest from "supertest";
import { createApp } from "../server/app";
import { testDatabase, vaultOptions } from "./database";
import { BridgeSetup } from "../shared/bridge";
const fixture = await testDatabase();
const app = createApp(fixture.store, "654321", null, vaultOptions);
after(() => fixture.close());
const phone = (await supertest(app).post("/api/pair").send({ code: "654321" }))
  .body.token;
const stranger = (
  await supertest(app).post("/api/pair").send({ code: "654321" })
).body.token;
const photo = (value: string) =>
  `data:image/png;base64,${Buffer.from(value).toString("base64")}`;
const setup: BridgeSetup = {
  accountId: "local-account",
  issuer: "Entre",
  label: "test@example.com",
  outfitIndex: 1,
  barcodes: { top: "top-001", pants: "pants-002", hat: "012345678905" },
  items: {
    top: { name: "Top", photo: photo("top") },
    pants: { name: "Pants", photo: photo("pants") },
    hat: { name: "Hat", photo: photo("hat") },
  },
};
async function pair() {
  const created = await supertest(app)
    .post("/api/browser/pair")
    .send({ name: "Test browser" })
    .expect(201);
  const token: string = created.body.token;
  await supertest(app)
    .get("/api/browser/status")
    .auth(token, { type: "bearer" })
    .expect(200, { paired: false });
  await supertest(app)
    .post("/api/browser/requests")
    .auth(token, { type: "bearer" })
    .send({ origin: "http://localhost:3020" })
    .expect(403);
  await supertest(app)
    .post("/api/bridge/pair")
    .auth(phone, { type: "bearer" })
    .send({ code: created.body.pairCode })
    .expect(200);
  await supertest(app)
    .post("/api/bridge/pair")
    .auth(stranger, { type: "bearer" })
    .send({ code: created.body.pairCode })
    .expect(404);
  return token;
}
async function createRequest(token: string) {
  return (
    await supertest(app)
      .post("/api/browser/requests")
      .auth(token, { type: "bearer" })
      .send({ origin: "http://localhost:3020" })
      .expect(201)
  ).body.id as string;
}
const phonePost = (id: string, action: string) =>
  supertest(app)
    .post(`/api/bridge/requests/${id}/${action}`)
    .auth(phone, { type: "bearer" });

test("paired browser receives only one fresh code after a successful clothing check", async () => {
  const token = await pair();
  const other = await pair();
  const id = await createRequest(token);
  const inbox = await supertest(app)
    .get("/api/bridge/inbox")
    .auth(phone, { type: "bearer" })
    .expect(200);
  assert.equal(inbox.body.requests[0].origin, "http://localhost:3020");
  const otherInbox = await supertest(app)
    .get("/api/bridge/inbox")
    .auth(stranger, { type: "bearer" })
    .expect(200);
  assert.equal(otherInbox.body.requests.length, 0);
  await supertest(app)
    .post(`/api/bridge/requests/${id}/prepare`)
    .auth(stranger, { type: "bearer" })
    .send(setup)
    .expect(404);
  await phonePost(id, "complete")
    .send({ code: "123456", validUntil: Date.now() + 30_000 })
    .expect(409);
  await phonePost(id, "prepare")
    .send({ ...setup, barcodes: { ...setup.barcodes, top: "00012345678905" } })
    .expect(400);
  await phonePost(id, "prepare").send(setup).expect(200);
  await phonePost(id, "prepare")
    .send({ ...setup, outfitIndex: 0 })
    .expect(409);
  await phonePost(id, "proof").send({ code: setup.barcodes.top }).expect(422);
  await phonePost(id, "proof").send({ code: "unknown-tag" }).expect(422);
  await phonePost(id, "complete")
    .send({ code: "123456", validUntil: Date.now() + 30_000 })
    .expect(409);
  await phonePost(id, "proof")
    .send({ code: "00012345678905" })
    .expect(200, { matchedCount: 1, status: "prepared" });
  await phonePost(id, "proof").send({ code: setup.barcodes.hat }).expect(422);
  const concurrent = await Promise.all([
    phonePost(id, "proof").send({ code: setup.barcodes.top }),
    phonePost(id, "proof").send({ code: setup.barcodes.top }),
  ]);
  assert.equal(concurrent.filter((result) => result.status === 200).length, 1);
  assert.ok(concurrent.some((result) => [409, 422].includes(result.status)));
  await phonePost(id, "complete")
    .send({ code: "123456", validUntil: Date.now() + 30_000 })
    .expect(409);
  const resumed = await supertest(app)
    .get("/api/bridge/inbox")
    .auth(phone, { type: "bearer" })
    .expect(200);
  assert.equal(
    resumed.body.requests.find((pending: { id: string }) => pending.id === id)
      .matchedCount,
    2,
  );
  await phonePost(id, "proof")
    .send({ code: setup.barcodes.pants })
    .expect(200, { matchedCount: 3, status: "verified" });
  await phonePost(id, "proof").send({ code: setup.barcodes.pants }).expect(409);
  await phonePost(id, "complete")
    .send({ code: "123456", validUntil: Date.now() - 1 })
    .expect(400);
  await phonePost(id, "complete")
    .send({ code: "123456", validUntil: Date.now() + 30_000 })
    .expect(200);
  const stored = (
    await fixture.store.database.query(
      'SELECT "codeCiphertext",setup FROM browser_requests WHERE id=$1',
      [id],
    )
  ).rows[0];
  assert.ok(!stored.codeCiphertext.includes("123456"));
  assert.equal(stored.setup, null);
  await supertest(app)
    .get(`/api/browser/requests/${id}`)
    .auth(other, { type: "bearer" })
    .expect(410);
  const delivered = await supertest(app)
    .get(`/api/browser/requests/${id}`)
    .auth(token, { type: "bearer" })
    .expect(200);
  assert.equal(delivered.body.code, "123456");
  assert.equal(delivered.body.origin, "http://localhost:3020");
  await supertest(app)
    .get(`/api/browser/requests/${id}`)
    .auth(token, { type: "bearer" })
    .expect(200, { status: "delivered" });
  await phonePost(id, "complete")
    .send({ code: "654321", validUntil: Date.now() + 30_000 })
    .expect(409);
});

test("expiry, cancellation, and revocation stop code delivery", async () => {
  const token = await pair();
  const id = await createRequest(token);
  await phonePost(id, "reject").expect(204);
  await supertest(app)
    .get(`/api/browser/requests/${id}`)
    .auth(token, { type: "bearer" })
    .expect(200, { status: "rejected" });
  const expired = await createRequest(token);
  await fixture.store.database.query(
    'UPDATE browser_requests SET "expiresAt"=0 WHERE id=$1',
    [expired],
  );
  await phonePost(expired, "prepare").send(setup).expect(404);
  await supertest(app)
    .get(`/api/browser/requests/${expired}`)
    .auth(token, { type: "bearer" })
    .expect(410);
  const cancelled = await createRequest(token);
  await supertest(app)
    .delete(`/api/browser/requests/${cancelled}`)
    .auth(token, { type: "bearer" })
    .expect(204);
  await phonePost(cancelled, "prepare").send(setup).expect(404);
  await supertest(app)
    .delete("/api/browser/connection")
    .auth(token, { type: "bearer" })
    .expect(204);
  await supertest(app)
    .get("/api/browser/status")
    .auth(token, { type: "bearer" })
    .expect(401);
});
