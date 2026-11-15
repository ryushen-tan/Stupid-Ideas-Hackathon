import { useState } from "react";
import { Text, View } from "react-native";
import { z } from "zod";
import { accountInputSchema } from "../../shared/authenticator";
import { CameraScanner } from "../components/CameraScanner";
import { Button, common, Field, Notice } from "../components/UI";

export function AccountForm({
  onAdd,
  onSaved,
}: {
  onAdd: (input: z.infer<typeof accountInputSchema>) => Promise<void>;
  onSaved: () => void;
}) {
  const [mode, setMode] = useState<"qr" | "manual">("qr");
  const [issuer, setIssuer] = useState("");
  const [label, setLabel] = useState("");
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cameraRevision, setCameraRevision] = useState(0);
  async function save(uri?: string) {
    setBusy(true);
    setError("");
    try {
      await onAdd(
        accountInputSchema.parse(
          uri
            ? { method: "qr", uri }
            : { method: "manual", issuer, label, secret },
        ),
      );
      setSecret("");
      onSaved();
    } catch (failure) {
      setError((failure as Error).message);
      setCameraRevision((value) => value + 1);
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={common.stack}>
      <Text style={common.title}>Add app or service</Text>
      <Text style={common.subtitle}>
        Open two-factor authentication in the service you want to protect.
        Choose an authenticator app, then scan its setup QR.
      </Text>
      {error ? <Notice error>{error}</Notice> : null}
      <View style={common.row}>
        <Button
          label="Scan setup QR"
          badge="qr"
          tone={mode === "qr" ? "primary" : "secondary"}
          small
          disabled={busy}
          onPress={() => setMode("qr")}
        />
        <Button
          label="Enter key"
          kind="hat"
          badge="plus"
          small
          tone={mode === "manual" ? "primary" : "secondary"}
          disabled={busy}
          onPress={() => setMode("manual")}
        />
      </View>
      {busy ? (
        <Notice>Saving your authenticator…</Notice>
      ) : mode === "qr" ? (
        <CameraScanner
          key={cameraRevision}
          purpose="account"
          onCode={(uri) => void save(uri)}
        />
      ) : (
        <>
          <Field
            label="Service name"
            value={issuer}
            onChangeText={setIssuer}
            placeholder="Microsoft, Google, Entre…"
            maxLength={80}
          />
          <Field
            label="Account label"
            value={label}
            onChangeText={setLabel}
            placeholder="you@example.com"
            autoCapitalize="none"
            maxLength={120}
          />
          <Field
            label="Setup key (Base32)"
            value={secret}
            onChangeText={setSecret}
            placeholder="Key from the service’s security settings"
            secureTextEntry
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={512}
          />
          <Text style={common.subtitle}>
            Manual setup uses standard 6-digit codes, SHA1, and a 30-second
            timer. For other settings, scan the service’s QR.
          </Text>
          <Button
            label="Add account"
            kind="hat"
            badge="plus"
            disabled={!issuer || !label || !secret}
            onPress={() => void save()}
          />
        </>
      )}
      <Notice>
        Keep the service’s recovery codes somewhere safe. Use the current code
        to finish setup on that service.
      </Notice>
    </View>
  );
}
