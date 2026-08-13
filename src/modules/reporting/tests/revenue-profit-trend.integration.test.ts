import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { hashPin } from "@/modules/people";
import type { AuthenticatedStaff } from "@/modules/people";
import { recordStockCount } from "@/modules/stock";
import { getRevenueProfitTrend } from "../logic";
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

describe("getRevenueProfitTrend", () => {
  test("returns one point per day in the window, most recent last", async () => {
    const windowEnd = new Date("2026-08-06T12:00:00Z");

    const result = await getRevenueProfitTrend(testDb, owner(), { windowEnd, days: 3 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.points).toHaveLength(3);
    expect(result.points[2].date).toBe("2026-08-06");
    expect(result.points[0].date).toBe("2026-08-04");
  });

  test("a day with no Sale rows and no Takings rows at either location is a gap (null revenue and net profit)", async () => {
    const windowEnd = new Date("2026-08-06T12:00:00Z");

    // Trading happened on the 6th only — the 4th and 5th have no rows at all.
    await testDb.takings.create({
      data: { locationId: canteenId, cashMinor: 2000, mpesaMinor: 1000, occurredAt: new Date("2026-08-06T18:00:00Z") },
    });

    const result = await getRevenueProfitTrend(testDb, owner(), { windowEnd, days: 3 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const gapDay = result.points.find((p) => p.date === "2026-08-04");
    expect(gapDay?.revenue).toBeNull();
    expect(gapDay?.netProfit).toBeNull();

    const tradingDay = result.points.find((p) => p.date === "2026-08-06");
    expect(tradingDay?.revenue).not.toBeNull();
  });

  test("a day with a recorded Takings row that nets to zero is real data, not a gap", async () => {
    const windowEnd = new Date("2026-08-06T12:00:00Z");

    // A canteen count establishes a real own-goods rate, so net profit is
    // a number and this test can assert "not a gap" without colliding
    // with Finding 3's separate "no rate yet" unavailable (null) case.
    const soda = await testDb.product.create({
      data: { name: "Soda", kind: "goods", priceMinor: 100, lastKnownCostMinor: 72 },
    });
    const previousCount = await recordStockCount(testDb, owner(), {
      locationId: canteenId,
      lines: [{ itemType: "product", itemId: soda.id, countedQuantity: 0 }],
    });
    expect(previousCount.ok).toBe(true);
    await testDb.stockMovement.create({
      data: {
        productId: soda.id,
        locationId: canteenId,
        quantity: 100,
        reason: "received",
        staffMemberId: ownerId,
      },
    });
    const latestCount = await recordStockCount(testDb, owner(), {
      locationId: canteenId,
      lines: [{ itemType: "product", itemId: soda.id, countedQuantity: 0 }],
    });
    expect(latestCount.ok).toBe(true);

    await testDb.takings.create({
      data: { locationId: canteenId, cashMinor: 0, mpesaMinor: 0, occurredAt: new Date("2026-08-05T18:00:00Z") },
    });

    const result = await getRevenueProfitTrend(testDb, owner(), { windowEnd, days: 3 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const zeroTradingDay = result.points.find((p) => p.date === "2026-08-05");
    expect(zeroTradingDay?.revenue).toBe(0);
    expect(zeroTradingDay?.netProfit).not.toBeNull();
  });

  test("a day with only a restaurant Sale row (no canteen takings) is not a gap", async () => {
    const windowEnd = new Date("2026-08-06T12:00:00Z");

    const chips = await testDb.product.create({
      data: { name: "Chips", kind: "cooked_food", priceMinor: 100 },
    });
    await testDb.sale.create({
      data: {
        locationId: restaurantId,
        staffMemberId: ownerId,
        fulfilment: "counter",
        totalMinor: 500,
        occurredAt: new Date("2026-08-04T09:00:00Z"),
        lines: { create: [{ productId: chips.id, quantity: 5, priceMinor: 100 }] },
      },
    });

    const result = await getRevenueProfitTrend(testDb, owner(), { windowEnd, days: 3 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const tradingDay = result.points.find((p) => p.date === "2026-08-04");
    expect(tradingDay?.revenue).not.toBeNull();
  });

  test("a day's revenue/net profit reconciles with getDashboardProfit for the same day", async () => {
    const windowEnd = new Date("2026-08-06T12:00:00Z");

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

    const result = await getRevenueProfitTrend(testDb, owner(), { windowEnd, days: 1 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const { getDashboardProfit } = await import("../logic");
    const dayStart = new Date("2026-08-06T04:00:00Z");
    const dayEnd = new Date("2026-08-06T20:59:59Z");
    const dashboard = await getDashboardProfit(testDb, owner(), { dayStart, dayEnd });
    expect(dashboard.ok).toBe(true);
    if (!dashboard.ok) return;

    const point = result.points[0];
    expect(point.revenue).toBe(dashboard.revenue.total);
    expect(point.netProfit).toBe(dashboard.netProfitMinor);
  });

  test("non-owner is denied", async () => {
    const windowEnd = new Date("2026-08-06T12:00:00Z");
    const result = await getRevenueProfitTrend(testDb, attendant(canteenId), { windowEnd, days: 3 });
    expect(result).toEqual({ ok: false, reason: "forbidden" });
  });
});
