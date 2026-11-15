import { useEffect, useState } from "react";
import {
  AppState,
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
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Stack } from "expo-router";
import Svg, { Circle, Path } from "react-native-svg";
import { currentOutfit } from "../../shared/drip";
import {
  dailyFitStorageKey,
  localDay,
  SavedFit,
  savedFitSchema,
} from "../../shared/daily-fit";
import { ScanFit } from "./ScanFit";
import { DripMenu } from "../components/DripMenu";
import { Garment } from "../components/Garment";
import { ClothingImages, OutfitMannequin } from "../components/OutfitMannequin";
import { dripColors as colors } from "../drip-theme";
import { AccountForm } from "./AccountForm";
import { loadAccounts, saveAccounts, LocalAccount } from "../accounts";
import { resetDripData } from "../reset";
import { loadSession } from "../session";
import { request } from "../api";
import { accountCode, parseAccount } from "../../shared/totp";

const streetwear: ClothingImages = {
  hoodie: {
    source: require("../../assets/streetwear/hoodie-cutout.png"),
    name: "Ivory graffiti hoodie",
  },
  pants: {
    source: require("../../assets/streetwear/pants-cutout.png"),
    name: "Indigo carpenter jeans",
  },
  hat: {
    source: require("../../assets/streetwear/hat-cutout.png"),
    name: "Sage embroidered cap",
  },
};

type Sheet =
  | { kind: "menu" }
  | { kind: "scan" }
  | { kind: "add" }
  | { kind: "row" | "delete"; row: LocalAccount };

