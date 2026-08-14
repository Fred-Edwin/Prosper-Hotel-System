import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { hashPin } from "@/modules/people";
import type { AuthenticatedStaff } from "@/modules/people";
import { confirmTransfer, recordTransfer, reverseTransfer } from "@/modules/stock";
import {
  computeTransferCost,
  computeRestaurantCostOfGoods,
  computeCanteenCostOfGoods,
  getDashboardProfit,
  getLedgerSummary,
} from "../logic";
import { testDb } from "@/shared/test-db";

let restaurantId: string;
let canteenId: string;
let ownerId: string;

function owner(): AuthenticatedStaff {
  return {
    staff: {
      id: ownerId,
      name: "Test Owner",
      phone: "+254700119001",
      role: "owner",
      locationId: restaurantId,
      dailyRateMinor: 0,
      active: true,
    },
    location: { id: restaurantId, code: "restaurant", name: "Test Restaurant" },
  };
}

function attendant(locationId: string): AuthenticatedStaff {
  return {
    staff: {
      id: "attendant-1",
      name: "Test Attendant",
      phone: "+254700119002",
      role: "attendant",
      locationId,
      dailyRateMinor: 0,
      active: true,
    },
    location: { id: locationId, code: "canteen", name: "Test Canteen" },
  };
}

async function resetDb() {
  await testDb.transfer.deleteMany({});
  await testDb.paymentLine.deleteMany({});
  await testDb.saleLine.deleteMany({});
  await testDb.sale.deleteMany({});
  await testDb.stockCountLine.deleteMany({});
  await testDb.stockCount.deleteMany({});
  await testDb.stockMovement.deleteMany({});
  await testDb.ingredientMovement.deleteMany({});
  await testDb.expense.deleteMany({});
  await testDb.recipeLine.deleteMany({});
  await testDb.recipe.deleteMany({});
  await testDb.product.deleteMany({});
  await testDb.ingredient.deleteMany({});
  await testDb.staffMember.deleteMany({});
  await testDb.location.deleteMany({});
}

beforeEach(async () => {
  await resetDb();

  const [restaurant, canteen] = await Promise.all([
    testDb.location.create({ data: { code: "restaurant", name: "Test Restaurant" } }),
    testDb.location.create({ data: { code: "canteen", name: "Test Canteen" } }),
  ]);
  restaurantId = restaurant.id;
  canteenId = canteen.id;

  const ownerStaff = await testDb.staffMember.create({
    data: {
      name: "Test Owner",
      phone: "+254700119003",
      pinHash: await hashPin("1234"),
      role: "owner",
      locationId: restaurant.id,
      dailyRateMinor: 0,
    },
  });
  ownerId = ownerStaff.id;

  await testDb.staffMember.create({
    data: {
      id: "attendant-1",
      name: "Test Attendant",
      phone: "+254700119002",
      pinHash: await hashPin("1234"),
      role: "attendant",
      locationId: canteen.id,
      dailyRateMinor: 0,
    },
  });
});

afterAll(async () => {
  await resetDb();
  await testDb.$disconnect();
});

