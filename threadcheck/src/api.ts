import Constants from "expo-constants";
import { Platform } from "react-native";
import { ApiError, StoreSession } from "../shared/model";

export const defaultServerUrl =
  process.env.EXPO_PUBLIC_API_URL ??
  (Platform.OS === "web"
    ? `http://${globalThis.location.hostname}:4310`
    : `http://${Constants.expoConfig?.hostUri?.split(":")[0] ?? "localhost"}:4310`);

export async function request<T>(
  session: StoreSession,
  path: string,
  options: RequestInit = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${session.url}/api${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.token}`,
        ...options.headers,
      },
      signal: AbortSignal.timeout(
        path === "/drip/fit"
          ? 300_000
          : path === "/vault/daily"
            ? 780_000
            : path === "/photo-checks" || path.endsWith("/proofs")
              ? 100_000
              : 15_000,
      ),
    });
  } catch (error) {
    throw new Error(
      error instanceof Error && error.name === "TimeoutError"
        ? "The store took too long to respond. Please retry."
        : "Can’t reach your store. Check the server address and that both devices are on the same Wi-Fi.",
    );
  }
  if (!response.ok) {
    const text = await response.text();
    let message = `The store returned an error (${response.status}).`;
    if (response.headers.get("content-type")?.includes("application/json"))
      message = (JSON.parse(text) as ApiError).error;
    if (response.status === 429)
      message = "Too many attempts. Wait a minute and try again.";
    throw new Error(message);
  }
  return response.status === 204 ? (undefined as T) : response.json();
}
