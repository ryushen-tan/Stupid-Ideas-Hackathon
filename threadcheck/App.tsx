import { useEffect, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { loadSession, clearSession } from "./src/session";
import { Authenticator } from "./src/screens/Authenticator";
import { AccountForm } from "./src/screens/AccountForm";
import { DailyOutfit } from "./src/screens/DailyOutfit";
import { Unlock } from "./src/screens/Unlock";
import { AuthenticatorAccount } from "./shared/authenticator";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { Nunito_400Regular } from "@expo-google-fonts/nunito/400Regular";
import { Nunito_600SemiBold } from "@expo-google-fonts/nunito/600SemiBold";
import { Nunito_800ExtraBold } from "@expo-google-fonts/nunito/800ExtraBold";
import { Fredoka_500Medium } from "@expo-google-fonts/fredoka/500Medium";
import { ClothingItem, ScanRecord, StoreSession } from "./shared/model";
import { request } from "./src/api";
import { Garment } from "./src/components/Garment";
import { Button, common, Notice } from "./src/components/UI";
import { fonts, palette } from "./src/theme";
import { Wardrobe } from "./src/screens/Wardrobe";
import { Scan, ScanMode } from "./src/screens/Scan";
import { Activity } from "./src/screens/Activity";
import { StoreSettings } from "./src/screens/StoreSettings";
import { ItemForm } from "./src/screens/ItemForm";
import { ItemDetail } from "./src/screens/ItemDetail";
import { ItemPicker } from "./src/screens/ItemPicker";
import { Result } from "./src/screens/Result";

type Tab = "authenticator" | "wardrobe" | "scan" | "activity" | "store";
type Sheet =
  | { type: "account" }
  | { type: "daily" }
  | { type: "unlock"; account: AuthenticatorAccount }
  | { type: "add" }
  | { type: "item"; item: ClothingItem }
  | { type: "result"; record: ScanRecord }
  | { type: "choose" }
  | null;
const navigation = [
  { id: "authenticator", label: "Codes", kind: "hoodie", badge: "qr" },
  { id: "wardrobe", label: "Stash", kind: "shirt", badge: undefined },
  { id: "scan", label: "Scan", kind: "shirt", badge: "qr" },
  { id: "activity", label: "Activity", kind: "hoodie", badge: "history" },
  { id: "store", label: "Vault", kind: "bag", badge: "settings" },
] as const;

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_800ExtraBold,
    Fredoka_500Medium,
  });
  const [session, setSession] = useState<StoreSession | null>(null);
  const [ready, setReady] = useState(false);
  const parameters = useLocalSearchParams<{ tab?: Tab }>();
  const tab = parameters.tab ?? "authenticator";
  function setTab(value: Tab) {
    setSheet(null);
    router.setParams({ tab: value });
  }

  const [scanMode, setScanMode] = useState<ScanMode>("camera");
  const [sheet, setSheet] = useState<Sheet>(null);
  const [expected, setExpected] = useState<ClothingItem | null>(null);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState("");
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  useEffect(() => {
    loadSession()
      .then(setSession)
      .catch((failure) =>
        setError(
          `Could not restore your store connection: ${(failure as Error).message}`,
        ),
      )
      .finally(() => setReady(true));
  }, []);
  function connectScreen() {
    setSheet(null);
    setTab("store");
  }
  function startScan(item: ClothingItem | null = null) {
    setExpected(item);
    setSheet(null);
    setTab("scan");
    setRevision((value) => value + 1);
  }
  function showResult(record: ScanRecord) {
    setSheet({ type: "result", record });
    setRevision((value) => value + 1);
  }
  async function openItem(id: string) {
    if (!session) return;
    try {
      setSheet({
        type: "item",
        item: await request<ClothingItem>(session, `/items/${id}`),
      });
    } catch (failure) {
      setSheet(null);
      setError((failure as Error).message);
    }
  }
  function updateItem(item: ClothingItem) {
    setSheet({ type: "item", item });
    setRevision((value) => value + 1);
    if (expected?.id === item.id) setExpected(item);
  }
  if ((!fontsLoaded && !fontError) || !ready)
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={palette.blue} />
        <Text>Getting your wardrobe ready…</Text>
      </View>
    );
  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.app} edges={["top", "left", "right"]}>
        <StatusBar style="dark" />
        <View style={[styles.header, wide && { paddingHorizontal: 38 }]}>
          <Pressable
            onPress={() => setTab("authenticator")}
            accessibilityRole="button"
            accessibilityLabel="Threadcheck home"
            style={common.row}
          >
            <View style={styles.logo}>
              <Garment size={37} color={palette.lime} badge="check" />
            </View>
            <Text style={styles.wordmark}>
              threadcheck<Text style={{ color: palette.blue }}>.</Text>
            </Text>
          </Pressable>
          <View style={common.row}>
            <View
              style={[
                styles.statusDot,
                session && { backgroundColor: "#4B8868" },
              ]}
            />
            <Text style={styles.headerText}>
              {session ? "Vault connected" : "Your daily dress code"}
            </Text>
          </View>
        </View>
        <View style={styles.workspace}>
          {wide && (
            <View style={styles.sidebar}>
              <Text
                style={[common.eyebrow, { marginLeft: 17, marginBottom: 20 }]}
              >
                A VERY INCONVENIENT KEY
              </Text>
              {navigation.map((item) => (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  accessibilityLabel={item.label}
                  accessibilityState={{ selected: tab === item.id }}
                  onPress={() => setTab(item.id)}
                  style={[
                    styles.sideTab,
                    tab === item.id && styles.sideTabSelected,
                  ]}
                >
                  <Garment
                    kind={item.kind}
                    badge={item.badge}
                    size={42}
                    color={tab === item.id ? palette.lime : palette.sage}
                  />
                  <Text
                    style={[
                      styles.navText,
                      tab === item.id && { color: palette.ink },
                    ]}
                  >
                    {item.label}
                  </Text>
                  {tab === item.id && <View style={styles.activeDot} />}
                </Pressable>
              ))}
              <View style={styles.sideNote}>
                <Garment kind="hat" size={84} color={palette.lime} face />
                <Text style={styles.sideNoteTitle}>
                  Dress code:{"\n"}mandatory.
                </Text>
                <Text style={styles.sideNoteText}>
                  Your outfit + two snacks.{"\n"}A fresh scan for every login.
                </Text>
              </View>
              <Text style={styles.version}>THREADCHECK AUTHENTICATOR · 02</Text>
            </View>
          )}
          <ScrollView
            key={tab}
            style={{ flex: 1 }}
            contentContainerStyle={[styles.content, wide && { padding: 36 }]}
            keyboardShouldPersistTaps="handled"
          >
            <View
              style={{ width: "100%", maxWidth: 1000, alignSelf: "center" }}
            >
              {Boolean(error) && (
                <View style={{ marginBottom: 15 }}>
                  <Notice error>{error}</Notice>
                  <Button
                    label="Dismiss message"
                    kind="hat"
                    badge="close"
                    tone="quiet"
                    small
                    onPress={() => setError("")}
                  />
                </View>
              )}
              {tab === "authenticator" && (
                <Authenticator
                  key={revision}
                  session={session}
                  onConnect={connectScreen}
                  onAddAccount={() => setSheet({ type: "account" })}
                  onDaily={() => setSheet({ type: "daily" })}
                  onUnlock={(account) => setSheet({ type: "unlock", account })}
                  onStash={() => setTab("wardrobe")}
                />
              )}
              {tab === "wardrobe" && (
                <Wardrobe
                  key={revision}
                  session={session}
                  onAdd={() =>
                    session ? setSheet({ type: "add" }) : connectScreen()
                  }
                  onScan={() => startScan()}
                  onItem={(item) => setSheet({ type: "item", item })}
                  onConnect={connectScreen}
                />
              )}
              {tab === "scan" && !sheet && (
                <Scan
                  mode={scanMode}
                  onModeChange={setScanMode}
                  key={`${revision}-${expected?.id}`}
                  session={session}
                  expected={expected}
                  onChoose={() => setSheet({ type: "choose" })}
                  onResult={showResult}
                  onConnect={connectScreen}
                />
              )}
              {tab === "activity" && (
                <Activity
                  key={revision}
                  session={session}
                  onResult={showResult}
                  onScan={() => startScan()}
                />
              )}
              {tab === "store" && (
                <StoreSettings
                  session={session}
                  onConnect={async (next) => {
                    setSession(next);
                    setRevision((value) => value + 1);
                  }}
                  onDisconnect={async () => {
                    try {
                      if (session)
                        await request<void>(session, "/session", {
                          method: "DELETE",
                        });
                    } catch (failure) {
                      setError(
                        `Disconnected on this device. The server could not revoke the old session: ${(failure as Error).message}`,
                      );
                    }
                    await clearSession();
                    setSession(null);
                    setExpected(null);
                  }}
                />
              )}
            </View>
          </ScrollView>
        </View>
        {!wide && (
          <SafeAreaView edges={["bottom"]} style={styles.bottomBar}>
            <View style={styles.bottomTabs}>
              {navigation.map((item) => (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  accessibilityLabel={item.label}
                  accessibilityState={{ selected: tab === item.id }}
                  onPress={() => setTab(item.id)}
                  style={styles.bottomTab}
                >
                  <View
                    style={[
                      styles.tabIcon,
                      tab === item.id && { backgroundColor: palette.paleGreen },
                    ]}
                  >
                    <Garment
                      kind={item.kind}
                      badge={item.badge}
                      size={35}
                      color={tab === item.id ? palette.lime : palette.sage}
                    />
                  </View>
                  <Text
                    style={[
                      styles.bottomText,
                      tab === item.id && { color: palette.ink },
                    ]}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </SafeAreaView>
        )}
        {sheet && (
          <Modal
            visible={Boolean(sheet)}
            transparent
            animationType="slide"
            onRequestClose={() => setSheet(null)}
          >
            <View style={styles.overlay}>
              <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                style={styles.sheet}
              >
                <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1 }}>
                  <View style={styles.sheetHeader}>
                    <Text style={common.eyebrow}>
                      THREADCHECK ·{" "}
                      {sheet?.type === "unlock"
                        ? "DAILY CHALLENGE"
                        : sheet?.type === "account"
                          ? "NEW ACCOUNT"
                          : sheet?.type === "daily"
                            ? "OUTFIT OF THE DAY"
                            : sheet?.type === "result"
                              ? "THE RESULTS"
                              : sheet?.type === "add"
                                ? "NEW PIECE"
                                : "YOUR PIECE"}
                    </Text>
                    <Button
                      label="Close"
                      kind="hat"
                      badge="close"
                      small
                      tone="quiet"
                      onPress={() => setSheet(null)}
                    />
                  </View>
                  <ScrollView
                    contentContainerStyle={{
                      padding: 24,
                      paddingTop: 8,
                      paddingBottom: 35,
                    }}
                    keyboardShouldPersistTaps="handled"
                  >
                    {sheet?.type === "account" && session && (
                      <AccountForm
                        onAdd={async (input) => {
                          await request(session, "/vault/accounts", {
                            method: "POST",
                            body: JSON.stringify(input),
                          });
                        }}
                        onSaved={() => {
                          setSheet(null);
                          setRevision((value) => value + 1);
                        }}
                      />
                    )}
                    {sheet?.type === "daily" && session && (
                      <DailyOutfit
                        session={session}
                        onSaved={() => {
                          setSheet(null);
                          setRevision((value) => value + 1);
                        }}
                        onStash={() => {
                          setSheet(null);
                          setTab("wardrobe");
                        }}
                      />
                    )}
                    {sheet?.type === "unlock" && session && (
                      <Unlock
                        session={session}
                        account={sheet.account}
                        onClose={() => {
                          setSheet(null);
                          setRevision((value) => value + 1);
                        }}
                      />
                    )}
                    {sheet?.type === "add" && session && (
                      <ItemForm session={session} onSaved={updateItem} />
                    )}
                    {sheet?.type === "item" && (
                      <ItemDetail
                        key={sheet.item.id}
                        item={sheet.item}
                        session={session}
                        onUpdated={updateItem}
                        onScan={() => startScan(sheet.item)}
                        onConnect={connectScreen}
                      />
                    )}
                    {sheet?.type === "choose" && session && (
                      <ItemPicker
                        session={session}
                        onChoose={(item) => {
                          setExpected(item);
                          setSheet(null);
                        }}
                      />
                    )}
                    {sheet?.type === "result" && (
                      <Result
                        key={sheet.record.id}
                        record={sheet.record}
                        session={session}
                        onResult={showResult}
                        onAgain={() => startScan()}
                        onOpenItem={(id) => void openItem(id)}
                      />
                    )}
                  </ScrollView>
                </SafeAreaView>
              </KeyboardAvoidingView>
            </View>
          </Modal>
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: palette.background },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 15,
    backgroundColor: palette.background,
  },
  header: {
    minHeight: 80,
    paddingHorizontal: 21,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.white,
    gap: 10,
  },
  logo: {
    width: 43,
    height: 43,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.paleGreen,
    borderRadius: 14,
  },
  wordmark: {
    fontFamily: fonts.display,
    fontSize: 25,
    color: palette.ink,
    letterSpacing: -0.7,
  },
  headerText: { fontFamily: fonts.medium, fontSize: 10, color: palette.muted },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 5,
    backgroundColor: palette.sage,
  },
  workspace: { flex: 1, flexDirection: "row" },
  content: { padding: 20, paddingTop: 26, paddingBottom: 35 },
  sidebar: {
    width: 250,
    backgroundColor: palette.white,
    borderRightWidth: 1,
    borderColor: palette.line,
    padding: 20,
    paddingTop: 34,
  },
  sideTab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 17,
    marginBottom: 8,
  },
  sideTabSelected: { backgroundColor: "#EAF6EB" },
  navText: { fontFamily: fonts.bold, fontSize: 15, color: palette.muted },
  activeDot: {
    width: 7,
    height: 7,
    borderRadius: 7,
    backgroundColor: palette.ink,
    marginLeft: "auto",
  },
  sideNote: {
    marginTop: "auto",
    backgroundColor: palette.paleSage,
    borderRadius: 22,
    alignItems: "center",
    padding: 20,
    gap: 13,
  },
  sideNoteTitle: {
    fontFamily: fonts.display,
    color: palette.ink,
    fontSize: 24,
    textAlign: "center",
  },
  sideNoteText: {
    fontFamily: fonts.medium,
    color: palette.muted,
    fontSize: 12,
    lineHeight: 19,
    textAlign: "center",
  },
  version: {
    fontFamily: fonts.bold,
    fontSize: 8,
    letterSpacing: 1.2,
    color: palette.muted,
    textAlign: "center",
    marginTop: 25,
  },
  bottomBar: {
    backgroundColor: palette.white,
    borderTopWidth: 1,
    borderColor: palette.line,
  },
  bottomTabs: { flexDirection: "row", paddingTop: 6, paddingBottom: 8 },
  bottomTab: { flex: 1, alignItems: "center", gap: 3, minHeight: 62 },
  tabIcon: {
    width: 58,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
  },
  bottomText: { fontFamily: fonts.bold, fontSize: 10, color: palette.muted },
  overlay: {
    flex: 1,
    backgroundColor: "#142E3B66",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  sheet: {
    width: "100%",
    maxWidth: 620,
    height: "94%",
    backgroundColor: palette.background,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: "hidden",
  },
  sheetHeader: {
    paddingHorizontal: 22,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderColor: palette.line,
  },
});
