import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import * as OTPAuth from "otpauth";
import { z } from "zod";
import { accountInputSchema } from "../shared/authenticator";

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
export function parseAccount(input: z.infer<typeof accountInputSchema>) {
  const parsed =
    input.method === "qr"
      ? OTPAuth.URI.parse(input.uri)
      : new OTPAuth.TOTP({
          ...input,
          secret: input.secret.replace(/\s/g, "").toUpperCase(),
        });
  if (!(parsed instanceof OTPAuth.TOTP))
    throw new Error(
      "Only time-based (TOTP) accounts are supported. This is not a TOTP setup QR.",
    );
  const account = z
    .object({
      issuer: z.string().min(1).max(80),
      label: z.string().min(1).max(120),
      algorithm: z.enum(["SHA1", "SHA256", "SHA512"]),
      digits: z.union([z.literal(6), z.literal(8)]),
      period: z.number().int().min(15).max(120),
    })
    .parse({
      issuer: parsed.issuer || "Account",
      label: parsed.label,
      algorithm: parsed.algorithm,
      digits: parsed.digits,
      period: parsed.period,
    });
  if (parsed.secret.buffer.byteLength < 10)
    throw new Error(
      "The setup key is too short. Use the full key from your account’s security settings.",
    );
  return { ...account, secret: parsed.secret.base32 };
}
