import { useRef, useState } from "react";
import { Platform } from "react-native";

// iOS doesn't let apps list USB/Bluetooth keyboards, and a keyboard-mode barcode
// scanner is just a keyboard. So we recognise it by how it types: a whole code
// in a few milliseconds per character, then Enter. No person types that fast.
const MIN_LENGTH = 4;
const MAX_MS_PER_CHAR = 60;

// Shared across screens: once the scanner has typed, it's plugged in.
let detectedAt = 0;

export function useScannerDetection() {
  const [detected, setDetected] = useState(detectedAt > 0);
  const startedAt = useRef(0);
  return {
    detected,
    // Call from onChangeText: notes when the current code started arriving.
    track(text: string) {
      if (text.length <= 1 || !startedAt.current)
        startedAt.current = Date.now();
      if (!text) startedAt.current = 0;
    },
    // Call from onSubmitEditing (the scanner's Enter).
    submitted(text: string) {
      const elapsed = Date.now() - startedAt.current;
      startedAt.current = 0;
      const length = text.trim().length;
      if (length >= MIN_LENGTH && elapsed / length <= MAX_MS_PER_CHAR) {
        detectedAt = Date.now();
        setDetected(true);
      }
    },
  };
}

// Props every scanner field needs on iPhone: no soft keyboard, no autocorrect
// or smart punctuation rewriting the code, and keep focus after Enter so the
// next scan lands in the same field.
export const scannerInputProps = {
  showSoftInputOnFocus: false,
  autoCorrect: false,
  autoCapitalize: "none",
  autoComplete: "off",
  spellCheck: false,
  smartInsertDelete: false,
  textContentType: "none",
  submitBehavior: "submit",
  // react-native-web ignores submitBehavior and blurs on Enter unless this is
  // false, which would drop every scan after the first in Safari.
  ...(Platform.OS === "web" ? ({ blurOnSubmit: false } as object) : {}),
} as const;
