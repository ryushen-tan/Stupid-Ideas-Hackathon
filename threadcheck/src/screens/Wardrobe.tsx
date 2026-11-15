import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import {
  categories,
  ClothingItem,
  Page,
  StoreSession,
} from "../../shared/model";
import { sampleItems } from "../../shared/samples";
import { request } from "../api";
import { Garment } from "../components/Garment";
import { ItemCard } from "../components/ItemCard";
import { Button, common, Notice } from "../components/UI";
import { fonts, palette } from "../theme";

const categoryIcons = {
  "": "shirt",
  Tops: "shirt",
  Bottoms: "pants",
  Accessories: "hat",
  Shoes: "shoe",
  Snacks: "snack",
} as const;

export function Wardrobe({
  session,
  onAdd,
  onScan,
  onItem,
  onConnect,
}: {
  session: StoreSession | null;
  onAdd: () => void;
  onScan: () => void;
  onItem: (item: ClothingItem) => void;
  onConnect: () => void;
}) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [items, setItems] = useState<ClothingItem[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  useEffect(() => {
    let active = true;
    const timer = setTimeout(
      async () => {
        setLoading(true);
        try {
          const result = session
            ? await request<Page<ClothingItem>>(
                session,
                `/items?search=${encodeURIComponent(search)}&category=${encodeURIComponent(category)}`,
              )
            : {
                items: sampleItems.filter(
                  (item) =>
                    (!category || item.category === category) &&
                    `${item.name} ${item.brand} ${item.barcode}`
                      .toLowerCase()
                      .includes(search.toLowerCase()),
                ),
                hasMore: false,
              };
          if (active) {
            setItems(result.items);
            setHasMore(result.hasMore);
            setError("");
          }
        } catch (failure) {
          if (active) {
            setItems([]);
            setError((failure as Error).message);
          }
        } finally {
          if (active) setLoading(false);
        }
      },
      search ? 250 : 0,
    );
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [session, search, category]);
  async function loadMore() {
    if (!session) return;
    setLoading(true);
    try {
      const result = await request<Page<ClothingItem>>(
        session,
        `/items?search=${encodeURIComponent(search)}&category=${encodeURIComponent(category)}&offset=${items.length}`,
      );
      setItems([...items, ...result.items]);
      setHasMore(result.hasMore);
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setLoading(false);
    }
  }
  return (
    <View style={{ gap: 25 }}>
      <View
        style={[
          common.row,
          { justifyContent: "space-between", alignItems: "flex-start" },
        ]}
      >
        <View style={{ flex: 1, gap: 5 }}>
          <Text style={common.eyebrow}>
            YOUR EVERYDAY ESSENTIALS, PROMOTED.
          </Text>
          <Text style={[common.title, { fontSize: wide ? 40 : 31 }]}>
            Your little stash{"\n"}of login keys.
          </Text>
          <Text style={common.subtitle}>
            Clothes, cans, and very important snacks.
          </Text>
        </View>
        {wide && (
          <Button label="Add a piece" kind="hat" badge="plus" onPress={onAdd} />
        )}
      </View>
      <View
        style={[
          styles.hero,
          { minHeight: wide ? 215 : 195 },
          !wide && { paddingVertical: 17 },
        ]}
      >
        <View style={{ flex: 1, zIndex: 1, maxWidth: wide ? 500 : 220 }}>
          {wide && (
            <View style={styles.heroLabel}>
              <Text style={styles.heroLabelText}>
                MEET YOUR CLOTHING SIDEKICK
              </Text>
            </View>
          )}
          <Text
            style={[
              styles.heroTitle,
              !wide && { fontSize: 26, lineHeight: 29, marginTop: 0 },
            ]}
          >
            Your closet.{"\n"}Now with snacks.
          </Text>
          <Text style={styles.heroText}>
            Register your favorites.{"\n"}They could be tomorrow’s dress code.
          </Text>
          <View style={{ alignSelf: "flex-start", marginTop: 16 }}>
            <Button label="Check a piece" badge="qr" onPress={onScan} small />
          </View>
        </View>
        <View
          style={[
            styles.heroArt,
            { right: wide ? 45 : -8, transform: [{ rotate: "9deg" }] },
          ]}
        >
          <View style={styles.artCircle} />
          <View style={{ zIndex: 1 }}>
            <Garment kind="shirt" size={wide ? 175 : 120} color="white" face />
          </View>
          <View style={styles.checkSticker}>
            <Text
              style={{
                fontFamily: fonts.bold,
                color: palette.ink,
                fontSize: 20,
              }}
            >
              ✓
            </Text>
          </View>
          <Text style={styles.sparkle}>✦</Text>
        </View>
      </View>
      <View style={[common.row, { justifyContent: "space-between" }]}>
        <View style={common.row}>
          <Text style={common.sectionTitle}>Your pieces</Text>
          <View style={styles.count}>
            <Text style={styles.countText}>
              {items.length}
              {hasMore ? "+" : ""}
            </Text>
          </View>
        </View>
        {!wide && (
          <Button
            label="Add new"
            kind="hat"
            badge="plus"
            onPress={onAdd}
            small
            tone="secondary"
          />
        )}
      </View>
      <View style={styles.search}>
        <Garment kind="hat" size={33} badge="search" />
        <TextInput
          accessibilityLabel="Search your wardrobe"
          placeholder="Find a piece, brand, or barcode…"
          placeholderTextColor="#81938E"
          value={search}
          onChangeText={setSearch}
          style={styles.searchInput}
        />
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginTop: -12 }}
        contentContainerStyle={{ gap: 8 }}
      >
        {(["", ...categories] as const).map((value) => (
          <Pressable
            key={value}
            accessibilityRole="button"
            accessibilityState={{ selected: category === value }}
            onPress={() => setCategory(value)}
            style={[styles.chip, category === value && styles.selectedChip]}
          >
            <Garment
              kind={categoryIcons[value]}
              size={23}
              color={category === value ? palette.lime : palette.sage}
            />
            <Text
              style={[
                styles.chipText,
                category === value && { color: palette.white },
              ]}
            >
              {value || "All pieces"}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      {error ? <Notice error>{error}</Notice> : null}
      <View style={[styles.grid, !wide && { flexDirection: "column" }]}>
        {items.map((item) => (
          <View key={item.id} style={wide ? { width: "48.9%" } : undefined}>
            <ItemCard item={item} onPress={() => onItem(item)} />
          </View>
        ))}
      </View>
      {loading && <ActivityIndicator color={palette.blue} />}
      {!loading && !error && items.length === 0 && (
        <View style={[common.card, { alignItems: "center", gap: 12 }]}>
          <Garment kind="hat" badge="search" size={90} />
          <Text style={common.sectionTitle}>No pieces found</Text>
          <Text style={common.subtitle}>
            Try a different search or add your first piece.
          </Text>
          <Button label="Add a piece" kind="hat" badge="plus" onPress={onAdd} />
        </View>
      )}
      {hasMore && (
        <Button
          label="More pieces"
          kind="bag"
          onPress={loadMore}
          loading={loading}
          tone="secondary"
        />
      )}
      {!session && (
        <View style={styles.demo}>
          <Text style={styles.demoText}>
            A peek inside a sample wardrobe.{"\n"}Connect your store to register
            and check your own pieces.
          </Text>
          <Button
            label="Connect your store"
            kind="bag"
            badge="settings"
            tone="quiet"
            small
            onPress={onConnect}
          />
        </View>
      )}
      <View style={{ alignItems: "center", gap: 6, paddingBottom: 10 }}>
        <Text style={styles.footer}>AN OUTFIT. TWO SNACKS. ONE WAY IN.</Text>
        <Text
          style={{ fontFamily: fonts.body, color: palette.muted, fontSize: 11 }}
        >
          Sample garments are for browsing, not daily enrollment.
        </Text>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  hero: {
    backgroundColor: "#DDF5DF",
    borderColor: "#C2E8C6",
    borderWidth: 1,
    borderRadius: 26,
    padding: 23,
    flexDirection: "row",
    overflow: "hidden",
  },
  heroLabel: {
    alignSelf: "flex-start",
    backgroundColor: "#F6FFF5",
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 5,
  },
  heroLabelText: {
    fontFamily: fonts.bold,
    fontSize: 8,
    letterSpacing: 1.2,
    color: "#4C7158",
  },
  heroTitle: {
    fontFamily: fonts.display,
    fontSize: 29,
    lineHeight: 33,
    color: palette.ink,
    marginTop: 11,
  },
  heroText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    lineHeight: 18,
    color: "#4C7158",
    marginTop: 7,
  },
  heroArt: {
    position: "absolute",
    bottom: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  artCircle: {
    position: "absolute",
    width: 170,
    height: 170,
    borderRadius: 100,
    backgroundColor: "#C9EDCB",
  },
  checkSticker: {
    position: "absolute",
    right: 5,
    bottom: 15,
    width: 39,
    height: 39,
    backgroundColor: palette.lime,
    borderWidth: 2,
    borderColor: palette.ink,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    transform: [{ rotate: "-20deg" }],
  },
  sparkle: {
    position: "absolute",
    right: -10,
    top: 0,
    fontSize: 32,
    color: palette.blue,
  },
  count: {
    backgroundColor: palette.paleSage,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  countText: { fontFamily: fonts.bold, fontSize: 12, color: palette.muted },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 16,
    paddingHorizontal: 13,
    minHeight: 53,
    marginTop: -9,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 15,
    fontFamily: fonts.medium,
    fontSize: 14,
    color: palette.ink,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.white,
    paddingHorizontal: 17,
    paddingVertical: 10,
  },
  selectedChip: { backgroundColor: palette.ink, borderColor: palette.ink },
  chipText: { fontFamily: fonts.bold, fontSize: 12, color: palette.muted },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 14, marginTop: -7 },
  demo: {
    alignItems: "center",
    padding: 15,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: palette.line,
    borderStyle: "dashed",
    gap: 4,
  },
  demoText: {
    textAlign: "center",
    fontFamily: fonts.medium,
    color: palette.muted,
    fontSize: 12,
    lineHeight: 19,
  },
  footer: {
    fontFamily: fonts.bold,
    fontSize: 9,
    letterSpacing: 1.4,
    color: palette.muted,
  },
});
