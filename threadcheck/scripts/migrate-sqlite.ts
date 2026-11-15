import { config } from "dotenv";
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { openDatabase } from "../server/database";
import { ClothingItem, ScanRecord } from "../shared/model";
config({ path: "server/.env", quiet: true });
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
const store = openDatabase(process.env.DATABASE_URL);
const old = new DatabaseSync("server/data/threadcheck.sqlite", {
  readOnly: true,
});
const transaction = await store.database.connect();
try {
  await transaction.query("BEGIN");
  for (let offset = 0; ; offset += 30) {
    const items = old
      .prepare("SELECT * FROM items ORDER BY id LIMIT 30 OFFSET ?")
      .all(offset) as (ClothingItem & Record<string, string | null>)[];
    for (const item of items)
      await transaction.query(
        "INSERT INTO items VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT DO NOTHING",
        [
          item.id,
          item.name,
          item.brand,
          item.barcode,
          item.color,
          item.size,
          item.serial,
          item.category,
          item.kind,
          item.photo,
          item.createdAt,
        ],
      );
    if (items.length < 30) break;
  }
  for (let offset = 0; ; offset += 30) {
    const scans = old
      .prepare("SELECT * FROM scans ORDER BY id LIMIT 30 OFFSET ?")
      .all(offset) as (Omit<ScanRecord, "observations"> & {
      observations: string;
    } & Record<string, string | null>)[];
    for (const scan of scans)
      await transaction.query(
        "INSERT INTO scans VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT DO NOTHING",
        [
          scan.id,
          scan.itemId,
          scan.itemName,
          scan.kind,
          scan.source,
          scan.code,
          scan.tag,
          scan.photo,
          scan.explanation,
          scan.observations,
          scan.createdAt,
        ],
      );
    if (scans.length < 30) break;
  }
  for (const session of old
    .prepare("SELECT * FROM sessions WHERE expiresAt > ?")
    .all(Date.now()) as { token: string; expiresAt: number }[])
    await transaction.query(
      "INSERT INTO sessions VALUES ($1,$2) ON CONFLICT DO NOTHING",
      [
        createHash("sha256").update(session.token).digest("hex"),
        session.expiresAt,
      ],
    );
  await transaction.query(
    "INSERT INTO metadata VALUES ('seeded','true') ON CONFLICT DO NOTHING",
  );
  await transaction.query("COMMIT");
  console.log(
    "Catalog, history, and active connections migrated to local Supabase. SQLite source retained.",
  );
} catch (error) {
  await transaction.query("ROLLBACK");
  throw error;
} finally {
  transaction.release();
  old.close();
  await store.database.end();
}
