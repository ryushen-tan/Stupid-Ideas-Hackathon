import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { networkInterfaces } from "node:os";
import { createVaultServer } from "./runtime";

config({ path: fileURLToPath(new URL(".env", import.meta.url)), quiet: true });
const { app, store, pairingCode, visionEnabled } = createVaultServer();
await store.seed();
const port = Number(process.env.PORT ?? 4310);
const server = app.listen(port, "0.0.0.0", () => {
  console.log(
    `Threadcheck vault: http://localhost:${port}\nPairing code: ${pairingCode}\nPhoto checks: ${visionEnabled ? "Backboard enabled" : "not configured"}`,
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
