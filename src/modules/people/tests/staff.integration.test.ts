import { afterAll, beforeEach, describe, expect, test } from "vitest";
import type { AuthenticatedStaff } from "../index";
import {
  createStaffMember,
  deactivateStaffMember,
  listStaffMembers,
  login,
  reactivateStaffMember,
  updateStaffMember,
} from "../index";
import { testDb } from "@/shared/test-db";

let restaurantId: string;

function staffAt(role: "owner" | "cashier"): AuthenticatedStaff {
  return {
    staff: {
      id: "staff-1",
      name: "Test Owner",
      phone: "+254700111555",
      role,
      locationId: restaurantId,
      dailyRateMinor: 0,
      active: true,
    },
    location: { id: restaurantId, code: "restaurant", name: "Test" },
  };
}

afterAll(async () => {
  await testDb.session.deleteMany({});
  await testDb.staffMember.deleteMany({});
  await testDb.location.deleteMany({});
  await testDb.$disconnect();
});

beforeEach(async () => {
  await testDb.session.deleteMany({});
  await testDb.staffMember.deleteMany({});
  await testDb.location.deleteMany({});
  const restaurant = await testDb.location.create({
    data: { code: "restaurant", name: "Test Restaurant" },
  });
  restaurantId = restaurant.id;
});

