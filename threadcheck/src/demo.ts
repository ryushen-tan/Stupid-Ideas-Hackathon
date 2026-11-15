import { Vibration } from "react-native";
import { loadAccounts, LocalAccount, saveAccounts } from "./accounts";

// A fake service for testing the scanner without a website or the vault.
// The secret is the well-known RFC test key, so its codes protect nothing.
export const demoAccount: LocalAccount = {
  id: "demo-fake-bank",
  issuer: "Fake Bank",
  label: "demo@drip.test",
  secret: "JBSWY3DPEHPK3PXP",
  algorithm: "SHA1",
  digits: 6,
  period: 30,
  createdAt: "2026-11-15T00:00:00.000Z",
};

// Adds Fake Bank to the authenticator list (once), so the real browser flow
// can use it too.
export async function ensureDemoAccount() {
  const accounts = await loadAccounts();
  if (accounts.some((account) => account.id === demoAccount.id)) return;
  await saveAccounts([...accounts, demoAccount]);
}

// Buzz the phone on success. On the web this is a no-op.
export function celebrate() {
  Vibration.vibrate([0, 120, 80, 120]);
}
