import assert from "node:assert/strict";
import { config } from "dotenv";
import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";
import { backboardVision } from "../server/vision";
import { ClothingItem } from "../shared/model";

config({ path: "server/.env", quiet: true });

async function main() {
  await mkdir("artifacts", { recursive: true });
  const shirt = `<svg width="480" height="480" xmlns="http://www.w3.org/2000/svg"><rect width="480" height="480" fill="white"/><path d="M170 95 110 115 60 200 125 240 145 210V390H335V210L355 240 420 200 370 115 310 95Q240 160 170 95Z" fill="#92c9b1" stroke="#203c3b" stroke-width="8"/><path d="M185 101Q240 160 295 101" fill="none" stroke="#203c3b" stroke-width="8"/><rect x="270" y="200" width="40" height="45" rx="3" fill="#4f759b"/></svg>`;
  const pants = `<svg width="480" height="480" xmlns="http://www.w3.org/2000/svg"><rect width="480" height="480" fill="white"/><path d="M145 65H335L370 420H265L240 215 215 420H110Z" fill="#4f759b" stroke="#203c3b" stroke-width="8"/><path d="M145 120H335M240 120V190" fill="none" stroke="#203c3b" stroke-width="8"/></svg>`;
  const reference = await sharp(Buffer.from(shirt)).png().toBuffer();
  const different = await sharp(Buffer.from(pants)).png().toBuffer();
  await writeFile("artifacts/reference-shirt.png", reference);
  await writeFile("artifacts/different-pants.png", different);
  const item: ClothingItem = {
    id: "vision-fixture",
    name: "Sage tee with blue pocket",
    brand: "Threadcheck Test",
    barcode: "TEST-TEE-SAGE-M",
    color: "Sage green",
    size: "M",
    serial: "",
    kind: "shirt",
    category: "Tops",
    photo: `data:image/png;base64,${reference.toString("base64")}`,
    createdAt: new Date().toISOString(),
  };
  const model = process.env.BACKBOARD_MODEL ?? "gpt-6-luna";
  const compare = backboardVision(
    process.env.BACKBOARD_API_KEY!,
    model,
    "openai",
  );
  const same = await compare(item, item.photo!);
  console.log("Same garment:", same);
  assert.equal(same.verdict, "consistent");
  const mismatch = await compare(
    item,
    `data:image/png;base64,${different.toString("base64")}`,
  );
  console.log("Different garment:", mismatch);
  assert.equal(mismatch.verdict, "mismatch");
  await writeFile(
    "artifacts/vision-smoke.json",
    JSON.stringify({ model, same, mismatch }, null, 2),
  );
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
