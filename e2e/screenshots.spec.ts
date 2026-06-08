import { test } from "@playwright/test";
import { hasTestUser, login, loadDemoData } from "./helpers/auth";
import path from "path";

/**
 * Screenshot generator. Run with: npm run screenshots
 *
 * Public pages are always captured. Authenticated pages are captured only when
 * TEST_USER_EMAIL / TEST_USER_PASSWORD are set (a seeded Supabase user — no
 * broker credentials needed). Output lands in public/screenshots/.
 */
const OUT = path.join(process.cwd(), "public/screenshots");
const shot = (name: string) => path.join(OUT, `${name}.png`);

test("public — landing", async ({ page }) => {
  await page.goto("/");
  await page.screenshot({ path: shot("landing"), fullPage: true });
});

test("public — login", async ({ page }) => {
  await page.goto("/login");
  await page.screenshot({ path: shot("login") });
});

test.describe("authenticated screenshots", () => {
  test.skip(!hasTestUser, "Set TEST_USER_EMAIL / TEST_USER_PASSWORD to capture dashboard screenshots.");

  test("dashboard, holdings, analytics, market, sync logs", async ({ page }) => {
    await login(page);
    await loadDemoData(page);

    await page.goto("/dashboard");
    await page.waitForTimeout(1200);
    await page.screenshot({ path: shot("dashboard"), fullPage: true });

    await page.goto("/dashboard/holdings");
    await page.waitForTimeout(800);
    await page.screenshot({ path: shot("holdings"), fullPage: true });

    await page.goto("/dashboard/analytics");
    await page.waitForTimeout(800);
    await page.screenshot({ path: shot("analytics"), fullPage: true });

    await page.goto("/dashboard/market");
    await page.waitForTimeout(800);
    await page.screenshot({ path: shot("market"), fullPage: true });

    await page.goto("/dashboard/sync-logs");
    await page.waitForTimeout(500);
    await page.screenshot({ path: shot("sync-logs"), fullPage: true });
  });
});
