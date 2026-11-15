import { ComponentRef, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Platform,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import {
  AuthenticatorAccount,
  UnlockChallenge,
  UnlockedCode,
} from "../../shared/authenticator";
import { StoreSession } from "../../shared/model";
import { request } from "../api";
import { CapturePhoto } from "../components/CapturePhoto";
import { Garment } from "../components/Garment";
import { Button, common, Notice, Pill } from "../components/UI";
import { fonts, palette } from "../theme";
import { scannerInputProps, useScannerDetection } from "../scanner";

export function Unlock({
  session,
  account,
  onClose,
}: {
  session: StoreSession;
  account: AuthenticatorAccount;
  onClose: () => void;
}) {
  const [challenge, setChallenge] = useState<UnlockChallenge | null>(null);
  const [unlocked, setUnlocked] = useState<UnlockedCode | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const [capturing, setCapturing] = useState(false);
  const [barcode, setBarcode] = useState("");
  const [copied, setCopied] = useState(false);
  const [clock, setClock] = useState(Date.now);
  const [offset, setOffset] = useState(0);
  const submitting = useRef(false);
  const scanner = useRef<ComponentRef<typeof TextInput>>(null);
  const scannerStatus = useScannerDetection();
  useEffect(() => {
    let active = true;
    request<UnlockChallenge>(session, "/vault/challenges", {
      method: "POST",
      body: JSON.stringify({ accountId: account.id }),
    })
      .then((result) => {
        if (active) {
          setChallenge(result);
          setOffset(result.serverTime - Date.now());
        }
      })
      .catch((failure) => {
        if (active) setError((failure as Error).message);
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    const timer = setInterval(() => setClock(Date.now()), 250);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [session, account.id]);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") onClose();
    });
    const hide = () => {
      if (document.visibilityState === "hidden") onClose();
    };
    if (Platform.OS === "web")
      document.addEventListener("visibilitychange", hide);
    return () => {
      subscription.remove();
      if (Platform.OS === "web")
        document.removeEventListener("visibilitychange", hide);
    };
  }, [onClose]);
  const current = challenge?.items.find((item) => !item.matched);
  const expired = Boolean(challenge && clock + offset >= challenge.expiresAt);
  const remaining = unlocked
    ? Math.max(0, Math.ceil((unlocked.validUntil - clock - offset) / 1000))
    : 0;
  async function prove(
    proof:
      { source: "store"; code: string } | { source: "photo"; photo: string },
  ) {
    if (!challenge || !current || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    setCapturing(false);
    try {
      setChallenge(
        await request<UnlockChallenge>(
          session,
          `/vault/challenges/${challenge.id}/proofs`,
          {
            method: "POST",
            body: JSON.stringify({ ...proof, dailyItemId: current.id }),
          },
        ),
      );
      setBarcode("");
    } catch (failure) {
      setError((failure as Error).message);
      setBarcode("");
    } finally {
      setBusy(false);
      submitting.current = false;
    }
  }
  async function redeem() {
    if (!challenge) return;
    setBusy(true);
    setError("");
    try {
      const result = await request<UnlockedCode>(
        session,
        `/vault/challenges/${challenge.id}/redeem`,
        { method: "POST" },
      );
      setUnlocked(result);
      setOffset(result.serverTime - Date.now());
      setClock(Date.now());
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function copy() {
    try {
      await Clipboard.setStringAsync(unlocked!.code);
      setCopied(true);
    } catch (failure) {
      setError((failure as Error).message);
    }
  }
  return (
    <View style={common.stack}>
      <Text style={common.eyebrow}>
        {account.issuer} · {account.label}
      </Text>
      <Text style={common.title}>
        {unlocked
          ? remaining
            ? "You’re dressed for success."
            : "Time for a fresh check."
          : "Let’s see those keys."}
      </Text>
      {error ? <Notice error>{error}</Notice> : null}
      {unlocked ? (
        <>
          <View
            style={[
              common.card,
              { alignItems: "center", gap: 15, paddingVertical: 30 },
            ]}
          >
            <Garment
              kind="shirt"
              badge="check"
              size={85}
              color={palette.lime}
            />
            <Text style={common.eyebrow}>
              {remaining ? "YOUR LOGIN CODE" : "CODE EXPIRED"}
            </Text>
            <Text
              selectable={Boolean(remaining)}
              style={{
                fontFamily: fonts.display,
                fontSize: 44,
                letterSpacing: 5,
                color: palette.ink,
              }}
            >
              {remaining
                ? unlocked.code.replace(/(.{3,4})(?=.{3,4}$)/, "$1 ")
                : "••• •••"}
            </Text>
            <Text style={common.subtitle}>
              {remaining
                ? `${remaining}s left · enter it in ${account.issuer}`
                : "Every reveal needs a fresh outfit + snack scan."}
            </Text>
          </View>
          {remaining > 0 && (
            <Button
              label={copied ? "Copied" : "Copy login code"}
              badge="check"
              onPress={() => void copy()}
            />
          )}
          <Button
            label="Done · lock again"
            kind="hat"
            badge="check"
            onPress={onClose}
          />
        </>
      ) : expired ? (
        <>
          <Notice error>
            This request expired. Start again from your account.
          </Notice>
          <Button label="Back to accounts" onPress={onClose} />
        </>
      ) : (
        <>
          <Text style={common.subtitle}>
            Lay today’s clothes out separately, with no people in the frame.
            Then scan your snacks with the store scanner.
          </Text>
          {challenge && (
            <>
              <Pill
                text={`${challenge.items.filter((item) => item.matched).length} / ${challenge.items.length} KEYS CHECKED`}
                tone="green"
              />
              <View style={{ flexDirection: "row", gap: 9, flexWrap: "wrap" }}>
                {challenge.items.map((item) => (
                  <View
                    key={item.id}
                    style={{
                      alignItems: "center",
                      backgroundColor: item.matched
                        ? palette.paleGreen
                        : palette.white,
                      borderRadius: 16,
                      padding: 7,
                      borderWidth: 1,
                      borderColor: palette.line,
                    }}
                  >
                    <Garment
                      kind={item.kind}
                      badge={item.matched ? "check" : undefined}
                      size={50}
                    />
                    <Text
                      style={{
                        fontFamily: fonts.bold,
                        fontSize: 10,
                        color: palette.muted,
                      }}
                    >
                      {item.matched
                        ? "Matched"
                        : item.category === "Snacks"
                          ? "Scanner"
                          : "Camera"}
                    </Text>
                  </View>
                ))}
              </View>
            </>
          )}
          {busy ? (
            <View style={{ gap: 12, alignItems: "center", padding: 25 }}>
              <ActivityIndicator color={palette.blue} />
              <Text style={common.subtitle}>
                {challenge
                  ? "Checking your scan…"
                  : "Preparing your daily challenge…"}
              </Text>
            </View>
          ) : current ? (
            <View style={[common.card, { gap: 16 }]}>
              <View style={common.row}>
                <Garment kind={current.kind} size={65} />
                <View style={{ flex: 1 }}>
                  <Text style={common.eyebrow}>UP NEXT</Text>
                  <Text style={common.sectionTitle}>{current.name}</Text>
                </View>
              </View>
              {current.category === "Snacks" ? (
                <>
                  <Notice>
                    {scannerStatus.detected
                      ? "Scanner connected. Scan this snack."
                      : "Connect your USB or Bluetooth barcode scanner in keyboard mode, with an Enter suffix. Focus below, then scan this snack."}
                  </Notice>
                  <TextInput
                    ref={scanner}
                    accessibilityLabel="Store scanner input"
                    autoFocus
                    {...scannerInputProps}
                    value={barcode}
                    onChangeText={(text) => {
                      scannerStatus.track(text);
                      setBarcode(text);
                    }}
                    onSubmitEditing={(event) => {
                      scannerStatus.submitted(event.nativeEvent.text);
                      void prove({
                        source: "store",
                        code: event.nativeEvent.text,
                      });
                    }}
                    placeholder="Waiting for your scanner…"
                    style={{
                      borderWidth: 2,
                      borderColor: palette.sage,
                      borderRadius: 15,
                      padding: 16,
                      fontFamily: fonts.medium,
                      color: palette.ink,
                    }}
                  />
                  <Button
                    label="Focus store scanner"
                    kind="can"
                    badge="qr"
                    tone="secondary"
                    onPress={() => scanner.current?.focus()}
                  />
                </>
              ) : capturing ? (
                <CapturePhoto
                  onPhoto={(photo) => void prove({ source: "photo", photo })}
                />
              ) : (
                <Button
                  label="Take fresh garment photo"
                  badge="camera"
                  onPress={() => setCapturing(true)}
                />
              )}
            </View>
          ) : challenge ? (
            <>
              <Notice>
                Outfit checked. Snacks checked. Your code is ready to reveal
                once.
              </Notice>
              <Button
                label="Reveal login code"
                badge="check"
                onPress={() => void redeem()}
              />
            </>
          ) : null}
          <Button
            label="Cancel & lock"
            kind="hat"
            badge="close"
            tone="quiet"
            onPress={onClose}
          />
        </>
      )}
    </View>
  );
}