// 2026-08-13 revision: transfer cost travels with the item at its own
// unit cost (recipe cost, or the shared 60%-of-selling-price estimate as
// a last resort) — docs/formulas.md §5. The dynamic kitchen-consumption
// rate this file used to test is retired.
describe("computeTransferCost — formulas.md §5", () => {
  test("uses recipe cost where the transferred item has a recipe", async () => {
    const chips = await testDb.product.create({
      data: { name: "Chips", kind: "cooked_food", priceMinor: 100, locationId: restaurantId },
    });
    const potatoes = await testDb.ingredient.create({
      data: { name: "Potatoes", unitOfMeasure: "kg", lastKnownCostMinor: 9000 },
    });
    // 10kg potatoes at 90/kg -> 900 total, yields 40 plates -> 22.5/plate.
    await testDb.recipe.create({
      data: {
        productId: chips.id,
        yieldQuantity: 40,
        effectiveFrom: new Date("2026-01-01T00:00:00Z"),
        lines: { create: [{ ingredientId: potatoes.id, quantity: 10 }] },
      },
    });
    await testDb.ingredient.update({ where: { id: potatoes.id }, data: { lastKnownCostMinor: 90 } });

    const dayStart = new Date("2026-08-06T00:00:00Z");
    const dayEnd = new Date("2026-08-06T23:59:59Z");

    await testDb.stockMovement.create({
      data: {
        productId: chips.id,
        locationId: canteenId,
        quantity: 5,
        reason: "transferred",
        staffMemberId: ownerId,
        occurredAt: new Date("2026-08-06T10:00:00Z"),
      },
    });

    const result = await computeTransferCost(testDb, owner(), { periodStart: dayStart, periodEnd: dayEnd });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const line = result.lines.find((l) => l.productId === chips.id);
    expect(line?.usedRecipeCost).toBe(true);
    expect(line?.isEstimated).toBe(false);
    // 22.5/plate, cent-precise (getCurrentRecipe rounds to 2dp, not whole shillings).
    expect(line?.costMinor).toBe(22.5 * 5);
    expect(result.transferCostMinor).toBe(22.5 * 5);
  });

  test("falls back to the 60%-of-selling-price estimate where the item has no recipe", async () => {
    const chips = await testDb.product.create({
      data: { name: "Chips", kind: "cooked_food", priceMinor: 100, locationId: restaurantId },
    });

    const dayStart = new Date("2026-08-06T00:00:00Z");
    const dayEnd = new Date("2026-08-06T23:59:59Z");

    await testDb.stockMovement.create({
      data: {
        productId: chips.id,
        locationId: canteenId,
        quantity: 60,
        reason: "transferred",
        staffMemberId: ownerId,
        occurredAt: new Date("2026-08-06T10:00:00Z"),
      },
    });

    const result = await computeTransferCost(testDb, owner(), { periodStart: dayStart, periodEnd: dayEnd });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const line = result.lines.find((l) => l.productId === chips.id);
    expect(line?.usedRecipeCost).toBe(false);
    expect(line?.isEstimated).toBe(true);
    // 60 units at 100/unit selling value, 60% estimate -> 60 * 100 * 0.6 = 3600.
    expect(line?.costMinor).toBe(3600);
    expect(result.transferCostMinor).toBe(3600);
  });

  test("rejects a non-owner", async () => {
    const result = await computeTransferCost(testDb, attendant(canteenId), {
      periodStart: new Date(),
      periodEnd: new Date(),
    });
    expect(result.ok).toBe(false);
  });
});

