import { test, expect } from "@playwright/test";

// Canteen count-derived sales (docs/scope.md's 2026-08-15 entry). The
// attendant has no "sell"/"credit" nav destination — a stock count is her
// only entry point, and the system infers what sold from the shortfall.
// Logs in independently rather than reusing e2e/.auth/staff.json, which is
// a restaurant cashier — same pattern as catalogue.spec.ts for the owner.
test("canteen attendant counts stock, a shortfall shows as an implied sale, and it lands in Today's summary and the handover", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByTestId("login-name").fill("Canteen Attendant");
  await page.getByTestId("login-pin").fill("1234");
  await page.getByTestId("login-submit").click();
  await expect(page).toHaveURL("/staff");

  // No "sell" or "credit" tile for the attendant.
  await expect(page.getByTestId("staff-tile-sell")).toHaveCount(0);
  await expect(page.getByTestId("staff-tile-credit")).toHaveCount(0);
  await expect(page.getByTestId("staff-tile-count")).toBeVisible();

  await page.getByTestId("staff-tile-count").click();

  await page.getByTestId("count-search").fill("Sweets");
  const tile = page.getByTestId("count-item-tile").first();
  await expect(tile).toBeVisible();
  // Expected quantity is visible while counting, canteen-only.
  await expect(tile).toContainText("expected");
  await tile.click();

  const line = page.getByTestId("count-lines").locator('[data-testid^="count-quantity-"]').first();
  await line.fill("100"); // short of the seeded 160 on-hand

  await page.getByTestId("count-complete").click();

  // Post-submit review — not a gate, the count already wrote, but nothing
  // is silent about what it implied.
  await expect(page.getByTestId("count-sold-review")).toBeVisible();
  await expect(page.getByTestId("count-sold-review-row")).toContainText("Sweets");
  await expect(page.getByTestId("count-sold-review-row")).toContainText("60 sold");

  await page.getByTestId("count-sold-review-done").click();

  // The count-derived sale is a real row in Today's summary.
  await page.getByTestId("staff-tile-sales").click();
  await expect(page.getByTestId("todays-sales-row").first()).toContainText("Sweets");

  // Handover: a count has now landed today, so no "no count yet" banner.
  await page.getByTestId("staff-tile-handover").click();
  await expect(page.getByTestId("handover-no-count-banner")).toHaveCount(0);
});
