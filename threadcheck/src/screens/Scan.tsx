import { ComponentRef, useRef, useState } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { ClothingItem, ScanRecord, StoreSession } from "../../shared/model";
import { request } from "../api";
import { CameraScanner } from "../components/CameraScanner";
import { Garment } from "../components/Garment";
import { Button, common, Notice } from "../components/UI";
import { fonts, palette } from "../theme";
import { pickPhoto } from "../photos";

export type ScanMode = "camera" | "store" | "photo";

export function Scan({
  session,
  expected,
  onChoose,
  onResult,
  onConnect,
  mode,
  onModeChange,
}: {
  session: StoreSession | null;
  expected: ClothingItem | null;
  onChoose: () => void;
  onResult: (result: ScanRecord) => void;
  onConnect: () => void;
  mode: ScanMode;
  onModeChange: (mode: ScanMode) => void;
}) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cameraKey, setCameraKey] = useState(0);
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const pending = useRef(false);
  async function scan(value: string, source: "camera" | "store" | "manual") {
    if (!session || pending.current) return;
    if (!value.trim()) {
      setError("Scan or enter a tag first.");
      return;
    }
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      onResult(
        await request<ScanRecord>(session, "/scans", {
          method: "POST",
          body: JSON.stringify({
            code: value,
            source,
            expectedItemId: expected?.id,
          }),
        }),
      );
    } catch (failure) {
      setError((failure as Error).message);
      setCameraKey((value) => value + 1);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  async function compare(camera: boolean) {
    if (!session || !expected) return;
    setBusy(true);
    setError("");
    try {
      const photo = await pickPhoto(camera);
      if (photo)
        onResult(
          await request<ScanRecord>(session, "/photo-checks", {
            method: "POST",
            body: JSON.stringify({ itemId: expected.id, photo }),
          }),
        );
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={common.stack}>
      <Text style={common.eyebrow}>LET’S GET TO KNOW THAT TAG</Text>
      <Text style={common.title}>Same piece? Check it.</Text>
      <Text style={common.subtitle}>
        Start with the tag. Follow with a photo for a second look.
      </Text>
      {!session ? (
        <View style={[common.card, { gap: 15, alignItems: "center" }]}>
          <Garment kind="bag" badge="settings" size={110} />
          <Text style={common.sectionTitle}>Meet your store first</Text>
          <Text style={[common.subtitle, { textAlign: "center" }]}>
            Connect once to access the same catalog on your phone and your store
            scanner.
          </Text>
          <Button
            label="Connect your store"
            kind="bag"
            badge="settings"
            onPress={onConnect}
          />
        </View>
      ) : (
        <>
          <View style={styles.modes}>
            {(
              [
                {
                  value: "camera",
                  label: "Phone camera",
                  kind: "shirt",
                  badge: "qr",
                },
                {
                  value: "store",
                  label: "Store scanner",
                  kind: "hoodie",
                  badge: "qr",
                },
                {
                  value: "photo",
                  label: "Photo check",
                  kind: "hat",
                  badge: "camera",
                },
              ] as const
            ).map((option) => (
              <Pressable
                key={option.value}
                accessibilityRole="button"
                accessibilityState={{ selected: mode === option.value }}
                disabled={busy}
                onPress={() => {
                  onModeChange(option.value);
                  setError("");
                }}
                style={[
                  styles.mode,
                  mode === option.value && styles.activeMode,
                ]}
              >
                <Garment
                  kind={option.kind}
                  badge={option.badge}
                  size={54}
                  color={mode === option.value ? palette.lime : palette.sage}
                />
                <Text style={styles.modeLabel}>{option.label}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Choose an expected item"
            onPress={onChoose}
            style={[common.card, common.row, { padding: 14 }]}
          >
            <Garment
              kind={expected?.kind ?? "shirt"}
              size={45}
              badge={expected ? "check" : "plus"}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.modeLabel}>
                {expected
                  ? `Checking: ${expected.name}`
                  : "Looking for a specific piece?"}
              </Text>
              <Text style={common.subtitle}>
                {expected
                  ? `${expected.color} · ${expected.size} · Tap to change`
                  : "Choose a piece to check against  ›"}
              </Text>
            </View>
          </Pressable>
          {Boolean(error) && <Notice error>{error}</Notice>}
          {mode === "camera" && (
            <>
              <CameraScanner
                key={cameraKey}
                onCode={(value) => void scan(value, "camera")}
              />
              <Text
                style={[common.subtitle, { textAlign: "center", fontSize: 12 }]}
              >
                QR, UPC, EAN and common retail barcodes
              </Text>
            </>
          )}
          {mode === "store" && (
            <View style={[common.card, { gap: 18 }]}>
              <Text style={common.sectionTitle}>
                Ready when your scanner is.
              </Text>
              <Text style={common.subtitle}>
                Pair your Bluetooth scanner in device settings, or plug in a USB
                scanner. Set it to keyboard / HID mode with an Enter suffix.
              </Text>
              <View style={styles.scannerReady}>
                <View style={styles.dot} />
                <Text style={styles.modeLabel}>
                  Focus the field, then scan a tag
                </Text>
              </View>
              <TextInput
                ref={input}
                accessibilityLabel="Store scanner input"
                autoFocus
                placeholder="Scan a clothing barcode…"
                placeholderTextColor={palette.muted}
                value={code}
                onChangeText={setCode}
                editable={!busy}
                showSoftInputOnFocus={false}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="go"
                onSubmitEditing={() => void scan(code, "store")}
                style={styles.input}
              />
              <Button
                label="Listen for a scan"
                kind="hoodie"
                badge="qr"
                tone="secondary"
                onPress={() => input.current?.focus()}
                disabled={busy}
                small
              />
              <Button
                label="Check scanned tag"
                badge="check"
                loading={busy}
                disabled={!code.trim()}
                onPress={() => void scan(code, "store")}
              />
              <Text style={[common.subtitle, { fontSize: 12 }]}>
                No special Bluetooth app connection is needed for keyboard-mode
                scanners.
              </Text>
            </View>
          )}
          {mode === "photo" && (
            <View style={[common.card, { gap: 16, alignItems: "center" }]}>
              <Garment kind="hat" badge="camera" size={110} />
              <Text style={common.sectionTitle}>Give it a second look</Text>
              <Text style={[common.subtitle, { textAlign: "center" }]}>
                Compare a new photo with the selected item’s saved reference.
                Include its color, logo, and shape in good light.
              </Text>
              {!expected ? (
                <Button
                  label="Choose a piece"
                  kind="hat"
                  badge="search"
                  onPress={onChoose}
                />
              ) : (
                <>
                  {!expected.photo && (
                    <Notice>
                      This piece needs a reference photo. Open it in your
                      wardrobe to add one.
                    </Notice>
                  )}
                  <Button
                    label="Choose a photo"
                    kind="hat"
                    badge="camera"
                    disabled={!expected.photo}
                    loading={busy}
                    onPress={() => void compare(false)}
                  />
                  {Platform.OS !== "web" && (
                    <Button
                      label="Take a photo"
                      badge="camera"
                      tone="secondary"
                      disabled={!expected.photo}
                      loading={busy}
                      onPress={() => void compare(true)}
                    />
                  )}
                </>
              )}
              <Text
                style={[common.subtitle, { fontSize: 12, textAlign: "center" }]}
              >
                Photos are sent to Backboard for comparison. A photo check
                cannot prove size, authenticity, or individual identity.
              </Text>
            </View>
          )}
          {mode === "camera" && (
            <View style={[common.card, { gap: 12 }]}>
              <Text style={common.sectionTitle}>
                Tag playing hide-and-seek?
              </Text>
              <TextInput
                accessibilityLabel="Manual barcode"
                placeholder="Enter its barcode instead"
                placeholderTextColor={palette.muted}
                value={code}
                onChangeText={setCode}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!busy}
                onSubmitEditing={() => void scan(code, "manual")}
                style={styles.input}
              />
              <Button
                label="Check this tag"
                badge="check"
                tone="secondary"
                loading={busy}
                disabled={!code.trim()}
                onPress={() => void scan(code, "manual")}
              />
            </View>
          )}
        </>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  modes: { flexDirection: "row", gap: 9 },
  mode: {
    flex: 1,
    alignItems: "center",
    gap: 7,
    padding: 10,
    borderWidth: 1.5,
    borderColor: palette.line,
    backgroundColor: palette.white,
    borderRadius: 20,
  },
  activeMode: { borderColor: palette.ink, backgroundColor: palette.paleGreen },
  modeLabel: { fontFamily: fonts.bold, fontSize: 12, color: palette.ink },
  input: {
    backgroundColor: palette.background,
    borderWidth: 1.5,
    borderColor: palette.line,
    padding: 15,
    borderRadius: 15,
    color: palette.ink,
    fontFamily: fonts.medium,
    fontSize: 15,
  },
  scannerReady: { flexDirection: "row", gap: 9, alignItems: "center" },
  dot: { width: 8, height: 8, borderRadius: 8, backgroundColor: palette.blue },
});
