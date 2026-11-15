import { z } from "zod";
import { photoSchema } from "./model";

export const fitSlots = ["top", "pants", "hat"] as const;
export const fitItemSchema = z.object({
  name: z.string().min(1).max(100),
  photo: photoSchema,
});
export const fitImagesSchema = z.object({
  top: fitItemSchema,
  pants: fitItemSchema,
  hat: fitItemSchema,
});
export const savedFitSchema = z.object({
  day: z.string(),
  items: fitImagesSchema,
});
export type FitImages = z.infer<typeof fitImagesSchema>;
export type SavedFit = z.infer<typeof savedFitSchema>;
export const dailyFitStorageKey = "drip-daily-fit";

export function localDay(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
