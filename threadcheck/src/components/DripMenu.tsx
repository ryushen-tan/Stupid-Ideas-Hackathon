import { useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import Svg, { Circle, Path } from "react-native-svg";

const entries = [
  {
    id: "transfer",
    label: "Transfer accounts",
    path: "M4 15h12m-4-4 4 4-4 4M20 9H8m4-4L8 9l4 4",
  },
  {
    id: "how",
    label: "How it works",
    path: "m2 9 10-5 10 5-10 5L2 9Zm4 2v6l6 3 6-3v-6m4-2v8",
  },
  {
    id: "settings",
    label: "Settings",
    path: "m9 3-.5 3-2 .9L4 5.8 2 9.2l2.3 1.9v1.8L2 14.8l2 3.4 2.5-1.1 2 .9.5 3h4l.5-3 2-.9 2.5 1.1 2-3.4-2.3-1.9v-1.8L20 9.2l-2-3.4-2.5 1.1-2-.9L13 3H9Z",
  },
  {
    id: "feedback",
    label: "Send feedback",
    path: "M4 4h16a1 1 0 0 1 1 1v13H7l-4 3V5a1 1 0 0 1 1-1Zm8 3v5m0 3v.1",
  },
  {
    id: "help",
    label: "Help",
    path: "M9.1 9a3 3 0 1 1 5.3 2c-1.4.7-2.4 1.1-2.4 3m0 3v.1",
  },
] as const;
type MenuPage = (typeof entries)[number]["id"];

export function DripMenu({
  onClose,
  onScan,
}: {
  onClose: () => void;
  onScan: () => void;
}) {
  const [page, setPage] = useState<MenuPage | null>(null);
  const [input, setInput] = useState("");
  const [message, setMessage] = useState("");

  async function copy(text: string) {
    try {
      await Clipboard.setStringAsync(text);
      setMessage("Copied to clipboard.");
    } catch (failure) {
      setMessage(
        failure instanceof Error
          ? failure.message
          : "Could not copy. Try again.",
      );
    }
  }

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.overlay}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close menu"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <SafeAreaView style={styles.drawer} accessibilityViewIsModal>
          <View style={styles.top}>
            {page ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Back to menu"
                onPress={() => {
                  setPage(null);
                  setMessage("");
                  setInput("");
                }}
                style={styles.control}
              >
                <Text style={styles.controlText}>‹</Text>
              </Pressable>
            ) : (
              <View style={styles.control} />
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close menu"
              onPress={onClose}
              style={styles.control}
            >
              <Text style={styles.controlText}>×</Text>
            </Pressable>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={page ? styles.content : styles.menu}
          >
            {!page ? (
              entries.map((entry) => (
                <View key={entry.id}>
                  {entry.id === "settings" && <View style={styles.divider} />}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={entry.label}
                    onPress={() => {
                      setPage(entry.id);
                      setMessage("");
                      setInput("");
                    }}
                    style={({ pressed }) => [
                      styles.menuRow,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Svg
                      width={25}
                      height={25}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#C4C7C5"
                      strokeWidth={1.8}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <Path d={entry.path} />
                      {entry.id === "settings" && (
                        <Circle cx={11} cy={12} r={3.4} />
                      )}
                      {entry.id === "help" && (
                        <Circle cx={12} cy={12} r={9.5} />
                      )}
                    </Svg>
                    <Text style={styles.menuLabel}>{entry.label}</Text>
                  </Pressable>
                </View>
              ))
            ) : (
              <>
                <Text style={styles.title}>
                  {entries.find((entry) => entry.id === page)?.label}
                </Text>
                {page === "how" && (
                  <>
                    <Text style={styles.body}>
                      Read each outfit from left to right: head, body, feet.
                    </Text>
                    <Text style={styles.body}>
                      Each service has its own real verification code. The
                      clothing arrangement follows that code; use the digits
                      when signing in.
                    </Text>
                    <Text style={styles.body}>
                      Scan your fit each morning. Review the cutouts to use your
                      own top, pants and hat for today.
                    </Text>
                  </>
                )}
                {page === "settings" && (
                  <>
                    <View style={styles.setting}>
                      <Text style={styles.body}>Appearance</Text>
                      <Text style={styles.secondary}>Dark</Text>
                    </View>
                    <View style={styles.setting}>
                      <Text style={styles.body}>Outfit refresh</Text>
                      <Text style={styles.secondary}>30 seconds</Text>
                    </View>
                    <Text style={styles.body}>
                      Service accounts are saved on this device.
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      style={styles.button}
                      onPress={onScan}
                    >
                      <Text style={styles.buttonText}>Scan today’s fit</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      style={styles.button}
                      onPress={() => {
                        onClose();
                        router.push("/vault");
                      }}
                    >
                      <Text style={styles.buttonText}>Vault & scanners</Text>
                    </Pressable>
                  </>
                )}
                {page === "transfer" && (
                  <Text style={styles.body}>
                    To add an account on another device, open that service’s
                    security settings and enroll the new authenticator there.
                    Keep its recovery codes safe.
                  </Text>
                )}
                {page === "feedback" && (
                  <>
                    <Text style={styles.body}>What could be better?</Text>
                    <TextInput
                      accessibilityLabel="Feedback"
                      multiline
                      placeholder="Write your feedback…"
                      placeholderTextColor="#939694"
                      value={input}
                      onChangeText={setInput}
                      style={styles.input}
                    />
                    <Text style={styles.secondary}>
                      Copy your feedback and paste it into our chat.
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      disabled={!input.trim()}
                      onPress={() => void copy(input)}
                      style={[styles.button, !input.trim() && styles.disabled]}
                    >
                      <Text style={styles.buttonText}>Copy feedback</Text>
                    </Pressable>
                  </>
                )}
                {page === "help" && (
                  <>
                    <Text style={styles.body}>
                      Tap the + hat to scan the setup QR from an app or
                      website’s two-factor security settings. You can also enter
                      its setup key.
                    </Text>
                    <Text style={styles.body}>
                      If the timer paused while the app was closed, reopen it to
                      catch up to the current combination.
                    </Text>
                    <Text style={styles.secondary}>
                      Tap a service to copy its code, change its account label,
                      or remove it. The separate outfit-gated vault is under
                      Settings → Vault & scanners.
                    </Text>
                  </>
                )}
                {!!message && (
                  <Text accessibilityRole="alert" style={styles.message}>
                    {message}
                  </Text>
                )}
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "#00000088" },
  drawer: { flex: 1, width: "86%", maxWidth: 360, backgroundColor: "#1E2021" },
  top: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  control: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  controlText: { color: "#C4C7C5", fontSize: 30 },
  menu: { paddingHorizontal: 24, paddingBottom: 24 },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 72,
    gap: 20,
    paddingHorizontal: 4,
  },
  menuLabel: { color: "#C4C7C5", fontSize: 19, flexShrink: 1 },
  divider: { height: 1, backgroundColor: "#424547", marginVertical: 6 },
  pressed: { opacity: 0.55 },
  content: { padding: 24, paddingTop: 12 },
  title: { color: "#E3E3E3", fontSize: 23, marginBottom: 24 },
  body: { color: "#E3E3E3", fontSize: 16, lineHeight: 24, marginBottom: 16 },
  secondary: {
    color: "#BFC1C3",
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 16,
  },
  setting: {
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#424547",
    marginBottom: 20,
  },
  button: { paddingVertical: 14, marginVertical: 8, minHeight: 48 },
  buttonText: { color: "#A8C7FA", fontSize: 16, fontWeight: "600" },
  input: {
    minHeight: 110,
    color: "#E3E3E3",
    borderColor: "#686C69",
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginVertical: 12,
    fontSize: 16,
    textAlignVertical: "top",
  },
  disabled: { opacity: 0.4 },
  message: { color: "#A8C7FA", fontSize: 14, lineHeight: 21, marginTop: 12 },
});
