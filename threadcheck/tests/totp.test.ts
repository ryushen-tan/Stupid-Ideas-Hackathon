import assert from "node:assert/strict";
import { test } from "node:test";
import { accountInputSchema } from "../shared/authenticator";
import { accountCode, parseAccount } from "../shared/totp";

const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

test("setup QR preserves service identity and TOTP settings", () => {
  const account = parseAccount({
    method: "qr",
    uri: `otpauth://totp/Microsoft:alice%40outlook.com?secret=${secret}&issuer=Microsoft&algorithm=SHA1&digits=8&period=30`,
  });
  assert.equal(account.issuer, "Microsoft");
  assert.equal(account.label, "alice@outlook.com");
  assert.equal(accountCode(account, 59_000), "94287082");
  assert.equal(accountCode(account, 1_111_111_109_000), "07081804");
});

test("manual keys match QR enrollment and codes change at the period boundary", () => {
  const qr = parseAccount({
    method: "qr",
    uri: `otpauth://totp/Entre:alice?secret=${secret}&issuer=Entre`,
  });
  const manual = parseAccount(
    accountInputSchema.parse({
      method: "manual",
      issuer: "Entre",
      label: "alice",
      secret: secret.toLowerCase(),
    }),
  );
  assert.deepEqual(manual, qr);
  assert.equal(accountCode(qr, 59_999), "287082");
  assert.notEqual(accountCode(qr, 60_000), "287082");
});

test("unrelated QR codes, counter-based accounts, and weak keys are rejected", () => {
  for (const uri of [
    "https://example.com",
    `otpauth://hotp/Test:alice?secret=${secret}&counter=0`,
    "otpauth://totp/Test:alice?secret=MY",
    `otpauth://totp/Test:alice?secret=${secret}&digits=9`,
  ]) {
    assert.throws(() => parseAccount({ method: "qr", uri }));
  }
});
