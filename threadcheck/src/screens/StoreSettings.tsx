import { useState } from "react";
import { Text, View } from "react-native";
import { StoreSession, StoreStatus } from "../../shared/model";
import { defaultServerUrl, request } from "../api";
import { Garment } from "../components/Garment";
import { Button, common, Field, Notice, Pill } from "../components/UI";

export function StoreSettings({
  session,
  onConnect,
  onDisconnect,
}: {
  session: StoreSession | null;
  onConnect: (session: StoreSession) => Promise<void>;
  onDisconnect: () => Promise<void>;
}) {
  const [url, setUrl] = useState(session?.url ?? defaultServerUrl);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<StoreStatus | null>(null);
  async function connect() {
    setBusy(true);
    setError("");
    try {
      const parsed = new URL(url.trim());
      if (
        !["http:", "https:"].includes(parsed.protocol) ||
        parsed.username ||
        parsed.password ||
        parsed.pathname !== "/" ||
        parsed.search ||
        parsed.hash
      )
        throw new Error(
          "Enter the vault address only, for example http://192.168.1.20:4310.",
        );
      const serverUrl = parsed.origin;
      const paired = await request<{ token: string }>(
        { url: serverUrl, token: "" },
        "/pair",
        { method: "POST", body: JSON.stringify({ code }) },
      );
      const next = { url: serverUrl, token: paired.token };
      setStatus(await request<StoreStatus>(next, "/store"));
      await onConnect(next);
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={common.stack}>
      <Text style={common.eyebrow}>ONE VAULT. YOUR DAILY RITUAL.</Text>
      <Text style={common.title}>Let’s get connected.</Text>
      <Text style={common.subtitle}>
        Your phone and checkout scanner, on the same team.
      </Text>
      <View style={[common.card, { gap: 18 }]}>
        <View style={common.row}>
          <Garment kind="bag" badge="settings" size={75} />
          <View style={{ flex: 1, gap: 8 }}>
            <Text style={common.sectionTitle}>Threadcheck Vault</Text>
            <Pill
              text={session ? "Vault paired" : "Not connected yet"}
              tone={session ? "green" : "neutral"}
            />
          </View>
        </View>
        {Boolean(error) && <Notice error>{error}</Notice>}
        {session ? (
          <>
            <Text style={common.text}>{session.url}</Text>
            {status && (
              <Notice>
                {status.visionEnabled
                  ? "Your vault is ready for tag and Backboard photo checks."
                  : "Tag checks are ready. Configure Backboard on the server for photo checks."}
              </Notice>
            )}
            <Button
              label="Test connection"
              kind="bag"
              badge="check"
              loading={busy}
              onPress={async () => {
                setBusy(true);
                setError("");
                try {
                  setStatus(await request<StoreStatus>(session, "/store"));
                } catch (failure) {
                  setError((failure as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            />
            <Button
              label="Disconnect this device"
              kind="bag"
              badge="close"
              tone="secondary"
              loading={busy}
              onPress={async () => {
                setBusy(true);
                setError("");
                try {
                  await onDisconnect();
                  setStatus(null);
                } catch (failure) {
                  setError((failure as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            />
          </>
        ) : (
          <>
            <Field
              label="Vault server address"
              value={url}
              onChangeText={setUrl}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              placeholder="http://192.168.1.20:4310"
            />
            <Field
              label="6-digit pairing code"
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              maxLength={6}
              placeholder="From your vault server terminal"
              secureTextEntry
            />
            <Button
              label="Connect to vault"
              kind="bag"
              badge="check"
              loading={busy}
              disabled={code.length !== 6}
              onPress={() => void connect()}
            />
            <Text style={[common.subtitle, { fontSize: 12 }]}>
              Use your vault’s address and pairing code. For a local server,
              keep both devices on the same Wi-Fi.
            </Text>
          </>
        )}
      </View>
      <View style={[common.card, { gap: 14 }]}>
        <Text style={common.sectionTitle}>
          Camera for clothes. Scanner for snacks.
        </Text>
        <View style={common.row}>
          <Garment badge="qr" size={55} />
          <View style={{ flex: 1 }}>
            <Text style={common.text}>Phone camera</Text>
            <Text style={common.subtitle}>
              Capture garments off your body. Scan setup QR codes to add
              accounts.
            </Text>
          </View>
        </View>
        <View style={common.row}>
          <Garment kind="hoodie" badge="qr" size={55} />
          <View style={{ flex: 1 }}>
            <Text style={common.text}>Store barcode scanner</Text>
            <Text style={common.subtitle}>
              USB or Bluetooth in keyboard / HID mode. Enable Enter after each
              scan.
            </Text>
          </View>
        </View>
      </View>
      <Notice>
        Real authenticator codes unlock after today’s outfit and snack
        challenge. Your outfit resets at midnight. Face ID or fingerprint
        confirms morning enrollment in the phone app.
      </Notice>
    </View>
  );
}
