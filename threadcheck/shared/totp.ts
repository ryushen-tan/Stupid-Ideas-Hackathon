import * as OTPAuth from "otpauth";
import { z } from "zod";
import { accountInputSchema } from "./authenticator";

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

export type TotpAccount = ReturnType<typeof parseAccount>;

export function accountCode(account: TotpAccount, timestamp: number) {
  return new OTPAuth.TOTP(account).generate({ timestamp });
}