export default function Drip() {
  const [rows, setRows] = useState<LocalAccount[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [dailyFit, setDailyFit] = useState<SavedFit | null>(null);
  const [skippedDay, setSkippedDay] = useState("");
  const [timestamp, setTimestamp] = useState(Date.now);
  const [search, setSearch] = useState("");
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [label, setLabel] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function connectDemo() {
      if (Platform.OS === "web") return;
      try {
        const session = await loadSession();
        if (session)
          await request(session, "/bridge/demo/connect", { method: "POST" });
      } catch (failure) {
        if (mounted)
          setError(
            failure instanceof Error
              ? failure.message
              : "Could not connect to your demo browser.",
          );
      }
    }
    void connectDemo();
    Promise.all([loadAccounts(), AsyncStorage.getItem(dailyFitStorageKey)])
      .then(([stored, savedFit]) => {
        if (mounted) {
          setRows(stored);
          if (savedFit) setDailyFit(savedFitSchema.parse(JSON.parse(savedFit)));
          setLoaded(true);
        }
      })
      .catch((failure: Error) => {
        if (mounted)
          setError(`Could not load your accounts: ${failure.message}`);
      });
    const interval = setInterval(() => setTimestamp(Date.now()), 250);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        setTimestamp(Date.now());
        void connectDemo();
      }
    });
    return () => {
      mounted = false;
      clearInterval(interval);
      subscription.remove();
    };
  }, []);

  async function saveRows(nextRows: LocalAccount[]) {
    setSaving(true);
    setError("");
    try {
      await saveAccounts(nextRows);
      setRows(nextRows);
      setSheet(null);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Could not save your changes.",
      );
    } finally {
      setSaving(false);
    }
  }

  function saveLabel() {
    const name = label.trim();
    if (!name) {
      setError("Enter a name first.");
      return;
    }
    if (sheet?.kind === "row") {
      void saveRows(
        rows.map((row) =>
          row.id === sheet.row.id ? { ...row, label: name } : row,
        ),
      );
    }
  }

  const day = localDay(new Date(timestamp));
  const clothing =
    dailyFit?.day === day
      ? {
          hoodie: {
            source: { uri: dailyFit.items.top.photo },
            name: dailyFit.items.top.name,
          },
          pants: {
            source: { uri: dailyFit.items.pants.photo },
            name: dailyFit.items.pants.name,
          },
          hat: {
            source: { uri: dailyFit.items.hat.photo },
            name: dailyFit.items.hat.name,
          },
        }
      : streetwear;
  const showDailyScan =
    sheet?.kind === "scan" ||
    (loaded && !sheet && dailyFit?.day !== day && skippedDay !== day);

  const visibleRows = rows.filter((row) =>
    `${row.issuer} ${row.label}`.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <SafeAreaView style={styles.safe}>
      <Stack.Screen options={{ title: "Drip Authenticator" }} />
      <StatusBar style="light" />
      <View style={styles.page}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open menu"
            style={styles.iconButton}
            onPress={() => setSheet({ kind: "menu" })}
          >
            <Svg width={24} height={24} viewBox="0 0 24 24">
              <Path
                d="M3 6H21M3 12H21M3 18H21"
                stroke={colors.muted}
                strokeWidth={2}
              />
            </Svg>
          </Pressable>
          <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit>
            Drip Authenticator
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="About your authenticator"
            onPress={() => setSheet({ kind: "menu" })}
            style={styles.avatar}
          >
            <Text style={styles.avatarText}>D</Text>
          </Pressable>
        </View>
        <TextInput
          accessibilityLabel="Search services"
          placeholder="Search…"
          placeholderTextColor={colors.muted}
          value={search}
          onChangeText={setSearch}
          style={styles.search}
          selectionColor={colors.blue}
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
        {!!error && !sheet && (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        )}
        <ScrollView
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
        >
          {visibleRows.map((row) => {
            const code = accountCode(row, timestamp);
            const outfit = currentOutfit(timestamp, Number(code) % 3);
            const remaining =
              1 - (timestamp % (row.period * 1000)) / (row.period * 1000);
            return (
              <View key={row.id} style={styles.row}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${row.issuer}: ${row.label}. View account.`}
                  onPress={() => {
                    setLabel(row.label);
                    setError("");
                    setSheet({ kind: "row", row });
                  }}
                  style={({ pressed }) => pressed && styles.pressed}
                >
                  <View style={styles.rowHeading}>
                    <Text style={styles.rowTitle}>{row.issuer}</Text>
                    <Text style={styles.note}>{row.label}</Text>
                  </View>
                  <View style={styles.code}>
                    <OutfitMannequin outfit={outfit} clothing={clothing} />
                    <Countdown remaining={remaining} period={row.period} />
                  </View>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Delete ${row.issuer}: ${row.label}`}
                  onPress={() => {
                    setError("");
                    setSheet({ kind: "delete", row });
                  }}
                  style={({ pressed }) => [
                    styles.iconButton,
                    styles.rowDelete,
                    pressed && styles.pressed,
                  ]}
                >
                  <Svg width={22} height={22} viewBox="0 0 24 24">
                    <Path
                      d="M4 7H20M9 7V4H15V7M6 7L7 21H17L18 7M10 11V17M14 11V17"
                      stroke={colors.muted}
                      strokeWidth={1.7}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                  </Svg>
                </Pressable>
              </View>
            );
          })}
          {!visibleRows.length && (
            <Text style={styles.empty}>
              {search
                ? "No matching services"
                : "Tap the + hat to scan a setup QR and add your first app or service."}
            </Text>
          )}
        </ScrollView>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add app or service"
          disabled={!loaded}
          onPress={() => {
            setLabel("");
            setError("");
            setSheet({ kind: "add" });
          }}
          style={({ pressed }) => [styles.add, pressed && styles.pressed]}
        >
          <Garment kind="hat" size={54} color={colors.blue} badge="plus" />
        </Pressable>
      </View>
      {sheet?.kind === "menu" && (
        <DripMenu
          onScan={() => setSheet({ kind: "scan" })}
          onClose={() => setSheet(null)}
          onReset={async (disconnect) => {
            await resetDripData(disconnect);
            setRows([]);
            setDailyFit(null);
            setSkippedDay("");
            setSearch("");
            setLabel("");
            setError("");
            setSheet(null);
          }}
        />
      )}
      {showDailyScan && (
        <ScanFit
          onClose={() => {
            setSkippedDay(day);
            setSheet(null);
          }}
          onSave={async (fit) => {
            await AsyncStorage.setItem(dailyFitStorageKey, JSON.stringify(fit));
            setDailyFit(fit);
            setSheet(null);
          }}
        />
      )}
      {sheet && sheet.kind !== "menu" && sheet.kind !== "scan" && (
        <Modal
          transparent
          animationType="fade"
          onRequestClose={() => {
            if (!saving) setSheet(null);
          }}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.backdrop}
          >
            <Pressable
              accessibilityLabel="Close dialog"
              accessibilityRole="button"
              style={StyleSheet.absoluteFill}
              disabled={saving}
              onPress={() => setSheet(null)}
            />
            <View
              style={[
                styles.sheet,
                sheet.kind === "add" && {
                  backgroundColor: colors.surface,
                  maxHeight: "95%",
                },
              ]}
              accessibilityViewIsModal
            >
              <View style={styles.sheetHeader}>
                {sheet.kind === "add" ? (
                  <View style={{ flex: 1 }} />
                ) : (
                  <Text style={styles.sheetTitle}>
                    {sheet.kind === "delete"
                      ? "Delete service?"
                      : sheet.row.issuer}
                  </Text>
                )}
                <Pressable
                  accessibilityLabel="Close dialog"
                  accessibilityRole="button"
                  disabled={saving}
                  onPress={() => setSheet(null)}
                  style={styles.iconButton}
                >
                  <Text style={styles.close}>×</Text>
                </Pressable>
              </View>
              {sheet.kind === "add" ? (
                <ScrollView keyboardShouldPersistTaps="handled">
                  <AccountForm
                    compact
                    onAdd={async (input) => {
                      const parsed = parseAccount(input);
                      if (
                        rows.some(
                          (account) =>
                            account.secret === parsed.secret &&
                            account.issuer === parsed.issuer &&
                            account.label === parsed.label,
                        )
                      ) {
                        throw new Error(
                          "This service account is already added.",
                        );
                      }
                      const nextRows = [
                        ...rows,
                        {
                          ...parsed,
                          id: `account-${Date.now()}`,
                          createdAt: new Date().toISOString(),
                        },
                      ];
                      await saveAccounts(nextRows);
                      setRows(nextRows);
                    }}
                    onSaved={() => setSheet(null)}
                  />
                </ScrollView>
              ) : sheet.kind === "delete" ? (
                <>
                  <Text style={styles.description}>
                    Remove {sheet.row.issuer} ({sheet.row.label}) from this
                    device? This won’t turn off two-factor authentication for
                    that service.
                  </Text>
                  {!!error && (
                    <Text accessibilityRole="alert" style={styles.error}>
                      {error}
                    </Text>
                  )}
                  <View style={styles.actions}>
                    <Pressable
                      accessibilityRole="button"
                      disabled={saving}
                      onPress={() => setSheet(null)}
                      style={styles.action}
                    >
                      <Text style={styles.linkText}>Cancel</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      disabled={saving || !loaded}
                      onPress={() =>
                        void saveRows(
                          rows.filter((row) => row.id !== sheet.row.id),
                        )
                      }
                      style={[
                        styles.save,
                        styles.deleteButton,
                        (saving || !loaded) && styles.disabled,
                      ]}
                    >
                      <Text style={styles.saveText}>
                        {saving ? "Deleting…" : "Delete service"}
                      </Text>
                    </Pressable>
                  </View>
                </>
              ) : (
                <>
                  <TextInput
                    accessibilityLabel="Account label"
                    placeholder="Account label"
                    placeholderTextColor={colors.muted}
                    value={label}
                    onChangeText={setLabel}
                    maxLength={60}
                    autoFocus
                    style={styles.nameInput}
                    onSubmitEditing={() => {
                      if (!saving && loaded) saveLabel();
                    }}
                    returnKeyType="done"
                    selectionColor={colors.blue}
                  />
                  {!!error && (
                    <Text accessibilityRole="alert" style={styles.error}>
                      {error}
                    </Text>
                  )}
                  <View style={styles.actions}>
                    {sheet.kind === "row" && (
                      <Pressable
                        accessibilityRole="button"
                        disabled={saving || !loaded}
                        onPress={() => {
                          setError("");
                          setSheet({ kind: "delete", row: sheet.row });
                        }}
                        style={styles.action}
                      >
                        <Text style={styles.deleteText}>Delete service</Text>
                      </Pressable>
                    )}
                    <Pressable
                      accessibilityRole="button"
                      disabled={saving || !loaded}
                      onPress={saveLabel}
                      style={[
                        styles.save,
                        (saving || !loaded) && styles.disabled,
                      ]}
                    >
                      <Text style={styles.saveText}>
                        {saving ? "Saving…" : "Save"}
                      </Text>
                    </Pressable>
                  </View>
                </>
              )}
            </View>
          </KeyboardAvoidingView>
        </Modal>
      )}
    </SafeAreaView>
  );
}

