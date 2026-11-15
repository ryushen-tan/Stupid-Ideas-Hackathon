import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { ClothingItem } from "../../shared/model";
import { Garment } from "./Garment";
import { Pill } from "./UI";
import { fonts, palette } from "../theme";

export function ItemCard({
  item,
  onPress,
}: {
  item: ClothingItem;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open ${item.name}`}
      style={({ pressed }) => [
        styles.card,
        pressed && { backgroundColor: palette.paleSage },
      ]}
    >
      <View
        style={[
          styles.art,
          {
            backgroundColor:
              item.kind === "pants" || item.kind === "shoe"
                ? palette.paleBlue
                : palette.paleGreen,
          },
        ]}
      >
        {item.photo ? (
          <Image source={{ uri: item.photo }} style={styles.photo} />
        ) : (
          <Garment
            kind={item.kind}
            size={77}
            color={
              item.kind === "pants"
                ? "#8BAAC5"
                : item.kind === "shirt" || item.kind === "shoe"
                  ? "#FFFDF7"
                  : item.kind === "hat"
                    ? palette.lime
                    : palette.sage
            }
          />
        )}
      </View>
      <View style={{ flex: 1, gap: 5 }}>
        <Text style={styles.brand}>{item.brand}</Text>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.detail}>
          {item.color} <Text style={{ color: "#ADBDB3" }}> · </Text> {item.size}
        </Text>
        <Pill
          text={item.photo ? "Ready for both checks" : "Tag registered"}
          tone={item.photo ? "green" : "neutral"}
        />
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  card: {
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: palette.line,
    padding: 15,
    borderRadius: 23,
    flexDirection: "row",
    alignItems: "center",
    gap: 15,
    minHeight: 137,
  },
  art: {
    width: 87,
    height: 101,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  photo: { width: "100%", height: "100%", resizeMode: "cover" },
  brand: {
    fontFamily: fonts.bold,
    fontSize: 9,
    letterSpacing: 1.2,
    color: palette.muted,
  },
  name: { fontFamily: fonts.bold, fontSize: 16, color: palette.ink },
  detail: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: palette.muted,
    marginBottom: 3,
  },
  chevron: { fontFamily: fonts.body, fontSize: 27, color: palette.muted },
});
