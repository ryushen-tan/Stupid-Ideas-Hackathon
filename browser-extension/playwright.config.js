import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  testMatch: "*.spec.js",
  workers: 1,
  timeout: 90_000,
  webServer: {
    command: "./node_modules/.bin/tsx ../browser-extension/tests/relay.ts",
    cwd: "../threadcheck",
    url: "http://127.0.0.1:4321/api/health",
    reuseExistingServer: false,
  },
});
