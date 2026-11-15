import { test, expect, chromium } from "@playwright/test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";

const require = createRequire(
  new URL("../../login-demo/package.json", import.meta.url),
);
const { createClient } = require("@supabase/supabase-js");
const extensionPath = path.resolve(import.meta.dirname, "..");
let context;
let worker;
let extensionId;
let profile;
test.beforeAll(async () => {
  profile = await mkdtemp(path.join(tmpdir(), "drip-extension-"));
  context = await chromium.launchPersistentContext(profile, {
    channel: "chromium",
    headless: true,
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
      : {}),
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });
  worker =
    context.serviceWorkers()[0] ??
    (await context.waitForEvent("serviceworker"));
  extensionId = new URL(worker.url()).host;
  await worker.evaluate(() =>
    chrome.storage.local.set({ serverUrl: "http://127.0.0.1:4321" }),
  );
});
test.afterEach(async ({}, testInfo) => {
  if (testInfo.status !== testInfo.expectedStatus && context) {
    const page = context
      .pages()
      .find((entry) => entry.url().includes("8081/browser"));
    if (page) {
      await page.screenshot({
        path: testInfo.outputPath("app-failure.png"),
        fullPage: true,
      });
      console.log(
        await page.evaluate(() => ({
          text: document.body.innerText,
          visibility: document.visibilityState,
        })),
      );
    }
  }
});
test.afterAll(async () => {
  await context?.close();
  if (profile) await rm(profile, { recursive: true, force: true });
});

