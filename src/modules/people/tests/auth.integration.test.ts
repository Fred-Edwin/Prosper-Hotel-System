import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { hashPin, login, logout } from "@/modules/people";
import { getAuthenticatedStaff } from "../logic";
import { testDb } from "@/shared/test-db";

const PHONE = "+254700111222";
const PIN = "4821";

let locationId: string;
let staffId: string;

beforeAll(async () => {
  const location = await testDb.location.create({
    data: { code: "restaurant", name: "Test Restaurant" },
  });
  locationId = location.id;
});

afterAll(async () => {
  await testDb.session.deleteMany({});
  await testDb.staffMember.deleteMany({});
  await testDb.location.deleteMany({});
  await testDb.$disconnect();
});

beforeEach(async () => {
  await testDb.session.deleteMany({});
  await testDb.staffMember.deleteMany({});
  const staff = await testDb.staffMember.create({
    data: {
      name: "Test Cashier",
      phone: PHONE,
      pinHash: await hashPin(PIN),
      role: "cashier",
      locationId,
    },
  });
  staffId = staff.id;
});

describe("login/logout", () => {
  test("logs in with the correct phone and PIN", async () => {
    const result = await login(testDb, PHONE, PIN);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.staff.id).toBe(staffId);
    expect(result.token).toHaveLength(64);
  });

  test("rejects a wrong PIN", async () => {
    const result = await login(testDb, PHONE, "0000");

    expect(result).toEqual({ ok: false, reason: "invalid_credentials" });
  });

  test("rejects an unknown phone with the same reason as a wrong PIN", async () => {
    const result = await login(testDb, "+254799999999", PIN);

    expect(result).toEqual({ ok: false, reason: "invalid_credentials" });
  });

  test("logout invalidates the session", async () => {
    const loggedIn = await login(testDb, PHONE, PIN);
    if (!loggedIn.ok) throw new Error("expected login to succeed");

    expect(await getAuthenticatedStaff(testDb, loggedIn.token)).not.toBeNull();

    await logout(testDb, loggedIn.token);

    expect(await getAuthenticatedStaff(testDb, loggedIn.token)).toBeNull();
  });
});
