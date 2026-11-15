import { z } from "zod";

export const categories = [
  "Tops",
  "Bottoms",
  "Accessories",
  "Shoes",
  "Snacks",
] as const;
export const garmentKinds = [
  "shirt",
  "hoodie",
  "pants",
  "hat",
  "bag",
  "shoe",
  "can",
  "snack",
] as const;
export type GarmentKind = (typeof garmentKinds)[number];
export const photoSchema = z
  .string()
  .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/)
  .max(8_000_000);
export const itemInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  brand: z.string().trim().min(1).max(60),
  barcode: z.string().trim().min(1).max(160),
  color: z.string().trim().min(1).max(40),
  size: z.string().trim().min(1).max(20),
  serial: z.string().trim().max(80).default(""),
  category: z.enum(categories),
  kind: z.enum(garmentKinds),
  photo: photoSchema.nullable(),
});
export type ItemInput = z.infer<typeof itemInputSchema>;
export interface ClothingItem extends ItemInput {
  id: string;
  createdAt: string;
}
export type ScanSource = "camera" | "store" | "manual" | "photo";
export const scanInputSchema = z.object({
  code: z.string().trim().min(1).max(500),
  source: z.enum(["camera", "store", "manual"]),
  expectedItemId: z.string().optional(),
});
export type ScanInput = z.infer<typeof scanInputSchema>;
export const visionSchema = z.object({
  verdict: z.enum(["consistent", "mismatch", "uncertain"]),
  explanation: z.string().min(1).max(1000),
  observations: z.array(z.string().max(200)).min(1).max(5),
});
export type VisualReview = z.infer<typeof visionSchema>;
export interface ScanRecord {
  id: string;
  itemId: string | null;
  itemName: string;
  kind: GarmentKind;
  source: ScanSource;
  code: string;
  tag: "matched" | "mismatch" | "not_found" | "not_scanned";
  photo: "pending" | VisualReview["verdict"];
  explanation: string;
  observations: string[];
  createdAt: string;
}
export interface StoreSession {
  url: string;
  token: string;
}
export interface StoreStatus {
  name: string;
  visionEnabled: boolean;
}
export interface ApiError {
  error: string;
}
export interface Page<T> {
  items: T[];
  hasMore: boolean;
}
export const pageSize = 30;

export function scanLabel(scan: ScanRecord) {
  if (scan.tag === "not_found") return "Unknown tag";
  if (scan.tag === "mismatch" || scan.photo === "mismatch")
    return "Doesn’t match";
  if (scan.tag === "matched" && scan.photo === "consistent")
    return "Both checks passed";
  if (scan.photo === "uncertain") return "Needs a closer look";
  if (scan.tag === "matched") return "Tag matched";
  return scan.photo === "consistent" ? "Looks consistent" : "Photo check";
}
