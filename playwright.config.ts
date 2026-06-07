import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E config.
 *
 * These tests exercise the real app in a browser. They do NOT require real
 * broker credentials — they cover public pages, auth redirects, and the demo
 * flow (which can be extended with a seeded test user).
 *
 * Run locally:
 *   npm run build && npx playwright install && npm run test:e2e
 *
 * The webServer block boots the production server with whatever env is in your
 * shell / .env.local. Dummy-but-valid env is enough for the public-page specs.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
