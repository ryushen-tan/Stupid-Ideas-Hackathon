import assert from "node:assert/strict";
import { after, test } from "node:test";
import supertest from "supertest";
import { createApp } from "../server/app";
import { testDatabase, vaultOptions } from "./database";

const fixture = await testDatabase();
const app = createApp(fixture.store, "654321", null, vaultOptions, null, true);
const normalApp = createApp(fixture.store, "654321", null, vaultOptions);
after(() => fixture.close());

test("demo remembers one authenticated app and automatically links waiting and new browsers", async () => {
  await supertest(normalApp)
    .get("/api/browser/demo")
    .expect(200, { enabled: false });
  await supertest(app).get("/api/browser/demo").expect(200, { enabled: true });
  await supertest(app).post("/api/bridge/demo/connect").expect(401);
  const phone = (
    await supertest(app).post("/api/pair").send({ code: "654321" })
  ).body.token;
  const stranger = (
    await supertest(app).post("/api/pair").send({ code: "654321" })
  ).body.token;
  const waiting = (
    await supertest(app)
      .post("/api/browser/pair")
      .send({ name: "Waiting browser" })
      .expect(201)
  ).body.token;
  await supertest(app)
    .get("/api/browser/status")
    .auth(waiting, { type: "bearer" })
    .expect(200, { paired: false, demo: true });
  await supertest(app)
    .post("/api/browser/requests")
    .auth(waiting, { type: "bearer" })
    .send({ origin: "http://localhost:3020" })
    .expect(403);
  await supertest(app)
    .post("/api/bridge/demo/connect")
    .auth(phone, { type: "bearer" })
    .expect(200, { enabled: true });
  await supertest(app)
    .get("/api/browser/status")
    .auth(waiting, { type: "bearer" })
    .expect(200, { paired: true, demo: true });
  await supertest(app)
    .post("/api/bridge/demo/connect")
    .auth(stranger, { type: "bearer" })
    .expect(409);
  const restarted = createApp(
    fixture.store,
    "654321",
    null,
    vaultOptions,
    null,
    true,
  );
  const browser = (
    await supertest(restarted)
      .post("/api/browser/pair")
      .send({ name: "New browser" })
      .expect(201)
  ).body.token;
  await supertest(restarted)
    .get("/api/browser/status")
    .auth(browser, { type: "bearer" })
    .expect(200, { paired: true, demo: true });
  const pending = (
    await supertest(restarted)
      .post("/api/browser/requests")
      .auth(browser, { type: "bearer" })
      .send({ origin: "http://localhost:3020" })
      .expect(201)
  ).body;
  await supertest(app)
    .post(`/api/bridge/requests/${pending.id}/complete`)
    .auth(phone, { type: "bearer" })
    .send({ code: "123456", validUntil: Date.now() + 30_000 })
    .expect(409);
  const inbox = await supertest(app)
    .get("/api/bridge/inbox")
    .auth(stranger, { type: "bearer" })
    .expect(200);
  assert.equal(inbox.body.browsers.length, 0);
  assert.equal(inbox.body.requests.length, 0);
  await supertest(normalApp)
    .get("/api/browser/status")
    .auth(browser, { type: "bearer" })
    .expect(401);
  await supertest(app)
    .delete("/api/browser/connection")
    .auth(browser, { type: "bearer" })
    .expect(204);
  await supertest(app)
    .get("/api/browser/status")
    .auth(browser, { type: "bearer" })
    .expect(401);
});
