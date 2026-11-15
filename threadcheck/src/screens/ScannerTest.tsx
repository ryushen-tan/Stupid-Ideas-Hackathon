import { ComponentRef, useCallback, useEffect, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { accountCode } from "../../shared/totp";
import { SuccessBanner } from "../components/SuccessBanner";
import { celebrate, demoAccount, ensureDemoAccount } from "../demo";
import { dripColors as colors } from "../drip-theme";
import { scannerInputProps, useScannerDetection } from "../scanner";

const NEEDED = 3;

// Offline test: Fake Bank asks for a code, you scan any three different tags,
// and the app notifies you and shows Fake Bank's current code. No website,
// vault or daily fit needed.
export default function ScannerTest() {
  const scanner = useRef<ComponentRef<typeof TextInput>>(null);
  const scannerStatus = useScannerDetection();
  const [barcode, setBarcode] = useState("");
  const [scans, setScans] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [banner, setBanner] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const done = scans.length >= NEEDED;

  useEffect(() => {
    void ensureDemoAccount();
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!done) scanner.current?.focus();
  }, [done]);
  const dismiss = useCallback(() => setBanner(false), []);

  function scanned(text: string) {
    const code = text.trim();
    setBarcode("");
    setError("");
    if (!code || done) return;
    if (scans.includes(code)) {
      setError("Already scanned that tag. Scan a different one.");
      return;
    }
    const next = [...scans, code];
    setScans(next);
    if (next.length === NEEDED) {
      setBanner(true);
      celebrate();
    }
  }

  const code = accountCode(demoAccount, now);
  const period = demoAccount.period * 1000;
  const secondsLeft = Math.ceil((period - (now % period)) / 1000);

  return (
    <SafeAreaView style={styles.screen}>
      <Stack.Screen options={{ title: "Test scanner" }} />
      <View style={styles.header}>
        <Text style={styles.title}>Test scanner</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close scanner test"
          onPress={() => router.back()}
          style={styles.close}
        >
          <Text style={styles.closeText}>×</Text>
        </Pressable>
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <Text style={styles.origin}>{demoAccount.issuer}</Text>
          <Text style={styles.note}>
            {demoAccount.label} is asking for a login code.
          </Text>
        </View>
        <Text
          style={[styles.note, scannerStatus.detected && { color: "#A2FAA3" }]}
        >
          {scannerStatus.detected
            ? "● Scanner connected"
            : "○ Scan any tag to confirm the scanner is connected"}
        </Text>
        {!done ? (
          <>
            <Text style={styles.title}>
              Scan {NEEDED} different tags · {scans.length} of {NEEDED}
            </Text>
            <TextInput
              ref={scanner}
              accessibilityLabel="Test scanner input"
              autoFocus
              {...scannerInputProps}
              value={barcode}
              onChangeText={(text) => {
                scannerStatus.track(text);
                setBarcode(text);
              }}
              onSubmitEditing={(event) => {
                scannerStatus.submitted(event.nativeEvent.text);
                scanned(event.nativeEvent.text);
              }}
              placeholder="Waiting for your scanner…"
              placeholderTextColor={colors.muted}
              style={styles.input}
            />
            <Pressable
              accessibilityRole="button"
              onPress={() => scanner.current?.focus()}
              style={styles.close}
            >
              <Text style={styles.link}>Focus scanner</Text>
            </Pressable>
          </>
        ) : (
          <View style={[styles.card, { alignItems: "center", gap: 8 }]}>
            <Text style={styles.note}>{demoAccount.issuer} code</Text>
            <Text selectable style={styles.code}>
              {code.slice(0, 3)} {code.slice(3)}
            </Text>
            <Text style={styles.note}>Changes in {secondsLeft}s</Text>
          </View>
        )}
        {scans.map((scan, index) => (
          <Text key={scan} style={styles.note}>
            ✓ Scan {index + 1}: {scan}
          </Text>
        ))}
        {!!error && (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        )}
        {(done || scans.length > 0) && (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setScans([]);
              setBanner(false);
              setError("");
            }}
            style={styles.button}
          >
            <Text style={styles.buttonText}>Test again</Text>
          </Pressable>
        )}
      </ScrollView>
      {banner && (
        <SuccessBanner
          title="Scans successful"
          body={`${demoAccount.issuer} code: ${code.slice(0, 3)} ${code.slice(3)}`}
          onDismiss={dismiss}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  content: {
    padding: 24,
    gap: 16,
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
  },
  title: { color: colors.text, fontSize: 20 },
  close: { padding: 12, alignItems: "center" },
  closeText: { color: colors.muted, fontSize: 28 },
  note: { color: colors.muted, fontSize: 14, lineHeight: 22 },
  origin: { color: colors.blue, fontSize: 18, fontWeight: "600" },
  error: { color: colors.error, fontSize: 14 },
  link: { color: colors.blue, fontSize: 14 },
  code: {
    color: colors.text,
    fontSize: 44,
    fontWeight: "600",
    letterSpacing: 4,
    fontVariant: ["tabular-nums"],
  },
  input: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    color: colors.text,
    fontSize: 16,
  },
  button: {
    backgroundColor: colors.blue,
    padding: 16,
    borderRadius: 24,
    alignItems: "center",
  },
  buttonText: { color: colors.background, fontWeight: "600", fontSize: 15 },
  card: { backgroundColor: colors.surface, padding: 20, borderRadius: 20 },
});