describe("createStaffMember", () => {
  test("the owner can add a staff member", async () => {
    const owner = staffAt("owner");

    const result = await createStaffMember(testDb, owner, {
      name: "Brian Otieno",
      phone: "+254700222333",
      role: "cashier",
      locationId: restaurantId,
      pin: "4821",
      dailyRateMinor: 550,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.name).toBe("Brian Otieno");
    expect(result.value.role).toBe("cashier");
    expect(result.value.dailyRateMinor).toBe(550);
    expect(result.value.active).toBe(true);
  });

  test("a non-owner cannot add a staff member", async () => {
    const cashier = staffAt("cashier");

    const result = await createStaffMember(testDb, cashier, {
      name: "Brian Otieno",
      phone: "+254700222333",
      role: "cashier",
      locationId: restaurantId,
      pin: "4821",
      dailyRateMinor: 550,
    });

    expect(result).toEqual({ ok: false, reason: "forbidden" });
  });

  test("rejects a PIN that isn't exactly four digits", async () => {
    const owner = staffAt("owner");

    const result = await createStaffMember(testDb, owner, {
      name: "Brian Otieno",
      phone: "+254700222333",
      role: "cashier",
      locationId: restaurantId,
      pin: "482",
      dailyRateMinor: 550,
    });

    expect(result).toEqual({ ok: false, reason: "invalid_pin" });
  });

  test("rejects a duplicate name", async () => {
    const owner = staffAt("owner");
    await createStaffMember(testDb, owner, {
      name: "Brian Otieno",
      phone: "+254700222333",
      role: "cashier",
      locationId: restaurantId,
      pin: "4821",
      dailyRateMinor: 550,
    });

    const result = await createStaffMember(testDb, owner, {
      name: "Brian Otieno",
      phone: "+254700222444",
      role: "cashier",
      locationId: restaurantId,
      pin: "1111",
      dailyRateMinor: 550,
    });

    expect(result).toEqual({ ok: false, reason: "duplicate_name" });
  });
});

describe("listStaffMembers", () => {
  test("the owner sees every staff member, active and inactive", async () => {
    const owner = staffAt("owner");
    const created = await createStaffMember(testDb, owner, {
      name: "Brian Otieno",
      phone: "+254700222333",
      role: "cashier",
      locationId: restaurantId,
      pin: "4821",
      dailyRateMinor: 550,
    });
    if (!created.ok) throw new Error("expected create to succeed");
    await deactivateStaffMember(testDb, owner, created.value.id);

    const result = await listStaffMembers(testDb, owner);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const names = result.value.map((s) => s.name);
    expect(names).toContain("Brian Otieno");
    const brian = result.value.find((s) => s.name === "Brian Otieno");
    expect(brian?.active).toBe(false);
  });

  test("a non-owner cannot list staff", async () => {
    const cashier = staffAt("cashier");

    const result = await listStaffMembers(testDb, cashier);

    expect(result).toEqual({ ok: false, reason: "forbidden" });
  });
});

describe("updateStaffMember", () => {
  test("the owner can edit name, phone, role, location, daily rate and PIN in place", async () => {
    const owner = staffAt("owner");
    const created = await createStaffMember(testDb, owner, {
      name: "Brian Otieno",
      phone: "+254700222333",
      role: "cashier",
      locationId: restaurantId,
      pin: "4821",
      dailyRateMinor: 550,
    });
    if (!created.ok) throw new Error("expected create to succeed");

    const result = await updateStaffMember(testDb, owner, created.value.id, {
      name: "Brian O.",
      phone: "+254700222999",
      role: "store_manager",
      locationId: restaurantId,
      dailyRateMinor: 700,
      pin: "9999",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.name).toBe("Brian O.");
    expect(result.value.phone).toBe("+254700222999");
    expect(result.value.role).toBe("store_manager");
    expect(result.value.dailyRateMinor).toBe(700);

    const loginResult = await login(testDb, "Brian O.", "9999");
    expect(loginResult.ok).toBe(true);
  });

  test("omitting the PIN keeps the previous one", async () => {
    const owner = staffAt("owner");
    const created = await createStaffMember(testDb, owner, {
      name: "Brian Otieno",
      phone: "+254700222333",
      role: "cashier",
      locationId: restaurantId,
      pin: "4821",
      dailyRateMinor: 550,
    });
    if (!created.ok) throw new Error("expected create to succeed");

    await updateStaffMember(testDb, owner, created.value.id, {
      name: "Brian Otieno",
      phone: "+254700222333",
      role: "cashier",
      locationId: restaurantId,
      dailyRateMinor: 550,
    });

    const loginResult = await login(testDb, "Brian Otieno", "4821");
    expect(loginResult.ok).toBe(true);
  });

  test("rejects updating an unknown staff member", async () => {
    const owner = staffAt("owner");

    const result = await updateStaffMember(testDb, owner, "nonexistent", {
      name: "Someone",
      phone: "+254700000000",
      role: "cashier",
      locationId: restaurantId,
      dailyRateMinor: 550,
    });

    expect(result).toEqual({ ok: false, reason: "not_found" });
  });
});

describe("deactivateStaffMember / reactivateStaffMember", () => {
  test("a deactivated staff member cannot log in, but the record and history remain", async () => {
    const owner = staffAt("owner");
    const created = await createStaffMember(testDb, owner, {
      name: "Brian Otieno",
      phone: "+254700222333",
      role: "cashier",
      locationId: restaurantId,
      pin: "4821",
      dailyRateMinor: 550,
    });
    if (!created.ok) throw new Error("expected create to succeed");

    const deactivated = await deactivateStaffMember(testDb, owner, created.value.id);
    expect(deactivated.ok).toBe(true);
    if (!deactivated.ok) return;
    expect(deactivated.value.active).toBe(false);

    const loginResult = await login(testDb, "Brian Otieno", "4821");
    expect(loginResult).toEqual({ ok: false, reason: "inactive" });

    const stillExists = await testDb.staffMember.findUnique({ where: { id: created.value.id } });
    expect(stillExists).not.toBeNull();
  });

  test("reactivating a staff member allows them to log in again", async () => {
    const owner = staffAt("owner");
    const created = await createStaffMember(testDb, owner, {
      name: "Brian Otieno",
      phone: "+254700222333",
      role: "cashier",
      locationId: restaurantId,
      pin: "4821",
      dailyRateMinor: 550,
    });
    if (!created.ok) throw new Error("expected create to succeed");
    await deactivateStaffMember(testDb, owner, created.value.id);

    const reactivated = await reactivateStaffMember(testDb, owner, created.value.id);
    expect(reactivated.ok).toBe(true);
    if (!reactivated.ok) return;
    expect(reactivated.value.active).toBe(true);

    const loginResult = await login(testDb, "Brian Otieno", "4821");
    expect(loginResult.ok).toBe(true);
  });

  test("a non-owner cannot deactivate a staff member", async () => {
    const owner = staffAt("owner");
    const cashier = staffAt("cashier");
    const created = await createStaffMember(testDb, owner, {
      name: "Brian Otieno",
      phone: "+254700222333",
      role: "cashier",
      locationId: restaurantId,
      pin: "4821",
      dailyRateMinor: 550,
    });
    if (!created.ok) throw new Error("expected create to succeed");

    const result = await deactivateStaffMember(testDb, cashier, created.value.id);

    expect(result).toEqual({ ok: false, reason: "forbidden" });
  });
});
