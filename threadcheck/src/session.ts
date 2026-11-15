import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { StoreSession } from "../shared/model";

const sessionKey = "threadcheck-session";

export async function loadSession(): Promise<StoreSession | null> {
  const stored = await (Platform.OS === "web"
    ? AsyncStorage.getItem(sessionKey)
    : SecureStore.getItemAsync(sessionKey));
  return stored ? JSON.parse(stored) : null;
}

export async function saveSession(session: StoreSession) {
  const stored = JSON.stringify(session);
  if (Platform.OS === "web") await AsyncStorage.setItem(sessionKey, stored);
  else await SecureStore.setItemAsync(sessionKey, stored);
}

export async function clearSession() {
  if (Platform.OS === "web") await AsyncStorage.removeItem(sessionKey);
  else await SecureStore.deleteItemAsync(sessionKey);
}