describe("computeRestaurantCostOfGoods — formulas.md §6, restaurant", () => {
  test("opening + bought − closing − food sent to canteen, matching the worked example", async () => {
    const flour = await testDb.ingredient.create({
      data: { name: "Flour", unitOfMeasure: "kg", lastKnownCostMinor: 1000 },
    });

    const dayStart = new Date("2026-08-06T00:00:00Z");
    const dayEnd = new Date("2026-08-06T23:59:59Z");

    // Opened with 18,000: 18 units at 1000/unit as of dayStart.
    await testDb.ingredientMovement.create({
      data: {
        ingredientId: flour.id,
        locationId: restaurantId,
        quantity: 18,
        reason: "received",
        unitCostMinor: 1000,
        staffMemberId: ownerId,
        occurredAt: new Date("2026-08-05T12:00:00Z"),
      },
    });

    // Bought 9,000 during the day.
    await testDb.ingredientMovement.create({
      data: {
        ingredientId: flour.id,
        locationId: restaurantId,
        quantity: 9,
        reason: "received",
        unitCostMinor: 1000,
        staffMemberId: ownerId,
        occurredAt: new Date("2026-08-06T08:00:00Z"),
      },
    });

    // Closed with 15,000: net position must be 15 units by dayEnd, so
    // issue enough to land there (18 + 9 - issued = 15 => issued = 12).
    await testDb.ingredientMovement.create({
      data: {
        ingredientId: flour.id,
        locationId: restaurantId,
        quantity: -12,
        reason: "issued",
        staffMemberId: ownerId,
        occurredAt: new Date("2026-08-06T09:00:00Z"),
      },
    });

    // No transfer to canteen in this test (isolate the base formula).
    const result = await computeRestaurantCostOfGoods(testDb, owner(), { dayStart, dayEnd });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.openingMinor).toBe(18000);
    expect(result.closingMinor).toBe(15000);
    expect(result.boughtMinor).toBe(9000);
    expect(result.transferCostMinor).toBe(0);
    // formulas.md's worked example is 18,000 + 9,000 − 15,000 − 2,400 (with
    // a transfer) = 9,600; with no transfer here the figure is 2,400 higher.
    expect(result.totalMinor).toBe(18000 + 9000 - 15000);
  });

  test("subtracts food sent to canteen from the restaurant total, at the transferred item's own cost basis", async () => {
    const chips = await testDb.product.create({
      data: { name: "Chips", kind: "cooked_food", priceMinor: 100, locationId: restaurantId },
    });
    const flour = await testDb.ingredient.create({
      data: { name: "Flour", unitOfMeasure: "kg", lastKnownCostMinor: 1000 },
    });

    const dayStart = new Date("2026-08-06T00:00:00Z");
    const dayEnd = new Date("2026-08-06T23:59:59Z");

    await testDb.ingredientMovement.create({
      data: {
        ingredientId: flour.id,
        locationId: restaurantId,
        quantity: 18,
        reason: "received",
        unitCostMinor: 1000,
        staffMemberId: ownerId,
        occurredAt: new Date("2026-08-05T12:00:00Z"),
      },
    });
    await testDb.ingredientMovement.create({
      data: {
        ingredientId: flour.id,
        locationId: restaurantId,
        quantity: 9,
        reason: "received",
        unitCostMinor: 1000,
        staffMemberId: ownerId,
        occurredAt: new Date("2026-08-06T08:00:00Z"),
      },
    });
    await testDb.ingredientMovement.create({
      data: {
        ingredientId: flour.id,
        locationId: restaurantId,
        quantity: -12,
        reason: "issued",
        staffMemberId: ownerId,
        occurredAt: new Date("2026-08-06T09:00:00Z"),
      },
    });

    await testDb.sale.create({
      data: {
        locationId: restaurantId,
        staffMemberId: ownerId,
        fulfilment: "counter",
        totalMinor: 100000,
        occurredAt: new Date("2026-08-06T09:30:00Z"),
        lines: { create: [{ productId: chips.id, quantity: 1, priceMinor: 100000 }] },
      },
    });
    // No recipe on chips — falls back to the 60% estimate: 60 units at
    // 100/unit selling value = 6000, 60% -> 3600.
    await testDb.stockMovement.create({
      data: {
        productId: chips.id,
        locationId: canteenId,
        quantity: 60,
        reason: "transferred",
        staffMemberId: ownerId,
        occurredAt: new Date("2026-08-06T10:00:00Z"),
      },
    });

    const result = await computeRestaurantCostOfGoods(testDb, owner(), { dayStart, dayEnd });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.transferCostMinor).toBe(3600);
    expect(result.totalMinor).toBe(18000 + 9000 - 15000 - 3600);
  });
});

