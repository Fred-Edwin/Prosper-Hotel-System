import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { hashPin } from "@/modules/people";
import type { AuthenticatedStaff } from "@/modules/people";
import { getProductLedger } from "../logic";
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
  await testDb.category.deleteMany({});
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

describe("getProductLedger", () => {
  test("forbidden for non-owner roles", async () => {
    const result = await getProductLedger(testDb, attendant(canteenId), {
      periodStart: new Date("2026-08-06T00:00:00Z"),
      periodEnd: new Date("2026-08-06T23:59:59Z"),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("forbidden");
  });

  test("reconciles opening + in − out = closing across produced, received, transferred, sold, wasted", async () => {
    const chips = await testDb.product.create({
      data: { name: "Chips", kind: "cooked_food", priceMinor: 100, lastKnownCostMinor: null, locationId: restaurantId },
    });

    // Opening balance at the restaurant, before the period, from an
    // earlier production run — establishes a non-zero opening quantity.
    await testDb.stockMovement.create({
      data: {
        productId: chips.id,
        locationId: restaurantId,
        quantity: 10,
        reason: "produced",
        costBasisMinor: 400,
        staffMemberId: ownerId,
        occurredAt: new Date("2026-08-05T12:00:00Z"),
      },
    });

    const periodStart = new Date("2026-08-06T00:00:00Z");
    const periodEnd = new Date("2026-08-06T23:59:59Z");

    // In: produced 20, received 5 (bought-in top-up, unrealistic for
    // cooked food but exercises the reason regardless).
    await testDb.stockMovement.create({
      data: {
        productId: chips.id,
        locationId: restaurantId,
        quantity: 20,
        reason: "produced",
        staffMemberId: ownerId,
        occurredAt: new Date("2026-08-06T08:00:00Z"),
      },
    });
    await testDb.stockMovement.create({
      data: {
        productId: chips.id,
        locationId: restaurantId,
        quantity: 5,
        reason: "received",
        staffMemberId: ownerId,
        occurredAt: new Date("2026-08-06T09:00:00Z"),
      },
    });

    // Out: transferred 5 to the canteen, sold 15, wasted 3.
    await testDb.stockMovement.create({
      data: {
        productId: chips.id,
        locationId: restaurantId,
        quantity: -5,
        reason: "transferred",
        staffMemberId: ownerId,
        occurredAt: new Date("2026-08-06T10:00:00Z"),
      },
    });
    await testDb.stockMovement.create({
      data: {
        productId: chips.id,
        locationId: restaurantId,
        quantity: -15,
        reason: "sold",
        staffMemberId: ownerId,
        occurredAt: new Date("2026-08-06T11:00:00Z"),
      },
    });
    await testDb.stockMovement.create({
      data: {
        productId: chips.id,
        locationId: restaurantId,
        quantity: -3,
        reason: "wasted",
        costBasisMinor: 120,
        sellingValueMinor: 300,
        staffMemberId: ownerId,
        occurredAt: new Date("2026-08-06T12:00:00Z"),
      },
    });

    const result = await getProductLedger(testDb, owner(), { periodStart, periodEnd });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const row = result.rows.find((r) => r.productId === chips.id && r.locationId === restaurantId);
    expect(row).toBeDefined();
    expect(row!.openingQty).toBe(10);
    expect(row!.produced).toBe(20);
    expect(row!.received).toBe(5);
    expect(row!.transferredIn).toBe(0);
    expect(row!.sold).toBe(15);
    expect(row!.transferredOut).toBe(5);
    expect(row!.nonSales).toBe(3);
    expect(row!.closingQty).toBe(10 + 20 + 5 - 5 - 15 - 3);
    expect(row!.openingQty + row!.produced + row!.received + row!.transferredIn
      - row!.sold - row!.transferredOut - row!.nonSales).toBe(row!.closingQty);
  });

  test("product with no recipe, no recorded cost, and no price shows profit as unavailable, not zero", async () => {
    const mystery = await testDb.product.create({
      data: { name: "Mystery item", kind: "goods", priceMinor: null, lastKnownCostMinor: null, locationId: restaurantId },
    });

    const periodStart = new Date("2026-08-06T00:00:00Z");
    const periodEnd = new Date("2026-08-06T23:59:59Z");

    await testDb.stockMovement.create({
      data: {
        productId: mystery.id,
        locationId: restaurantId,
        quantity: -4,
        reason: "sold",
        staffMemberId: ownerId,
        occurredAt: new Date("2026-08-06T11:00:00Z"),
      },
    });

    const result = await getProductLedger(testDb, owner(), { periodStart, periodEnd });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const row = result.rows.find((r) => r.productId === mystery.id);
    expect(row).toBeDefined();
    expect(row!.unitCostMinor).toBeNull();
    expect(row!.costOfSalesMinor).toBeNull();
    expect(row!.profitMinor).toBeNull();
  });

  test("a product priced via recipe cost shows profit, not null", async () => {
    const samosa = await testDb.product.create({
      data: { name: "Samosa", kind: "cooked_food", priceMinor: 30, locationId: restaurantId },
    });
    const dough = await testDb.ingredient.create({
      data: { name: "Dough", unitOfMeasure: "kg", lastKnownCostMinor: 400 },
    });
    await testDb.recipe.create({
      data: {
        productId: samosa.id,
        yieldQuantity: 40,
        effectiveFrom: new Date("2026-01-01T00:00:00Z"),
        lines: { create: [{ ingredientId: dough.id, quantity: 10 }] },
      },
    });

    const periodStart = new Date("2026-08-06T00:00:00Z");
    const periodEnd = new Date("2026-08-06T23:59:59Z");

    await testDb.stockMovement.create({
      data: {
        productId: samosa.id,
        locationId: restaurantId,
        quantity: -10,
        reason: "sold",
        staffMemberId: ownerId,
        occurredAt: new Date("2026-08-06T11:00:00Z"),
      },
    });

    const result = await getProductLedger(testDb, owner(), { periodStart, periodEnd });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const row = result.rows.find((r) => r.productId === samosa.id);
    expect(row).toBeDefined();
    expect(row!.unitCostMinor).not.toBeNull();
    expect(row!.profitMinor).not.toBeNull();
  });

  test("filtering by location shows only that location's rows; same product at both locations appears twice", async () => {
    const soda = await testDb.product.create({
      data: { name: "Soda", kind: "goods", priceMinor: 80, lastKnownCostMinor: 58, locationId: restaurantId },
    });

    const periodStart = new Date("2026-08-06T00:00:00Z");
    const periodEnd = new Date("2026-08-06T23:59:59Z");

    await testDb.stockMovement.create({
      data: {
        productId: soda.id,
        locationId: restaurantId,
        quantity: -2,
        reason: "sold",
        staffMemberId: ownerId,
        occurredAt: new Date("2026-08-06T11:00:00Z"),
      },
    });
    await testDb.stockMovement.create({
      data: {
        productId: soda.id,
        locationId: canteenId,
        quantity: -6,
        reason: "sold",
        staffMemberId: ownerId,
        occurredAt: new Date("2026-08-06T11:00:00Z"),
      },
    });

    const both = await getProductLedger(testDb, owner(), { periodStart, periodEnd });
    expect(both.ok).toBe(true);
    if (!both.ok) return;
    const sodaRows = both.rows.filter((r) => r.productId === soda.id);
    expect(sodaRows).toHaveLength(2);
    expect(new Set(sodaRows.map((r) => r.locationId))).toEqual(new Set([restaurantId, canteenId]));

    const restaurantOnly = await getProductLedger(testDb, owner(), {
      periodStart,
      periodEnd,
      locationId: restaurantId,
    });
    expect(restaurantOnly.ok).toBe(true);
    if (!restaurantOnly.ok) return;
    expect(restaurantOnly.rows.every((r) => r.locationId === restaurantId)).toBe(true);
    expect(restaurantOnly.rows.find((r) => r.productId === soda.id)?.sold).toBe(2);
  });

  test("filtering by category and searching by name narrow correctly and combine as AND", async () => {
    const drinksCategory = await testDb.category.create({ data: { name: "Drinks" } });
    const snacksCategory = await testDb.category.create({ data: { name: "Snacks" } });

    const soda = await testDb.product.create({
      data: { name: "Soda", kind: "goods", priceMinor: 80, lastKnownCostMinor: 58, categoryId: drinksCategory.id, locationId: canteenId },
    });
    const water = await testDb.product.create({
      data: { name: "Water", kind: "goods", priceMinor: 60, lastKnownCostMinor: 42, categoryId: drinksCategory.id, locationId: canteenId },
    });
    const crisps = await testDb.product.create({
      data: { name: "Crisps", kind: "goods", priceMinor: 60, lastKnownCostMinor: 44, categoryId: snacksCategory.id, locationId: canteenId },
    });

    const periodStart = new Date("2026-08-06T00:00:00Z");
    const periodEnd = new Date("2026-08-06T23:59:59Z");

    for (const product of [soda, water, crisps]) {
      await testDb.stockMovement.create({
        data: {
          productId: product.id,
          locationId: canteenId,
          quantity: -1,
          reason: "sold",
          staffMemberId: ownerId,
          occurredAt: new Date("2026-08-06T11:00:00Z"),
        },
      });
    }

    const byCategory = await getProductLedger(testDb, owner(), {
      periodStart,
      periodEnd,
      categoryId: drinksCategory.id,
    });
    expect(byCategory.ok).toBe(true);
    if (!byCategory.ok) return;
    expect(new Set(byCategory.rows.map((r) => r.productId))).toEqual(new Set([soda.id, water.id]));

    const bySearch = await getProductLedger(testDb, owner(), {
      periodStart,
      periodEnd,
      search: "sod",
    });
    expect(bySearch.ok).toBe(true);
    if (!bySearch.ok) return;
    expect(bySearch.rows.map((r) => r.productId)).toEqual([soda.id]);

    const combined = await getProductLedger(testDb, owner(), {
      periodStart,
      periodEnd,
      categoryId: drinksCategory.id,
      search: "water",
    });
    expect(combined.ok).toBe(true);
    if (!combined.ok) return;
    expect(combined.rows.map((r) => r.productId)).toEqual([water.id]);

    const categoryExcludesSearchMiss = await getProductLedger(testDb, owner(), {
      periodStart,
      periodEnd,
      categoryId: snacksCategory.id,
      search: "water",
    });
    expect(categoryExcludesSearchMiss.ok).toBe(true);
    if (!categoryExcludesSearchMiss.ok) return;
    expect(categoryExcludesSearchMiss.rows).toHaveLength(0);
  });

  test("day-expansion breakdown covers each day in the period with matching totals", async () => {
    const mandazi = await testDb.product.create({
      data: { name: "Mandazi", kind: "cooked_food", priceMinor: 20, lastKnownCostMinor: 8, locationId: restaurantId },
    });

    const periodStart = new Date("2026-08-06T00:00:00Z");
    const periodEnd = new Date("2026-08-07T23:59:59Z");

    await testDb.stockMovement.create({
      data: {
        productId: mandazi.id,
        locationId: restaurantId,
        quantity: 20,
        reason: "produced",
        staffMemberId: ownerId,
        occurredAt: new Date("2026-08-06T07:00:00Z"),
      },
    });
    await testDb.stockMovement.create({
      data: {
        productId: mandazi.id,
        locationId: restaurantId,
        quantity: -12,
        reason: "sold",
        staffMemberId: ownerId,
        occurredAt: new Date("2026-08-06T09:00:00Z"),
      },
    });
    await testDb.stockMovement.create({
      data: {
        productId: mandazi.id,
        locationId: restaurantId,
        quantity: 10,
        reason: "produced",
        staffMemberId: ownerId,
        occurredAt: new Date("2026-08-07T07:00:00Z"),
      },
    });
    await testDb.stockMovement.create({
      data: {
        productId: mandazi.id,
        locationId: restaurantId,
        quantity: -6,
        reason: "sold",
        staffMemberId: ownerId,
        occurredAt: new Date("2026-08-07T09:00:00Z"),
      },
    });

    const result = await getProductLedger(testDb, owner(), { periodStart, periodEnd });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const row = result.rows.find((r) => r.productId === mandazi.id);
    expect(row).toBeDefined();
    expect(row!.days).toHaveLength(2);

    const [day1, day2] = row!.days;
    expect(day1.date).toBe("2026-08-06");
    expect(day1.opening).toBe(0);
    expect(day1.produced).toBe(20);
    expect(day1.sold).toBe(12);
    expect(day1.closing).toBe(8);

    expect(day2.date).toBe("2026-08-07");
    expect(day2.opening).toBe(day1.closing);
    expect(day2.produced).toBe(10);
    expect(day2.sold).toBe(6);
    expect(day2.closing).toBe(day2.opening + day2.produced - day2.sold);

    expect(row!.openingQty).toBe(day1.opening);
    expect(row!.closingQty).toBe(day2.closing);
  });

  test("empty period (no movements) returns no rows", async () => {
    await testDb.product.create({
      data: { name: "Untouched", kind: "goods", priceMinor: 50, locationId: restaurantId },
    });

    const result = await getProductLedger(testDb, owner(), {
      periodStart: new Date("2026-08-06T00:00:00Z"),
      periodEnd: new Date("2026-08-06T23:59:59Z"),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows).toHaveLength(0);
  });
});
