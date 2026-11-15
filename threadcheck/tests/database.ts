import { config } from "dotenv";
import { readFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { openDatabase } from "../server/database";
config({ path: "server/.env", quiet: true });
export const vaultOptions = {
  encryptionKey: Buffer.alloc(32, 7).toString("base64"),
  timezone: "America/Toronto",
};
export async function testDatabase() {
  if (!process.env.DATABASE_URL)
    throw new Error(
      "Start local Supabase and set DATABASE_URL in server/.env to run integration tests.",
    );
  const schema = `test_${randomBytes(6).toString("hex")}`;
  const store = openDatabase(process.env.DATABASE_URL, schema);
  const migration = await readFile(
    new URL(
      "../supabase/migrations/20261115170000_daily_authenticator.sql",
      import.meta.url,
    ),
    "utf8",
  );
  await store.database.query(migration.replaceAll("threadcheck", schema));
  await store.seed();
  return {
    store,
    async close() {
      await store.database.query(`DROP SCHEMA ${schema} CASCADE`);
      await store.database.end();
    },
  };
}
