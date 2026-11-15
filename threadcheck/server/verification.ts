import { randomUUID } from "node:crypto";
import { ClothingItem, ScanInput, ScanRecord } from "../shared/model";
import { Store } from "./database";

import { parseTag } from "../shared/tags";

export async function verifyTag(
  store: Store,
  input: ScanInput,
): Promise<ScanRecord> {
  const identity = parseTag(input.code);
  const scannedItem = await store.lookup(identity.barcode, identity.serial);
  const expectedItem = input.expectedItemId
    ? await store.getItem(input.expectedItemId)
    : undefined;
  if (input.expectedItemId && !expectedItem)
    throw new Error("The selected item no longer exists.");
  const item = expectedItem ?? scannedItem;
  const tag = !scannedItem
    ? "not_found"
    : expectedItem && expectedItem.id !== scannedItem.id
      ? "mismatch"
      : "matched";
  const explanation =
    tag === "matched"
      ? `The tag matches ${scannedItem!.name}, ${scannedItem!.color}, size ${scannedItem!.size}. ${scannedItem!.serial ? "The registered serial number matches too." : "This identifies the product variant, not a unique physical garment."}`
      : tag === "mismatch"
        ? `This tag belongs to ${scannedItem!.name} (${scannedItem!.color}, ${scannedItem!.size}), not the selected item.`
        : "This exact tag is not in your store catalog. Register it before checking it.";
  return store.saveScan({
    id: randomUUID(),
    itemId: item?.id ?? null,
    itemName: item?.name ?? "Unrecognized item",
    kind: item?.kind ?? "shirt",
    source: input.source,
    code: input.code,
    tag,
    photo: "pending",
    explanation,
    observations: [],
    createdAt: new Date().toISOString(),
  });
}

export function createPhotoScan(item: ClothingItem): ScanRecord {
  return {
    id: randomUUID(),
    itemId: item.id,
    itemName: item.name,
    kind: item.kind,
    source: "photo",
    code: "",
    tag: "not_scanned",
    photo: "pending",
    explanation:
      "A photo can compare appearance. Scan the tag to check the product identity.",
    observations: [],
    createdAt: new Date().toISOString(),
  };
}
