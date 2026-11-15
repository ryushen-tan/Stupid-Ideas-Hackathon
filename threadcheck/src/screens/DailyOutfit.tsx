import { useEffect, useState } from "react";
import { ActivityIndicator, Image, Platform, Text, View } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";
import { DailyFit, VaultOverview } from "../../shared/authenticator";
import { ClothingItem, Page, StoreSession } from "../../shared/model";
import { request } from "../api";
import { CapturePhoto } from "../components/CapturePhoto";
import { Garment } from "../components/Garment";
import { Button, common, Notice, Pill } from "../components/UI";

export function DailyOutfit({
  session,
  onSaved,
  onStash,
}: {
  session: StoreSession;
  onSaved: () => void;
  onStash: () => void;
}) {
  const [overview, setOverview] = useState<VaultOverview | null>(null);
  const [items, setItems] = useState<ClothingItem[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [pieces, setPieces] = useState<{ item: ClothingItem; photo: string }[]>(
    [],
  );
  const [capturing, setCapturing] = useState<ClothingItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    Promise.all([
      request<VaultOverview>(session, "/vault/overview"),
      request<Page<ClothingItem>>(session, "/items"),
    ])
      .then(([vault, page]) => {
        if (active) {
          setOverview(vault);
          setItems(page.items);
          setHasMore(page.hasMore);
        }
      })
      .catch((failure) => {
        if (active) setError((failure as Error).message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [session]);
  async function more() {
    setLoading(true);
    try {
      const page = await request<Page<ClothingItem>>(
        session,
        `/items?offset=${items.length}`,
      );
      setItems([...items, ...page.items]);
      setHasMore(page.hasMore);
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setLoading(false);
    }
  }
  async function enroll() {
    setBusy(true);
    setError("");
    try {
      if (Platform.OS !== "web") {
        if (
          !(await LocalAuthentication.hasHardwareAsync()) ||
          !(await LocalAuthentication.isEnrolledAsync())
        )
          throw new Error(
            "Set up Face ID or fingerprint authentication on your phone before enrolling your daily outfit.",
          );
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: "Confirm today’s Threadcheck outfit",
          disableDeviceFallback: true,
          biometricsSecurityLevel: "strong",
        });
        if (!result.success)
          throw new Error(
            `Biometric confirmation did not finish (${result.error}). Your outfit has not been saved.`,
          );
      }
      await request<DailyFit>(session, "/vault/daily", {
        method: "POST",
        body: JSON.stringify({
          pieces: pieces.map((piece) => ({
            itemId: piece.item.id,
            photo: piece.photo,
          })),
        }),
      });
      onSaved();
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (loading && !overview) return <ActivityIndicator />;
  if (overview?.daily)
    return (
      <View style={common.stack}>
        <Pill text="TODAY’S OUTFIT IS SET" tone="green" />
        <Text style={common.title}>Your keys for the day.</Text>
        <Text style={common.subtitle}>
          Every unlock needs these clothes laid out on a surface, plus these two
          snacks through your store scanner.
        </Text>
        {overview.daily.items.map((item) => (
          <View key={item.id} style={[common.card, common.row]}>
            <Garment kind={item.kind} size={55} />
            <View style={{ flex: 1 }}>
              <Text style={common.sectionTitle}>{item.name}</Text>
              <Text style={common.subtitle}>
                {item.category === "Snacks"
                  ? "Store barcode scanner"
                  : "Fresh off-body photo"}
              </Text>
            </View>
          </View>
        ))}
        <Notice>
          Resets at midnight in {overview.timezone}. Today’s selection stays
          fixed until then.
        </Notice>
        <Button label="Back to my accounts" badge="check" onPress={onSaved} />
      </View>
    );
  return (
    <View style={common.stack}>
      <Text style={common.eyebrow}>THE MORNING RITUAL</Text>
      <Text style={common.title}>What’s the fit today?</Text>
      <Text style={common.subtitle}>
        Choose today’s clothes and photograph each piece on a surface, before
        putting it on. We’ll pick two snacks from your stash.
      </Text>
      {error ? <Notice error>{error}</Notice> : null}
      {Platform.OS === "web" ? (
        <Notice>
          Browser preview: Face ID is unavailable here. The phone app asks for
          Face ID or fingerprint confirmation.
        </Notice>
      ) : null}
      {capturing ? (
        <View style={common.stack}>
          <Text style={common.sectionTitle}>{capturing.name}</Text>
          <CapturePhoto
            onPhoto={(photo) => {
              setPieces([
                ...pieces.filter((piece) => piece.item.id !== capturing.id),
                { item: capturing, photo },
              ]);
              setCapturing(null);
            }}
          />
          <Button
            label="Cancel photo"
            badge="close"
            tone="quiet"
            onPress={() => setCapturing(null)}
          />
        </View>
      ) : (
        <>
          {pieces.map((piece) => (
            <View key={piece.item.id} style={[common.card, common.row]}>
              <Image
                source={{ uri: piece.photo }}
                style={{ width: 60, height: 60, borderRadius: 14 }}
              />
              <Text style={[common.text, { flex: 1 }]}>{piece.item.name}</Text>
              <Button
                label="Remove"
                small
                tone="quiet"
                badge="close"
                disabled={busy}
                onPress={() =>
                  setPieces(
                    pieces.filter(
                      (selected) => selected.item.id !== piece.item.id,
                    ),
                  )
                }
              />
            </View>
          ))}
          {items
            .filter(
              (item) =>
                item.category !== "Snacks" &&
                !item.id.startsWith("sample-") &&
                !pieces.some((piece) => piece.item.id === item.id),
            )
            .map((item) => (
              <View key={item.id} style={[common.card, { gap: 10 }]}>
                <View style={common.row}>
                  <Garment kind={item.kind} size={43} />
                  <View style={{ flex: 1 }}>
                    <Text style={common.sectionTitle}>{item.name}</Text>
                    <Text style={common.subtitle}>
                      {item.photo
                        ? "Ready for a fresh morning photo"
                        : "Add a reference photo in your stash first"}
                    </Text>
                  </View>
                </View>
                <Button
                  label={`Photograph ${item.name}`}
                  badge="camera"
                  tone="secondary"
                  small
                  disabled={!item.photo || pieces.length >= 8 || busy}
                  onPress={() => setCapturing(item)}
                />
              </View>
            ))}
          {hasMore && (
            <Button
              label="More clothes"
              tone="secondary"
              loading={loading}
              onPress={() => void more()}
            />
          )}
          <Button
            label="Add clothes or snacks to stash"
            kind="bag"
            badge="plus"
            tone="quiet"
            disabled={busy}
            onPress={onStash}
          />
          <Notice>
            Pick 1–8 garments. Have at least two different snacks registered.
            The set stays fixed until midnight in{" "}
            {overview?.timezone ?? "your vault’s timezone"}.
          </Notice>
          <Button
            label={
              Platform.OS === "web"
                ? "Set today’s outfit · web preview"
                : "Confirm outfit with biometrics"
            }
            badge="check"
            disabled={!pieces.length}
            loading={busy}
            onPress={() => void enroll()}
          />
          {busy && (
            <Text style={common.subtitle}>
              Checking each garment photo. This can take a minute per piece.
            </Text>
          )}
        </>
      )}
    </View>
  );
}
