import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import supertest from "supertest";
import { createApp } from "../server/app";
import { testDatabase, vaultOptions } from "./database";
import { parseTag } from "../shared/tags";
import { ClothingItem, ScanRecord, scanLabel } from "../shared/model";

const fixture = await testDatabase();
const store = fixture.store;
const photo = "data:image/png;base64,aGVsbG8=";
const app = createApp(
  store,
  "654321",
  async () => ({
    verdict: "consistent",
    explanation: "The visible features look consistent.",
    observations: ["Both show a green shirt."],
  }),
  vaultOptions,
);
let token = "";
before(async () => {
  token = (
    await supertest(app).post("/api/pair").send({ code: "654321" }).expect(200)
  ).body.token;
});
after(() => fixture.close());

test("catalog and paid photo endpoint require pairing", async () => {
  await supertest(app).get("/api/items").expect(401);
  await supertest(app).post("/api/photo-checks").send({}).expect(401);
  await supertest(app).post("/api/pair").send({ code: "123456" }).expect(401);
});
test("store scan identifies the exact registered variant", async () => {
  const response = await supertest(app)
    .post("/api/scans")
    .auth(token, { type: "bearer" })
    .send({ code: "TC-HOODIE-SAGE-M", source: "store" })
    .expect(201);
  assert.equal(response.body.itemId, "sample-hoodie");
  assert.equal(response.body.tag, "matched");
  assert.equal(response.body.photo, "pending");
  assert.equal(scanLabel(response.body), "Tag matched");
});
test("expected item rejects another valid barcode", async () => {
  const response = await supertest(app)
    .post("/api/scans")
    .auth(token, { type: "bearer" })
    .send({
      code: "TC-CAP-GREEN-OS",
      source: "camera",
      expectedItemId: "sample-hoodie",
    })
    .expect(201);
  assert.equal(response.body.tag, "mismatch");
  assert.match(response.body.explanation, /Sunday club cap/);
});
test("unknown barcode is never replaced with a similar item", async () => {
  const response = await supertest(app)
    .post("/api/scans")
    .auth(token, { type: "bearer" })
    .send({ code: "TC-HOODIE-SAGE-L", source: "manual" })
    .expect(201);
  assert.equal(response.body.tag, "not_found");
  assert.equal(response.body.itemId, null);
});
test("serial number must match and cannot be dropped", async () => {
  const input = {
    name: "Serialized tee",
    brand: "Test",
    barcode: "SERIAL-TEE",
    color: "Green",
    size: "M",
    serial: "piece-001",
    category: "Tops",
    kind: "shirt",
    photo: null,
  };
  const added = await supertest(app)
    .post("/api/items")
    .auth(token, { type: "bearer" })
    .send(input)
    .expect(201);
  const item: ClothingItem = added.body;
  for (const code of [
    "SERIAL-TEE",
    "threadcheck://item?barcode=SERIAL-TEE&serial=piece-002",
  ]) {
    const result = await supertest(app)
      .post("/api/scans")
      .auth(token, { type: "bearer" })
      .send({ code, source: "camera" })
      .expect(201);
    assert.equal(result.body.tag, "not_found");
  }
  const correct = await supertest(app)
    .post("/api/scans")
    .auth(token, { type: "bearer" })
    .send({
      code: "threadcheck://item?barcode=SERIAL-TEE&serial=piece-001",
      source: "camera",
    })
    .expect(201);
  assert.equal(correct.body.itemId, item.id);
  assert.equal(correct.body.tag, "matched");
  await supertest(app)
    .post("/api/items")
    .auth(token, { type: "bearer" })
    .send(input)
    .expect(409);
});
test("GS1 Digital Link preserves GTIN and serial", () => {
  assert.deepEqual(parseTag("https://id.gs1.org/01/09506000134352/21/ABC123"), {
    barcode: "09506000134352",
    serial: "ABC123",
  });
  assert.throws(() => parseTag("https://example.com/not-a-tag"));
});

