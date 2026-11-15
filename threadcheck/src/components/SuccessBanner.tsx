import { useEffect, useState } from "react";
import { Animated, Pressable, StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// A notification-style banner that drops in from the top of the screen.
export function SuccessBanner({
  title,
  body,
  onDismiss,
}: {
  title: string;
  body?: string;
  onDismiss: () => void;
}) {
  const [slide] = useState(() => new Animated.Value(-160));
  useEffect(() => {
    Animated.spring(slide, { toValue: 0, useNativeDriver: true }).start();
    const timer = setTimeout(onDismiss, 8000);
    return () => clearTimeout(timer);
  }, [slide, onDismiss]);
  return (
    <SafeAreaView pointerEvents="box-none" style={styles.wrap}>
      <Animated.View style={{ transform: [{ translateY: slide }] }}>
        <Pressable
          accessibilityRole="alert"
          accessibilityLabel={`${title}. ${body ?? ""}`}
          onPress={onDismiss}
          style={styles.banner}
        >
          <Text style={styles.title}>✅ {title}</Text>
          {!!body && <Text style={styles.body}>{body}</Text>}
        </Pressable>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 10 },
  banner: {
    margin: 12,
    padding: 16,
    borderRadius: 20,
    backgroundColor: "#A2FAA3",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  title: { color: "#131314", fontSize: 17, fontWeight: "700" },
  body: { color: "#131314", fontSize: 15, marginTop: 4 },
});