describe("business-total invariant — formulas.md §5", () => {
  test("business cost of goods sold is unaffected by which cost basis a transfer uses", async () => {
    const chips = await testDb.product.create({
      data: { name: "Chips", kind: "cooked_food", priceMinor: 100, locationId: restaurantId },
    });
    const flour = await testDb.ingredient.create({
      data: { name: "Flour", unitOfMeasure: "kg", lastKnownCostMinor: 1000 },
    });

    const dayStart = new Date("2026-08-06T00:00:00Z");
    const dayEnd = new Date("2026-08-06T23:59:59Z");

    await testDb.ingredientMovement.create({
      data: {
        ingredientId: flour.id,
        locationId: restaurantId,
        quantity: 18,
        reason: "received",
        unitCostMinor: 1000,
        staffMemberId: ownerId,
        occurredAt: new Date("2026-08-05T12:00:00Z"),
      },
    });
    await testDb.sale.create({
      data: {
        locationId: restaurantId,
        staffMemberId: ownerId,
        fulfilment: "counter",
        totalMinor: 100000,
        occurredAt: new Date("2026-08-06T09:30:00Z"),
        lines: { create: [{ productId: chips.id, quantity: 1, priceMinor: 100000 }] },
      },
    });
    // Real, confirmed stock to transfer at the restaurant.
    await testDb.stockMovement.create({
      data: {
        productId: chips.id,
        locationId: restaurantId,
        quantity: 60,
        reason: "produced",
        staffMemberId: ownerId,
        occurredAt: new Date("2026-08-06T08:00:00Z"),
      },
    });

    // Baseline, before any transfer.
    const restaurantBefore = await computeRestaurantCostOfGoods(testDb, owner(), { dayStart, dayEnd });
    const canteenBefore = await computeCanteenCostOfGoods(testDb, owner(), { dayStart, dayEnd });
    expect(restaurantBefore.ok && canteenBefore.ok).toBe(true);
    if (!restaurantBefore.ok || !canteenBefore.ok) return;

    const transferResult = await recordTransfer(testDb, owner(), {
      fromLocationId: restaurantId,
      toLocationId: canteenId,
      itemType: "product",
      itemId: chips.id,
      quantity: 60,
    });
    expect(transferResult.ok).toBe(true);
    if (!transferResult.ok) return;
    const transferId = transferResult.transfers[0].id;

    // Cost only moves once confirmed — the receiving side's sold quantity
    // (computeCanteenCostOfGoods now reads real "sold" movements, not the
    // transfer itself) needs a confirmed, then sold, unit to reconcile.
    const confirmed = await confirmTransfer(testDb, attendant(canteenId), {
      transferId,
      confirmedQuantity: 60,
    });
    expect(confirmed.ok).toBe(true);

    const restaurantAfterTransfer = await computeRestaurantCostOfGoods(testDb, owner(), { dayStart, dayEnd });
    expect(restaurantAfterTransfer.ok).toBe(true);
    if (!restaurantAfterTransfer.ok) return;

    // Confirming the transfer reduced the restaurant's cost of goods sold
    // by the transfer's own cost basis, regardless of what that basis is.
    const restaurantReduction = restaurantBefore.totalMinor - restaurantAfterTransfer.totalMinor;
    expect(restaurantReduction).toBe(restaurantAfterTransfer.transferCostMinor);

    const reversal = await reverseTransfer(testDb, owner(), transferId);
    expect(reversal.ok).toBe(true);

    const restaurantAfterReversal = await computeRestaurantCostOfGoods(testDb, owner(), { dayStart, dayEnd });
    expect(restaurantAfterReversal.ok).toBe(true);
    if (!restaurantAfterReversal.ok) return;

    // The round-trip returns the restaurant's cost of goods to its
    // pre-transfer value.
    expect(restaurantAfterReversal.totalMinor).toBe(restaurantBefore.totalMinor);
  });
});

