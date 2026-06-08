import { type Page } from "@playwright/test";

/**
 * Logged-in E2E needs a SEEDED Supabase test user — NOT any broker credentials.
 * Create one in Supabase Auth, then set:
 *   TEST_USER_EMAIL=... TEST_USER_PASSWORD=...
 * Specs that need auth skip automatically when these aren't provided, so CI
 * never requires real accounts.
 */
export const TEST_EMAIL = process.env.TEST_USER_EMAIL;
export const TEST_PASSWORD = process.env.TEST_USER_PASSWORD;
export const hasTestUser = Boolean(TEST_EMAIL && TEST_PASSWORD);

export async function login(page: Page): Promise<void> {
  await page.goto("/login");
  await page.locator('input[type="email"]').fill(TEST_EMAIL!);
  await page.locator('input[type="password"]').fill(TEST_PASSWORD!);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
}

/** Loads demo data via the dashboard button (idempotent-ish). */
export async function loadDemoData(page: Page): Promise<void> {
  const btn = page.getByRole("button", { name: /load demo data/i });
  if (await btn.isVisible().catch(() => false)) {
    await btn.click();
    await page.getByText(/demo mode/i).waitFor({ timeout: 15_000 }).catch(() => {});
  }
}
