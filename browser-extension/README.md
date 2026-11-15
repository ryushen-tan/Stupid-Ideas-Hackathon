# Drip browser extension

The extension fills a website’s existing TOTP field after you complete a clothing check in Drip. Websites keep their normal two-factor authentication; no website integration is required.

## Install locally (Chrome or Edge)

1. Open `chrome://extensions` or `edge://extensions` and enable **Developer mode**.
2. Choose **Load unpacked** and select this `browser-extension` directory.
3. Pin **Drip Authenticator** in the browser toolbar.

No build step is required for the extension. The Node dependencies are for tests only.

## Connect the app

Run the updated authenticator API from `threadcheck`:

```sh
npm run db:migrate
npm run server
```

Keep the Expo app running as usual. Pair your USB/Bluetooth store scanner to the device running Drip in **keyboard / HID mode** with an **Enter suffix**. Scans go to that device; a scanner attached to your computer cannot type into a separate phone. The daily fit still uses the existing photo extraction, but barcode approval does not call a vision provider.

1. Open the extension. Set the Drip server address, normally `http://localhost:4310` on the same computer, and choose **Connect app**.
2. In Drip, open **Menu → Browser extension**. If prompted, enter the server’s address and its six-digit pairing code. On a phone, use the computer’s LAN address printed by the API, not `localhost`.
3. Enter the extension’s eight-digit pairing code in Drip and choose **Pair browser**. Both URLs must reach the same server. Pairing codes expire after three minutes.
4. Add the website’s authenticator account with the + hat and scan your daily fit if you have not already done so.

## Fill a verification code

1. Reach the website’s verification-code screen and leave the field empty.
2. Click the extension and choose **Request code from Drip**. The popup can close; the page keeps waiting.
3. Open **Browser extension** in Drip and select the pending website. Review the exact website origin. Link the three clothing tags by scanning one barcode for your top, pants, and hat, then choose the matching service account. These barcode mappings are remembered for the day and can be edited before starting another request. Each garment must have a distinct tag.
4. Follow the displayed arrangement and scan its **head → body → feet** clothing items in order. Keep the scanner input focused; each Enter submits one scan. Wrong or repeated items cannot advance the check. The arrangement stays fixed for this request, even while the TOTP changes.
5. After the third matching barcode, Drip automatically generates a fresh code and the extension fills the original field. Continue on the website yourself.

The main page must contain a recognizable single OTP field or six/eight adjacent digit boxes. If multiple fields are ambiguous, focus the intended code field and request again. Cross-origin embedded verification forms, browser-internal pages, closed shadow roots, and unusual custom inputs are not supported. The extension does not submit forms or choose an account for you.

## Data and lifetime

The extension uses temporary access to the page where it is invoked. It stores its browser pairing token in extension-local storage restricted to trusted extension contexts. TOTP setup secrets remain in Drip and never enter the extension or relay. The relay stores a code encrypted only until it is consumed or expires. Requests expire after three minutes, and retrieval is single-use and bound to the paired browser; the extension additionally binds it to the initiating tab, document, and origin.

Pairings persist across restarts and last up to the app session’s 30-day lifetime. Disconnect in either Drip or the extension to revoke that browser. **Reset connection** forgets local extension credentials when the server is unavailable; revoke the old browser from Drip when it is reachable again.

The relay temporarily retains the frozen clothing cutouts, barcode mappings, and scan progress for the pending request; the setup is cleared on completion and expired requests are purged during subsequent relay requests. Barcode order is a hackathon interaction: HID input cannot prove which hardware typed it, how the clothes are worn, or who is wearing them. The app owns the TOTP secret and supplies the code after the scan gate. Local HTTP is for development on a trusted network; use HTTPS for remote connections.

## Verification

With local Supabase, the Next.js demo on port 3020, and Expo web on port 8081 running:

```sh
npm ci
npx playwright install chromium
npm test
```

`PLAYWRIGHT_CHROMIUM_EXECUTABLE` can point to an already-installed Chrome for Testing executable. Tests launch an isolated profile with the actual unpacked extension and a temporary relay schema. They exercise pairing, the app’s three-barcode flow, real Supabase MFA enrollment, automatic filling of the React-controlled Next.js field, successful login, split digit boxes, and refusal of ambiguous/hidden/replaced fields. The test types barcode text and Enter as a keyboard-mode scanner would, including a rejected wrong scan and checks that no code arrives early. Test users and schemas are removed afterward. A physical scanner still needs an on-device check.

The authenticator’s `npm test` separately checks unauthorized access, incorrect/out-of-order/duplicate scans, concurrent submissions, account selection immutability, expired codes, request expiry, cancellation, revocation, and single-use delivery.
