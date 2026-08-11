import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { hashPin } from "@/modules/people";
import type { AuthenticatedStaff } from "@/modules/people";
import { recordIngredientReceipt } from "@/modules/stock";
import { recordExpense, reverseExpense, getRunningCashBalance } from "../logic";
import { testDb } from "@/shared/test-db";

let restaurantId: string;
let canteenId: string;
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
  const canteen = await testDb.location.create({
    data: { code: "canteen", name: "Test Canteen" },
  });
  restaurantId = restaurant.id;
  canteenId = canteen.id;

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
  await testDb.handover.deleteMany({});
  await testDb.ingredientMovement.deleteMany({});
});

afterAll(async () => {
  await testDb.drawingDebt.deleteMany({});
  await testDb.expense.deleteMany({});
  await testDb.handover.deleteMany({});
  await testDb.ingredientMovement.deleteMany({});
  await testDb.ingredient.deleteMany({});
  await testDb.staffMember.deleteMany({});
  await testDb.location.deleteMany({});
  await testDb.$disconnect();
});

// Directly seeds a Handover row rather than going through recordHandover,
// since this ticket only cares about the actual amounts handed over, not
// the expected-vs-actual comparison machinery.
async function seedHandover(locationId: string, actualCashMinor: number, actualMpesaMinor: number) {
  await testDb.handover.create({
    data: {
      locationId,
      staffMemberId: "staff-cashier",
      expectedCashMinor: actualCashMinor,
      expectedMpesaMinor: actualMpesaMinor,
      actualCashMinor,
      actualMpesaMinor,
    },
  });
}

describe("getRunningCashBalance", () => {
  test("matches formulas.md §9's worked example", async () => {
    // Handovers received: KSh 142,000 (all cash, all restaurant, for simplicity).
    await seedHandover(restaurantId, 14200000, 0);

    // Stock bought: KSh 61,500.
    const receipt = await recordIngredientReceipt(testDb, staffAt("owner", restaurantId), {
      locationId: restaurantId,
      lines: [{ itemType: "ingredient", itemId: flourId, quantity: 10, unitCostMinor: 615000 }],
    });
    if (!receipt.ok) throw new Error("setup failed");
    await recordExpense(testDb, staffAt("owner", restaurantId), {
      locationId: restaurantId,
      category: "stock",
      amountMinor: 6150000,
      paymentMethod: "cash",
      receiptId: receipt.movements[0].receiptId,
    });
    // Gas/charcoal/electricity (running costs): KSh 12,300.
    await recordExpense(testDb, staffAt("owner", restaurantId), {
      locationId: restaurantId,
      category: "running",
      amountMinor: 1230000,
      paymentMethod: "cash",
    });
    // Freezer (equipment/asset): KSh 30,000.
    await recordExpense(testDb, staffAt("owner", restaurantId), {
      locationId: restaurantId,
      category: "asset",
      amountMinor: 3000000,
      paymentMethod: "cash",
    });
    // Owner's drawings: KSh 15,000.
    await recordExpense(testDb, staffAt("owner", restaurantId), {
      locationId: restaurantId,
      category: "drawing",
      amountMinor: 1500000,
      paymentMethod: "cash",
    });

    const result = await getRunningCashBalance(testDb, staffAt("owner", restaurantId));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // 142,000 - 61,500 - 12,300 - 30,000 - 15,000 = 23,200.
    expect(result.cashMinor).toBe(2320000);
    expect(result.mpesaMinor).toBe(0);
  });

  test("keeps cash and M-Pesa separate throughout, and combines both locations", async () => {
    await seedHandover(restaurantId, 10000, 5000);
    await seedHandover(canteenId, 3000, 2000);

    await recordExpense(testDb, staffAt("owner", restaurantId), {
      locationId: restaurantId,
      category: "running",
      amountMinor: 1000,
      paymentMethod: "cash",
    });
    await recordExpense(testDb, staffAt("owner", restaurantId), {
      locationId: restaurantId,
      category: "running",
      amountMinor: 500,
      paymentMethod: "mpesa",
    });

    const result = await getRunningCashBalance(testDb, staffAt("owner", restaurantId));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Cash in: 10,000 + 3,000 = 13,000. Cash out: 1,000. Expected: 12,000.
    expect(result.cashMinor).toBe(12000);
    // M-Pesa in: 5,000 + 2,000 = 7,000. M-Pesa out: 500. Expected: 6,500.
    expect(result.mpesaMinor).toBe(6500);
  });

  test("a reversed expense is excluded from money-out", async () => {
    await seedHandover(restaurantId, 10000, 0);

    const recorded = await recordExpense(testDb, staffAt("owner", restaurantId), {
      locationId: restaurantId,
      category: "running",
      amountMinor: 3000,
      paymentMethod: "cash",
    });
    if (!recorded.ok) throw new Error("setup failed");
    await reverseExpense(testDb, staffAt("owner", restaurantId), recorded.expense.id);

    const result = await getRunningCashBalance(testDb, staffAt("owner", restaurantId));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.cashMinor).toBe(10000);
  });

  test("equipment and drawings both reduce the balance even though neither reduces profit", async () => {
    await seedHandover(restaurantId, 100000, 0);

    await recordExpense(testDb, staffAt("owner", restaurantId), {
      locationId: restaurantId,
      category: "asset",
      amountMinor: 20000,
      paymentMethod: "cash",
    });
    await recordExpense(testDb, staffAt("owner", restaurantId), {
      locationId: restaurantId,
      category: "drawing",
      amountMinor: 15000,
      paymentMethod: "cash",
    });

    const result = await getRunningCashBalance(testDb, staffAt("owner", restaurantId));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.cashMinor).toBe(65000);
  });

  test("a repeated category in separate expense entries sums correctly (no dedupe by category)", async () => {
    await seedHandover(restaurantId, 100000, 0);

    await recordExpense(testDb, staffAt("owner", restaurantId), {
      locationId: restaurantId,
      category: "running",
      amountMinor: 5000,
      paymentMethod: "cash",
    });
    await recordExpense(testDb, staffAt("owner", restaurantId), {
      locationId: restaurantId,
      category: "running",
      amountMinor: 7000,
      paymentMethod: "cash",
    });

    const result = await getRunningCashBalance(testDb, staffAt("owner", restaurantId));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.cashMinor).toBe(88000);
  });

  test("rejects a non-owner", async () => {
    const result = await getRunningCashBalance(testDb, staffAt("cashier", restaurantId));

    expect(result).toEqual({ ok: false, reason: "forbidden" });
  });
});
