# Entré — a real 2FA demo

A fictional login experience inspired by [Oui Will](https://www.awwwards.com/sites/oui-will-2), built with Next.js App Router, TypeScript, Tailwind CSS, and Supabase Auth. The architectural scene is original SVG/CSS with a floating metallic ring; no external image or font requests are needed.

## Hosted site

**https://entre-login.vercel.app**

Deployed with Vercel CLI to `ryushens-projects/entre-login` using Next.js and Node 24. Authentication runs on the dedicated Supabase project `ecsscgoijhglzontagzq` (**Entre Login**, in **Drip Authenticator**), independently of the laptop and the authenticator app’s backend.

Google sign-in returns to the hosted site. Local and hosted authenticator enrollments are separate, so connect your authenticator once on the hosted site even if you already set it up locally.

Production uses Vercel’s `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Google’s secret is configured in Supabase Auth, not Vercel or browser code. `.vercelignore` excludes local environment files from uploaded source.

- Production origin: `https://entre-login.vercel.app`
- Google callback: `https://ecsscgoijhglzontagzq.supabase.co/auth/v1/callback`
- Hosted auth configuration: `deploy/supabase/config.toml`

Redeploy from `login-demo`:

```sh
npx --yes vercel@65.16.0 project inspect --non-interactive --scope ryushens-projects
npx --yes vercel@65.16.0 deploy --prod --yes --scope ryushens-projects
```

Deployment verification covered the actual Google OAuth callback in the browser and hosted QR enrollment, incorrect-code rejection, AAL2 endpoint access, and sign-out using a temporary account that was deleted after testing.

## Google OAuth configuration

This workspace is configured with the dedicated **Entre login** web client in your existing Google Cloud project `phoney-auth`. The Google consent screen uses that project’s shared **Ryuo Studio** branding. Only basic profile and email access are requested.

The client secret is stored in ignored `login-demo/.env`, never in public frontend variables. For a fresh checkout, put these values in `login-demo/.env` before running setup:

```dotenv
SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=your-google-web-client-id
SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=your-google-client-secret
```

The Google web client must allow:

- JavaScript origin: `http://localhost:3020`
- Redirect URI: `http://127.0.0.1:56421/auth/v1/callback`

After changing these values or the Supabase configuration, run `supabase stop` followed by `npm run setup:local` from `login-demo`. Existing local database contents are preserved. The production origin and hosted Supabase callback below are also configured on this Google client.

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

1. Choose **Continue with Google**. Alternatively, choose **Create an account** and use a demo email and a new demo password with at least eight characters.
2. Select **Connect authenticator app**.
3. In Drip Authenticator, tap the **+ hat → Add app or service** and scan the QR code. Alternatively, expand **Can’t scan? Use a setup key** and enter it manually with issuer `Entre`, SHA1, six digits, and a 30-second period.
4. Read the current code shown for **Entre** on Drip’s main screen (or complete the unlock flow if you used the separate vault). Enter it on this website and choose **Verify & enter**.
5. The success page appears only after the server verifies an AAL2 session.
6. Choose **Sign out**, sign in with Google or the same email/password, and retrieve a new authenticator code. The authenticator remains enrolled; subsequent logins show the code challenge rather than a new QR code.

Scanning the laptop screen with a phone does not require exposing this website to the phone: the QR contains the standard `otpauth://` enrollment data. Keep the computer and phone clocks accurate. If you reload before completing enrollment, connect the authenticator again and replace the unfinished entry with the new QR code.

This implements **Google OAuth or password sign-in, followed by TOTP two-factor authentication**. It works with your authenticator app and other standard TOTP apps. The physical camera and your app’s unlock flow require an on-device check; integration tests use an independent TOTP implementation.

## Verification

With the development server running:

```sh
npm run test:auth
npm run build
```

The local integration test creates and deletes its own account, checks QR enrollment and incorrect-code rejection, verifies unauthenticated/AAL1 rejection by `/api/access`, and exercises successful AAL2 access plus sign-out and repeat login. Browser QA covers account creation, enrollment, code verification, success, responsive layouts, and an actual Google consent → PKCE callback → authenticator setup flow.

Google sign-in uses the Supabase SDK’s PKCE flow and returns to the same site origin. The SDK exchanges the authorization code before the existing authenticator flow continues. OAuth errors are shown on the sign-in screen.

The protected endpoint validates the signed JWT with Supabase, requires `aal2`, and fetches the authenticated user. Changing frontend state does not grant endpoint access. Sessions are managed by the Supabase browser SDK; no service-role key is used by the app. The admin key is read only by the local test for cleanup.

## Scope

This is a hackathon demo with local and hosted environments. It does not include recovery codes or password reset. Create another demo account if you lose its authenticator. To use hosted Supabase later, configure `.env.local` using `.env.example`, enable TOTP MFA, and configure email confirmation and redirect URLs for that project. The local integration test intentionally refuses remote hosts.

To stop this demo’s database without affecting your authenticator app:

```sh
supabase stop
```

## Screenshots

[Login](docs/login-desktop.png) · [QR enrollment](docs/enrollment-desktop.png) · [Verified session](docs/verified-desktop.png)

Screenshots show a temporary QA account that has been deleted; its QR code is no longer active.
