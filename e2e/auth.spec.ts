import { test, expect } from "@playwright/test";

test.describe("Auth protection", () => {
  test("unauthenticated /dashboard redirects to /login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("unauthenticated /connect/schwab redirects to /login", async ({ page }) => {
    await page.goto("/connect/schwab");
    await expect(page).toHaveURL(/\/login$/);
  });
});
