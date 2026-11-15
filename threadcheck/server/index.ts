import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { networkInterfaces } from "node:os";
import { openDatabase } from "./database";
import { createApp } from "./app";
import { backboardVision } from "./vision";
import { backboardFit } from "./fit";

config({ path: fileURLToPath(new URL(".env", import.meta.url)), quiet: true });
const pairingCode = process.env.PAIRING_CODE;
if (!pairingCode || !/^\d{6}$/.test(pairingCode))
  throw new Error("Set a six-digit PAIRING_CODE in server/.env.");
if (!process.env.DATABASE_URL || !process.env.VAULT_ENCRYPTION_KEY)
  throw new Error("Set DATABASE_URL and VAULT_ENCRYPTION_KEY in server/.env.");
const store = openDatabase(process.env.DATABASE_URL);
await store.seed();
const comparePhotos = process.env.BACKBOARD_API_KEY
  ? backboardVision(
      process.env.BACKBOARD_API_KEY,
      process.env.BACKBOARD_MODEL ?? "gpt-6-luna",
      process.env.BACKBOARD_PROVIDER ?? "openai",
    )
  : null;
const port = Number(process.env.PORT ?? 4310);
const server = createApp(
  store,
  pairingCode,
  comparePhotos,
  {
    encryptionKey: process.env.VAULT_ENCRYPTION_KEY,
    timezone: process.env.VAULT_TIMEZONE ?? "America/Toronto",
  },
  process.env.BACKBOARD_API_KEY
    ? backboardFit(
        process.env.BACKBOARD_API_KEY,
        process.env.BACKBOARD_MODEL ?? "gpt-6-luna",
        process.env.BACKBOARD_PROVIDER ?? "openai",
      )
    : null,
).listen(port, "0.0.0.0", () => {
  console.log(
    `Threadcheck vault: http://localhost:${port}\nPairing code: ${pairingCode}\nPhoto checks: ${comparePhotos ? "Backboard enabled" : "not configured"}`,
  );
  for (const network of Object.values(networkInterfaces())) {
    for (const address of network ?? []) {
      if (address.family === "IPv4" && !address.internal)
        console.log(`Phone connection: http://${address.address}:${port}`);
    }
  }
});
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () =>
    server.close(async () => {
      await store.database.end();
      process.exit(0);
    }),
  );
}
