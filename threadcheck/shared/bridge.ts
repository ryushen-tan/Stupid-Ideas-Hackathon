import { z } from "zod";
import { fitImagesSchema, fitSlots } from "./daily-fit";
import { Outfit } from "./drip";
import { parseTag } from "./tags";

export const clothingBarcodesStorageKey = "drip-clothing-barcodes-v2";
export const hardwareClothingBarcodes = {
  top: "10000017",
  pants: "20000024",
  hat: "30000031",
} satisfies Record<(typeof fitSlots)[number], string>;
export const garmentSlot: Record<Outfit["head"], (typeof fitSlots)[number]> = {
  hoodie: "top",
  pants: "pants",
  hat: "hat",
};
export const clothingBarcodeSchema = z
  .string()
  .trim()
  .min(1)
  .max(2048)
  .transform((code, context) => {
    try {
      return parseTag(code);
    } catch (failure) {
      context.addIssue({
        code: "custom",
        message:
          failure instanceof Error
            ? failure.message
            : "Invalid clothing barcode.",
      });
      return z.NEVER;
    }
  });
const barcodeTextSchema = z
  .string()
  .trim()
  .min(1, "Scan all three clothing barcodes first.")
  .max(2048);
export const clothingBarcodesSchema = z
  .object({
    top: barcodeTextSchema,
    pants: barcodeTextSchema,
    hat: barcodeTextSchema,
  })
  .superRefine((barcodes, context) => {
    const identities = new Set<string>();
    for (const slot of fitSlots) {
      const parsed = clothingBarcodeSchema.safeParse(barcodes[slot]);
      if (!parsed.success) {
        context.addIssue({
          code: "custom",
          path: [slot],
          message: parsed.error.issues[0].message,
        });
        continue;
      }
      const identity = JSON.stringify(parsed.data);
      if (identities.has(identity))
        context.addIssue({
          code: "custom",
          path: [slot],
          message: "Each clothing item needs a different barcode.",
        });
      identities.add(identity);
    }
  });
export type ClothingBarcodes = z.infer<typeof clothingBarcodesSchema>;

export const browserOriginSchema = z.url().refine((value) => {
  const url = new URL(value);
  return ["http:", "https:"].includes(url.protocol) && url.origin === value;
}, "Use a website origin.");
export const bridgeSetupSchema = z.object({
  accountId: z.string().min(1).max(100),
  issuer: z.string().min(1).max(80),
  label: z.string().min(1).max(120),
  outfitIndex: z.number().int().min(0).max(2),
  items: fitImagesSchema,
  barcodes: clothingBarcodesSchema,
});
export type BridgeSetup = z.infer<typeof bridgeSetupSchema>;
export interface BrowserRequest {
  id: string;
  browserName: string;
  origin: string;
  expiresAt: number;
  status:
    "pending" | "prepared" | "verified" | "ready" | "delivered" | "rejected";
  setup: BridgeSetup | null;
  matchedCount: number;
}
export interface BrowserConnection {
  id: string;
  name: string;
}
export interface BrowserInbox {
  browsers: BrowserConnection[];
  requests: BrowserRequest[];
}
