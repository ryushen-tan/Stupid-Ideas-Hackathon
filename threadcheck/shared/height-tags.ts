// Drip hardware clothing tags (Pico + e-ink + depth sensor).
// Their barcode is 8 digits: a 5-digit garment ID + the garment's current height in cm (3 digits).
//   hoodie 10000xxx · pants 20000xxx · hat 30000xxx      xxx = 999 means "no height sensor"
// The scanner carries the height into Drip, so the tag needs no wireless link.
import { placements } from "./drip";
import { parseTag } from "./tags";

type Placement = (typeof placements)[number];

// Calibrated on the demo stand (hat ~46 cm, shirt ~20 cm). Same values as hardware/pico/config.py.
export const heightRangesCm: Record<Placement, [number, number]> = {
  head: [33, 100],
  body: [12, 33],
  feet: [0, 12],
};
export const noHeightSensor = 999;

export function heightTag(raw: string): { id: string; heightCm: number } | null {
  const code = raw.trim();
  if (!/^[123]0000\d{3}$/.test(code)) return null;
  return { id: code.slice(0, 5), heightCm: Number(code.slice(5)) };
}

/** Same physical clothing tag? Hardware tags compare by garment ID only (the height digits change). */
export function sameClothingTag(a: string, b: string): boolean {
  const tagA = heightTag(a);
  const tagB = heightTag(b);
  if (tagA && tagB) return tagA.id === tagB.id;
  const parsedA = parseTag(a);
  const parsedB = parseTag(b);
  return parsedA.barcode === parsedB.barcode && parsedA.serial === parsedB.serial;
}

/** Why this height is wrong for the placement, or null when it's fine. */
export function heightProblem(
  garment: string,
  heightCm: number,
  placement: Placement,
): string | null {
  if (heightCm === noHeightSensor) return null;
  if (garment === "pants") return null; // pants tag has no working sensor: always accepted
  const [low, high] = heightRangesCm[placement];
  if (heightCm >= low && heightCm <= high) return null;
  return `Your ${garment} is at ${heightCm} cm, but it goes on the ${placement} (${low}–${high} cm). Move it, wait for the tag to update, and scan again.`;
}