test("UPC and EAN scanner representations resolve to the same catalog identity", async () => {
  const input = {
    name: "Retail tee",
    brand: "Test",
    barcode: "012345678905",
    color: "White",
    size: "L",
    serial: "",
    category: "Tops",
    kind: "shirt",
    photo: null,
  };
  const registered = await supertest(app)
    .post("/api/items")
    .auth(token, { type: "bearer" })
    .send(input)
    .expect(201);
  for (const code of ["012345678905", "0012345678905", "00012345678905"]) {
    const result = await supertest(app)
      .post("/api/scans")
      .auth(token, { type: "bearer" })
      .send({ code, source: "store" })
      .expect(201);
    assert.equal(result.body.itemId, registered.body.id);
    assert.equal(result.body.tag, "matched");
  }
});
test("photo check needs an actual reference and cannot attach to a mismatch", async () => {
  await supertest(app)
    .post("/api/photo-checks")
    .auth(token, { type: "bearer" })
    .send({ itemId: "sample-hoodie", photo })
    .expect(409);
  await supertest(app)
    .patch("/api/items/sample-hoodie/photo")
    .auth(token, { type: "bearer" })
    .send({ photo })
    .expect(200);
  const mismatch = await supertest(app)
    .post("/api/scans")
    .auth(token, { type: "bearer" })
    .send({
      code: "TC-CAP-GREEN-OS",
      source: "store",
      expectedItemId: "sample-hoodie",
    })
    .expect(201);
  await supertest(app)
    .post("/api/photo-checks")
    .auth(token, { type: "bearer" })
    .send({ itemId: "sample-hoodie", photo, scanId: mismatch.body.id })
    .expect(400);
});
test("two checks are saved together and remain distinct from photo-only similarity", async () => {
  const scan = await supertest(app)
    .post("/api/scans")
    .auth(token, { type: "bearer" })
    .send({ code: "TC-HOODIE-SAGE-M", source: "camera" })
    .expect(201);
  const reviewed = await supertest(app)
    .post("/api/photo-checks")
    .auth(token, { type: "bearer" })
    .send({ itemId: "sample-hoodie", scanId: scan.body.id, photo })
    .expect(200);
  assert.equal(scanLabel(reviewed.body), "Both checks passed");
  assert.equal((await store.getScan(scan.body.id))?.photo, "consistent");
  const photoOnly = await supertest(app)
    .post("/api/photo-checks")
    .auth(token, { type: "bearer" })
    .send({ itemId: "sample-hoodie", photo })
    .expect(200);
  assert.equal(photoOnly.body.tag, "not_scanned");
  assert.equal(scanLabel(photoOnly.body), "Looks consistent");
});
test("Backboard failures surface and never become a passed check", async () => {
  const failingApp = createApp(
    store,
    "654321",
    async () => {
      throw new Error("Provider unavailable");
    },
    vaultOptions,
  );
  const response = await supertest(failingApp)
    .post("/api/photo-checks")
    .auth(token, { type: "bearer" })
    .send({ itemId: "sample-hoodie", photo })
    .expect(502);
  assert.equal(response.body.error, "Provider unavailable");
});
test("search, category filters and scan history return saved records", async () => {
  const items = await supertest(app)
    .get("/api/items?category=Accessories&search=cap")
    .auth(token, { type: "bearer" })
    .expect(200);
  assert.deepEqual(
    items.body.items.map((item: ClothingItem) => item.id),
    ["sample-hat"],
  );
  const scans = await supertest(app)
    .get("/api/scans")
    .auth(token, { type: "bearer" })
    .expect(200);
  assert.ok(
    scans.body.items.some(
      (scan: ScanRecord) =>
        scan.photo === "consistent" && scan.tag === "matched",
    ),
  );
});
test("disconnect revokes the paired session", async () => {
  const pairing = await supertest(app)
    .post("/api/pair")
    .send({ code: "654321" });
  await supertest(app)
    .delete("/api/session")
    .auth(pairing.body.token, { type: "bearer" })
    .expect(204);
  await supertest(app)
    .get("/api/items")
    .auth(pairing.body.token, { type: "bearer" })
    .expect(401);
});
