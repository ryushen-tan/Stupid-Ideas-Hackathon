import { dripColors } from "../drip-theme";
import { useRef, useState } from "react";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Button, common } from "./UI";
import { Garment } from "./Garment";
import { palette } from "../theme";

export function CameraScanner({
  onCode,
  purpose = "item",
  compact = false,
}: {
  onCode: (code: string) => void;
  purpose?: "item" | "account";
  compact?: boolean;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const [error, setError] = useState("");
  const [torch, setTorch] = useState(false);
  const scanned = useRef(false);
  async function enableCamera() {
    try {
      if (permission && !permission.canAskAgain) await Linking.openSettings();
      else {
        const result = await requestPermission();
        if (!result.granted)
          setError(
            purpose === "account"
              ? "Camera access was denied. Enter the setup key instead."
              : "Camera access was denied. Use a store scanner or enter the tag.",
          );
      }
    } catch (failure) {
      setError((failure as Error).message);
    }
  }
  if (!permission?.granted)
    return (
      <View
        style={
          compact
            ? styles.square
            : [common.card, { alignItems: "center", gap: 15 }]
        }
      >
        {compact ? (
          <View
            pointerEvents="none"
            style={[styles.frame, styles.squareFrame]}
          />
        ) : (
          <>
            <Garment kind="shirt" badge="qr" size={110} />
            <Text style={common.sectionTitle}>A little camera magic</Text>
            <Text style={[common.subtitle, { textAlign: "center" }]}>
              {purpose === "account"
                ? "Allow camera access to scan a setup QR."
                : "Allow camera access, then point your phone at the clothing tag."}
            </Text>
          </>
        )}
        {Boolean(error) && (
          <Text
            accessibilityRole="alert"
            style={{ color: dripColors.error, padding: 16 }}
          >
            {error}
          </Text>
        )}
        {compact ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => void enableCamera()}
            style={styles.permissionButton}
          >
            <Text style={styles.permissionText}>
              {permission && !permission.canAskAgain
                ? "Open camera settings"
                : "Enable camera"}
            </Text>
          </Pressable>
        ) : (
          <Button
            label={
              permission && !permission.canAskAgain
                ? "Open camera settings"
                : "Enable camera"
            }
            badge="camera"
            onPress={() => void enableCamera()}
          />
        )}
      </View>
    );
  return (
    <View style={{ gap: 12 }}>
      <View style={compact ? styles.square : styles.camera}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          enableTorch={torch}
          barcodeScannerSettings={{
            barcodeTypes:
              purpose === "account"
                ? ["qr"]
                : [
                    "qr",
                    "ean13",
                    "ean8",
                    "upc_a",
                    "code128",
                    "code39",
                    "pdf417",
                    "datamatrix",
                  ],
          }}
          onMountError={(event) => setError(event.message)}
          onBarcodeScanned={({ data }) => {
            if (!scanned.current) {
              scanned.current = true;
              onCode(data);
            }
          }}
        />
        <View
          pointerEvents="none"
          style={[styles.frame, compact && styles.squareFrame]}
        />
        {!compact && (
          <View pointerEvents="none" style={styles.caption}>
            <Text style={{ color: "white" }}>
              {purpose === "account"
                ? "Keep the setup QR code inside the frame"
                : "Keep the whole tag inside the frame"}
            </Text>
          </View>
        )}
      </View>
      {Boolean(error) && (
        <Text accessibilityRole="alert" style={{ color: dripColors.error }}>
          {error}
        </Text>
      )}
      {!compact && (
        <Button
          label={torch ? "Turn light off" : "Turn light on"}
          badge="camera"
          tone="secondary"
          small
          onPress={() => setTorch(!torch)}
        />
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  square: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: dripColors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  squareFrame: {
    position: "absolute",
    width: "78%",
    height: "78%",
    borderColor: dripColors.blue,
    borderWidth: 2,
    borderRadius: 16,
  },
  permissionButton: {
    padding: 16,
    borderRadius: 24,
    backgroundColor: dripColors.blue,
  },
  permissionText: {
    color: dripColors.background,
    fontSize: 14,
    fontWeight: "600",
  },
  camera: {
    height: 320,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: palette.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  frame: {
    width: "76%",
    height: 170,
    borderWidth: 3,
    borderColor: palette.lime,
    borderRadius: 22,
  },
  caption: {
    position: "absolute",
    bottom: 20,
    borderRadius: 12,
    backgroundColor: "#203C3BBF",
    padding: 10,
  },
});
