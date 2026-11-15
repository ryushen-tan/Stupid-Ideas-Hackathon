import { z } from "zod";
import { ClothingItem, GarmentKind, photoSchema } from "./model";

export const accountInputSchema = z.discriminatedUnion("method", [
  z.object({ method: z.literal("qr"), uri: z.string().min(1).max(2000) }),
  z.object({
    method: z.literal("manual"),
    issuer: z.string().trim().min(1).max(80),
    label: z.string().trim().min(1).max(120),
    secret: z.string().trim().min(16).max(512),
    algorithm: z.enum(["SHA1", "SHA256", "SHA512"]).default("SHA1"),
    digits: z.union([z.literal(6), z.literal(8)]).default(6),
    period: z.number().int().min(15).max(120).default(30),
  }),
]);
export interface AuthenticatorAccount {
  id: string;
  issuer: string;
  label: string;
  algorithm: "SHA1" | "SHA256" | "SHA512";
  digits: 6 | 8;
  period: number;
  createdAt: string;
}
export interface DailyPiece {
  id: string;
  itemId: string;
  name: string;
  kind: GarmentKind;
  category: ClothingItem["category"];
  position: number;
}
export interface DailyFit {
  id: string;
  day: string;
  expiresAt: number;
  items: DailyPiece[];
}
export interface VaultOverview {
  accounts: AuthenticatorAccount[];
  hasMore: boolean;
  daily: DailyFit | null;
  day: string;
  timezone: string;
  serverTime: number;
}
export interface UnlockChallenge {
  serverTime: number;
  id: string;
  accountId: string;
  expiresAt: number;
  items: (DailyPiece & { matched: boolean })[];
}
export interface UnlockedCode {
  code: string;
  validUntil: number;
  serverTime: number;
}
export const dailyInputSchema = z.object({
  pieces: z
    .array(z.object({ itemId: z.string().min(1), photo: photoSchema }))
    .min(1)
    .max(8),
});
export const proofInputSchema = z.discriminatedUnion("source", [
  z.object({
    source: z.literal("photo"),
    dailyItemId: z.string(),
    photo: photoSchema,
  }),
  z.object({
    source: z.literal("store"),
    dailyItemId: z.string(),
    code: z.string().trim().min(1).max(500),
  }),
]);
