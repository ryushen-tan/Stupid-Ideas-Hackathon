import sharp from "sharp";
import { readFile } from "node:fs/promises";

const icon = await readFile(new URL("../assets/icon.svg", import.meta.url));
await sharp(icon).resize(1024, 1024).png().toFile("assets/icon.png");
await sharp(icon).resize(64, 64).png().toFile("assets/favicon.png");
await sharp(icon)
  .resize(432, 432)
  .png()
  .toFile("assets/android-icon-foreground.png");
