import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { hashPin } from "@/modules/people";
import type { AuthenticatedStaff } from "@/modules/people";
import { recordIngredientReceipt } from "@/modules/stock";
import { recordExpense, reverseExpense, drawingDebtOwed } from "../logic";
import { testDb } from "@/shared/test-db";

let restaurantId: string;
let flourId: string;

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

  const flour = await testDb.ingredient.create({
    data: { name: "Flour", unitOfMeasure: "kg" },
  });
  flourId = flour.id;
});

beforeEach(async () => {
  await testDb.drawingDebt.deleteMany({});
  await testDb.expense.deleteMany({});
  await testDb.ingredientMovement.deleteMany({});
});

afterAll(async () => {
  await testDb.drawingDebt.deleteMany({});
  await testDb.expense.deleteMany({});
  await testDb.ingredientMovement.deleteMany({});
  await testDb.ingredient.deleteMany({});
  await testDb.staffMember.deleteMany({});
  await testDb.location.deleteMany({});
  await testDb.$disconnect();
});

describe("recordExpense", () => {
  test("records a running-cost payment", async () => {
    const result = await recordExpense(testDb, staffAt("owner", restaurantId), {
      locationId: restaurantId,
      category: "running",
      amountMinor: 50000,
      note: "Gas refill",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.expense.category).toBe("running");
    expect(result.expense.amountMinor).toBe(50000);
    expect(result.expense.reversed).toBe(false);
  });

  test("rejects a non-owner", async () => {
    const result = await recordExpense(testDb, staffAt("cashier", restaurantId), {
      locationId: restaurantId,
      category: "running",
      amountMinor: 5000,
    });

    expect(result).toEqual({ ok: false, reason: "forbidden" });
  });

  test("rejects a non-positive amount", async () => {
    const result = await recordExpense(testDb, staffAt("owner", restaurantId), {
      locationId: restaurantId,
      category: "running",
      amountMinor: 0,
    });

    expect(result).toEqual({ ok: false, reason: "invalid_amount" });
  });

  test("records a stock payment referencing a real receipt", async () => {
    const receipt = await recordIngredientReceipt(testDb, staffAt("owner", restaurantId), {
      locationId: restaurantId,
      lines: [{ ingredientId: flourId, quantity: 10, unitCostMinor: 8000 }],
    });
    if (!receipt.ok) throw new Error("setup failed");
    const receiptId = receipt.movements[0].receiptId;

    const result = await recordExpense(testDb, staffAt("owner", restaurantId), {
      locationId: restaurantId,
      category: "stock",
      amountMinor: 80000,
      receiptId,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.expense.receiptId).toBe(receiptId);
  });

  test("rejects a stock payment with no receipt reference", async () => {
    const result = await recordExpense(testDb, staffAt("owner", restaurantId), {
      locationId: restaurantId,
      category: "stock",
      amountMinor: 80000,
    });

    expect(result).toEqual({ ok: false, reason: "receipt_required" });
  });

  test("rejects a stock payment referencing an unknown receipt", async () => {
    const result = await recordExpense(testDb, staffAt("owner", restaurantId), {
      locationId: restaurantId,
      category: "stock",
      amountMinor: 80000,
      receiptId: "does-not-exist",
    });

    expect(result).toEqual({ ok: false, reason: "receipt_not_found" });
  });

  test("a drawing payment also creates a debt owed back to the business", async () => {
    const before = await drawingDebtOwed(testDb);

    const result = await recordExpense(testDb, staffAt("owner", restaurantId), {
      locationId: restaurantId,
      category: "drawing",
      amountMinor: 20000,
    });

    expect(result.ok).toBe(true);
    const after = await drawingDebtOwed(testDb);
    expect(after).toBe(before + 20000);
  });

  test("a non-drawing payment does not create a debt", async () => {
    const before = await drawingDebtOwed(testDb);

    await recordExpense(testDb, staffAt("owner", restaurantId), {
      locationId: restaurantId,
      category: "asset",
      amountMinor: 15000,
    });

    const after = await drawingDebtOwed(testDb);
    expect(after).toBe(before);
  });
});

describe("reverseExpense", () => {
  test("reverses a same-day payment", async () => {
    const recorded = await recordExpense(testDb, staffAt("owner", restaurantId), {
      locationId: restaurantId,
      category: "running",
      amountMinor: 3000,
    });
    if (!recorded.ok) throw new Error("setup failed");

    const result = await reverseExpense(testDb, staffAt("owner", restaurantId), recorded.expense.id);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.expense.reversed).toBe(true);
    expect(result.expense.reversedBy).toBe("staff-owner");
  });

  test("rejects a non-owner", async () => {
    const recorded = await recordExpense(testDb, staffAt("owner", restaurantId), {
      locationId: restaurantId,
      category: "running",
      amountMinor: 3000,
    });
    if (!recorded.ok) throw new Error("setup failed");

    const result = await reverseExpense(testDb, staffAt("cashier", restaurantId), recorded.expense.id);

    expect(result).toEqual({ ok: false, reason: "forbidden" });
  });

  test("rejects an unknown expense", async () => {
    const result = await reverseExpense(testDb, staffAt("owner", restaurantId), "does-not-exist");

    expect(result).toEqual({ ok: false, reason: "not_found" });
  });

  test("rejects reversing an already-reversed payment", async () => {
    const recorded = await recordExpense(testDb, staffAt("owner", restaurantId), {
      locationId: restaurantId,
      category: "running",
      amountMinor: 3000,
    });
    if (!recorded.ok) throw new Error("setup failed");
    await reverseExpense(testDb, staffAt("owner", restaurantId), recorded.expense.id);

    const result = await reverseExpense(testDb, staffAt("owner", restaurantId), recorded.expense.id);

    expect(result).toEqual({ ok: false, reason: "already_reversed" });
  });

  test("rejects reversing a payment from a previous day", async () => {
    const recorded = await recordExpense(testDb, staffAt("owner", restaurantId), {
      locationId: restaurantId,
      category: "running",
      amountMinor: 3000,
    });
    if (!recorded.ok) throw new Error("setup failed");

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    await testDb.expense.update({ where: { id: recorded.expense.id }, data: { occurredAt: yesterday } });

    const result = await reverseExpense(testDb, staffAt("owner", restaurantId), recorded.expense.id);

    expect(result).toEqual({ ok: false, reason: "not_same_day" });
  });

  test("reversing a drawing payment also reverses its debt", async () => {
    const recorded = await recordExpense(testDb, staffAt("owner", restaurantId), {
      locationId: restaurantId,
      category: "drawing",
      amountMinor: 7000,
    });
    if (!recorded.ok) throw new Error("setup failed");
    const before = await drawingDebtOwed(testDb);

    await reverseExpense(testDb, staffAt("owner", restaurantId), recorded.expense.id);

    const after = await drawingDebtOwed(testDb);
    expect(after).toBe(before - 7000);
  });

  test("reversing a stock payment does not touch the paired receipt's stock movement", async () => {
    const receipt = await recordIngredientReceipt(testDb, staffAt("owner", restaurantId), {
      locationId: restaurantId,
      lines: [{ ingredientId: flourId, quantity: 5, unitCostMinor: 8000 }],
    });
    if (!receipt.ok) throw new Error("setup failed");
    const receiptId = receipt.movements[0].receiptId;

    const recorded = await recordExpense(testDb, staffAt("owner", restaurantId), {
      locationId: restaurantId,
      category: "stock",
      amountMinor: 40000,
      receiptId,
    });
    if (!recorded.ok) throw new Error("setup failed");

    await reverseExpense(testDb, staffAt("owner", restaurantId), recorded.expense.id);

    const movementsStillPresent = await testDb.ingredientMovement.count({ where: { receiptId } });
    expect(movementsStillPresent).toBe(1);
  });
});
