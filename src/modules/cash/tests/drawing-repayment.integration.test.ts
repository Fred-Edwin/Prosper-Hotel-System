import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { hashPin } from "@/modules/people";
import type { AuthenticatedStaff } from "@/modules/people";
import {
  recordExpense,
  drawingDebtOwed,
  recordDrawingRepayment,
  reverseDrawingRepayment,
} from "../logic";
import { testDb } from "@/shared/test-db";

let restaurantId: string;

function staffAt(role: "owner" | "cashier", locationId: string): AuthenticatedStaff {
  return {
    staff: {
      id: role === "owner" ? "staff-owner" : "staff-cashier",
      name: role === "owner" ? "Test Owner" : "Test Cashier",
      phone: role === "owner" ? "+254700111333" : "+254700111334",
      role,
      locationId,
      dailyRateMinor: 0,
      active: true,
    },
    location: { id: locationId, code: "restaurant", name: "Test" },
  };
}

beforeAll(async () => {
  const restaurant = await testDb.location.create({
    data: { code: "restaurant", name: "Test Restaurant" },
  });
  restaurantId = restaurant.id;

  await testDb.staffMember.create({
    data: {
      id: "staff-owner",
      name: "Test Owner",
      phone: "+254700111333",
      pinHash: await hashPin("1234"),
      role: "owner",
      locationId: restaurant.id,
      dailyRateMinor: 0,
    },
  });

  await testDb.staffMember.create({
    data: {
      id: "staff-cashier",
      name: "Test Cashier",
      phone: "+254700111334",
      pinHash: await hashPin("1234"),
      role: "cashier",
      locationId: restaurant.id,
      dailyRateMinor: 0,
    },
  });
});

beforeEach(async () => {
  await testDb.drawingRepayment.deleteMany({});
  await testDb.drawingDebt.deleteMany({});
  await testDb.expense.deleteMany({});
});

afterAll(async () => {
  await testDb.drawingRepayment.deleteMany({});
  await testDb.drawingDebt.deleteMany({});
  await testDb.expense.deleteMany({});
  await testDb.staffMember.deleteMany({});
  await testDb.location.deleteMany({});
  await testDb.$disconnect();
});

async function recordDrawing(amountMinor: number) {
  const result = await recordExpense(testDb, staffAt("owner", restaurantId), {
    locationId: restaurantId,
    category: "drawing",
    amountMinor,
    paymentMethod: "cash",
  });
  if (!result.ok) throw new Error("setup failed");
  return result.expense;
}

describe("recordDrawingRepayment", () => {
  test("reduces the outstanding drawings balance by the repayment amount", async () => {
    await recordDrawing(20000);
    const before = await drawingDebtOwed(testDb);

    const result = await recordDrawingRepayment(testDb, staffAt("owner", restaurantId), {
      amountMinor: 5000, paymentMethod: "cash",
    });

    expect(result.ok).toBe(true);
    const after = await drawingDebtOwed(testDb);
    expect(after).toBe(before - 5000);
  });

  test("rejects a repayment larger than the current outstanding balance", async () => {
    await recordDrawing(3000);

    const result = await recordDrawingRepayment(testDb, staffAt("owner", restaurantId), {
      amountMinor: 3001, paymentMethod: "cash",
    });

    expect(result).toEqual({ ok: false, reason: "exceeds_outstanding" });
  });

  test("rejects a non-positive amount", async () => {
    await recordDrawing(3000);

    const result = await recordDrawingRepayment(testDb, staffAt("owner", restaurantId), {
      amountMinor: 0, paymentMethod: "cash",
    });

    expect(result).toEqual({ ok: false, reason: "invalid_amount" });
  });

  test("rejects a non-owner", async () => {
    await recordDrawing(3000);

    const result = await recordDrawingRepayment(testDb, staffAt("cashier", restaurantId), {
      amountMinor: 1000, paymentMethod: "cash",
    });

    expect(result).toEqual({ ok: false, reason: "forbidden" });
  });
});

describe("reverseDrawingRepayment", () => {
  test("reversing a same-day repayment restores the outstanding balance", async () => {
    await recordDrawing(20000);
    const before = await drawingDebtOwed(testDb);
    const recorded = await recordDrawingRepayment(testDb, staffAt("owner", restaurantId), {
      amountMinor: 5000, paymentMethod: "cash",
    });
    if (!recorded.ok) throw new Error("setup failed");

    const result = await reverseDrawingRepayment(
      testDb,
      staffAt("owner", restaurantId),
      recorded.repayment.id,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.repayment.reversed).toBe(true);
    const after = await drawingDebtOwed(testDb);
    expect(after).toBe(before);
  });

  test("rejects reversing an already-reversed repayment", async () => {
    await recordDrawing(20000);
    const recorded = await recordDrawingRepayment(testDb, staffAt("owner", restaurantId), {
      amountMinor: 5000, paymentMethod: "cash",
    });
    if (!recorded.ok) throw new Error("setup failed");
    await reverseDrawingRepayment(testDb, staffAt("owner", restaurantId), recorded.repayment.id);

    const result = await reverseDrawingRepayment(
      testDb,
      staffAt("owner", restaurantId),
      recorded.repayment.id,
    );

    expect(result).toEqual({ ok: false, reason: "already_reversed" });
  });

  test("rejects a non-owner", async () => {
    await recordDrawing(20000);
    const recorded = await recordDrawingRepayment(testDb, staffAt("owner", restaurantId), {
      amountMinor: 5000, paymentMethod: "cash",
    });
    if (!recorded.ok) throw new Error("setup failed");

    const result = await reverseDrawingRepayment(
      testDb,
      staffAt("cashier", restaurantId),
      recorded.repayment.id,
    );

    expect(result).toEqual({ ok: false, reason: "forbidden" });
  });

  test("rejects an unknown repayment", async () => {
    const result = await reverseDrawingRepayment(testDb, staffAt("owner", restaurantId), "does-not-exist");

    expect(result).toEqual({ ok: false, reason: "not_found" });
  });

  test("rejects reversing a repayment from a previous day", async () => {
    await recordDrawing(20000);
    const recorded = await recordDrawingRepayment(testDb, staffAt("owner", restaurantId), {
      amountMinor: 5000, paymentMethod: "cash",
    });
    if (!recorded.ok) throw new Error("setup failed");

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    await testDb.drawingRepayment.update({
      where: { id: recorded.repayment.id },
      data: { occurredAt: yesterday },
    });

    const result = await reverseDrawingRepayment(
      testDb,
      staffAt("owner", restaurantId),
      recorded.repayment.id,
    );

    expect(result).toEqual({ ok: false, reason: "not_same_day" });
  });
});

describe("drawingDebtOwed", () => {
  test("nets debt minus unreversed repayments", async () => {
    await recordDrawing(10000);
    await recordDrawing(5000);
    await recordDrawingRepayment(testDb, staffAt("owner", restaurantId), {
      amountMinor: 4000,
      paymentMethod: "cash",
    });

    const owed = await drawingDebtOwed(testDb);

    expect(owed).toBe(11000);
  });

  test("a reversed repayment does not reduce the balance", async () => {
    await recordDrawing(10000);
    const recorded = await recordDrawingRepayment(testDb, staffAt("owner", restaurantId), {
      amountMinor: 4000, paymentMethod: "cash",
    });
    if (!recorded.ok) throw new Error("setup failed");
    await reverseDrawingRepayment(testDb, staffAt("owner", restaurantId), recorded.repayment.id);

    const owed = await drawingDebtOwed(testDb);

    expect(owed).toBe(10000);
  });
});
