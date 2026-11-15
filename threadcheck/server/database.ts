import { Pool, types } from "pg";
import { randomUUID } from "node:crypto";
import { ClothingItem, ItemInput, ScanRecord, pageSize } from "../shared/model";
import { sampleItems } from "../shared/samples";

types.setTypeParser(20, Number);

export function openDatabase(connectionString: string, schema = "threadcheck") {
  if (!/^[a-z_][a-z0-9_]*$/.test(schema))
    throw new Error("Invalid database schema.");
  const database = new Pool({
    connectionString,
    options: `-c search_path=${schema}`,
    max: 8,
  });
  async function saveItem(item: ClothingItem) {
    await database.query(
      'INSERT INTO items (id,name,brand,barcode,color,size,serial,category,kind,photo,"createdAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
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
    return item;
  }
  return {
    database,
    async seed() {
      const seeded = await database.query(
        "SELECT key FROM metadata WHERE key = 'seeded'",
      );
      if (!seeded.rowCount) {
        for (const item of sampleItems) await saveItem(item);
        await database.query("INSERT INTO metadata VALUES ('seeded','true')");
      }
    },
    createItem(input: ItemInput) {
      return saveItem({
        ...input,
        id: randomUUID(),
        createdAt: new Date().toISOString(),
      });
    },
    async getItem(id: string) {
      return (
        await database.query<ClothingItem>("SELECT * FROM items WHERE id=$1", [
          id,
        ])
      ).rows[0];
    },
    async lookup(barcode: string, serial: string) {
      return (
        await database.query<ClothingItem>(
          "SELECT * FROM items WHERE barcode=$1 AND serial=$2",
          [barcode, serial],
        )
      ).rows[0];
    },
    async listItems(search: string, category: string, offset: number) {
      const items = (
        await database.query<ClothingItem>(
          `SELECT * FROM items WHERE ($1='' OR category=$1) AND ($2='' OR to_tsvector('simple',name || ' ' || brand || ' ' || barcode) @@ plainto_tsquery('simple',$2)) ORDER BY "createdAt" DESC,id LIMIT $3 OFFSET $4`,
          [category, search, pageSize + 1, offset],
        )
      ).rows;
      return {
        items: items.slice(0, pageSize),
        hasMore: items.length > pageSize,
      };
    },
    async saveScan(scan: ScanRecord) {
      await database.query(
        "INSERT INTO scans VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)",
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
          JSON.stringify(scan.observations),
          scan.createdAt,
        ],
      );
      return scan;
    },
    async getScan(id: string) {
      return (
        await database.query<ScanRecord>("SELECT * FROM scans WHERE id=$1", [
          id,
        ])
      ).rows[0];
    },
    async updateScan(scan: ScanRecord) {
      await database.query(
        "UPDATE scans SET photo=$1,explanation=$2,observations=$3 WHERE id=$4",
        [
          scan.photo,
          scan.explanation,
          JSON.stringify(scan.observations),
          scan.id,
        ],
      );
      return scan;
    },
    async listScans(offset: number) {
      const items = (
        await database.query<ScanRecord>(
          'SELECT * FROM scans ORDER BY "createdAt" DESC,id LIMIT $1 OFFSET $2',
          [pageSize + 1, offset],
        )
      ).rows;
      return {
        items: items.slice(0, pageSize),
        hasMore: items.length > pageSize,
      };
    },
  };
}
export type Store = ReturnType<typeof openDatabase>;
