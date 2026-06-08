import { test, expect } from "@playwright/test";
import { hasTestUser, login, loadDemoData } from "./helpers/auth";
import path from "path";

// These flows need a seeded Supabase test user (no broker credentials needed).
test.describe("Authenticated flows", () => {
  test.skip(!hasTestUser, "Set TEST_USER_EMAIL / TEST_USER_PASSWORD to run authenticated E2E.");

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("load demo data populates the dashboard", async ({ page }) => {
    await loadDemoData(page);
    await expect(page.getByText(/demo mode/i)).toBeVisible();
    await page.goto("/dashboard/holdings");
    await expect(page.getByText(/AAPL|VOO|AMZN/).first()).toBeVisible();
  });

  test("holdings search filters the table", async ({ page }) => {
    await loadDemoData(page);
    await page.goto("/dashboard/holdings");
    await page.getByPlaceholder(/search ticker/i).fill("AAPL");
    await expect(page.getByText("AAPL").first()).toBeVisible();
  });

  test("CSV import (Fidelity) previews and imports", async ({ page }) => {
    await page.goto("/connect/fidelity");
    await page.locator('input[type="file"]').setInputFiles(
      path.join(process.cwd(), "tests/fixtures/fidelity-positions.csv")
    );
    await expect(page.getByText(/positions found/i)).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: /confirm import/i }).click();
    await page.waitForURL(/\/dashboard/);
  });

  test("invalid CSV shows a clear error", async ({ page }) => {
    await page.goto("/connect/fidelity");
    await page.locator('input[type="file"]').setInputFiles(
      path.join(process.cwd(), "tests/fixtures/invalid-positions.csv")
    );
    await expect(page.getByText(/Symbol\/Ticker|couldn't read|no valid holdings/i)).toBeVisible({ timeout: 15_000 });
  });

  test("market search and stock detail chart", async ({ page }) => {
    await page.goto("/dashboard/market");
    await page.getByLabel(/search stocks/i).fill("AAPL");
    await page.getByRole("link", { name: /AAPL/ }).first().click();
    await expect(page).toHaveURL(/\/dashboard\/market\/AAPL/i);
    await expect(page.getByRole("button", { name: /watchlist|watching/i })).toBeVisible();
  });

  test("sync logs page renders", async ({ page }) => {
    await page.goto("/dashboard/sync-logs");
    await expect(page.getByRole("heading", { name: /sync logs/i })).toBeVisible();
  });
});
