import dotenv from "dotenv";
import { Buffer } from "node:buffer";
import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";

dotenv.config({ path: "server/.env", quiet: true });
const descriptions = {
  hoodie:
    "An oversized washed ivory Stüssy-inspired pullover streetwear hoodie, thick cotton fleece, large clearly visible hood, long dropped sleeves, ribbed cuffs and hem, roomy kangaroo pocket, chunky black hand-drawn graffiti DRIP wordmark across the chest, small black eight-ball graphic below. Front view, entire hood and both sleeves visible.",
  shirt:
    "An oversized washed ivory Stüssy-inspired streetwear T-shirt, short dropped sleeves, chunky black hand-drawn graffiti DRIP wordmark across the chest, small black eight-ball graphic below. Front view.",
  pants:
    "A pair of baggy washed indigo Carhartt-inspired double-knee carpenter jeans. Very wide straight legs, visible golden contrast stitching, double-knee panels, hammer loop, small tan square workwear patch, softly worn pale blue highlights. Front view, legs slightly separated, complete waistband and both hems visible.",
  hat: "A washed sage green streetwear six-panel baseball cap with a cream embroidered DRIP graffiti wordmark, curved brim, visible cream topstitching, small fabric creases. Three-quarter front view with the entire brim visible.",
};
const kind = process.argv[2];
if (!Object.hasOwn(descriptions, kind))
  throw new Error("Choose hoodie, shirt, pants, or hat.");
if (!process.env.BACKBOARD_API_KEY)
  throw new Error("BACKBOARD_API_KEY is missing from server/.env.");
const prompt = `Create ONE isolated clothing asset for a streetwear outfit authenticator app. ${descriptions[kind]} Garment alone, unworn, no person, mannequin, hanger, hands or extra objects. High-end playful 3D cartoon product illustration with soft fabric folds, tactile fabric, crisp silhouette, restrained cel shading. Readable at 72px. Centered, fills 85 percent of a square image with clear padding on every side. Background must be a completely uniform solid exact hex #131314, no gradient, no floor, no shadow outside garment, no frame. One garment only.`;
const model = "openai/gpt-image-2";
const form = new FormData();
form.set("operation", "generate_image");
form.set("image_model_provider", "openrouter");
form.set("image_model_name", model);
form.set(
  "image_config",
  JSON.stringify({ background: "opaque", output_format: "png" }),
);
form.set("content", prompt);
const response = await fetch("https://app.backboard.io/api/threads/messages", {
  method: "POST",
  headers: { "X-API-Key": process.env.BACKBOARD_API_KEY },
  body: form,
  signal: AbortSignal.timeout(300_000),
});
const body = await response.json();
await mkdir("artifacts/streetwear", { recursive: true });
await writeFile(
  `artifacts/streetwear/${kind}-response.json`,
  JSON.stringify(body, null, 2),
);
if (!response.ok)
  throw new Error(`Backboard ${response.status}: ${JSON.stringify(body)}`);
const media = body.generated_media.find(
  (entry) => entry.media_type === "image",
);
if (!media) throw new Error("Backboard completed without generating an image.");
const download = await fetch(media.url, {
  signal: AbortSignal.timeout(60_000),
});
if (!download.ok) throw new Error(`Image download failed: ${download.status}`);
const bytes = Buffer.from(await download.arrayBuffer());
await mkdir("assets/streetwear", { recursive: true });
await writeFile(`artifacts/streetwear/${kind}-original.png`, bytes);
await sharp(bytes)
  .resize(320, 320, { fit: "contain", background: "#131314" })
  .png()
  .toFile(`assets/streetwear/${kind}.png`);
console.log(`Saved assets/streetwear/${kind}.png using ${body.model_name}`);
await writeFile(
  `artifacts/streetwear/${kind}-prompt.json`,
  JSON.stringify({ model, prompt }, null, 2),
);
