import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export function secretCipher(encodedKey: string) {
  const key = Buffer.from(encodedKey, "base64");
  if (key.length !== 32)
    throw new Error("VAULT_ENCRYPTION_KEY must encode 32 random bytes.");
  return {
    encrypt(secret: string, accountId: string) {
      const nonce = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", key, nonce);
      cipher.setAAD(Buffer.from(accountId));
      const ciphertext = Buffer.concat([
        cipher.update(secret, "utf8"),
        cipher.final(),
      ]);
      return Buffer.concat([nonce, cipher.getAuthTag(), ciphertext]).toString(
        "base64",
      );
    },
    decrypt(encoded: string, accountId: string) {
      const encrypted = Buffer.from(encoded, "base64");
      const decipher = createDecipheriv(
        "aes-256-gcm",
        key,
        encrypted.subarray(0, 12),
      );
      decipher.setAAD(Buffer.from(accountId));
      decipher.setAuthTag(encrypted.subarray(12, 28));
      return Buffer.concat([
        decipher.update(encrypted.subarray(28)),
        decipher.final(),
      ]).toString("utf8");
    },
  };
}
