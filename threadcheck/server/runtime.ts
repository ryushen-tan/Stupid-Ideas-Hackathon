import { openDatabase } from "./database";
import { createApp } from "./app";
import { backboardVision } from "./vision";
import { backboardFit } from "./fit";

export function createVaultServer() {
  const pairingCode = process.env.PAIRING_CODE;
  if (!pairingCode || !/^\d{6}$/.test(pairingCode))
    throw new Error("Set a six-digit PAIRING_CODE.");
  if (!process.env.DATABASE_URL || !process.env.VAULT_ENCRYPTION_KEY)
    throw new Error("Set DATABASE_URL and VAULT_ENCRYPTION_KEY.");
  const store = openDatabase(
    process.env.DATABASE_URL,
    "threadcheck",
    process.env.DATABASE_SSL_CA,
  );
  const model = process.env.BACKBOARD_MODEL ?? "gpt-6-luna";
  const provider = process.env.BACKBOARD_PROVIDER ?? "openai";
  const comparePhotos = process.env.BACKBOARD_API_KEY
    ? backboardVision(process.env.BACKBOARD_API_KEY, model, provider)
    : null;
  const app = createApp(
    store,
    pairingCode,
    comparePhotos,
    {
      encryptionKey: process.env.VAULT_ENCRYPTION_KEY,
      timezone: process.env.VAULT_TIMEZONE ?? "America/Toronto",
    },
    process.env.BACKBOARD_API_KEY
      ? backboardFit(process.env.BACKBOARD_API_KEY, model, provider)
      : null,
    process.env.BROWSER_DEMO_AUTO_CONNECT === "true",
  );
  return { app, store, pairingCode, visionEnabled: Boolean(comparePhotos) };
}
