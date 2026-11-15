# Drip Authenticator

**Your fit. Your snacks. Your way in.** A deliberately inconvenient TOTP authenticator built with Expo SDK 58, React Native, Expo Router, Express, local Supabase Postgres, and Backboard photo comparison. No OAuth or Google sign-in.

## Add an app or service

Tap the **+ hat** on the main screen to open the camera scanner. In the app or website you want to protect (Microsoft, Google, Entré, etc.), open two-factor authentication settings, choose an authenticator app, and scan its setup QR. If you cannot use the camera, choose **Enter key** and enter the service name, account label, and Base32 setup key.

Accounts show clothing combinations on a mannequin with placement labels and per-service countdowns. The hoodie fits the torso, torso pants hook around the sleeve/arm area, lower garments follow two legs to the ankles, a lower cap covers the crotch, pants on the head form a tied wrap, a hoodie on the head forms a durag, and a lower hoodie flips upside down. Scanned cutouts use the same positioning; the wrap clips the actual pants image into illustrated folds. Numeric TOTP codes are used internally to select the arrangement but are never rendered or offered for copying on the main screen or account details. Tap an account to rename its label. To delete a service, tap its trash icon or choose **Delete service** in account details, then confirm. Cancel keeps it unchanged; confirmed deletion persists on this device and does not disable two-factor authentication on the service itself. Search matches service names and account labels, and daily fit cutouts replace the bundled clothing images.

Main-screen accounts work offline and persist on the device: native apps use Expo SecureStore; the web preview uses browser storage. Browser storage is not encrypted, so use disposable accounts for web demos. Old demo outfit labels are left untouched in storage and no longer appear as authenticator accounts. The separate outfit-gated server vault remains under **Menu → Settings → Vault & scanners**.

To repeat setup, open **Menu → Settings → Reset Drip data → Delete saved data**. This clears saved services, today’s outfit, clothing barcodes, and pending browser approvals while keeping your server/browser connection. Enable **Also disconnect server & browsers** for a full disconnect. Resetting Drip does not disable two-factor authentication on the websites you enrolled.

The companion site at `http://localhost:3020` uses normal numerical TOTP entry. The browser extension fills that field after the three clothing barcode scans in Drip. The separate server vault retains its gated code-reveal flow.

## Browser extension

Use **Menu → Browser extension** to pair Chrome or Edge and approve website requests. Link the barcodes for your top, pants, and hat, then scan the displayed arrangement in head → body → feet order with a keyboard-mode store scanner. Three matching scans automatically send one current TOTP code to the requesting tab. The website keeps its usual numeric 2FA field. For the single-user demo, `BROWSER_DEMO_AUTO_CONNECT=true` remembers the first connected Drip app and pairs browsers automatically. The local login page also requests its code automatically. See [extension setup and usage](../browser-extension/README.md).

## Original vault workflow

1. Connect the app to your vault using its server address and pairing code.
2. Add your clothes and snacks in **Stash**. Garments need a clear reference photo. Register at least two snacks, each with its own product barcode and package variant.
3. Add an authenticator account using its `otpauth://totp/…` setup QR or Base32 setup key. Finish enabling two-factor authentication on that service using a code from Threadcheck, and retain the service’s recovery codes.
4. Each morning, choose 1–8 garments and take fresh photos of them laid out or hanging separately. Keep people out of the images. On a supported phone, confirm enrollment with Face ID or fingerprint. The server assigns two registered snacks.
5. Whenever you need a code, photograph every enrolled garment **off your body**, then scan both assigned snacks with a USB/Bluetooth store scanner. Each successful challenge reveals one current TOTP code. Closing the sheet, backgrounding the app, or letting the code expire locks the UI again.
6. The outfit and snack set expires at midnight in the server’s configured timezone (default `America/Toronto`). Existing account secrets do not reset. A new daily enrollment is required.

The browser is explicitly a preview without native biometrics. Native biometric confirmation happens locally; the server never receives biometric templates or face photographs. Only garment images are sent to Backboard. Images containing people or worn garments are instructed to fail the outfit check.

## Hosted deployment

The web app and API are hosted together at **https://drip-authenticator.vercel.app** in Vercel project **ryushens-projects/drip-authenticator**. Vercel uses `threadcheck` as the repository root directory, Node 24, and `npm run build:vercel`. Expo exports the web UI, and esbuild bundles the Express server for the Node function in `api/index.mjs`.

The database lives in the existing **Ryuo Supabase** project (`iijwbjappulhuiviyoph`), under the private `threadcheck` schema. The `drip_server` database role can read and write Drip's tables but cannot read Ryuo's public tables. Production credentials live in Vercel environment variables: `DATABASE_URL`, `DATABASE_SSL_CA`, `PAIRING_CODE`, `VAULT_ENCRYPTION_KEY`, `BACKBOARD_API_KEY`, and `VAULT_TIMEZONE`. The database uses the session pooler with its CA certificate and hostname verification. Keep `BROWSER_DEMO_AUTO_CONNECT` disabled on the public deployment.

Drip's schema was installed from `supabase/migrations` without changing Ryuo's migration history. Apply future Drip migrations explicitly with `supabase db query --remote=iijwbjappulhuiviyoph --file <new-migration.sql>`. Do not run `supabase db reset` or push this application's migration history over the shared Ryuo project. New tables must grant the `drip_server` role access while remaining inaccessible to `anon` and `authenticated`.

The production website calls its own origin. Set `EXPO_PUBLIC_API_URL=https://drip-authenticator.vercel.app` in local Expo configuration to use this backend from a phone. When moving an existing vault with its sessions and encryption key, `EXPO_PUBLIC_PREVIOUS_API_URL` can name the old server address so the app preserves its pairing. These public variables must never contain credentials. Expo Go still requires a running Metro development server; the hosted website and API do not.

Deploy from the repository root after linking the Vercel project:

```sh
npx vercel@latest deploy --prod --scope ryushens-projects
```

Server requests have a five-minute execution limit. Camera uploads are resized to a 1,200-pixel longest edge before sending. The companion login demo remains a separate local app.

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
- Original vault account secrets use AES-256-GCM with account-bound authenticated data. Codes are server-gated, uncached, and revealed once per challenge. Challenges last at most five minutes and never cross midnight.
- The service you log into may accept an already revealed TOTP again within its time window. Threadcheck cannot change that service’s verification policy or revoke a copied code.
- This local setup permits HTTP for LAN development. Use HTTPS, stronger device enrollment, isolated user ownership, hardened secret storage, and security review before any public deployment.
- Reference photos remain in the stash. Daily reference snapshots are removed when the next day’s outfit is enrolled. Unlock photos are sent to the comparison service but are not stored in Postgres; hashes are retained with challenge proofs until that daily record is pruned.
- Hardware camera, Face ID/fingerprint, and a physical store scanner still need an on-device test. Native bundle exports establish compilation, not device validation.

## Design

The primary screen uses system typography, background `#131314`, surfaces `#27292B`, and pale blue `#A8C7FA`. Transparent Backboard streetwear cutouts dress a neutral mannequin: an ivory graffiti hoodie, indigo carpenter jeans, and a sage embroidered cap. The three assets are bundled locally, so viewing them does not call the API. Generation provenance is in `assets/streetwear/generation.json`; `node scripts/generate-streetwear.mjs hoodie` (or `pants` / `hat`) regenerates the source artwork using the server-only Backboard key. The original mint-and-white vault remains in the secondary route.

Screenshots in `docs/` show local test data, not linked external accounts. `docs/mannequin-poses.png` shows all three clothing arrangements; older screenshots document earlier layouts and the original vault.
