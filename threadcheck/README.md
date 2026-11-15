# Drip Authenticator

**Your fit. Your snacks. Your way in.** A deliberately inconvenient TOTP authenticator built with Expo SDK 58, React Native, Expo Router, Express, local Supabase Postgres, and Backboard photo comparison. No OAuth or Google sign-in.

## Simple outfit screen

The default screen follows the supplied dark Authenticator reference: search, flat rows, streetwear clothing images, circular countdowns, and a floating hat-plus button. Three preset orders rotate every 30 seconds, assigning a hoodie, pants, and hat to head, body, and feet. Outfits appear immediately with no enrollment or server connection. Search filters rows; tap a row to rename/remove it, or + to add a label. Labels persist locally on each device.

These three public preset combinations are a visual demo, not TOTP credentials for external accounts. The existing real TOTP vault and camera/HID workflows remain available under **Menu → Vault & scanners**. The original vault still enforces its enrollment and verification requirements.

## Original vault workflow

1. Connect the app to your vault using its server address and pairing code.
2. Add your clothes and snacks in **Stash**. Garments need a clear reference photo. Register at least two snacks, each with its own product barcode and package variant.
3. Add an authenticator account using its `otpauth://totp/…` setup QR or Base32 setup key. Finish enabling two-factor authentication on that service using a code from Threadcheck, and retain the service’s recovery codes.
4. Each morning, choose 1–8 garments and take fresh photos of them laid out or hanging separately. Keep people out of the images. On a supported phone, confirm enrollment with Face ID or fingerprint. The server assigns two registered snacks.
5. Whenever you need a code, photograph every enrolled garment **off your body**, then scan both assigned snacks with a USB/Bluetooth store scanner. Each successful challenge reveals one current TOTP code. Closing the sheet, backgrounding the app, or letting the code expire locks the UI again.
6. The outfit and snack set expires at midnight in the server’s configured timezone (default `America/Toronto`). Existing account secrets do not reset. A new daily enrollment is required.

The browser is explicitly a preview without native biometrics. Native biometric confirmation happens locally; the server never receives biometric templates or face photographs. Only garment images are sent to Backboard. Images containing people or worn garments are instructed to fail the outfit check.

## Run locally

Requires Node 24+, Docker, and the Supabase CLI. Run from this directory:

```sh
npm ci
npm run db:start
npm run db:migrate
npm run setup:local
```

Set `BACKBOARD_API_KEY` in the ignored `server/.env`, then:

```sh
npm run dev
```

Open the web URL printed by Expo. The vault API listens on port **4310**. The server prints the LAN address and six-digit pairing code for the app’s **Vault** tab. Keep the phone, server, and scanner host on the same network.

This repository uses a separate Supabase project named `threadcheck`: API **56321**, database **56322**, Studio **56323**. It does not modify another project’s Supabase stack. Supabase Auth is not used. The application schema is private and inaccessible to the anonymous/authenticated Data API roles; the Express server connects through `pg`.

`npm run setup:local` preserves existing keys and creates a random encryption key and pairing code when absent. Keep the encryption key with your database backup: losing it makes stored TOTP secrets unrecoverable. Never put server credentials in `EXPO_PUBLIC_*` variables.

For the earlier SQLite prototype, `npx tsx scripts/migrate-sqlite.ts` copies catalog records, scan history, and active pairing sessions into Supabase without deleting the SQLite source. The current runtime uses Postgres only.

## Phone builds and scanners

Use an Expo development or internal preview build for the full native flow. Face ID is unavailable in Expo Go on iOS ([Expo documentation](https://docs.expo.dev/versions/v58.0.0/sdk/local-authentication/)).

```sh
npx eas-cli@latest login
npx eas-cli@latest build --profile development --platform ios
npx eas-cli@latest build --profile development --platform android
```

EAS builds require your Expo account and platform signing setup. `eas.json` also includes a preview APK profile. Expo CLI is signed in; no signed binary or store submission has been created in this workspace.

For snack challenges, pair a USB/Bluetooth scanner in **keyboard / HID mode**, enable its **Enter suffix**, and focus the scanner input. The software submits on Enter; there is no camera or manual-submit button for snack challenges. A scanner paired to a desktop works in that desktop’s web app; it does not relay automatically to a separate phone. Pair directly with the phone to complete the entire flow there.

The ordinary **Scan** tab remains available for catalog lookup and visual checks. Those checks do not unlock authenticator codes; only an account’s fresh daily challenge does.

## Verification and boundaries

```sh
npm run typecheck
npm run lint
npm test
npm run export:web
npx expo export --platform ios --platform android --output-dir dist-native
npx expo-doctor
```

Integration tests create and remove isolated schemas in local Supabase. They exercise RFC 6238 TOTP vectors, authenticated encryption, metadata secrecy, daily enrollment, scanner-source constraints, mismatches, uncertain photos, provider errors, photo replay rejection, session isolation, expiry, and single-use code reveals, plus the catalog/scanning flows.

This is a **single-user hackathon prototype with real TOTP generation**, not an audited replacement for a production authenticator:

- Photos compare visual appearance; they cannot prove ownership or distinguish physically identical garments. Exact replayed image bytes are blocked, but transformed images and sophisticated presentation attacks are not cryptographically prevented.
- Ordinary HID scanners behave like keyboards. The app cannot prove that keystrokes originated from physical scanner hardware.
- Face ID/fingerprint is a local app gate, not server-verifiable device attestation. The web preview deliberately has no biometric gate.
- Account secrets use AES-256-GCM with account-bound authenticated data. Codes are server-gated, uncached, and revealed once per challenge. Challenges last at most five minutes and never cross midnight.
- The service you log into may accept an already revealed TOTP again within its time window. Threadcheck cannot change that service’s verification policy or revoke a copied code.
- This local setup permits HTTP for LAN development. Use HTTPS, stronger device enrollment, isolated user ownership, hardened secret storage, and security review before any public deployment.
- Reference photos remain in the stash. Daily reference snapshots are removed when the next day’s outfit is enrolled. Unlock photos are sent to the comparison service but are not stored in Postgres; hashes are retained with challenge proofs until that daily record is pruned.
- Hardware camera, Face ID/fingerprint, and a physical store scanner still need an on-device test. Native bundle exports establish compilation, not device validation.

## Design

The primary screen uses system typography, background `#131314`, surfaces `#27292B`, and pale blue `#A8C7FA`. Backboard-generated streetwear images replace numerical codes: an ivory graffiti hoodie, indigo carpenter jeans, and a sage embroidered cap. The three assets are bundled locally, so viewing them does not call the API. Generation provenance is in `assets/streetwear/generation.json`; `node scripts/generate-streetwear.mjs hoodie` (or `pants` / `hat`) regenerates one asset using the server-only Backboard key. The original mint-and-white vault remains in the secondary route.

Screenshots in `docs/` show local test data, not linked external accounts. `docs/drip-phone.png` shows the current primary screen; older screenshots document the original vault.
