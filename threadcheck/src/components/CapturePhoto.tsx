import { useRef, useState } from "react";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Platform, Text, View } from "react-native";
import { Button, common, Notice } from "./UI";

export function CapturePhoto({
  onPhoto,
}: {
  onPhoto: (photo: string) => void;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function capture() {
    setBusy(true);
    setError("");
    try {
      if (!camera.current) throw new Error("The camera isn’t ready yet.");
      const photo = await camera.current.takePictureAsync({
        quality: 0.5,
        base64: true,
      });
      if (!photo.base64)
        throw new Error("No image was captured. Please try again.");
      onPhoto(
        Platform.OS === "web"
          ? photo.uri
          : `data:image/jpeg;base64,${photo.base64}`,
      );
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={common.stack}>
      <Notice>
        Lay the garment flat or hang it by itself. Keep all people out of the
        frame.
      </Notice>
      {error ? <Notice error>{error}</Notice> : null}
      {permission?.granted ? (
        <>
          <View style={{ height: 320, borderRadius: 22, overflow: "hidden" }}>
            <CameraView
              ref={camera}
              style={{ flex: 1 }}
              facing="back"
              onCameraReady={() => setReady(true)}
              onMountError={(failure) => setError(failure.message)}
            />
          </View>
          <Button
            label="Capture garment"
            badge="camera"
            disabled={!ready}
            loading={busy}
            onPress={() => void capture()}
          />
        </>
      ) : (
        <>
          <Text style={common.subtitle}>
            Your camera opens only when you allow it. We need a fresh photo for
            this check.
          </Text>
          <Button
            label="Allow camera"
            badge="camera"
            onPress={() => {
              void requestPermission().catch((failure) =>
                setError((failure as Error).message),
              );
            }}
          />
          {permission && !permission.canAskAgain ? (
            <Notice error>
              Camera access is blocked. Enable it in your device or browser
              settings.
            </Notice>
          ) : null}
        </>
      )}
    </View>
  );
}
