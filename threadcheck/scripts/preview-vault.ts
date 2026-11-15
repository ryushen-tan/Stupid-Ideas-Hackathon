import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { testDatabase, vaultOptions } from "../tests/database";
import { createApp } from "../server/app";
import { backboardVision } from "../server/vision";

if (!process.env.BACKBOARD_API_KEY)
  throw new Error("A server Backboard key is required for the live preview.");
const fixture = await testDatabase();
const image = await readFile("artifacts/reference-shirt.png");
const reference = `data:image/png;base64,${image.toString("base64")}`;
const fresh = await sharp(image)
  .rotate(3, { background: "white" })
  .resize(480, 480)
  .png()
  .toBuffer();
await fixture.store.createItem({
  name: "Sage pocket tee · demo",
  brand: "Threadcheck demo",
  barcode: "DEMO-SAGE-TEE",
  color: "Sage green",
  size: "M",
  serial: "",
  kind: "shirt",
  category: "Tops",
  photo: reference,
});
await fixture.store.createItem({
  name: "Zero sugar can · demo",
  brand: "Threadcheck demo",
  barcode: "00012345678905",
  color: "Zero sugar",
  size: "500ml",
  serial: "",
  kind: "can",
  category: "Snacks",
  photo: null,
});
await fixture.store.createItem({
  name: "Mystery chips · demo",
  brand: "Threadcheck demo",
  barcode: "DEMO-MYSTERY-CHIPS",
  color: "Mystery",
  size: "100g",
  serial: "",
  kind: "snack",
  category: "Snacks",
  photo: null,
});
const app = createApp(
  fixture.store,
  "123456",
  backboardVision(
    process.env.BACKBOARD_API_KEY,
    process.env.BACKBOARD_MODEL ?? "gpt-6-luna",
    "openai",
  ),
  vaultOptions,
);
app.get("/fixture/:version", (_request, response) => {
  response
    .type("png")
    .send(_request.params.version === "fresh" ? fresh : image);
});
const server = app.listen(4311, "127.0.0.1", () =>
  console.log(
    "Isolated live preview on http://localhost:4311, pairing code 123456. Photos and snippets are synthetic test fixtures.",
  ),
);
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () =>
    server.close(async () => {
      await fixture.close();
      process.exit(0);
    }),
  );
