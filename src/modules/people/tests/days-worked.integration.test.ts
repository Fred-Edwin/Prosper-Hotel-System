import { afterAll, beforeEach, describe, expect, test } from "vitest";
import type { AuthenticatedStaff } from "../index";
import { deactivateStaffMember, getPayForStaff, hashPin, listDaysWorkedForStaff, recordDaysWorked } from "../index";
import { testDb } from "@/shared/test-db";

let restaurantId: string;
let staffId: string;

function staffAt(role: "owner" | "cashier"): AuthenticatedStaff {
  const id = role === "owner" ? "staff-owner" : "staff-cashier";
  return {
    staff: {
      id,
      name: role === "owner" ? "Test Owner" : "Test Cashier",
      phone: role === "owner" ? "+254700111555" : "+254700111556",
      role,
      locationId: restaurantId,
      dailyRateMinor: 0,
      active: true,
    },
    location: { id: restaurantId, code: "restaurant", name: "Test" },
  };
}

afterAll(async () => {
  await testDb.daysWorked.deleteMany({});
  await testDb.session.deleteMany({});
  await testDb.staffMember.deleteMany({});
  await testDb.location.deleteMany({});
  await testDb.$disconnect();
});

beforeEach(async () => {
  await testDb.daysWorked.deleteMany({});
  await testDb.session.deleteMany({});
  await testDb.staffMember.deleteMany({});
  await testDb.location.deleteMany({});
  const restaurant = await testDb.location.create({
    data: { code: "restaurant", name: "Test Restaurant" },
  });
  restaurantId = restaurant.id;

  await testDb.staffMember.create({
    data: {
      id: "staff-owner",
      name: "Test Owner",
      phone: "+254700111555",
      pinHash: await hashPin("1234"),
      role: "owner",
      locationId: restaurantId,
      dailyRateMinor: 0,
    },
  });
  await testDb.staffMember.create({
    data: {
      id: "staff-cashier",
      name: "Test Cashier",
      phone: "+254700111556",
      pinHash: await hashPin("1234"),
      role: "cashier",
      locationId: restaurantId,
      dailyRateMinor: 0,
    },
  });

  const brian = await testDb.staffMember.create({
    data: {
      name: "Brian Otieno",
      phone: "+254700222333",
      pinHash: await hashPin("4821"),
      role: "cashier",
      locationId: restaurantId,
      dailyRateMinor: 550,
    },
  });
  staffId = brian.id;
});

describe("recordDaysWorked", () => {
  test("the owner can record a day worked for a staff member", async () => {
    const owner = staffAt("owner");

    const result = await recordDaysWorked(testDb, owner, {
      staffMemberId: staffId,
      date: new Date("2026-08-01"),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.staffMemberId).toBe(staffId);
  });

  test("recording the same staff member/date twice edits in place, not a duplicate", async () => {
    const owner = staffAt("owner");
    const date = new Date("2026-08-01");

    const first = await recordDaysWorked(testDb, owner, { staffMemberId: staffId, date });
    const second = await recordDaysWorked(testDb, owner, { staffMemberId: staffId, date });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.value.id).toBe(first.value.id);

    const rows = await testDb.daysWorked.findMany({ where: { staffMemberId: staffId } });
    expect(rows).toHaveLength(1);
  });

  test("a non-owner cannot record a day worked", async () => {
    const cashier = staffAt("cashier");

    const result = await recordDaysWorked(testDb, cashier, {
      staffMemberId: staffId,
      date: new Date("2026-08-01"),
    });

    expect(result).toEqual({ ok: false, reason: "forbidden" });
  });
});

describe("getPayForStaff", () => {
  test("pay equals days worked in the current month times the daily rate", async () => {
    const owner = staffAt("owner");
    const now = new Date();
    const day1 = new Date(now.getFullYear(), now.getMonth(), 3);
    const day2 = new Date(now.getFullYear(), now.getMonth(), 5);
    await recordDaysWorked(testDb, owner, { staffMemberId: staffId, date: day1 });
    await recordDaysWorked(testDb, owner, { staffMemberId: staffId, date: day2 });

    const result = await getPayForStaff(testDb, owner, staffId);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.daysWorked).toBe(2);
    expect(result.value.dailyRateMinor).toBe(550);
    expect(result.value.payMinor).toBe(1100);
  });

  test("days worked outside the current month are not counted", async () => {
    const owner = staffAt("owner");
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 15);
    await recordDaysWorked(testDb, owner, { staffMemberId: staffId, date: lastMonth });

    const result = await getPayForStaff(testDb, owner, staffId);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.daysWorked).toBe(0);
    expect(result.value.payMinor).toBe(0);
  });

  test("a non-owner cannot view the pay figure", async () => {
    const cashier = staffAt("cashier");

    const result = await getPayForStaff(testDb, cashier, staffId);

    expect(result).toEqual({ ok: false, reason: "forbidden" });
  });
});

describe("listDaysWorkedForStaff", () => {
  test("a deactivated staff member's days worked remain readable", async () => {
    const owner = staffAt("owner");
    await recordDaysWorked(testDb, owner, { staffMemberId: staffId, date: new Date("2026-08-01") });
    await deactivateStaffMember(testDb, owner, staffId);

    const result = await listDaysWorkedForStaff(testDb, owner, staffId);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(1);
  });
});
