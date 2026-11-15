import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { StoreSession } from "../shared/model";
import { defaultServerUrl, request } from "./api";

const sessionKey = "threadcheck-session";
export const demoPairingCode = process.env.EXPO_PUBLIC_DEMO_PAIRING_CODE ?? "";
let pendingDemoConnection: Promise<StoreSession> | null = null;

export async function connectSession(url: string, code: string) {
  const paired = await request<{ token: string }>({ url, token: "" }, "/pair", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
  const session = { url, token: paired.token };
  await saveSession(session);
  return session;
}

export async function loadSession(): Promise<StoreSession | null> {
  const stored = await (Platform.OS === "web"
    ? AsyncStorage.getItem(sessionKey)
    : SecureStore.getItemAsync(sessionKey));
  if (!stored) {
    if (!demoPairingCode) return null;
    if (!pendingDemoConnection)
      pendingDemoConnection = connectSession(
        defaultServerUrl,
        demoPairingCode,
      ).finally(() => {
        pendingDemoConnection = null;
      });
    return pendingDemoConnection;
  }
  const session: StoreSession = JSON.parse(stored);
  if (
    session.url === process.env.EXPO_PUBLIC_PREVIOUS_API_URL &&
    session.url !== defaultServerUrl
  ) {
    session.url = defaultServerUrl;
    await saveSession(session);
  }
  return session;
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
