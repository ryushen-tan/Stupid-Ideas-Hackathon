import { useState } from "react";
import { Image, Platform, Pressable, Text, View } from "react-native";
import {
  categories,
  ClothingItem,
  garmentKinds,
  GarmentKind,
  ItemInput,
  itemInputSchema,
  StoreSession,
} from "../../shared/model";
import { request } from "../api";
import { parseTag } from "../../shared/tags";
import { CameraScanner } from "../components/CameraScanner";
import { Garment } from "../components/Garment";
import { Button, common, Field, Notice } from "../components/UI";
import { pickPhoto } from "../photos";
import { fonts, palette } from "../theme";

export function ItemForm({
  session,
  onSaved,
}: {
  session: StoreSession;
  onSaved: (item: ClothingItem) => void;
}) {
  const [form, setForm] = useState<ItemInput>({
    name: "",
    brand: "",
    barcode: "",
    color: "",
    size: "",
    serial: "",
    category: "Tops",
    kind: "shirt",
    photo: null,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [scanTag, setScanTag] = useState(false);
  function field<Key extends keyof ItemInput>(key: Key, value: ItemInput[Key]) {
    setForm((previous) => ({ ...previous, [key]: value }));
  }
  async function photo(camera: boolean) {
    setBusy(true);
    setError("");
    try {
      const result = await pickPhoto(camera);
      if (result) field("photo", result);
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    const parsed = itemInputSchema.safeParse(form);
    if (!parsed.success) {
      setError("Add a name, brand, barcode, color, and size before saving.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      onSaved(
        await request<ClothingItem>(session, "/items", {
          method: "POST",
          body: JSON.stringify(parsed.data),
        }),
      );
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={common.stack}>
      <Text style={common.title}>Meet your next little key.</Text>
      <Text style={common.subtitle}>
        Give this exact color and size its own tag. A reference photo makes the
        second check possible.
      </Text>
      {Boolean(error) && <Notice error>{error}</Notice>}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {garmentKinds.map((kind) => (
          <Pressable
            key={kind}
            accessibilityRole="button"
            accessibilityLabel={`Choose ${kind}`}
            accessibilityState={{ selected: form.kind === kind }}
            onPress={() => {
              const category: Record<GarmentKind, ItemInput["category"]> = {
                shirt: "Tops",
                hoodie: "Tops",
                hat: "Accessories",
                bag: "Accessories",
                pants: "Bottoms",
                shoe: "Shoes",
                can: "Snacks",
                snack: "Snacks",
              };
              setForm((previous) => ({
                ...previous,
                kind,
                category: category[kind],
              }));
            }}
            style={{
              padding: 7,
              borderRadius: 15,
              backgroundColor:
                form.kind === kind ? palette.paleGreen : palette.white,
              borderWidth: 1.5,
              borderColor: form.kind === kind ? palette.ink : palette.line,
            }}
          >
            <Garment kind={kind} size={46} />
          </Pressable>
        ))}
      </View>
      <Field
        label="Piece name"
        value={form.name}
        onChangeText={(value) => field("name", value)}
        placeholder="The everyday hoodie"
        maxLength={80}
      />
      <Field
        label="Brand"
        value={form.brand}
        onChangeText={(value) => field("brand", value)}
        placeholder="Studio Basics"
        maxLength={60}
      />
      <View style={{ flexDirection: "row", gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Field
            label={form.category === "Snacks" ? "Flavor / variant" : "Color"}
            value={form.color}
            onChangeText={(value) => field("color", value)}
            placeholder="Sage green"
            maxLength={40}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Field
            label={form.category === "Snacks" ? "Package size" : "Size"}
            value={form.size}
            onChangeText={(value) => field("size", value)}
            placeholder="M"
            maxLength={20}
          />
        </View>
      </View>
      <Text style={common.eyebrow}>CATEGORY</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {categories.map((category) => (
          <Pressable
            key={category}
            accessibilityRole="button"
            accessibilityState={{ selected: form.category === category }}
            onPress={() => field("category", category)}
            style={{
              borderWidth: 1,
              borderColor: palette.line,
              backgroundColor:
                form.category === category ? palette.lime : palette.white,
              borderRadius: 20,
              padding: 10,
            }}
          >
            <Text
              style={{
                fontFamily: fonts.bold,
                fontSize: 12,
                color: palette.ink,
              }}
            >
              {category}
            </Text>
          </Pressable>
        ))}
      </View>
      <Field
        label="Product barcode / SKU"
        value={form.barcode}
        onChangeText={(value) => field("barcode", value)}
        placeholder="Scan or enter the exact product code"
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={160}
      />
      <Button
        label={scanTag ? "Close tag camera" : "Scan the tag to fill this in"}
        badge="qr"
        small
        tone="secondary"
        onPress={() => setScanTag(!scanTag)}
      />
      {scanTag && (
        <CameraScanner
          onCode={(value) => {
            try {
              const identity = parseTag(value);
              setForm((previous) => ({ ...previous, ...identity }));
            } catch (failure) {
              setError((failure as Error).message);
            }
            setScanTag(false);
          }}
        />
      )}
      <Field
        label="Serial number (optional)"
        value={form.serial}
        onChangeText={(value) => field("serial", value)}
        placeholder="For an individually tagged garment"
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={80}
      />
      <View style={[common.card, { gap: 12, alignItems: "center" }]}>
        {form.photo ? (
          <Image
            source={{ uri: form.photo }}
            style={{ width: 180, height: 180, borderRadius: 20 }}
          />
        ) : (
          <Garment kind={form.kind} badge="camera" size={95} />
        )}
        <Text style={common.sectionTitle}>Its good-side photo</Text>
        <Text style={[common.subtitle, { textAlign: "center" }]}>
          Use a clear photo of the actual piece, including any logos or
          distinctive details.
        </Text>
        <Button
          label={
            form.photo ? "Change reference photo" : "Choose reference photo"
          }
          kind="hat"
          badge="camera"
          tone="secondary"
          loading={busy}
          onPress={() => void photo(false)}
        />
        {Platform.OS !== "web" && (
          <Button
            label="Take reference photo"
            badge="camera"
            tone="quiet"
            loading={busy}
            onPress={() => void photo(true)}
          />
        )}
      </View>
      <Button
        label="Add to my stash"
        kind="hat"
        badge="plus"
        loading={busy}
        onPress={() => void save()}
      />
    </View>
  );
}
