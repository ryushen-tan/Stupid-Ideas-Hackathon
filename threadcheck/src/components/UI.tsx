import { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from "react-native";
import { GarmentKind } from "../../shared/model";
import { Badge, Garment } from "./Garment";
import { fonts, palette } from "../theme";

export function Button({
  label,
  onPress,
  kind = "shirt",
  badge = "arrow",
  tone = "primary",
  disabled = false,
  loading = false,
  small = false,
}: {
  label: string;
  onPress: () => void;
  kind?: GarmentKind;
  badge?: Badge;
  tone?: "primary" | "secondary" | "quiet";
  disabled?: boolean;
  loading?: boolean;
  small?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        tone === "secondary" && styles.secondary,
        tone === "quiet" && styles.quiet,
        small && styles.small,
        (disabled || loading) && { opacity: 0.5 },
        pressed && { transform: [{ translateY: 2 }], opacity: 0.85 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.ink} size="small" />
      ) : (
        <Garment
          kind={kind}
          size={small ? 30 : 37}
          badge={badge}
          color={tone === "primary" ? palette.white : palette.sage}
        />
      )}
      <Text style={[styles.buttonLabel, small && { fontSize: 13 }]}>
        {label}
      </Text>
    </Pressable>
  );
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={{ gap: 7 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor="#81938E"
        {...props}
        style={[styles.input, props.style]}
      />
    </View>
  );
}
export function Notice({
  children,
  error = false,
}: {
  children: ReactNode;
  error?: boolean;
}) {
  return (
    <View
      accessibilityRole={error ? "alert" : undefined}
      style={[
        styles.notice,
        error && {
          backgroundColor: palette.paleDanger,
          borderColor: "#EBC9C3",
        },
      ]}
    >
      <Text style={[styles.noticeText, error && { color: palette.danger }]}>
        {children}
      </Text>
    </View>
  );
}
export function Pill({
  text,
  tone = "neutral",
}: {
  text: string;
  tone?: "neutral" | "green" | "red" | "blue";
}) {
  return (
    <View
      style={[
        styles.pill,
        {
          backgroundColor:
            tone === "green"
              ? palette.paleGreen
              : tone === "red"
                ? palette.paleDanger
                : tone === "blue"
                  ? palette.paleBlue
                  : palette.paleSage,
        },
      ]}
    >
      <Text
        style={[
          styles.pillText,
          tone === "red" && { color: palette.danger },
          tone === "blue" && { color: palette.blue },
        ]}
      >
        {text}
      </Text>
    </View>
  );
}
export const common = StyleSheet.create({
  title: {
    fontFamily: fonts.display,
    fontSize: 32,
    color: palette.ink,
    letterSpacing: -0.7,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 23,
    color: palette.muted,
  },
  sectionTitle: { fontFamily: fonts.bold, fontSize: 19, color: palette.ink },
  text: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 23,
    color: palette.ink,
  },
  eyebrow: {
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 1.5,
    color: palette.muted,
  },
  card: {
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 24,
    padding: 20,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  stack: { gap: 18 },
});
const styles = StyleSheet.create({
  button: {
    backgroundColor: palette.lime,
    borderWidth: 1.5,
    borderColor: palette.ink,
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 9,
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  secondary: { backgroundColor: palette.white, borderColor: palette.line },
  quiet: {
    backgroundColor: "transparent",
    borderColor: "transparent",
    paddingHorizontal: 6,
  },
  small: {
    minHeight: 42,
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 14,
    gap: 6,
  },
  buttonLabel: { fontFamily: fonts.bold, fontSize: 15, color: palette.ink },
  input: {
    backgroundColor: palette.white,
    borderWidth: 1.5,
    borderColor: palette.line,
    borderRadius: 15,
    paddingHorizontal: 15,
    paddingVertical: 13,
    minHeight: 50,
    fontFamily: fonts.medium,
    fontSize: 15,
    color: palette.ink,
  },
  label: { fontFamily: fonts.bold, fontSize: 13, color: palette.ink },
  notice: {
    backgroundColor: palette.paleBlue,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#D6E3EE",
    padding: 14,
  },
  noticeText: {
    fontFamily: fonts.medium,
    color: palette.blue,
    fontSize: 13,
    lineHeight: 20,
  },
  pill: {
    alignSelf: "flex-start",
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 20,
  },
  pillText: { fontFamily: fonts.bold, fontSize: 11, color: "#3D6554" },
});
