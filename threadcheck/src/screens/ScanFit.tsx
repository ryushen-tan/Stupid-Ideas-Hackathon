import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  fitImagesSchema,
  fitSlots,
  localDay,
  SavedFit,
} from "../../shared/daily-fit";
import { StoreSession } from "../../shared/model";
import { defaultServerUrl, request } from "../api";
import { clearSession, loadSession, saveSession } from "../session";

export function ScanFit({
  onSave,
  onClose,
}: {
  onSave: (fit: SavedFit) => Promise<void>;
  onClose: () => void;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const countdownTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [facing, setFacing] = useState<"front" | "back">("back");
  const [active, setActive] = useState(AppState.currentState === "active");
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<StoreSession | null>(null);
  const [photo, setPhoto] = useState("");
  const [capturedDay, setCapturedDay] = useState("");
  const [fit, setFit] = useState<SavedFit | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadSession()
      .then(setSession)
      .catch((failure: Error) => setError(failure.message));
    const listener = AppState.addEventListener("change", (state) => {
      setActive(state === "active");
      setReady(false);
      if (countdownTimer.current) clearInterval(countdownTimer.current);
      countdownTimer.current = null;
      setCountdown(null);
    });
    return () => {
      listener.remove();
      if (countdownTimer.current) clearInterval(countdownTimer.current);
    };
  }, []);

  function startCountdown() {
    setError("");
    let seconds = 5;
    setCountdown(seconds);
    countdownTimer.current = setInterval(() => {
      seconds -= 1;
      if (seconds === 0) {
        if (countdownTimer.current) clearInterval(countdownTimer.current);
        countdownTimer.current = null;
        setCountdown(null);
        void capture();
      } else setCountdown(seconds);
    }, 1000);
  }

  async function detect(image: string, connection: StoreSession, day: string) {
    setBusy(true);
    setError("");
    try {
      const items = fitImagesSchema.parse(
        await request(connection, "/drip/fit", {
          method: "POST",
          body: JSON.stringify({ photo: image }),
        }),
      );
      setFit({ day, items });
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Could not scan your fit. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function capture() {
    setBusy(true);
    setError("");
    try {
      if (!camera.current) throw new Error("The camera is not ready yet.");
      const result = await camera.current.takePictureAsync({
        quality: 0.5,
        base64: true,
      });
      if (!result.base64)
        throw new Error("No photo was captured. Please try again.");
      const image =
        Platform.OS === "web"
          ? result.uri
          : `data:image/jpeg;base64,${result.base64}`;
      const day = localDay();
      setPhoto(image);
      setCapturedDay(day);
      if (session) await detect(image, session, day);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Could not take your photo.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function connect() {
    setBusy(true);
    setError("");
    try {
      const paired = await request<{ token: string }>(
        { url: defaultServerUrl, token: "" },
        "/pair",
        { method: "POST", body: JSON.stringify({ code }) },
      );
      const connection = { url: defaultServerUrl, token: paired.token };
      await saveSession(connection);
      setSession(connection);
      await detect(photo, connection, capturedDay);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Could not connect to the vault.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!fit) return;
    setBusy(true);
    setError("");
    try {
      if (fit.day !== localDay())
        throw new Error(
          "A new day has started. Retake your outfit photo for today.",
        );
      await onSave(fit);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Could not save today's fit.",
      );
    } finally {
      setBusy(false);
    }
  }

  const captureDisabled =
    !ready || !permission?.granted || !active || busy || countdown !== null;

  return (
    <Modal animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.screen}>
        <View style={styles.header}>
          <Text style={styles.title}>
            {fit ? "Your fit, cut out" : "Scan your fit"}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close daily scan"
            onPress={onClose}
            style={styles.close}
          >
            <Text style={styles.closeText}>×</Text>
          </Pressable>
        </View>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.body}>
            {fit
              ? "Check that each cutout shows the right piece, then use this fit for today."
              : "Get your top, pants and hat in one photo. Wear them or lay them out together."}
          </Text>
          {!photo ? (
            <>
              {permission?.granted && active ? (
                <View style={styles.camera}>
                  <CameraView
                    key={facing}
                    ref={camera}
                    facing={facing}
                    style={StyleSheet.absoluteFill}
                    onCameraReady={() => setReady(true)}
                    onMountError={(failure) => setError(failure.message)}
                  />
                  {countdown !== null && (
                    <View pointerEvents="none" style={styles.countdownOverlay}>
                      <Text
                        accessibilityLiveRegion="assertive"
                        style={styles.countdownNumber}
                      >
                        {countdown}
                      </Text>
                      <Text style={styles.countdownHint}>
                        Get your fit in frame
                      </Text>
                    </View>
                  )}
                </View>
              ) : (
                <View style={styles.permission}>
                  <Text style={styles.body}>
                    {permission && !permission.canAskAgain
                      ? "Camera access is blocked. Enable it in your phone or browser settings."
                      : "Allow camera access to capture today's outfit."}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    style={styles.button}
                    onPress={() => {
                      void requestPermission().catch((failure: Error) =>
                        setError(failure.message),
                      );
                    }}
                  >
                    <Text style={styles.buttonText}>Allow camera</Text>
                  </Pressable>
                </View>
              )}
              <Text style={styles.note}>
                Your photo is sent to Backboard to detect and cut out clothing.
                Only the cutouts are saved in this app.
              </Text>
              <View style={styles.actions}>
                <Pressable
                  accessibilityRole="button"
                  disabled={busy || countdown !== null}
                  style={styles.secondary}
                  onPress={() => {
                    setReady(false);
                    setFacing(facing === "back" ? "front" : "back");
                  }}
                >
                  <Text style={styles.link}>Flip camera</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={captureDisabled}
                  style={[styles.button, captureDisabled && styles.disabled]}
                  onPress={startCountdown}
                >
                  <Text style={styles.buttonText}>
                    {countdown !== null
                      ? `Taking photo in ${countdown}…`
                      : "Scan my fit · 5s"}
                  </Text>
                </Pressable>
              </View>
              {countdown !== null && (
                <Pressable
                  accessibilityRole="button"
                  style={styles.secondary}
                  onPress={() => {
                    if (countdownTimer.current)
                      clearInterval(countdownTimer.current);
                    countdownTimer.current = null;
                    setCountdown(null);
                  }}
                >
                  <Text style={styles.link}>Cancel timer</Text>
                </Pressable>
              )}
            </>
          ) : fit ? (
            <>
              <View style={styles.cutouts}>
                {fitSlots.map((slot) => (
                  <View key={slot} style={styles.cutout}>
                    <Image
                      source={{ uri: fit.items[slot].photo }}
                      style={styles.itemImage}
                      resizeMode="contain"
                      accessibilityLabel={fit.items[slot].name}
                    />
                    <Text style={styles.itemLabel}>{fit.items[slot].name}</Text>
                    <Text style={styles.note}>{slot}</Text>
                  </View>
                ))}
              </View>
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                style={styles.button}
                onPress={() => void save()}
              >
                <Text style={styles.buttonText}>
                  {busy ? "Saving…" : "Use today's fit"}
                </Text>
              </Pressable>
            </>
          ) : (
            <>
              <Image
                source={{ uri: photo }}
                style={styles.preview}
                resizeMode="contain"
                accessibilityLabel="Your captured outfit"
              />
              {busy ? (
                <View style={styles.processing}>
                  <ActivityIndicator color="#A8C7FA" />
                  <Text style={styles.body}>
                    Detecting your clothes and cutting out each piece…
                  </Text>
                </View>
              ) : !session ? (
                <>
                  <Text style={styles.body}>
                    Connect once to enable clothing detection.
                  </Text>
                  <TextInput
                    accessibilityLabel="Vault pairing code"
                    keyboardType="number-pad"
                    maxLength={6}
                    value={code}
                    onChangeText={setCode}
                    placeholder="6-digit vault code"
                    placeholderTextColor="#939694"
                    style={styles.input}
                  />
                  <Pressable
                    accessibilityRole="button"
                    disabled={code.length !== 6}
                    style={[
                      styles.button,
                      code.length !== 6 && styles.disabled,
                    ]}
                    onPress={() => void connect()}
                  >
                    <Text style={styles.buttonText}>Connect & scan</Text>
                  </Pressable>
                </>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  style={styles.button}
                  onPress={() => void detect(photo, session, capturedDay)}
                >
                  <Text style={styles.buttonText}>Retry cutouts</Text>
                </Pressable>
              )}
            </>
          )}
          {!!error && (
            <Text accessibilityRole="alert" style={styles.error}>
              {error}
            </Text>
          )}
          {!!photo && !busy && (
            <Pressable
              accessibilityRole="button"
              style={styles.secondary}
              onPress={() => {
                setPhoto("");
                setFit(null);
                setError("");
                setReady(false);
              }}
            >
              <Text style={styles.link}>Retake photo</Text>
            </Pressable>
          )}
          {!!error && session && !busy && (
            <Pressable
              accessibilityRole="button"
              style={styles.secondary}
              onPress={() => {
                void clearSession()
                  .then(() => setSession(null))
                  .catch((failure: Error) => setError(failure.message));
              }}
            >
              <Text style={styles.link}>Reconnect vault</Text>
            </Pressable>
          )}
          <Pressable
            accessibilityRole="button"
            style={styles.secondary}
            onPress={onClose}
          >
            <Text style={styles.note}>Use demo outfits for now</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  countdownOverlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#00000033",
  },
  countdownNumber: { color: "white", fontSize: 96, fontWeight: "700" },
  countdownHint: { color: "white", fontSize: 18 },
  screen: { flex: 1, backgroundColor: "#131314" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 8,
  },
  title: { fontSize: 25, color: "#E3E3E3", flex: 1 },
  close: { padding: 10 },
  closeText: { fontSize: 30, color: "#BFC1C3" },
  content: {
    padding: 24,
    gap: 16,
    maxWidth: 620,
    width: "100%",
    alignSelf: "center",
  },
  body: { color: "#E3E3E3", fontSize: 16, lineHeight: 24 },
  note: { color: "#BFC1C3", fontSize: 13, lineHeight: 20 },
  camera: {
    height: 380,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "#27292B",
  },
  permission: {
    padding: 24,
    gap: 24,
    backgroundColor: "#27292B",
    borderRadius: 20,
  },
  button: {
    backgroundColor: "#A8C7FA",
    padding: 16,
    borderRadius: 24,
    alignItems: "center",
  },
  buttonText: { color: "#131314", fontSize: 16, fontWeight: "600" },
  secondary: { paddingVertical: 12, alignItems: "center" },
  link: { color: "#A8C7FA", fontSize: 16 },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  preview: { width: "100%", height: 260, borderRadius: 20 },
  processing: { gap: 16, padding: 20, alignItems: "center" },
  cutouts: { flexDirection: "row", gap: 12 },
  cutout: { flex: 1, alignItems: "center", gap: 8 },
  itemImage: { width: "100%", aspectRatio: 1 },
  itemLabel: { fontSize: 14, color: "#E3E3E3", textAlign: "center" },
  input: {
    borderWidth: 1,
    borderColor: "#686C69",
    borderRadius: 10,
    padding: 16,
    fontSize: 18,
    color: "#E3E3E3",
  },
  disabled: { opacity: 0.4 },
  error: { color: "#FFB4AB", fontSize: 14, lineHeight: 21 },
});
