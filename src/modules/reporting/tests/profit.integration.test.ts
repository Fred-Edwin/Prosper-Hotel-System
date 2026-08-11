import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { hashPin } from "@/modules/people";
import type { AuthenticatedStaff } from "@/modules/people";
import { recordStockCount } from "@/modules/stock";
import {
  computeTransferCost,
  computeRestaurantCostOfGoods,
  computeCanteenCostOfGoods,
  computeCountCorrection,
  getDashboardProfit,
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
  await testDb.paymentLine.deleteMany({});
  await testDb.saleLine.deleteMany({});
  await testDb.sale.deleteMany({});
  await testDb.stockCountLine.deleteMany({});
  await testDb.stockCount.deleteMany({});
  await testDb.stockMovement.deleteMany({});
  await testDb.ingredientMovement.deleteMany({});
  await testDb.expense.deleteMany({});
  await testDb.takings.deleteMany({});
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

describe("computeTransferCost — formulas.md §5", () => {
  test("rate = kitchen ingredients consumed ÷ kitchen food's selling value, applied to transferred food's selling value", async () => {
    const chips = await testDb.product.create({
      data: { name: "Chips", kind: "cooked_food", priceMinor: 100 },
    });

    const dayStart = new Date("2026-08-06T00:00:00Z");
    const dayEnd = new Date("2026-08-06T23:59:59Z");

    // Kitchen consumed KSh 40,000 of ingredients (issued to production).
    const flour = await testDb.ingredient.create({
      data: { name: "Flour", unitOfMeasure: "kg", lastKnownCostMinor: 40000 },
    });
    await testDb.ingredientMovement.create({
      data: {
        ingredientId: flour.id,
        locationId: restaurantId,
        quantity: -1,
        reason: "issued",
        staffMemberId: ownerId,
        occurredAt: new Date("2026-08-06T08:00:00Z"),
      },
    });

    // Kitchen food sold for KSh 100,000 (restaurant sales revenue).
    await testDb.sale.create({
      data: {
        locationId: restaurantId,
        staffMemberId: ownerId,
        fulfilment: "counter",
        totalMinor: 100000,
        occurredAt: new Date("2026-08-06T09:00:00Z"),
        lines: { create: [{ productId: chips.id, quantity: 1, priceMinor: 100000 }] },
      },
    });

    // Food worth KSh 6,000 (selling value) goes to the canteen.
    await testDb.stockMovement.create({
      data: {
        productId: chips.id,
        locationId: canteenId,
        quantity: 60, // 60 units at 100/unit = 6,000 selling value
        reason: "transferred",
        staffMemberId: ownerId,
        occurredAt: new Date("2026-08-06T10:00:00Z"),
      },
    });

    const result = await computeTransferCost(testDb, owner(), { periodStart: dayStart, periodEnd: dayEnd });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.rate).toBeCloseTo(0.4);
    expect(result.transferCostMinor).toBe(2400);
  });

  test("uses recipe cost instead of the derived rate where the transferred item has a recipe", async () => {
    const chips = await testDb.product.create({
      data: { name: "Chips", kind: "cooked_food", priceMinor: 100 },
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
    // 22.5/plate rounds to 23 (Math.round used in getCurrentRecipe) — assert against actual recipe cost.
    expect(line?.costMinor).toBe(23 * 5);
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

  test("subtracts food sent to canteen from the restaurant total", async () => {
    const chips = await testDb.product.create({
      data: { name: "Chips", kind: "cooked_food", priceMinor: 100 },
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

    // Kitchen sold KSh 100,000 of chips, consumed nothing extra tracked
    // (rate uses issued minor above => 0 issued for "consumed" split? we
    // use a separate ingredient consumption line to drive a non-zero rate)
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
    // The 12 units issued above (value 12,000) is what's "consumed" for
    // the rate: 12,000 / 100,000 = 0.12
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

    // rate = 12000 / 100000 = 0.12; transferred selling value = 60 * 100 = 6000; cost = 720
    expect(result.transferCostMinor).toBe(720);
    expect(result.totalMinor).toBe(18000 + 9000 - 15000 - 720);
  });
});

describe("business-total invariant — formulas.md §5", () => {
  test("business cost of goods sold is unaffected by the transfer rate chosen", async () => {
    const chips = await testDb.product.create({
      data: { name: "Chips", kind: "cooked_food", priceMinor: 100 },
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

    const transfer = await computeTransferCost(testDb, owner(), { periodStart: dayStart, periodEnd: dayEnd });
    const restaurantCogs = await computeRestaurantCostOfGoods(testDb, owner(), { dayStart, dayEnd });
    const canteenCogs = await computeCanteenCostOfGoods(testDb, owner(), { dayStart, dayEnd });
    expect(transfer.ok && restaurantCogs.ok && canteenCogs.ok).toBe(true);
    if (!transfer.ok || !restaurantCogs.ok || !canteenCogs.ok) return;

    // The same transferCostMinor must appear subtracted from the
    // restaurant and added (as canteenExact) to the canteen — so it
    // cancels in the business total regardless of the rate's value.
    expect(restaurantCogs.transferCostMinor).toBe(transfer.transferCostMinor);
    expect(canteenCogs.exactMinor).toBe(transfer.transferCostMinor);
  });
});

describe("computeCanteenCostOfGoods — formulas.md §6, canteen", () => {
  test("restaurant food: opening + transferred in − closing − wasted, valued at the transfer's own cost basis", async () => {
    // Recipe cost overrides the derived rate (§5's note) — makes the
    // per-unit cost deterministic for this test: 10 units of an
    // ingredient at 5/unit, yielding 40 samosas => 50/40 = 1.25/unit,
    // rounds to 1 (Math.round in getCurrentRecipe -> 50/40 = 1.25 -> 1).
    const samosa = await testDb.product.create({
      data: { name: "Samosa", kind: "cooked_food", priceMinor: 20 },
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

    // Monday: 40 samosas arrive, none carried in, 8 left at close (wasted for this test).
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
    await testDb.stockMovement.create({
      data: {
        productId: samosa.id,
        locationId: canteenId,
        quantity: -8,
        reason: "wasted",
        staffMemberId: ownerId,
        occurredAt: new Date("2026-08-06T20:00:00Z"),
      },
    });

    const result = await computeCanteenCostOfGoods(testDb, owner(), { dayStart, dayEnd });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // per-unit recipe cost = round(50/40) = 1; 40 - 8 = 32 consumed at cost 1/unit = 32.
    expect(result.exactMinor).toBe(32);
  });

  test("own goods: estimated cost = today's takings from those goods × rate measured at the last count", async () => {
    const soda = await testDb.product.create({
      data: { name: "Soda", kind: "goods", priceMinor: 100, lastKnownCostMinor: 72 },
    });

    // Previous count establishes the period the rate is measured over.
    const previous = await recordStockCount(testDb, attendant(canteenId), {
      locationId: canteenId,
      lines: [{ itemType: "product", itemId: soda.id, countedQuantity: 0 }],
    });
    expect(previous.ok).toBe(true);

    // Own goods received (own-goods classification) then sold down to 0
    // by the next count, so count-derived-sales attributes the full
    // quantity as sold. No explicit occurredAt — must land strictly
    // after the previous count's own (real, "now") timestamp.
    await testDb.stockMovement.create({
      data: {
        productId: soda.id,
        locationId: canteenId,
        quantity: 100,
        reason: "received",
        staffMemberId: ownerId,
      },
    });

    const latest = await recordStockCount(testDb, attendant(canteenId), {
      locationId: canteenId,
      lines: [{ itemType: "product", itemId: soda.id, countedQuantity: 0 }],
    });
    expect(latest.ok).toBe(true);

    // 100 sold at 100/unit selling price = 10,000 revenue. Cost at
    // lastKnownCostMinor 72 = 7,200. Rate = 7200 / 10000 = 0.72 — the
    // formulas.md example's own figure.
    const dayStart = new Date("2026-08-10T00:00:00Z");
    const dayEnd = new Date("2026-08-10T23:59:59Z");
    await testDb.takings.create({
      data: { locationId: canteenId, cashMinor: 2500, mpesaMinor: 1500, occurredAt: new Date("2026-08-10T18:00:00Z") },
    });

    const result = await computeCanteenCostOfGoods(testDb, owner(), { dayStart, dayEnd });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.canteenCostRate).toBeCloseTo(0.72);
    // Today's takings 4,000 × 0.72 = 2,880 — the formulas.md example.
    expect(result.estimatedMinor).toBe(Math.round(4000 * 0.72));
  });

  test("no previous count: own-goods estimate is unavailable rather than guessed", async () => {
    const dayStart = new Date("2026-08-06T00:00:00Z");
    const dayEnd = new Date("2026-08-06T23:59:59Z");

    const result = await computeCanteenCostOfGoods(testDb, owner(), { dayStart, dayEnd });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.canteenCostRate).toBeNull();
    expect(result.estimatedMinor).toBe(0);
    expect(result.lastCanteenCount).toBeNull();
  });

  test("rejects a non-owner", async () => {
    const result = await computeCanteenCostOfGoods(testDb, attendant(canteenId), {
      dayStart: new Date(),
      dayEnd: new Date(),
    });
    expect(result.ok).toBe(false);
  });
});

describe("computeCountCorrection — formulas.md §6, 'the count corrects the estimate'", () => {
  test("unavailable when there is no count history deep enough to derive an earlier rate", async () => {
    const result = await computeCountCorrection(testDb, owner());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.available).toBe(false);
  });

  test("computes estimated vs. measured vs. difference once three counts of history exist", async () => {
    const soda = await testDb.product.create({
      data: { name: "Soda", kind: "goods", priceMinor: 100, lastKnownCostMinor: 72 },
    });

    // computeCountCorrection needs the rate in force *before* the period
    // it's correcting, which is itself measured at the count before the
    // previous one — three counts of history deep, not two:
    //   zeroth -> first: establishes the "prior" rate (0.72)
    //   first -> second: the period computeCountCorrection reports on
    //   second: the latest count, triggering the report
    const zeroth = await recordStockCount(testDb, attendant(canteenId), {
      locationId: canteenId,
      lines: [{ itemType: "product", itemId: soda.id, countedQuantity: 0 }],
    });
    expect(zeroth.ok).toBe(true);

    await testDb.stockMovement.create({
      data: {
        productId: soda.id,
        locationId: canteenId,
        quantity: 50,
        reason: "received",
        staffMemberId: ownerId,
      },
    });

    // First count: everything sold — measures the 0.72 rate that will be
    // "in force" for the period after this count.
    const first = await recordStockCount(testDb, attendant(canteenId), {
      locationId: canteenId,
      lines: [{ itemType: "product", itemId: soda.id, countedQuantity: 0 }],
    });
    expect(first.ok).toBe(true);

    await testDb.stockMovement.create({
      data: {
        productId: soda.id,
        locationId: canteenId,
        quantity: 40,
        reason: "received",
        staffMemberId: ownerId,
      },
    });
    await testDb.takings.create({
      data: { locationId: canteenId, cashMinor: 3000, mpesaMinor: 1000 },
    });

    // Second count: the latest — computeCountCorrection reports on the
    // first→second period, using the rate measured at the zeroth→first
    // count.
    const second = await recordStockCount(testDb, attendant(canteenId), {
      locationId: canteenId,
      lines: [{ itemType: "product", itemId: soda.id, countedQuantity: 0 }],
    });
    expect(second.ok).toBe(true);

    const result = await computeCountCorrection(testDb, owner());
    expect(result.ok).toBe(true);
    if (!result.ok || !result.available) throw new Error("expected available correction");

    // rate before this period (from the zeroth→first count) = 0.72,
    // applied to takings since the first count (4,000) => 2,880.
    expect(result.estimatedSinceLastCountMinor).toBe(2880);
    // measured: 40 sold at 100/unit = 4,000 revenue.
    expect(result.measuredAtCountMinor).toBe(4000);
    expect(result.differenceMinor).toBe(4000 - 2880);
  });
});

describe("getDashboardProfit", () => {
  test("assembles revenue, cost of goods, running costs and net profit for a day", async () => {
    const dayStart = new Date("2026-08-06T00:00:00Z");
    const dayEnd = new Date("2026-08-06T23:59:59Z");

    await testDb.expense.create({
      data: {
        locationId: restaurantId,
        staffMemberId: ownerId,
        category: "running",
        amountMinor: 2300,
        occurredAt: new Date("2026-08-06T12:00:00Z"),
      },
    });
    await testDb.takings.create({
      data: { locationId: canteenId, cashMinor: 2000, mpesaMinor: 1000, occurredAt: new Date("2026-08-06T18:00:00Z") },
    });

    const result = await getDashboardProfit(testDb, owner(), { dayStart, dayEnd });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.revenue.canteen).toBe(3000);
    expect(result.runningCostsMinor).toBe(2300);
    expect(result.grossProfitMinor).toBe(result.revenue.total - result.costOfGoods.total);
    expect(result.netProfitMinor).toBe(result.grossProfitMinor - result.runningCostsMinor);
  });

  test("rejects a non-owner", async () => {
    const result = await getDashboardProfit(testDb, attendant(canteenId), {
      dayStart: new Date(),
      dayEnd: new Date(),
    });
    expect(result.ok).toBe(false);
  });
});
