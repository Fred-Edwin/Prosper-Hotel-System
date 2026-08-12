import { test, expect } from "@playwright/test";

// Owner-only screen — catalogue.spec.ts logs in for itself rather than
// reusing e2e/.auth/staff.json, which is a cashier and cannot reach
// /catalogue. See prisma/seed.ts for the seeded "Admin Owner".
test("owner edits a product's name from Catalogue", async ({ page }) => {
  await page.goto("/login");
  await page.getByTestId("login-name").fill("Admin Owner");
  await page.getByTestId("login-pin").fill("1234");
  await page.getByTestId("login-submit").click();
  await expect(page).toHaveURL("/dashboard");

  await page.goto("/catalogue");

  await page.getByTestId("product-search").fill("Sodas");
  await expect(page.getByTestId("product-row")).toHaveCount(1, { timeout: 10_000 });

  await page.getByTestId(/product-row-edit-/).click();
  await expect(page.getByTestId("product-sheet")).toBeVisible({ timeout: 10_000 });

  const nameInput = page.getByTestId("product-name-input");
  await nameInput.fill("Sodas (renamed)");
  await page.getByTestId("product-save").click();

  // Saving does not auto-close the sheet — the row behind it updates live.
  await expect(page.getByTestId("product-row")).toContainText("Sodas (renamed)");
});
