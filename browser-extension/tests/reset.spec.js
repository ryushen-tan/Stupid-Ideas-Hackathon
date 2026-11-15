import { test, expect } from "@playwright/test";

test("Settings reset clears Drip data, preserves the connection by default, and supports full disconnect", async ({
  page,
  request,
}) => {
  const sessionResponse = await request.get(
    "http://127.0.0.1:4321/__test/session",
  );
  expect(sessionResponse.ok()).toBe(true);
  const session = await sessionResponse.json();
  await page.addInitScript(
    ({ session }) => {
      if (localStorage.getItem("reset-test-initialized")) return;
      const timestamp = new Date();
      const day = `${timestamp.getFullYear()}-${String(timestamp.getMonth() + 1).padStart(2, "0")}-${String(timestamp.getDate()).padStart(2, "0")}`;
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 2;
      const photo = canvas.toDataURL();
      localStorage.setItem(
        "drip-accounts-v1",
        JSON.stringify([
          {
            id: "reset-test-account",
            issuer: "Reset test",
            label: "test@example.com",
            secret: "JBSWY3DPEHPK3PXP",
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
      localStorage.setItem(
        "drip-clothing-barcodes-v1",
        JSON.stringify({
          day,
          barcodes: { top: "top", pants: "pants", hat: "hat" },
        }),
      );
      localStorage.setItem("threadcheck-session", JSON.stringify(session));
      localStorage.setItem("unrelated-setting", "keep-me");
      localStorage.setItem("reset-test-initialized", "true");
    },
    { session },
  );
  await page.goto("http://localhost:8081");
  await expect(page.getByText("Reset test", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Reset Drip data" }).click();
  await page.getByRole("button", { name: "Cancel reset" }).click();
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("drip-accounts-v1")).length,
    ),
  ).toBe(1);
  await page.getByRole("button", { name: "Reset Drip data" }).click();
  await page.route("**/api/bridge/inbox", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "Reset server unavailable" }),
    }),
  );
  await page.getByRole("button", { name: "Delete saved data" }).click();
  await expect(page.getByRole("alert")).toContainText("Reset server unavailable");
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("drip-accounts-v1")).length,
    ),
  ).toBe(1);
  await page.unroute("**/api/bridge/inbox");
  await page.getByRole("button", { name: "Delete saved data" }).click();
  await expect(page.getByText("Scan your fit", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(() => ({
      accounts: JSON.parse(localStorage.getItem("drip-accounts-v1")),
      fit: localStorage.getItem("drip-daily-fit"),
      barcodes: localStorage.getItem("drip-clothing-barcodes-v1"),
      session: Boolean(localStorage.getItem("threadcheck-session")),
      unrelated: localStorage.getItem("unrelated-setting"),
    })),
  ).toEqual({
    accounts: [],
    fit: null,
    barcodes: null,
    session: true,
    unrelated: "keep-me",
  });
  await page.getByRole("button", { name: "Close daily scan" }).click();
  await expect(
    page.getByText(
      "Tap the + hat to scan a setup QR and add your first app or service.",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Reset Drip data" }).click();
  await page
    .getByRole("switch", { name: "Also disconnect server and browsers" })
    .click();
  await page.getByRole("button", { name: "Delete saved data" }).click();
  await expect(page.getByText("Scan your fit", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("threadcheck-session")),
  ).toBeNull();
  const revoked = await request.get(`${session.url}/api/bridge/inbox`, {
    headers: { Authorization: `Bearer ${session.token}` },
  });
  expect(revoked.status()).toBe(401);
});
