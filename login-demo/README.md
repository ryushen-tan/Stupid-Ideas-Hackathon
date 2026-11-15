# Entré — a real 2FA demo

A fictional login experience inspired by [Oui Will](https://www.awwwards.com/sites/oui-will-2), built with Next.js App Router, TypeScript, Tailwind CSS, and Supabase Auth. The architectural scene is original SVG/CSS with a floating metallic ring; no external image or font requests are needed.

## Run

Requires Node 20.9+, Docker, and the Supabase CLI.

```sh
cd login-demo
npm install
npm run setup:local
npm run dev
```

Open **http://localhost:3020**. Setup starts the separate `entre-demo` Supabase stack on API port **56421** and database port **56422**, then writes its public client configuration to ignored `.env.local`. It does not modify your authenticator app or a hosted Supabase project. Local email confirmation is disabled for the demo.

## Connect your authenticator app

1. Choose **Create an account**. Use a demo email and a new demo password with at least eight characters.
2. Select **Connect authenticator app**.
3. In your authenticator app, add an account and scan the QR code. Alternatively, expand **Can’t scan? Use a setup key** and enter it manually with issuer `Entre`, SHA1, six digits, and a 30-second period.
4. Complete your authenticator app’s unlock flow to reveal the current code. Enter it on this website and choose **Verify & enter**.
5. The success page appears only after the server verifies an AAL2 session.
6. Choose **Sign out**, enter the same email/password, and retrieve a new authenticator code. The authenticator remains enrolled; subsequent logins show the code challenge rather than a new QR code.

Scanning the laptop screen with a phone does not require exposing this website to the phone: the QR contains the standard `otpauth://` enrollment data. Keep the computer and phone clocks accurate. If you reload before completing enrollment, connect the authenticator again and replace the unfinished entry with the new QR code.

This implements **password + TOTP two-factor authentication**, not Google/GitHub OAuth. It works with your authenticator app and other standard TOTP apps. The physical camera and your app’s unlock flow require an on-device check; integration tests use an independent TOTP implementation.

## Verification

With the development server running:

```sh
npm run test:auth
npm run build
```

The local integration test creates and deletes its own account, checks QR enrollment and incorrect-code rejection, verifies unauthenticated/AAL1 rejection by `/api/access`, and exercises successful AAL2 access plus sign-out and repeat login. Browser QA covers account creation, enrollment, code verification, success, and responsive layouts.

The protected endpoint validates the signed JWT with Supabase, requires `aal2`, and fetches the authenticated user. Changing frontend state does not grant endpoint access. Sessions are managed by the Supabase browser SDK; no service-role key is used by the app. The admin key is read only by the local test for cleanup.

## Scope

This is a local hackathon demo, with no public deployment, recovery-code flow, or password reset. Create another demo account if you lose its authenticator. To use hosted Supabase later, configure `.env.local` using `.env.example`, enable TOTP MFA, and configure email confirmation and redirect URLs for that project. The local integration test intentionally refuses remote hosts.

To stop this demo’s database without affecting your authenticator app:

```sh
supabase stop
```

## Screenshots

[Login](docs/login-desktop.png) · [QR enrollment](docs/enrollment-desktop.png) · [Verified session](docs/verified-desktop.png)

Screenshots show a temporary QA account that has been deleted; its QR code is no longer active.
