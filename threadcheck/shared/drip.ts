import { z } from "zod";
import { GarmentKind } from "./model";

export type Outfit = Record<
  "head" | "body" | "feet",
  Extract<GarmentKind, "hoodie" | "pants" | "hat">
>;

export const outfits: Outfit[] = [
  { head: "hoodie", body: "pants", feet: "hat" },
  { head: "hat", body: "hoodie", feet: "pants" },
  { head: "pants", body: "hat", feet: "hoodie" },
];
export const placements = ["head", "body", "feet"] as const;
export const rotationMilliseconds = 30_000;
export const dripRowsSchema = z.array(
  z.object({
    id: z.string(),
    label: z.string(),
    offset: z.number().int().min(0).max(2),
  }),
);
export type DripRow = z.infer<typeof dripRowsSchema>[number];
export const defaultDripRows: DripRow[] = [
  { id: "everyday", label: "Everyday", offset: 0 },
  { id: "going-out", label: "Going out", offset: 1 },
  { id: "after-hours", label: "After hours", offset: 2 },
];

export function currentOutfit(timestamp: number, offset: number) {
  return outfits[
    (Math.floor(timestamp / rotationMilliseconds) + offset) % outfits.length
  ];
}
