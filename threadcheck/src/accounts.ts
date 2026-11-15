import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { AuthenticatorAccount } from "../shared/authenticator";
import { parseAccount, TotpAccount } from "../shared/totp";

export type LocalAccount = AuthenticatorAccount & Pick<TotpAccount, "secret">;
const accountsKey = "drip-accounts-v1";

export async function loadAccounts(): Promise<LocalAccount[]> {
  const stored = await (Platform.OS === "web"
    ? AsyncStorage.getItem(accountsKey)
    : SecureStore.getItemAsync(accountsKey));
  if (!stored) return [];
  const accounts: LocalAccount[] = JSON.parse(stored);
  return accounts.map((account) => ({
    ...account,
    ...parseAccount({ method: "manual", ...account }),
  }));
}

export async function saveAccounts(accounts: LocalAccount[]) {
  const stored = JSON.stringify(accounts);
  if (Platform.OS === "web") await AsyncStorage.setItem(accountsKey, stored);
  else await SecureStore.setItemAsync(accountsKey, stored);
}
