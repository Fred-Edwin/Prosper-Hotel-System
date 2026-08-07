import { test, expect } from "@playwright/test";

// Seeded cashier is Sarah Njeri, restaurant. See prisma/seed.ts.
test("a logged-in staff member sees their location's current stock", async ({ page }) => {
  await page.goto("/staff");

  await page.getByTestId("staff-tile-stock").click();

  await expect(page.getByTestId("stock-list")).toBeVisible();
  await expect(page.getByTestId("stock-row")).toHaveCount(3, { timeout: 10_000 });
  await expect(page.getByTestId("stock-list")).toContainText("Sodas (500ml)");
});
