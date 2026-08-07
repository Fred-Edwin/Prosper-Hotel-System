import { test as setup, expect } from "@playwright/test";

const STORAGE_STATE = "e2e/.auth/staff.json";

// Seeded by prisma/seed.ts — see prisma/seed.ts for the full roster.
const SEED_PHONE = "+254700000003"; // Sarah Njeri, cashier, restaurant
const SEED_PIN = "1234";

setup("authenticate as a seeded cashier", async ({ request }) => {
  const response = await request.post("/api/auth/login", {
    data: { phone: SEED_PHONE, pin: SEED_PIN },
  });
  expect(response.ok()).toBeTruthy();

  await request.storageState({ path: STORAGE_STATE });
});
