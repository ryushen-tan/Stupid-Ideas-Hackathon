import AsyncStorage from "@react-native-async-storage/async-storage";
import { BrowserInbox, clothingBarcodesStorageKey } from "../shared/bridge";
import { dailyFitStorageKey } from "../shared/daily-fit";
import { saveAccounts } from "./accounts";
import { request } from "./api";
import { clearSession, loadSession } from "./session";

export async function resetDripData(disconnect: boolean) {
  const session = await loadSession();
  if (session) {
    if (disconnect) {
      await request(session, "/session", { method: "DELETE" });
      await clearSession();
    } else {
      const inbox = await request<BrowserInbox>(session, "/bridge/inbox");
      await Promise.all(
        inbox.requests.map((pending) =>
          request(session, `/bridge/requests/${pending.id}/reject`, {
            method: "POST",
          }),
        ),
      );
    }
  }
  await saveAccounts([]);
  await AsyncStorage.multiRemove([
    dailyFitStorageKey,
    clothingBarcodesStorageKey,
  ]);
}
