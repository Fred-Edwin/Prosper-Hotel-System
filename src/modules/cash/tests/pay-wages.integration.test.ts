import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { hashPin, recordDaysWorked } from "@/modules/people";
import type { AuthenticatedStaff } from "@/modules/people";
import { payWages } from "../logic";
import { testDb } from "@/shared/test-db";

let restaurantId: string;
let staffId: string;

function staffAt(role: "owner" | "cashier"): AuthenticatedStaff {
  return {
    staff: {
      id: role === "owner" ? "staff-owner" : "staff-cashier",
      name: role === "owner" ? "Test Owner" : "Test Cashier",
      phone: role === "owner" ? "+254700111337" : "+254700111338",
      role,
      locationId: restaurantId,
      dailyRateMinor: 0,
      active: true,
    },
    location: { id: restaurantId, code: "restaurant", name: "Test" },
  };
}

afterAll(async () => {
  await testDb.expense.deleteMany({});
  await testDb.daysWorked.deleteMany({});
  await testDb.staffMember.deleteMany({});
  await testDb.location.deleteMany({});
  await testDb.$disconnect();
});

beforeEach(async () => {
  await testDb.expense.deleteMany({});
  await testDb.daysWorked.deleteMany({});
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
      phone: "+254700111337",
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
      phone: "+254700111338",
      pinHash: await hashPin("1234"),
      role: "cashier",
      locationId: restaurantId,
      dailyRateMinor: 0,
    },
  });

  const brian = await testDb.staffMember.create({
    data: {
      name: "Brian Otieno",
      phone: "+254700222335",
      pinHash: await hashPin("4821"),
      role: "cashier",
      locationId: restaurantId,
      dailyRateMinor: 550,
    },
  });
  staffId = brian.id;
});

describe("payWages", () => {
  test("pays out unpaid days worked this month as a running-cost expense", async () => {
    const owner = staffAt("owner");
    const now = new Date();
    await recordDaysWorked(testDb, owner, {
      staffMemberId: staffId,
      date: new Date(now.getFullYear(), now.getMonth(), 2),
    });
    await recordDaysWorked(testDb, owner, {
      staffMemberId: staffId,
      date: new Date(now.getFullYear(), now.getMonth(), 4),
    });

    const result = await payWages(testDb, owner, {
      staffMemberId: staffId,
      locationId: restaurantId,
      paymentMethod: "cash",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.expense.category).toBe("running");
    expect(result.expense.amountMinor).toBe(1100);
    expect(result.expense.payeeStaffMemberId).toBe(staffId);

    const rows = await testDb.daysWorked.findMany({ where: { staffMemberId: staffId } });
    expect(rows.every((r) => r.paidAs === result.expense.id)).toBe(true);
  });

  test("paying again with nothing new unpaid rejects rather than creating a zero expense", async () => {
    const owner = staffAt("owner");
    const now = new Date();
    await recordDaysWorked(testDb, owner, {
      staffMemberId: staffId,
      date: new Date(now.getFullYear(), now.getMonth(), 2),
    });
    await payWages(testDb, owner, {
      staffMemberId: staffId,
      locationId: restaurantId,
      paymentMethod: "cash",
    });

    const second = await payWages(testDb, owner, {
      staffMemberId: staffId,
      locationId: restaurantId,
      paymentMethod: "cash",
    });

    expect(second).toEqual({ ok: false, reason: "nothing_to_pay" });
  });

  test("a non-owner cannot pay wages", async () => {
    const cashier = staffAt("cashier");

    const result = await payWages(testDb, cashier, {
      staffMemberId: staffId,
      locationId: restaurantId,
      paymentMethod: "cash",
    });

    expect(result).toEqual({ ok: false, reason: "forbidden" });
  });
});
