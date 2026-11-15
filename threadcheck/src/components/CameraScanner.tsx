import { useRef, useState } from "react";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Linking, StyleSheet, Text, View } from "react-native";
import { Button, common, Notice } from "./UI";
import { Garment } from "./Garment";
import { palette } from "../theme";

export function CameraScanner({
  onCode,
  purpose = "item",
}: {
  onCode: (code: string) => void;
  purpose?: "item" | "account";
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const [error, setError] = useState("");
  const [torch, setTorch] = useState(false);
  const scanned = useRef(false);
  if (!permission?.granted)
    return (
      <View style={[common.card, { alignItems: "center", gap: 15 }]}>
        <Garment kind="shirt" badge="qr" size={110} />
        <Text style={common.sectionTitle}>A little camera magic</Text>
        <Text style={[common.subtitle, { textAlign: "center" }]}>
          {purpose === "account"
            ? "Allow camera access, then point at your account’s authenticator setup QR."
            : "Allow camera access, then point your phone at the clothing tag."}
        </Text>
        {Boolean(error) && <Notice error>{error}</Notice>}
        <Button
          label={
            permission && !permission.canAskAgain
              ? "Open camera settings"
              : "Enable camera"
          }
          badge="camera"
          onPress={async () => {
            try {
              if (permission && !permission.canAskAgain)
                await Linking.openSettings();
              else {
                const result = await requestPermission();
                if (!result.granted)
                  setError(
                    purpose === "account"
                      ? "Camera access was denied. You can enter the setup key instead."
                      : "Camera access was denied. You can still use a store scanner or enter the tag.",
                  );
              }
            } catch (failure) {
              setError((failure as Error).message);
            }
          }}
        />
      </View>
    );
  return (
    <View style={{ gap: 12 }}>
      <View style={styles.camera}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          enableTorch={torch}
          barcodeScannerSettings={{
            barcodeTypes: [
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
        <View pointerEvents="none" style={styles.frame} />
        <View pointerEvents="none" style={styles.caption}>
          <Text style={{ color: "white" }}>
            Keep the whole tag inside the frame
          </Text>
        </View>
      </View>
      {Boolean(error) && <Notice error>{error}</Notice>}
      <Button
        label={torch ? "Turn light off" : "Turn light on"}
        badge="camera"
        tone="secondary"
        small
        onPress={() => setTorch(!torch)}
      />
    </View>
  );
}
const styles = StyleSheet.create({
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