// 2026-08-13 revision: the canteen's cost of goods sold is now the same
// question as the restaurant's, asked at product granularity — the cost
// of what was actually recorded sold, at each product's own cost basis.
// No more exact/estimated split, no more own-goods rate measured at a
// count (docs/formulas.md §6).
describe("computeCanteenCostOfGoods — formulas.md §6, canteen", () => {
  test("restaurant-supplied food, sold with a recipe: valued at recipe cost", async () => {
    const samosa = await testDb.product.create({
      data: { name: "Samosa", kind: "cooked_food", priceMinor: 20, locationId: restaurantId },
    });
    const dough = await testDb.ingredient.create({
      data: { name: "Dough", unitOfMeasure: "kg", lastKnownCostMinor: 5 },
    });
    await testDb.recipe.create({
      data: {
        productId: samosa.id,
        yieldQuantity: 40,
        effectiveFrom: new Date("2026-01-01T00:00:00Z"),
        lines: { create: [{ ingredientId: dough.id, quantity: 10 }] },
      },
    });

    const dayStart = new Date("2026-08-06T00:00:00Z");
    const dayEnd = new Date("2026-08-06T23:59:59Z");

    await testDb.stockMovement.create({
      data: {
        productId: samosa.id,
        locationId: canteenId,
        quantity: 40,
        reason: "transferred",
        staffMemberId: ownerId,
        occurredAt: new Date("2026-08-06T08:00:00Z"),
      },
    });
    // 32 sold, 8 left at close (not sold — no cost contribution here).
    await testDb.stockMovement.create({
      data: {
        productId: samosa.id,
        locationId: canteenId,
        quantity: -32,
        reason: "sold",
        staffMemberId: "attendant-1",
        occurredAt: new Date("2026-08-06T12:00:00Z"),
      },
    });

    const result = await computeCanteenCostOfGoods(testDb, owner(), { dayStart, dayEnd });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // per-unit recipe cost = 50/40 = 1.25 (cent-precise); 32 sold at 1.25/unit = 40.
    expect(result.totalMinor).toBe(40);
  });

  test("the canteen's own goods, sold: valued at purchase cost, exact — no rate, no estimate", async () => {
    const soda = await testDb.product.create({
      data: { name: "Soda", kind: "goods", priceMinor: 100, lastKnownCostMinor: 72, locationId: canteenId },
    });

    const dayStart = new Date("2026-08-06T00:00:00Z");
    const dayEnd = new Date("2026-08-06T23:59:59Z");

    await testDb.stockMovement.create({
      data: {
        productId: soda.id,
        locationId: canteenId,
        quantity: 100,
        reason: "received",
        staffMemberId: ownerId,
        occurredAt: new Date("2026-08-06T07:00:00Z"),
      },
    });
    await testDb.stockMovement.create({
      data: {
        productId: soda.id,
        locationId: canteenId,
        quantity: -60,
        reason: "sold",
        staffMemberId: "attendant-1",
        occurredAt: new Date("2026-08-06T12:00:00Z"),
      },
    });

    const result = await computeCanteenCostOfGoods(testDb, owner(), { dayStart, dayEnd });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // 60 sold at 72/unit purchase cost = 4320, exact.
    expect(result.totalMinor).toBe(4320);
  });

  test("a day with nothing sold has zero cost of goods, not unavailable", async () => {
    const dayStart = new Date("2026-08-06T00:00:00Z");
    const dayEnd = new Date("2026-08-06T23:59:59Z");

    const result = await computeCanteenCostOfGoods(testDb, owner(), { dayStart, dayEnd });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.totalMinor).toBe(0);
  });

  test("rejects a non-owner", async () => {
    const result = await computeCanteenCostOfGoods(testDb, attendant(canteenId), {
      dayStart: new Date(),
      dayEnd: new Date(),
    });
    expect(result.ok).toBe(false);
  });
});

