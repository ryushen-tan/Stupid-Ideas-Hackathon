# Verification — 2026-11-15

The tested story is: add a TOTP account → enroll today’s off-body outfit → receive two snacks → photograph the outfit again → scan both snack barcodes → reveal a standard login code once → hide it on expiry.

| Boundary | Result | Evidence |
| --- | --- | --- |
| Expo UI → account API → encrypted Postgres record | Passed | Added a clearly labeled demo account through the manual setup form; metadata returned no secret. Automated test decrypts the stored ciphertext only with the correct key/account binding. |
| Morning UI → camera capture → Backboard → Supabase daily record | Passed with synthetic image source | Browser camera fixture captured an authored garment illustration; real Backboard comparison accepted it; UI displayed the fixed daily garment and two snacks. |
| Unlock UI → fresh camera capture → Backboard → saved proof | Passed with synthetic image source | A separately rendered garment image passed real comparison; challenge advanced from 0/3 to 1/3. |
| HID input path → barcode API → challenge progress | Passed with simulated keystrokes | Wrong snack returned a visible mismatch. UPC representation matched its padded registered GTIN. Enter-terminated inputs advanced to 3/3. |
| Complete challenge → TOTP generation → UI | Passed | Real code displayed with its remaining lifetime. RFC 6238 tests confirm expected values. Repeated redemption returns 410. |
| Code expiry → locked UI | Passed | Code became masked and copy button disappeared when its period ended. |
| Daily reset and isolation | Passed in integration tests | Midnight in America/Toronto clears the active daily fit; another session cannot use a challenge; a new challenge supersedes the old one; expired requests cannot redeem. |
| Expo package health | Passed | `expo-doctor`: 20/20 checks. |
| Static checks | Passed | TypeScript and ESLint. |
| Automated tests | Passed | 21 tests against disposable Supabase schemas. |
| Bundles | Passed | Web, iOS, and Android export successfully. |
| Real phone camera, Face ID/fingerprint, physical scanner | Not run | Requires actual hardware and an iOS development/preview build for Face ID. |
| Signed installable application | Not built | EAS profiles are configured; `eas whoami` reports `Not logged in`. Account/signing setup is still required. |

The browser run used a separate temporary schema and test server on port 4311. Its data is discarded afterward and the original vault connection is restored. Test account secrets are standard public fixtures and are not connected to any external service.

A web capture-format bug was found and fixed during this run: Expo Camera returns a complete data URL on web, while native capture returns bare Base64. The capture component now selects the documented platform-specific representation.

These checks establish functional behavior. They do not establish cryptographic garment identity, scanner hardware provenance, or biometric attestation; see the README for the prototype’s boundaries.

## Drip simplified UI — November 15, 2026

- Main route now opens immediately to three preset clothing orders, without vault pairing or daily enrollment. Original vault remains at `/vault`.
- Checked mobile layout at 390 × 844; screenshot: `drip-phone.png`.
- Browser search filtered correctly. Added a temporary row through the UI, reloaded to verify local persistence, then removed it through the UI.
- Verified all three offsets at 29,999 ms, 30,000 ms, and 90,000 ms to check rollover and repeat behavior.
- Typecheck, lint, and iOS/web production bundle exports passed.
- Expo tunnel restarted with a clean Metro cache after a development hot-reload graph error.
- Physical iPhone reported unavailable through CoreDevice at final verification; the updated screen was not visually verified on the phone.
