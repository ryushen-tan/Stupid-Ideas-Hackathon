import { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { ClothingItem, Page, StoreSession } from "../../shared/model";
import { request } from "../api";
import { ItemCard } from "../components/ItemCard";
import { Button, common, Field, Notice } from "../components/UI";

export function ItemPicker({
  session,
  onChoose,
}: {
  session: StoreSession;
  onChoose: (item: ClothingItem | null) => void;
}) {
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<ClothingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      setLoading(true);
      request<Page<ClothingItem>>(
        session,
        `/items?search=${encodeURIComponent(search)}`,
      )
        .then((result) => {
          if (active) {
            setItems(result.items);
            setError("");
          }
        })
        .catch((failure) => {
          if (active) setError((failure as Error).message);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 200);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [session, search]);
  return (
    <View style={common.stack}>
      <Text style={common.title}>Which piece is it?</Text>
      <Text style={common.subtitle}>
        Choose the exact color and size you’re expecting.
      </Text>
      <Field
        label="Find a piece"
        value={search}
        onChangeText={setSearch}
        placeholder="Search name, brand, or barcode"
      />
      <Button
        label="Look up any scanned tag"
        badge="qr"
        tone="secondary"
        onPress={() => onChoose(null)}
      />
      {Boolean(error) && <Notice error>{error}</Notice>}
      {loading && <ActivityIndicator />}
      {items.map((item) => (
        <ItemCard key={item.id} item={item} onPress={() => onChoose(item)} />
      ))}
      {!loading && !items.length && (
        <Text style={common.subtitle}>
          No pieces found. Try another search.
        </Text>
      )}
    </View>
  );
}