describe("getDashboardProfit", () => {
  test("assembles revenue, cost of goods, running costs and net profit for a day — all final, never null", async () => {
    const dayStart = new Date("2026-08-06T00:00:00Z");
    const dayEnd = new Date("2026-08-06T23:59:59Z");

    const soda = await testDb.product.create({
      data: { name: "Soda", kind: "goods", priceMinor: 100, lastKnownCostMinor: 72, locationId: canteenId },
    });
    await testDb.sale.create({
      data: {
        locationId: canteenId,
        staffMemberId: "attendant-1",
        fulfilment: "counter",
        totalMinor: 3000,
        occurredAt: new Date("2026-08-06T18:00:00Z"),
        lines: { create: [{ productId: soda.id, quantity: 30, priceMinor: 100 }] },
      },
    });
    await testDb.stockMovement.create({
      data: {
        productId: soda.id,
        locationId: canteenId,
        quantity: -30,
        reason: "sold",
        staffMemberId: "attendant-1",
        occurredAt: new Date("2026-08-06T18:00:00Z"),
      },
    });
    await testDb.expense.create({
      data: {
        locationId: restaurantId,
        staffMemberId: ownerId,
        category: "running",
        amountMinor: 2300,
        occurredAt: new Date("2026-08-06T12:00:00Z"),
      },
    });

    const result = await getDashboardProfit(testDb, owner(), { dayStart, dayEnd });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.revenue.canteen).toBe(3000);
    expect(result.runningCostsMinor).toBe(2300);
    // 2026-08-13: no longer provisional or unavailable — every figure
    // here is final as recorded, at both locations (docs/formulas.md §7).
    expect(result.costOfGoods.total).toBe(30 * 72);
    expect(result.grossProfitMinor).not.toBeNull();
    expect(result.netProfitMinor).toBe(result.grossProfitMinor! - 2300);
  });

  test("rejects a non-owner", async () => {
    const result = await getDashboardProfit(testDb, attendant(canteenId), {
      dayStart: new Date(),
      dayEnd: new Date(),
    });
    expect(result.ok).toBe(false);
  });

  test("accepts a multi-day (week-shaped) period and reflects revenue from every day in it", async () => {
    const weekStart = new Date("2026-08-03T00:00:00Z"); // Monday
    const weekEnd = new Date("2026-08-10T00:00:00Z"); // following Monday

    const chips = await testDb.product.create({
      data: { name: "Chips", kind: "cooked_food", priceMinor: 100, locationId: restaurantId },
    });
    await testDb.sale.create({
      data: {
        locationId: restaurantId,
        staffMemberId: ownerId,
        fulfilment: "counter",
        totalMinor: 5000,
        occurredAt: new Date("2026-08-04T12:00:00Z"),
        lines: { create: [{ productId: chips.id, quantity: 50, priceMinor: 5000 }] },
      },
    });
    await testDb.sale.create({
      data: {
        locationId: restaurantId,
        staffMemberId: ownerId,
        fulfilment: "counter",
        totalMinor: 3000,
        occurredAt: new Date("2026-08-07T12:00:00Z"),
        lines: { create: [{ productId: chips.id, quantity: 30, priceMinor: 3000 }] },
      },
    });
    await testDb.expense.create({
      data: {
        locationId: restaurantId,
        staffMemberId: ownerId,
        category: "running",
        amountMinor: 1000,
        occurredAt: new Date("2026-08-04T12:00:00Z"),
      },
    });
    await testDb.expense.create({
      data: {
        locationId: canteenId,
        staffMemberId: ownerId,
        category: "running",
        amountMinor: 500,
        occurredAt: new Date("2026-08-07T12:00:00Z"),
      },
    });

    const result = await getDashboardProfit(testDb, owner(), {
      dayStart: weekStart,
      dayEnd: weekEnd,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.revenue.restaurant).toBe(8000);
    expect(result.runningCostsMinor).toBe(1500);
  });

  test("per-location split reconciles: restaurant + canteen = combined, across revenue, cost of goods, running costs and net profit", async () => {
    const dayStart = new Date("2026-08-06T00:00:00Z");
    const dayEnd = new Date("2026-08-06T23:59:59Z");

    const soda = await testDb.product.create({
      data: { name: "Soda", kind: "goods", priceMinor: 100, lastKnownCostMinor: 72, locationId: canteenId },
    });
    await testDb.stockMovement.create({
      data: {
        productId: soda.id,
        locationId: canteenId,
        quantity: -30,
        reason: "sold",
        staffMemberId: "attendant-1",
        occurredAt: new Date("2026-08-06T18:00:00Z"),
      },
    });

    const chips = await testDb.product.create({
      data: { name: "Chips", kind: "cooked_food", priceMinor: 100, locationId: restaurantId },
    });
    await testDb.sale.create({
      data: {
        locationId: restaurantId,
        staffMemberId: ownerId,
        fulfilment: "counter",
        totalMinor: 5000,
        occurredAt: new Date("2026-08-06T09:00:00Z"),
        lines: { create: [{ productId: chips.id, quantity: 50, priceMinor: 5000 }] },
      },
    });
    await testDb.sale.create({
      data: {
        locationId: canteenId,
        staffMemberId: "attendant-1",
        fulfilment: "counter",
        totalMinor: 3000,
        occurredAt: new Date("2026-08-06T18:00:00Z"),
        lines: { create: [{ productId: soda.id, quantity: 30, priceMinor: 100 }] },
      },
    });
    await testDb.expense.create({
      data: {
        locationId: restaurantId,
        staffMemberId: ownerId,
        category: "running",
        amountMinor: 800,
        occurredAt: new Date("2026-08-06T12:00:00Z"),
      },
    });
    await testDb.expense.create({
      data: {
        locationId: canteenId,
        staffMemberId: ownerId,
        category: "running",
        amountMinor: 200,
        occurredAt: new Date("2026-08-06T12:00:00Z"),
      },
    });

    const result = await getDashboardProfit(testDb, owner(), { dayStart, dayEnd });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.byLocation.restaurant.revenueMinor).toBe(5000);
    expect(result.byLocation.canteen.revenueMinor).toBe(3000);
    expect(result.byLocation.restaurant.revenueMinor + result.byLocation.canteen.revenueMinor).toBe(
      result.revenue.total,
    );

    expect(
      result.byLocation.restaurant.costOfGoodsMinor + result.byLocation.canteen.costOfGoodsMinor,
    ).toBe(result.costOfGoods.total);

    expect(result.byLocation.restaurant.runningCostsMinor).toBe(800);
    expect(result.byLocation.canteen.runningCostsMinor).toBe(200);
    expect(
      result.byLocation.restaurant.runningCostsMinor + result.byLocation.canteen.runningCostsMinor,
    ).toBe(result.runningCostsMinor);

    expect(
      result.byLocation.restaurant.netProfitMinor + result.byLocation.canteen.netProfitMinor,
    ).toBe(result.netProfitMinor);
  });
});