test("demo auto-connects to Drip and fills real Next.js MFA after three clothing scans", async ({
  request,
}) => {
  const configuration = JSON.parse(
    execFileSync("supabase", ["status", "--output", "json"], {
      cwd: path.resolve(extensionPath, "../login-demo"),
      encoding: "utf8",
    }),
  );
  const admin = createClient(
    configuration.API_URL,
    configuration.SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const email = `extension-${Date.now()}@example.com`;
  const password = `Drip-${crypto.randomUUID()}`;
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  try {
    const website = await context.newPage();
    await website.goto("http://localhost:3020");
    await website.getByLabel("Email address").fill(email);
    await website.getByLabel("Password", { exact: true }).fill(password);
    await website
      .getByRole("button", { name: "Continue", exact: true })
      .click();
    await website
      .getByRole("button", { name: "Connect authenticator app" })
      .click();
    await expect(website.locator(".qr-frame img")).toBeVisible();
    const secret = await website.locator("details code").textContent();
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    const session = await (
      await request.get("http://127.0.0.1:4321/__test/session")
    ).json();
    const app = await context.newPage();
    await app.addInitScript(
      ({ session, secret, email }) => {
        const timestamp = new Date();
        const day = `${timestamp.getFullYear()}-${String(timestamp.getMonth() + 1).padStart(2, "0")}-${String(timestamp.getDate()).padStart(2, "0")}`;
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 80;
        const drawing = canvas.getContext("2d");
        drawing.fillStyle = "#a8c7fa";
        drawing.fillRect(0, 0, 80, 80);
        const photo = canvas.toDataURL();
        localStorage.setItem("threadcheck-session", JSON.stringify(session));
        localStorage.setItem(
          "drip-accounts-v1",
          JSON.stringify([
            {
              id: "browser-test-account",
              issuer: "Entre",
              label: email,
              secret,
              algorithm: "SHA1",
              digits: 6,
              period: 30,
              createdAt: timestamp.toISOString(),
            },
          ]),
        );
        localStorage.setItem(
          "drip-daily-fit",
          JSON.stringify({
            day,
            items: {
              top: { name: "Top", photo },
              pants: { name: "Pants", photo },
              hat: { name: "Hat", photo },
            },
          }),
        );
      },
      { session, secret, email },
    );
    const connected = await request.post(`${session.url}/api/bridge/demo/connect`, {
      headers: { Authorization: `Bearer ${session.token}` },
    });
    expect(connected.ok()).toBe(true);
    await app.goto("http://localhost:8081");
    await expect(
      app.getByRole("textbox", { name: "Browser pairing code" }),
    ).toHaveCount(0);
    await expect(
      popup.getByRole("button", { name: "Request code from Drip" }),
    ).toBeVisible();
    await popup.reload();
    await expect(
      popup.getByRole("button", { name: "Request code from Drip" }),
    ).toBeVisible();
    await app.bringToFront();
    await expect(
      website.getByRole("textbox", {
        name: "02 / Confirm your six-digit code",
      }),
    ).toHaveValue("");
    await expect(app).toHaveURL("http://localhost:8081/browser");
    await expect(app.getByText("http://localhost:3020", { exact: true })).toBeVisible();
    await app.screenshot({ path: "test-results/link-clothing-waiting.png", fullPage: true });
    const barcodes = { Pants: "20000999", Top: "10000999", Hat: "30000999" };
    const linkingScanner = app.getByRole("textbox", { name: "Link clothing scanner input" });
    for (const [name, barcode] of Object.entries(barcodes)) {
      await expect(linkingScanner).toBeFocused();
      await app.keyboard.type(barcode);
      await app.keyboard.press("Enter");
      await expect(app.getByLabel(`${name === "Top" ? "Hoodie" : name}: linked`, { exact: true })).toBeVisible();
      if (name === "Pants") await expect(app.getByLabel("Hoodie: waiting for scan", { exact: true })).toBeVisible();
      if (name === "Top") await app.screenshot({ path: "test-results/link-clothing-progress.png", fullPage: true });
    }
    await app.getByRole("button", { name: `Entre ${email}` }).click();
    const scanner = app.getByRole("textbox", {
      name: "Clothing scanner input",
    });
    await expect(scanner).toBeFocused();
    await app.keyboard.type("wrong-item");
    await app.keyboard.press("Enter");
    await expect(app.getByRole("alert")).toContainText("Wrong item.");
    await expect(app.getByText("0 of 3 scanned")).toBeVisible();
    const codeFieldBeforeApproval = website.getByRole("textbox", {
      name: "02 / Confirm your six-digit code",
    });
    await expect(codeFieldBeforeApproval).toHaveValue("");
    for (let index = 0; index < 3; index++) {
      await expect(app.getByText(`${index} of 3 scanned`)).toBeVisible();
      await expect(scanner).toBeFocused();
      await app.keyboard.type(Object.values(barcodes)[index]);
      await app.keyboard.press("Enter");
      if (index < 2) await expect(codeFieldBeforeApproval).toHaveValue("");
      if (index === 0) {
        await expect(app.getByText("1 of 3 scanned")).toBeVisible();
        await app.screenshot({ path: "test-results/clothing-approval-progress.png", fullPage: true });
      }
    }
    await expect(app.getByText("Code sent to your browser.")).toBeVisible();
    const codeField = website.getByRole("textbox", {
      name: "02 / Confirm your six-digit code",
    });
    await expect(codeField).toHaveValue(/\d{6}/);
    await expect(
      website.getByRole("button", { name: "Verify & enter" }),
    ).toBeEnabled();
    await website.getByRole("button", { name: "Verify & enter" }).click();
    await expect(
      website.getByRole("heading", { name: "You’re in. Make it yours." }),
    ).toBeVisible();
    await website.screenshot({
      path: "test-results/extension-verified.png",
      fullPage: true,
    });
    await app.screenshot({
      path: "test-results/app-browser-connected.png",
      fullPage: true,
    });
    await popup.screenshot({ path: "test-results/extension-popup.png" });
  } finally {
    const { error: cleanupError } = await admin.auth.admin.deleteUser(
      created.user.id,
    );
    if (cleanupError) throw cleanupError;
  }
});

test("automatic connection errors never ask for a browser pairing code", async ({ page, request }) => {
  const session = await (await request.get("http://127.0.0.1:4321/__test/session")).json();
  await page.addInitScript((session) => localStorage.setItem("threadcheck-session", JSON.stringify(session)), session);
  await page.route("**/api/bridge/demo/connect", (route) => route.fulfill({
    status: 503,
    contentType: "application/json",
    headers: { "access-control-allow-origin": "*" },
    body: JSON.stringify({ error: "Connection temporarily unavailable." }),
  }));
  await page.goto("http://localhost:8081/browser");
  await expect(page.getByRole("alert")).toContainText("Connection temporarily unavailable.");
  await expect(page.getByRole("textbox", { name: "Browser pairing code" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Pair browser" })).toHaveCount(0);
});

test("an expired scan does not block the next browser request", async ({ page, request }) => {
  const session = await (await request.get("http://127.0.0.1:4321/__test/session")).json();
  await page.addInitScript((session) => localStorage.setItem("threadcheck-session", JSON.stringify(session)), session);
  let inboxReads = 0;
  await page.route("**/api/bridge/inbox", (route) => {
    inboxReads += 1;
    const first = inboxReads === 1;
    return route.fulfill({
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify({ browsers: [], requests: [{
        id: first ? "expiring-request" : "next-request",
        browserName: "My browser",
        origin: first ? "https://first.example" : "https://next.example",
        expiresAt: Date.now() + (first ? 3000 : 180000),
        status: "pending", setup: null, matchedCount: 0, matchedPlacements: [],
      }] }),
    });
  });
  await page.goto("http://localhost:8081/browser");
  await expect(page.getByText("https://first.example", { exact: true })).toBeVisible();
  await expect(page.getByText("https://next.example", { exact: true })).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole("textbox", { name: "Link clothing scanner input" })).toBeFocused();
});

test("autofill supports split digits and refuses ambiguous, hidden, or replaced fields", async () => {
  const page = await context.newPage();
  await page.goto("http://localhost:3020");
  await page.setContent(
    '<form><label>Verification code</label><div><input maxlength="1" aria-label="OTP digit 1"><input maxlength="1"><input maxlength="1"><input maxlength="1"><input maxlength="1"><input maxlength="1"></div></form>',
  );
  await page.addScriptTag({ path: path.join(extensionPath, "autofill.js") });
  const values = await page.evaluate(() => {
    const fields = dripAutofill.fields();
    dripAutofill.fill(fields, "123456", location.origin);
    return fields.map((field) => field.value).join("");
  });
  expect(values).toBe("123456");
  await page.setContent(
    '<input autocomplete="one-time-code" style="display:none"><input id="password" type="password">',
  );
  await expect(page.evaluate(() => dripAutofill.fields())).rejects.toThrow(
    "Click the verification-code field",
  );
  await page.setContent(
    '<input autocomplete="one-time-code"><input autocomplete="one-time-code">',
  );
  await expect(page.evaluate(() => dripAutofill.fields())).rejects.toThrow(
    "Click the verification-code field",
  );
  await page.setContent('<input autocomplete="one-time-code">');
  await expect(
    page.evaluate(() => {
      const fields = dripAutofill.fields();
      fields[0].remove();
      dripAutofill.fill(fields, "123456", location.origin);
    }),
  ).rejects.toThrow("verification field changed");
  await page.close();
});
