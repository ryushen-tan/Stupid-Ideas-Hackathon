import { dripColors } from "../drip-theme";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { z } from "zod";
import { accountInputSchema } from "../../shared/authenticator";
import { CameraScanner } from "../components/CameraScanner";
import { Button, common, Field } from "../components/UI";

export function AccountForm({
  onAdd,
  onSaved,
  compact = false,
}: {
  onAdd: (input: z.infer<typeof accountInputSchema>) => Promise<void>;
  onSaved: () => void;
  compact?: boolean;
}) {
  const [mode, setMode] = useState<"qr" | "manual">("qr");
  const [issuer, setIssuer] = useState("");
  const [label, setLabel] = useState("");
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
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
    } finally {
      setBusy(false);
    }
  }
  const fields = [
    {
      label: "Service name",
      value: issuer,
      onChangeText: setIssuer,
      placeholder: "Microsoft, Google, Entre…",
      maxLength: 80,
    },
    {
      label: "Account label",
      value: label,
      onChangeText: setLabel,
      placeholder: "you@example.com",
      maxLength: 120,
    },
    {
      label: "Setup key",
      value: secret,
      onChangeText: setSecret,
      placeholder: "Setup key",
      maxLength: 512,
      secureTextEntry: true,
    },
  ];
  return (
    <View style={{ gap: compact ? 16 : 20 }}>
      {!compact && (
        <>
          <Text style={common.title}>Add app or service</Text>
          <Text style={common.subtitle}>
            Scan the setup QR from the service’s two-factor authentication
            settings.
          </Text>
        </>
      )}
      {error ? (
        <Text
          accessibilityRole="alert"
          style={compact ? styles.error : common.subtitle}
        >
          {error}
        </Text>
      ) : null}
      {busy ? (
        <ActivityIndicator color={compact ? dripColors.blue : "#203C3B"} />
      ) : mode === "qr" && error ? (
        <Pressable
          accessibilityRole="button"
          style={styles.toggle}
          onPress={() => {
            setError("");
          }}
        >
          <Text style={compact ? styles.link : common.subtitle}>
            Scan again
          </Text>
        </Pressable>
      ) : mode === "qr" ? (
        <CameraScanner
          purpose="account"
          compact={compact}
          onCode={(uri) => void save(uri)}
        />
      ) : (
        <>
          {fields.map(({ label: fieldLabel, ...props }) =>
            compact ? (
              <TextInput
                key={fieldLabel}
                {...props}
                accessibilityLabel={fieldLabel}
                style={styles.input}
                placeholderTextColor={dripColors.muted}
                autoCapitalize="none"
                autoCorrect={false}
              />
            ) : (
              <Field
                key={fieldLabel}
                {...props}
                label={fieldLabel}
                autoCapitalize="none"
                autoCorrect={false}
              />
            ),
          )}
          {compact ? (
            <Pressable
              accessibilityRole="button"
              disabled={!issuer || !label || !secret}
              onPress={() => void save()}
              style={[
                styles.save,
                (!issuer || !label || !secret) && { opacity: 0.4 },
              ]}
            >
              <Text style={styles.saveText}>Add service</Text>
            </Pressable>
          ) : (
            <Button
              label="Add account"
              kind="hat"
              badge="plus"
              disabled={!issuer || !label || !secret}
              onPress={() => void save()}
            />
          )}
        </>
      )}
      <Pressable
        accessibilityRole="button"
        disabled={busy}
        onPress={() => {
          setError("");
          setMode(mode === "qr" ? "manual" : "qr");
        }}
        style={styles.toggle}
      >
        <Text style={compact ? styles.link : common.subtitle}>
          {mode === "qr" ? "Enter key instead" : "Scan QR instead"}
        </Text>
      </Pressable>
    </View>
  );
}
const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: dripColors.line,
    borderRadius: 12,
    padding: 16,
    color: dripColors.text,
    fontSize: 16,
  },
  error: { color: dripColors.error, fontSize: 14 },
  toggle: { alignItems: "center", padding: 12 },
  link: { color: dripColors.blue, fontSize: 14 },
  save: {
    backgroundColor: dripColors.blue,
    padding: 16,
    borderRadius: 24,
    alignItems: "center",
  },
  saveText: { color: dripColors.background, fontWeight: "600" },
});
