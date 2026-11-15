import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import supertest from "supertest";
import { createApp } from "../server/app";
import { FitImages, localDay } from "../shared/daily-fit";
import { testDatabase, vaultOptions } from "./database";

const fixture = await testDatabase();
const photo = "data:image/png;base64,aGVsbG8=";
const cutouts: FitImages = {
  top: { name: "Ivory hoodie", photo },
  pants: { name: "Blue jeans", photo },
  hat: { name: "Green cap", photo },
};
let calls = 0;
const app = createApp(
  fixture.store,
  "654321",
  null,
  vaultOptions,
  async (captured) => {
    assert.equal(captured, photo);
    calls++;
    return cutouts;
  },
);
let token = "";
before(async () => {
  token = (await supertest(app).post("/api/pair").send({ code: "654321" })).body
    .token;
});
after(() => fixture.close());

test("fit extraction rejects unpaired and malformed requests before calling the provider", async () => {
  await supertest(app).post("/api/drip/fit").send({ photo }).expect(401);
  await supertest(app)
    .post("/api/drip/fit")
    .auth(token, { type: "bearer" })
    .send({ photo: "not a photo" })
    .expect(400);
  assert.equal(calls, 0);
});

test("paired fit extraction returns the actual three cutouts", async () => {
  const result = await supertest(app)
    .post("/api/drip/fit")
    .auth(token, { type: "bearer" })
    .send({ photo })
    .expect(200);
  assert.deepEqual(result.body, cutouts);
  assert.equal(calls, 1);
});

test("fit provider failures and missing configuration surface instead of returning demo clothes", async () => {
  const failed = createApp(
    fixture.store,
    "654321",
    null,
    vaultOptions,
    async () => {
      throw new Error("Could not clearly see your hat.");
    },
  );
  const result = await supertest(failed)
    .post("/api/drip/fit")
    .auth(token, { type: "bearer" })
    .send({ photo })
    .expect(502);
  assert.equal(result.body.error, "Could not clearly see your hat.");
  const disabled = createApp(fixture.store, "654321", null, vaultOptions);
  await supertest(disabled)
    .post("/api/drip/fit")
    .auth(token, { type: "bearer" })
    .send({ photo })
    .expect(503);
});

test("daily outfit keys turn over at device-local midnight and year boundaries", () => {
  assert.equal(localDay(new Date(2026, 10, 15, 23, 59, 59)), "2026-11-15");
  assert.equal(localDay(new Date(2026, 10, 16, 0, 0, 0)), "2026-11-16");
  assert.equal(localDay(new Date(2027, 0, 1, 0, 0, 0)), "2027-01-01");
});
