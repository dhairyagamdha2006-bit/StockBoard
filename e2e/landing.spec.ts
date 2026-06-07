import { test, expect } from "@playwright/test";

test.describe("Landing page", () => {
  test("renders hero and primary CTAs", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /one dashboard/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /get started/i }).first()).toBeVisible();
  });

  test("Sign In navigates to /login", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /^sign in$/i }).first().click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("button", { name: /sign in|log in|continue/i }).first()).toBeVisible();
  });

  test("does not claim 15-minute sync or complete transaction history", async ({ page }) => {
    await page.goto("/");
    const body = await page.locator("body").innerText();
    expect(body.toLowerCase()).not.toContain("every 15 minutes");
    expect(body.toLowerCase()).not.toContain("complete transaction history");
  });
});
