import { test as setup, expect } from "@playwright/test";

const STORAGE_STATE = "e2e/.auth/staff.json";

// Seeded by prisma/seed.ts — see prisma/seed.ts for the full roster.
const SEED_NAME = "Sarah Njeri"; // cashier, restaurant
const SEED_PIN = "1234";

// Through the real login page rather than a direct API call — this is what
// makes the login page itself covered by E2E, not just built. A broken
// login page produces one failing setup, not forty failing specs, because
// every other spec reuses the saved storage state below.
setup("authenticate as a seeded cashier", async ({ page }) => {
  await page.goto("/login");
  await page.getByTestId("login-name").fill(SEED_NAME);
  await page.getByTestId("login-pin").fill(SEED_PIN);
  await page.getByTestId("login-submit").click();

  await expect(page).toHaveURL("/staff");

  await page.context().storageState({ path: STORAGE_STATE });
});