describe("getLedgerSummary — ticket 38, whole business over an arbitrary period", () => {
  test("opening + purchases − closing = cost of goods sold, and gross profit = sales value − cost of goods sold, over a multi-day period spanning both locations", async () => {
    const periodStart = new Date("2026-08-01T00:00:00Z");
    const periodEnd = new Date("2026-08-03T00:00:00Z");

    // Restaurant ingredients: opening 18,000 (flour on hand before the
    // period), bought 9,000 during it, closing 15,000 (whatever remains at
    // periodEnd) — the worked example from proposal.md §10.2, spread over
    // two days rather than one.
    const flour = await testDb.ingredient.create({
      data: { name: "Flour", unitOfMeasure: "kg", lastKnownCostMinor: 1000 },
    });
    await testDb.ingredientMovement.create({
      data: {
        ingredientId: flour.id,
        locationId: restaurantId,
        quantity: 18,
        reason: "received",
        unitCostMinor: 1000,
        staffMemberId: ownerId,
        occurredAt: new Date("2026-07-31T12:00:00Z"),
      },
    });
    await testDb.ingredientMovement.create({
      data: {
        ingredientId: flour.id,
        locationId: restaurantId,
        quantity: 9,
        reason: "received",
        unitCostMinor: 1000,
        staffMemberId: ownerId,
        occurredAt: new Date("2026-08-01T09:00:00Z"),
      },
    });
    await testDb.ingredientMovement.create({
      data: {
        ingredientId: flour.id,
        locationId: restaurantId,
        quantity: -12,
        reason: "issued",
        unitCostMinor: 1000,
        staffMemberId: ownerId,
        occurredAt: new Date("2026-08-02T09:00:00Z"),
      },
    });

    // Restaurant sells across the two days.
    const chips = await testDb.product.create({
      data: { name: "Chips", kind: "cooked_food", priceMinor: 100, locationId: restaurantId },
    });
    await testDb.sale.create({
      data: {
        locationId: restaurantId,
        staffMemberId: ownerId,
        fulfilment: "counter",
        totalMinor: 5000,
        occurredAt: new Date("2026-08-01T13:00:00Z"),
        lines: { create: [{ productId: chips.id, quantity: 50, priceMinor: 5000 }] },
      },
    });
    await testDb.sale.create({
      data: {
        locationId: restaurantId,
        staffMemberId: ownerId,
        fulfilment: "counter",
        totalMinor: 4000,
        occurredAt: new Date("2026-08-02T13:00:00Z"),
        lines: { create: [{ productId: chips.id, quantity: 40, priceMinor: 4000 }] },
      },
    });

    // Canteen sells across the two days — real sales now, valued at
    // purchase cost, exact.
    const soda = await testDb.product.create({
      data: { name: "Soda", kind: "goods", priceMinor: 100, lastKnownCostMinor: 72, locationId: canteenId },
    });
    await testDb.sale.create({
      data: {
        locationId: canteenId,
        staffMemberId: "attendant-1",
        fulfilment: "counter",
        totalMinor: 1500,
        occurredAt: new Date("2026-08-01T18:00:00Z"),
        lines: { create: [{ productId: soda.id, quantity: 15, priceMinor: 100 }] },
      },
    });
    await testDb.stockMovement.create({
      data: {
        productId: soda.id,
        locationId: canteenId,
        quantity: -15,
        reason: "sold",
        staffMemberId: "attendant-1",
        occurredAt: new Date("2026-08-01T18:00:00Z"),
      },
    });
    await testDb.sale.create({
      data: {
        locationId: canteenId,
        staffMemberId: "attendant-1",
        fulfilment: "counter",
        totalMinor: 1000,
        occurredAt: new Date("2026-08-02T18:00:00Z"),
        lines: { create: [{ productId: soda.id, quantity: 10, priceMinor: 100 }] },
      },
    });
    await testDb.stockMovement.create({
      data: {
        productId: soda.id,
        locationId: canteenId,
        quantity: -10,
        reason: "sold",
        staffMemberId: "attendant-1",
        occurredAt: new Date("2026-08-02T18:00:00Z"),
      },
    });

    // A plate wasted at the restaurant — non-sales consumption, already
    // inside cost of goods sold via the ingredients it used, reported
    // separately at cost and at selling price.
    await testDb.stockMovement.create({
      data: {
        productId: chips.id,
        locationId: restaurantId,
        quantity: -1,
        reason: "wasted",
        staffMemberId: ownerId,
        costBasisMinor: 60,
        sellingValueMinor: 100,
        occurredAt: new Date("2026-08-01T20:00:00Z"),
      },
    });

    const result = await getLedgerSummary(testDb, owner(), { periodStart, periodEnd });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.openingMinor).toBe(18000);
    expect(result.purchasesMinor).toBe(9000);
    expect(result.closingMinor).toBe(15000);
    // Restaurant COGS 18000+9000-15000=12000, canteen COGS 25 sodas at 72 = 1800.
    expect(result.costOfGoodsSoldMinor).toBe(12000 + 1800);
    expect(result.salesValueMinor).toBe(5000 + 4000 + 1500 + 1000);
    expect(result.grossProfitMinor).toBe(result.salesValueMinor - result.costOfGoodsSoldMinor);
    expect(result.nonSalesAtCostMinor).toBe(60);
    expect(result.nonSalesAtPriceMinor).toBe(100);
  });

  test("rejects a non-owner", async () => {
    const result = await getLedgerSummary(testDb, attendant(canteenId), {
      periodStart: new Date(),
      periodEnd: new Date(),
    });
    expect(result.ok).toBe(false);
  });

  test("an empty period has zero figures throughout, not an error", async () => {
    const result = await getLedgerSummary(testDb, owner(), {
      periodStart: new Date("2026-01-01T00:00:00Z"),
      periodEnd: new Date("2026-01-02T00:00:00Z"),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.openingMinor).toBe(0);
    expect(result.purchasesMinor).toBe(0);
    expect(result.closingMinor).toBe(0);
    expect(result.costOfGoodsSoldMinor).toBe(0);
    expect(result.salesValueMinor).toBe(0);
    expect(result.grossProfitMinor).toBe(0);
    expect(result.nonSalesAtCostMinor).toBe(0);
    expect(result.nonSalesAtPriceMinor).toBe(0);
  });
});