function Countdown({
  remaining,
  period,
}: {
  remaining: number;
  period: number;
}) {
  const angle = -remaining * Math.PI * 2 - Math.PI / 2;
  const horizontal = 12 + 11 * Math.cos(angle);
  const vertical = 12 + 11 * Math.sin(angle);
  return (
    <View
      accessibilityLabel={`Changes in ${Math.ceil(remaining * period)} seconds`}
      style={styles.timer}
    >
      <Svg width={25} height={25} viewBox="0 0 24 24">
        {remaining > 0.999 ? (
          <Circle cx={12} cy={12} r={11} fill={colors.blue} />
        ) : (
          <Path
            d={`M12 12L12 1A11 11 0 ${remaining > 0.5 ? 1 : 0} 0 ${horizontal} ${vertical}Z`}
            fill={colors.blue}
          />
        )}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  page: { flex: 1, width: "100%", maxWidth: 620, alignSelf: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 18,
    gap: 8,
  },
  iconButton: {
    width: 40,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { flex: 1, color: "#F5F5F5", fontSize: 23, fontWeight: "400" },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: "#4285F4",
    padding: 3,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#087FB7",
  },
  avatarText: { color: "white", fontSize: 22 },
  search: {
    backgroundColor: colors.surface,
    borderRadius: 40,
    height: 56,
    marginHorizontal: 16,
    paddingHorizontal: 24,
    color: colors.text,
    fontSize: 18,
    marginBottom: 6,
  },
  list: { paddingHorizontal: 24, paddingBottom: 110 },
  row: {
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    paddingTop: 18,
    paddingBottom: 18,
  },
  rowHeading: { paddingRight: 48 },
  rowDelete: { position: "absolute", top: 14, right: 0 },
  rowTitle: { color: colors.text, fontSize: 18, lineHeight: 25 },
  code: { flexDirection: "row", alignItems: "center", marginTop: 9 },
  timer: { marginLeft: "auto", paddingRight: 10 },
  pressed: { opacity: 0.65 },
  add: {
    position: "absolute",
    right: 20,
    bottom: 24,
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 4px 16px #00000055",
  },
  empty: {
    color: colors.muted,
    textAlign: "center",
    marginTop: 50,
    fontSize: 16,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "#00000088",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  sheet: {
    backgroundColor: colors.surface,
    width: "100%",
    maxWidth: 420,
    padding: 24,
    borderRadius: 28,
  },
  sheetHeader: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  sheetTitle: { flex: 1, color: colors.text, fontSize: 22 },
  close: { color: colors.muted, fontSize: 30 },
  description: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 16,
  },
  note: { color: colors.muted, fontSize: 13, lineHeight: 20, marginBottom: 12 },
  menuLink: {
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  linkText: { color: colors.blue, fontSize: 16 },
  nameInput: {
    borderWidth: 1,
    borderColor: colors.muted,
    borderRadius: 10,
    padding: 16,
    color: colors.text,
    fontSize: 17,
    marginBottom: 16,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 12,
    marginTop: 8,
  },
  action: { padding: 14 },
  deleteText: { color: "#FFB4AB", fontSize: 15 },
  deleteButton: { backgroundColor: "#FFB4AB" },
  save: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 24,
    backgroundColor: colors.blue,
  },
  saveText: { color: colors.background, fontSize: 15, fontWeight: "600" },
  error: { color: "#FFB4AB", fontSize: 14, padding: 12 },
  disabled: { opacity: 0.5 },
});
