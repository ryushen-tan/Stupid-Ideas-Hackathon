import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { StoreSession } from "../shared/model";
import { defaultServerUrl, request } from "./api";

const sessionKey = "threadcheck-session";

export async function loadSession(): Promise<StoreSession | null> {
  const stored = await (Platform.OS === "web"
    ? AsyncStorage.getItem(sessionKey)
    : SecureStore.getItemAsync(sessionKey));
  if (!stored) return demoPair();
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

// Single-user demo: when the build carries the vault's pairing code, pair on
// first launch so nobody has to type it. Anyone with the app can then use the
// vault, so only set EXPO_PUBLIC_DEMO_PAIRING_CODE for the demo deployment.
let pairing: Promise<StoreSession | null> | null = null;
function demoPair(): Promise<StoreSession | null> {
  const code = process.env.EXPO_PUBLIC_DEMO_PAIRING_CODE;
  if (!code) return Promise.resolve(null);
  pairing ??= request<{ token: string }>(
    { url: defaultServerUrl, token: "" },
    "/pair",
    { method: "POST", body: JSON.stringify({ code }) },
  )
    .then(async ({ token }) => {
      const session = { url: defaultServerUrl, token };
      await saveSession(session);
      return session;
    })
    .catch(() => null)
    .finally(() => {
      pairing = null;
    });
  return pairing;
}
