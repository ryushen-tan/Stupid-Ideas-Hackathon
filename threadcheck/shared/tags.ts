export function parseTag(raw: string): { barcode: string; serial: string } {
  const code = raw.trim();
  if (code.startsWith("threadcheck:")) {
    const url = new URL(code);
    if (url.hostname !== "item" || !url.searchParams.get("barcode"))
      throw new Error("This Threadcheck QR code is not an item tag.");
    return {
      barcode: normalizeBarcode(url.searchParams.get("barcode")!),
      serial: url.searchParams.get("serial") ?? "",
    };
  }
  if (/^https?:/.test(code)) {
    const url = new URL(code);
    const parts = url.pathname.split("/");
    const productPosition = parts.indexOf("01");
    const serialPosition = parts.indexOf("21");
    if (productPosition < 0 || !/^\d{14}$/.test(parts[productPosition + 1]))
      throw new Error(
        "Use a product barcode, a Threadcheck QR, or a GS1 Digital Link.",
      );
    return {
      barcode: parts[productPosition + 1],
      serial:
        serialPosition < 0
          ? ""
          : decodeURIComponent(parts[serialPosition + 1] ?? ""),
    };
  }
  return { barcode: normalizeBarcode(code), serial: "" };
}

function normalizeBarcode(barcode: string) {
  return /^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(barcode)
    ? barcode.padStart(14, "0")
    : barcode;
}
