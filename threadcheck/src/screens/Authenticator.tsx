import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import {
  AuthenticatorAccount,
  VaultOverview,
} from "../../shared/authenticator";
import { StoreSession } from "../../shared/model";
import { request } from "../api";
import { Garment } from "../components/Garment";
import { Button, common, Notice, Pill } from "../components/UI";
import { fonts, palette } from "../theme";

export function Authenticator({
  session,
  onConnect,
  onAddAccount,
  onDaily,
  onUnlock,
  onStash,
}: {
  session: StoreSession | null;
  onConnect: () => void;
  onAddAccount: () => void;
  onDaily: () => void;
  onUnlock: (account: AuthenticatorAccount) => void;
  onStash: () => void;
}) {
  const [overview, setOverview] = useState<VaultOverview | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(Boolean(session));
  const [clock, setClock] = useState(Date.now);
  const [offset, setOffset] = useState(0);
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  useEffect(() => {
    let active = true;
    if (session)
      request<VaultOverview>(session, "/vault/overview")
        .then((result) => {
          if (active) {
            setOverview(result);
            setOffset(result.serverTime - Date.now());
          }
        })
        .catch((failure) => {
          if (active) setError((failure as Error).message);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [session]);
  const daily =
    overview?.daily && overview.daily.expiresAt > clock + offset
      ? overview.daily
      : null;
  async function more() {
    if (!session || !overview) return;
    setLoading(true);
    setError("");
    try {
      const result = await request<VaultOverview>(
        session,
        `/vault/overview?offset=${overview.accounts.length}`,
      );
      setOverview({
        ...result,
        accounts: [...overview.accounts, ...result.accounts],
      });
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setLoading(false);
    }
  }
  return (
    <View style={{ gap: 24 }}>
      <View style={[common.row, { justifyContent: "space-between" }]}>
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={common.eyebrow}>VERY SERIOUSLY UNCONVENTIONAL</Text>
          <Text style={[common.title, { fontSize: wide ? 42 : 32 }]}>
            A fit check. To log in.
          </Text>
        </View>
        {wide && <Pill text="AUTHENTICATOR" tone="blue" />}
      </View>
      <View style={[styles.hero, wide && { padding: 32 }]}>
        <View
          style={{ flex: 1, maxWidth: wide ? 480 : 210, zIndex: 1, gap: 12 }}
        >
          <Text style={styles.heroTag}>
            {daily ? "TODAY’S KEYS ARE READY" : "NEW DAY. NEW DRESS CODE."}
          </Text>
          <Text
            style={[
              styles.heroTitle,
              { fontSize: wide ? 44 : 33, lineHeight: wide ? 47 : 36 },
            ]}
          >
            {daily
              ? "Nice fit.\nNow prove it."
              : "Your fit.\nYour snacks.\nYour way in."}
          </Text>
          <Text
            style={[
              common.subtitle,
              {
                fontSize: 13,
                lineHeight: 20,
                color: palette.ink,
                maxWidth: 210,
              },
            ]}
          >
            {daily
              ? "Lay out your outfit. Scan your snacks. Unlock a login code."
              : "Your daily essentials are now your very inconvenient keys."}
          </Text>
          <View style={{ alignSelf: "flex-start", marginTop: 5 }}>
            <Button
              label={daily ? "See today’s outfit" : "Set today’s outfit"}
              kind="shirt"
              badge={daily ? "check" : "camera"}
              small
              onPress={session ? onDaily : onConnect}
            />
          </View>
        </View>
        <View
          pointerEvents="none"
          style={[
            styles.art,
            { right: wide ? 42 : 12, bottom: wide ? 24 : 62 },
          ]}
        >
          <View style={styles.artCircle} />
          <View style={{ transform: [{ rotate: "-9deg" }] }}>
            <Garment kind="shirt" face size={wide ? 190 : 112} color="white" />
          </View>
          <View
            style={{
              position: "absolute",
              bottom: -26,
              right: -12,
              transform: [{ rotate: "13deg" }],
            }}
          >
            <Garment kind="can" size={wide ? 100 : 65} color={palette.lime} />
          </View>
          <Text style={styles.sparkle}>✦</Text>
        </View>
      </View>
      <View style={[common.card, { gap: 13, padding: 18 }]}>
        <View style={[common.row, { justifyContent: "space-between" }]}>
          <Text style={common.sectionTitle}>Today’s dress code</Text>
          <Pill
            text={daily ? "Enrolled" : "Not set"}
            tone={daily ? "green" : "neutral"}
          />
        </View>
        {daily ? (
          <>
            <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
              {daily.items.map((item) => (
                <View key={item.id} style={styles.dailyItem}>
                  <Garment kind={item.kind} size={36} />
                  <Text numberOfLines={1} style={styles.itemName}>
                    {item.name}
                  </Text>
                </View>
              ))}
            </View>
            <Text style={styles.caption}>
              Resets at midnight · {overview?.timezone}
            </Text>
          </>
        ) : (
          <Text style={common.subtitle}>
            One morning enrollment. A fresh scan every time you need a code.
          </Text>
        )}
      </View>
      {error ? <Notice error>{error}</Notice> : null}
      <View style={[common.row, { justifyContent: "space-between" }]}>
        <Text style={common.sectionTitle}>Your accounts</Text>
        <Button
          label="Add account"
          kind="hat"
          badge="plus"
          small
          tone="secondary"
          onPress={session ? onAddAccount : onConnect}
        />
      </View>
      {overview?.accounts.map((account) => (
        <Pressable
          key={account.id}
          accessibilityRole="button"
          accessibilityLabel={`Unlock ${account.issuer} ${account.label}`}
          onPress={() => (daily ? onUnlock(account) : onDaily())}
          style={[common.card, { gap: 15 }]}
        >
          <View style={common.row}>
            <View style={styles.accountIcon}>
              <Garment kind="hoodie" badge="qr" size={50} />
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={common.sectionTitle}>{account.issuer}</Text>
              <Text style={styles.caption}>{account.label}</Text>
            </View>
            <Pill text="Locked" />
          </View>
          <View style={[common.row, { justifyContent: "space-between" }]}>
            <Text accessibilityLabel="Code locked" style={styles.dots}>
              {account.digits === 8 ? "•••• ••••" : "••• •••"}
            </Text>
            <View style={common.row}>
              <Text style={styles.unlock}>Scan to unlock</Text>
              <Garment kind="shirt" badge="arrow" size={30} />
            </View>
          </View>
        </Pressable>
      ))}
      {loading && <ActivityIndicator color={palette.blue} />}
      {!loading && !error && !overview?.accounts.length && (
        <View
          style={[
            common.card,
            {
              alignItems: "center",
              gap: 12,
              borderStyle: "dashed",
              padding: 26,
            },
          ]}
        >
          <Garment kind="hat" badge="plus" size={75} />
          <Text style={common.sectionTitle}>Your first account awaits.</Text>
          <Text style={[common.subtitle, { textAlign: "center" }]}>
            Scan the authenticator setup QR from an account’s security settings.
            No Google sign-in needed.
          </Text>
          <Button
            label={session ? "Add an authenticator" : "Connect my vault"}
            kind="hat"
            badge="plus"
            onPress={session ? onAddAccount : onConnect}
          />
        </View>
      )}
      {overview?.hasMore && (
        <Button
          label="More accounts"
          tone="secondary"
          loading={loading}
          onPress={() => void more()}
        />
      )}
      <Pressable
        accessibilityRole="button"
        onPress={onStash}
        style={[styles.stashLink, common.row]}
      >
        <Garment kind="snack" size={43} />
        <View style={{ flex: 1 }}>
          <Text style={styles.unlock}>Stock your little key collection</Text>
          <Text style={styles.caption}>
            Add clothes + at least two snacks to your stash.
          </Text>
        </View>
        <Garment kind="hat" badge="arrow" size={30} />
      </Pressable>
      <Text
        style={[
          styles.caption,
          { textAlign: "center", letterSpacing: 1, fontSize: 10 },
        ]}
      >
        REAL CODES. RIDICULOUS RITUAL.
      </Text>
    </View>
  );
}
const styles = StyleSheet.create({
  hero: {
    backgroundColor: "#DCF3DF",
    borderWidth: 1,
    borderColor: "#B9DCC3",
    borderRadius: 27,
    padding: 22,
    minHeight: 330,
    overflow: "hidden",
  },
  heroTag: {
    fontFamily: fonts.bold,
    fontSize: 9,
    letterSpacing: 1.2,
    color: "#3D6554",
  },
  heroTitle: {
    fontFamily: fonts.display,
    color: palette.ink,
    letterSpacing: -0.7,
  },
  art: { position: "absolute", alignItems: "center", justifyContent: "center" },
  artCircle: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 110,
    backgroundColor: "#C6E8CB",
  },
  sparkle: {
    position: "absolute",
    top: -20,
    right: 0,
    color: palette.blue,
    fontSize: 35,
  },
  dailyItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: palette.paleSage,
    padding: 7,
    borderRadius: 13,
    maxWidth: 210,
  },
  itemName: {
    fontFamily: fonts.bold,
    color: palette.ink,
    fontSize: 11,
    flexShrink: 1,
  },
  caption: {
    fontFamily: fonts.medium,
    fontSize: 12,
    lineHeight: 19,
    color: palette.muted,
  },
  accountIcon: {
    backgroundColor: palette.paleBlue,
    padding: 5,
    borderRadius: 17,
  },
  dots: {
    fontFamily: fonts.display,
    fontSize: 33,
    letterSpacing: 3,
    color: palette.sage,
  },
  unlock: { fontFamily: fonts.bold, color: palette.ink, fontSize: 13 },
  stashLink: {
    padding: 16,
    backgroundColor: palette.paleBlue,
    borderRadius: 20,
  },
});
