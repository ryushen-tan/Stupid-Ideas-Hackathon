import { ComponentRef, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  BrowserInbox,
  BrowserRequest,
  BridgeSetup,
  ClothingBarcodes,
  clothingBarcodesSchema,
  clothingBarcodesStorageKey,
  garmentSlot,
} from "../../shared/bridge";
import { z } from "zod";
import {
  SavedFit,
  fitSlots,
  dailyFitStorageKey,
  localDay,
  savedFitSchema,
} from "../../shared/daily-fit";
import { currentOutfit, outfits, placements } from "../../shared/drip";
import { StoreSession } from "../../shared/model";
import { accountCode } from "../../shared/totp";
import { loadAccounts, LocalAccount } from "../accounts";
import { defaultServerUrl, request } from "../api";
import { connectSession, demoPairingCode, loadSession } from "../session";
import { OutfitMannequin, ClothingImages } from "../components/OutfitMannequin";
import { dripColors as colors } from "../drip-theme";

const savedBarcodesSchema = z.object({
  day: z.string(),
  barcodes: clothingBarcodesSchema,
});

export default function BrowserExtension() {
  const [session, setSession] = useState<StoreSession | null>(null);
  const [accounts, setAccounts] = useState<LocalAccount[]>([]);
  const [barcodes, setBarcodes] = useState<ClothingBarcodes>({
    top: "",
    pants: "",
    hat: "",
  });
  const barcodeInputs = useRef<
    Record<(typeof fitSlots)[number], ComponentRef<typeof TextInput> | null>
  >({ top: null, pants: null, hat: null });
  const [fit, setFit] = useState<SavedFit | null>(null);
  const [inbox, setInbox] = useState<BrowserInbox>({
    browsers: [],
    requests: [],
  });
  const [selected, setSelected] = useState<BrowserRequest | null>(null);
  const [server, setServer] = useState(defaultServerUrl);
  const [serverCode, setServerCode] = useState("");
  const [pairCode, setPairCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [demoConnected, setDemoConnected] = useState(false);
  const [connectionError, setConnectionError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([
      loadSession().catch((failure: Error) => {
        if (active) setConnectionError(failure.message);
        return null;
      }),
      loadAccounts(),
      AsyncStorage.getItem(dailyFitStorageKey),
      AsyncStorage.getItem(clothingBarcodesStorageKey),
    ])
      .then(([connection, savedAccounts, savedFit, savedBarcodes]) => {
        if (!active) return;
        setSession(connection);
        setAccounts(savedAccounts);
        if (savedFit) setFit(savedFitSchema.parse(JSON.parse(savedFit)));
        if (savedBarcodes) {
          const saved = savedBarcodesSchema.parse(JSON.parse(savedBarcodes));
          if (saved.day === localDay()) setBarcodes(saved.barcodes);
        }
      })
      .catch((failure: Error) => {
        if (active) setError(failure.message);
      })
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!session || selected) return;
    const connection = session;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const demo = await request<{ enabled: boolean }>(
          connection,
          "/bridge/demo/connect",
          { method: "POST" },
        );
        if (active) setDemoConnected(demo.enabled);
        const result = await request<BrowserInbox>(connection, "/bridge/inbox");
        if (active) {
          setInbox(result);
          setConnectionError("");
        }
      } catch (failure) {
        if (active)
          setConnectionError(
            failure instanceof Error
              ? failure.message
              : "Could not reach your browser.",
          );
      } finally {
        if (active) timer = setTimeout(poll, 2500);
      }
    }
    void poll();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [session, selected]);

  async function connectServer() {
    setBusy(true);
    setError("");
    try {
      const url = new URL(server.trim());
      if (
        !["http:", "https:"].includes(url.protocol) ||
        url.username ||
        url.password ||
        url.pathname !== "/" ||
        url.search ||
        url.hash
      )
        throw new Error("Enter the server address only.");
      const connection = await connectSession(
        url.origin,
        demoPairingCode || serverCode,
      );
      setSession(connection);
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "Could not connect.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function pairBrowser() {
    if (!session) return;
    setBusy(true);
    setError("");
    try {
      await request(session, "/bridge/pair", {
        method: "POST",
        body: JSON.stringify({ code: pairCode }),
      });
      setPairCode("");
      setMessage("Browser connected.");
      setInbox(await request<BrowserInbox>(session, "/bridge/inbox"));
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Could not pair your browser.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function prepare(account: LocalAccount, timestamp: number) {
    if (!session || !selected || !fit) return;
    setBusy(true);
    setError("");
    try {
      if (fit.day !== localDay()) throw new Error("Scan today’s fit first.");
      const parsed = clothingBarcodesSchema.safeParse(barcodes);
      if (!parsed.success) throw new Error(parsed.error.issues[0].message);
      await AsyncStorage.setItem(
        clothingBarcodesStorageKey,
        JSON.stringify({ day: fit.day, barcodes: parsed.data }),
      );
      const setup: BridgeSetup = {
        accountId: account.id,
        issuer: account.issuer,
        label: account.label,
        outfitIndex: outfits.indexOf(
          currentOutfit(
            timestamp,
            Number(accountCode(account, timestamp)) % outfits.length,
          ),
        ),
        items: fit.items,
        barcodes: parsed.data,
      };
      await request(session, `/bridge/requests/${selected.id}/prepare`, {
        method: "POST",
        body: JSON.stringify(setup),
      });
      setSelected({ ...selected, setup, status: "prepared" });
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Could not start the check.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function reject() {
    if (!session || !selected) return;
    setBusy(true);
    setError("");
    try {
      await request(session, `/bridge/requests/${selected.id}/reject`, {
        method: "POST",
      });
      setSelected(null);
      setMessage("Request declined.");
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Could not decline the request.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <SafeAreaView style={styles.screen}>
      <Stack.Screen options={{ title: "Browser extension" }} />
      <View style={styles.header}>
        <Text style={styles.title}>Browser extension</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close browser extension"
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
        {!loaded && !error ? <ActivityIndicator color={colors.blue} /> : null}
        {!!connectionError && (
          <Text accessibilityRole="alert" style={styles.error}>
            {connectionError}
          </Text>
        )}
        {!!error && (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        )}
        {!!message && (
          <Text accessibilityRole="text" style={styles.note}>
            {message}
          </Text>
        )}
        {loaded && !session ? (
          <>
            <Text style={styles.note}>
              Connect to the same Drip server as your browser.
            </Text>
            <TextInput
              accessibilityLabel="Drip server address"
              style={styles.input}
              value={server}
              onChangeText={setServer}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {!demoPairingCode && (
              <TextInput
                accessibilityLabel="Server pairing code"
                placeholder="6-digit server pairing code"
                placeholderTextColor={colors.muted}
                style={styles.input}
                value={serverCode}
                onChangeText={setServerCode}
                keyboardType="number-pad"
                maxLength={6}
                secureTextEntry
              />
            )}
            <Pressable
              accessibilityRole="button"
              disabled={busy || (!demoPairingCode && serverCode.length !== 6)}
              onPress={() => void connectServer()}
              style={styles.button}
            >
              <Text style={styles.buttonText}>
                {busy ? "Connecting…" : "Connect server"}
              </Text>
            </Pressable>
          </>
        ) : session && selected ? (
          <>
            <Text style={styles.origin}>{selected.origin}</Text>
            <Text style={styles.note}>{selected.browserName}</Text>
            {!selected.setup ? (
              <>
                <Text style={styles.title}>Clothing barcodes</Text>
                <Text style={styles.note}>
                  Scan each item’s tag once to link it.
                </Text>
                {fitSlots.map((slot, index) => (
                  <TextInput
                    key={slot}
                    ref={(input) => {
                      barcodeInputs.current[slot] = input;
                    }}
                    accessibilityLabel={`${slot} barcode`}
                    placeholder={`${slot} barcode`}
                    placeholderTextColor={colors.muted}
                    style={styles.input}
                    value={barcodes[slot]}
                    onChangeText={(value) =>
                      setBarcodes((current) => ({ ...current, [slot]: value }))
                    }
                    onSubmitEditing={() => {
                      if (index < fitSlots.length - 1)
                        barcodeInputs.current[fitSlots[index + 1]]?.focus();
                    }}
                    autoCapitalize="none"
                    autoCorrect={false}
                    showSoftInputOnFocus={false}
                    submitBehavior="submit"
                    editable={!busy}
                  />
                ))}
                <Text style={styles.title}>Choose your account</Text>
                {!fit || fit.day !== localDay() ? (
                  <Text style={styles.note}>
                    Scan today’s fit from the main screen first.
                  </Text>
                ) : accounts.length ? (
                  accounts.map((account) => (
                    <Pressable
                      key={account.id}
                      accessibilityRole="button"
                      disabled={busy}
                      onPress={() => void prepare(account, Date.now())}
                      style={styles.card}
                    >
                      <Text style={styles.title}>{account.issuer}</Text>
                      <Text style={styles.note}>{account.label}</Text>
                    </Pressable>
                  ))
                ) : (
                  <Text style={styles.note}>
                    Add a service with the + hat first.
                  </Text>
                )}
              </>
            ) : (
              <ClothingApproval
                key={selected.id}
                session={session}
                pending={selected}
                setup={selected.setup}
                accounts={accounts}
                onSent={() => {
                  setSelected(null);
                  setMessage("Code sent to your browser.");
                }}
              />
            )}
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => void reject()}
              style={styles.close}
            >
              <Text style={styles.link}>Decline request</Text>
            </Pressable>
          </>
        ) : session ? (
          <>
            {inbox.requests.length ? (
              inbox.requests.map((pending) => (
                <Pressable
                  key={pending.id}
                  accessibilityRole="button"
                  onPress={() => {
                    setSelected(pending);
                    setMessage("");
                    setError("");
                  }}
                  style={styles.card}
                >
                  <Text style={styles.origin}>{pending.origin}</Text>
                  <Text style={styles.note}>Check outfit → fill code</Text>
                </Pressable>
              ))
            ) : (
              <Text style={styles.note}>
                Request a code from the extension on your website, then complete
                the check here.
              </Text>
            )}
            {inbox.browsers.map((browser) => (
              <View key={browser.id} style={styles.connection}>
                <Text style={styles.note}>{browser.name} · connected</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Disconnect ${browser.name}`}
                  onPress={async () => {
                    try {
                      await request(
                        session,
                        `/bridge/connections/${browser.id}`,
                        { method: "DELETE" },
                      );
                      setInbox(
                        await request<BrowserInbox>(session, "/bridge/inbox"),
                      );
                    } catch (failure) {
                      setError(
                        failure instanceof Error
                          ? failure.message
                          : "Could not disconnect.",
                      );
                    }
                  }}
                >
                  <Text style={styles.link}>Disconnect</Text>
                </Pressable>
              </View>
            ))}
            {demoConnected ? (
              <Text style={styles.note}>
                Demo connected · Your browser connects automatically.
              </Text>
            ) : (
              <>
                <TextInput
                  accessibilityLabel="Browser pairing code"
                  placeholder="8-digit code from the extension"
                  placeholderTextColor={colors.muted}
                  style={styles.input}
                  value={pairCode}
                  onChangeText={setPairCode}
                  maxLength={8}
                  keyboardType="number-pad"
                />
                <Pressable
                  accessibilityRole="button"
                  disabled={busy || pairCode.length !== 8}
                  onPress={() => void pairBrowser()}
                  style={[
                    styles.button,
                    (busy || pairCode.length !== 8) && styles.disabled,
                  ]}
                >
                  <Text style={styles.buttonText}>
                    {busy ? "Connecting…" : "Pair browser"}
                  </Text>
                </Pressable>
              </>
            )}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function ClothingApproval({
  session,
  pending,
  setup,
  accounts,
  onSent,
}: {
  session: StoreSession;
  pending: BrowserRequest;
  setup: BridgeSetup;
  accounts: LocalAccount[];
  onSent: () => void;
}) {
  const scanner = useRef<ComponentRef<typeof TextInput>>(null);
  const [barcode, setBarcode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [matchedCount, setMatchedCount] = useState(pending.matchedCount);
  const verified = matchedCount === placements.length;
  useEffect(() => {
    if (!busy) scanner.current?.focus();
  }, [busy]);
  const account = accounts.find((entry) => entry.id === setup.accountId);
  const clothing: ClothingImages = {
    hoodie: {
      source: { uri: setup.items.top.photo },
      name: setup.items.top.name,
    },
    pants: {
      source: { uri: setup.items.pants.photo },
      name: setup.items.pants.name,
    },
    hat: { source: { uri: setup.items.hat.photo }, name: setup.items.hat.name },
  };
  async function sendCode() {
    if (!account)
      throw new Error("This service account was removed. Start a new request.");
    if (pending.expiresAt <= Date.now())
      throw new Error(
        "This request expired. Request another code in the browser.",
      );
    const period = account.period * 1000;
    const remaining = period - (Date.now() % period);
    if (remaining < 4000)
      await new Promise((resolve) => setTimeout(resolve, remaining + 100));
    const timestamp = Date.now();
    await request(session, `/bridge/requests/${pending.id}/complete`, {
      method: "POST",
      body: JSON.stringify({
        code: accountCode(account, timestamp),
        validUntil: (Math.floor(timestamp / period) + 1) * period,
      }),
    });
    onSent();
  }
  async function complete(code?: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    setBarcode("");
    try {
      if (!verified) {
        const result = await request<
          Pick<BrowserRequest, "matchedCount" | "status">
        >(session, `/bridge/requests/${pending.id}/proof`, {
          method: "POST",
          body: JSON.stringify({ code }),
        });
        setMatchedCount(result.matchedCount);
        if (result.status !== "verified") return;
      }
      await sendCode();
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Could not complete the clothing scan.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={{ gap: 16 }}>
      <Text style={styles.title}>{setup.issuer}</Text>
      <Text style={styles.note}>{setup.label}</Text>
      <OutfitMannequin
        outfit={outfits[setup.outfitIndex]}
        clothing={clothing}
      />
      {!verified ? (
        <>
          <Text style={styles.title}>
            Scan {placements[matchedCount]} ·{" "}
            {
              setup.items[
                garmentSlot[
                  outfits[setup.outfitIndex][placements[matchedCount]]
                ]
              ].name
            }
          </Text>
          <Text style={styles.note}>{matchedCount} of 3 scanned</Text>
          <TextInput
            ref={scanner}
            accessibilityLabel="Clothing scanner input"
            autoFocus
            showSoftInputOnFocus={false}
            autoCorrect={false}
            autoCapitalize="none"
            submitBehavior="submit"
            editable={!busy}
            value={barcode}
            onChangeText={setBarcode}
            onSubmitEditing={(event) => void complete(event.nativeEvent.text)}
            placeholder={busy ? "Checking…" : "Waiting for your scanner…"}
            placeholderTextColor={colors.muted}
            style={styles.input}
          />
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() => scanner.current?.focus()}
            style={styles.close}
          >
            <Text style={styles.link}>Focus scanner</Text>
          </Pressable>
        </>
      ) : (
        <Text style={styles.note}>All three items matched.</Text>
      )}
      {!!error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      {verified && (
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => void complete()}
          style={[styles.button, busy && styles.disabled]}
        >
          <Text style={styles.buttonText}>
            {busy ? "Sending…" : "Send code"}
          </Text>
        </Pressable>
      )}
    </View>
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
    gap: 20,
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
  card: {
    backgroundColor: colors.surface,
    padding: 20,
    borderRadius: 20,
    gap: 8,
  },
  connection: { gap: 10 },
  link: { color: colors.blue, fontSize: 14 },
  disabled: { opacity: 0.45 },
});
