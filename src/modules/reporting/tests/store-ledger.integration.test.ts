import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { hashPin } from "@/modules/people";
import type { AuthenticatedStaff } from "@/modules/people";
import { getStoreLedger } from "../logic";
import { testDb } from "@/shared/test-db";

let restaurantId: string;
let canteenId: string;
let ownerId: string;

function owner(): AuthenticatedStaff {
  return {
    staff: {
      id: ownerId,
      name: "Test Owner",
      phone: "+254700119003",
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

describe("getStoreLedger", () => {
  test("forbidden for non-owner roles", async () => {
    const result = await getStoreLedger(testDb, attendant(canteenId), {
      periodStart: new Date("2026-08-06T00:00:00Z"),
      periodEnd: new Date("2026-08-06T23:59:59Z"),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("forbidden");
  });

  test("reconciles opening + purchased − out = closing across purchases, kitchen issues, transfers, wastage", async () => {
    const potatoes = await testDb.ingredient.create({
      data: { name: "Potatoes", unitOfMeasure: "kg", lastKnownCostMinor: 65 },
    });

    // Opening balance at the restaurant, before the period, from an
    // earlier delivery — establishes a non-zero opening quantity.
    await testDb.ingredientMovement.create({
      data: {
        ingredientId: potatoes.id,
        locationId: restaurantId,
        quantity: 34,
        reason: "received",
        unitCostMinor: 61,
        staffMemberId: ownerId,
        occurredAt: new Date("2026-08-05T12:00:00Z"),
      },
    });

    const periodStart = new Date("2026-08-06T00:00:00Z");
    const periodEnd = new Date("2026-08-06T23:59:59Z");

    // Purchased: 120kg during the period.
    await testDb.ingredientMovement.create({
      data: {
        ingredientId: potatoes.id,
        locationId: restaurantId,
        quantity: 120,
        reason: "received",
        unitCostMinor: 65,
        staffMemberId: ownerId,
        occurredAt: new Date("2026-08-06T08:00:00Z"),
      },
    });

    // Out: issued to kitchen 104, transferred out 0 (none), spoilage 2.
    await testDb.ingredientMovement.create({
      data: {
        ingredientId: potatoes.id,
        locationId: restaurantId,
        quantity: -104,
        reason: "issued",
        staffMemberId: ownerId,
        occurredAt: new Date("2026-08-06T09:00:00Z"),
      },
    });
    await testDb.ingredientMovement.create({
      data: {
        ingredientId: potatoes.id,
        locationId: restaurantId,
        quantity: -2,
        reason: "wasted",
        costBasisMinor: 130,
        staffMemberId: ownerId,
        occurredAt: new Date("2026-08-06T10:00:00Z"),
      },
    });

    const result = await getStoreLedger(testDb, owner(), { periodStart, periodEnd });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const row = result.rows.find((r) => r.ingredientId === potatoes.id && r.locationId === restaurantId);
    expect(row).toBeDefined();
    expect(row).toMatchObject({
      openingQty: 34,
      purchasedQty: 120,
      purchasedValueMinor: 120 * 65,
      issuedToKitchen: 104,
      transferredOut: 0,
      spoilage: 2,
      closingQty: 34 + 120 - 104 - 2,
    });
    expect(row!.openingQty + row!.purchasedQty - (row!.issuedToKitchen + row!.transferredOut + row!.spoilage)).toBe(
      row!.closingQty,
    );
  });

  test("shows the running-average cost move when a purchase changes the weighted average within the period", async () => {
    const flour = await testDb.ingredient.create({
      data: { name: "Maize flour", unitOfMeasure: "kg", lastKnownCostMinor: 79 },
    });

    const periodStart = new Date("2026-08-06T00:00:00Z");
    const periodEnd = new Date("2026-08-06T23:59:59Z");

    // Opening stock at the old cost, before the period.
    await testDb.ingredientMovement.create({
      data: {
        ingredientId: flour.id,
        locationId: restaurantId,
        quantity: 28,
        reason: "received",
        unitCostMinor: 74,
        staffMemberId: ownerId,
        occurredAt: new Date("2026-08-05T12:00:00Z"),
      },
    });

    // A purchase within the period at a higher unit cost — moves the
    // ingredient's current running average (lastKnownCostMinor, stamped
    // at 78 in the fixture above) up from the previous 74.
    await testDb.ingredientMovement.create({
      data: {
        ingredientId: flour.id,
        locationId: restaurantId,
        quantity: 50,
        reason: "received",
        unitCostMinor: 82,
        staffMemberId: ownerId,
        occurredAt: new Date("2026-08-06T08:00:00Z"),
      },
    });

    const result = await getStoreLedger(testDb, owner(), { periodStart, periodEnd });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const row = result.rows.find((r) => r.ingredientId === flour.id && r.locationId === restaurantId);
    expect(row).toBeDefined();
    expect(row!.unitCostMinor).toBe(79);
    expect(row!.previousUnitCostMinor).toBe(74);
  });

  test("an ingredient with no purchases or movements this period, and no prior cost, shows no cost-move indicator", async () => {
    const rice = await testDb.ingredient.create({
      data: { name: "Rice", unitOfMeasure: "kg", lastKnownCostMinor: 165 },
    });
    await testDb.ingredientMovement.create({
      data: {
        ingredientId: rice.id,
        locationId: restaurantId,
        quantity: 22,
        reason: "received",
        unitCostMinor: 165,
        staffMemberId: ownerId,
        occurredAt: new Date("2026-08-05T12:00:00Z"),
      },
    });

    const result = await getStoreLedger(testDb, owner(), {
      periodStart: new Date("2026-08-06T00:00:00Z"),
      periodEnd: new Date("2026-08-06T23:59:59Z"),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const row = result.rows.find((r) => r.ingredientId === rice.id && r.locationId === restaurantId);
    expect(row).toBeDefined();
    expect(row!.unitCostMinor).toBe(165);
    expect(row!.previousUnitCostMinor).toBe(165);
  });

  test("filtering by location shows only that location's rows", async () => {
    const oil = await testDb.ingredient.create({
      data: { name: "Cooking oil", unitOfMeasure: "L", lastKnownCostMinor: 320 },
    });
    await testDb.ingredientMovement.create({
      data: {
        ingredientId: oil.id,
        locationId: restaurantId,
        quantity: 18,
        reason: "received",
        unitCostMinor: 320,
        staffMemberId: ownerId,
        occurredAt: new Date("2026-08-05T12:00:00Z"),
      },
    });
    await testDb.ingredientMovement.create({
      data: {
        ingredientId: oil.id,
        locationId: canteenId,
        quantity: 6,
        reason: "transferred",
        staffMemberId: ownerId,
        occurredAt: new Date("2026-08-05T13:00:00Z"),
      },
    });

    const result = await getStoreLedger(testDb, owner(), {
      periodStart: new Date("2026-08-06T00:00:00Z"),
      periodEnd: new Date("2026-08-06T23:59:59Z"),
      locationId: restaurantId,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows.every((r) => r.locationId === restaurantId)).toBe(true);
    expect(result.rows.some((r) => r.locationId === canteenId)).toBe(false);
  });

  test("searching by name narrows correctly", async () => {
    await testDb.ingredient.create({
      data: { name: "Beef", unitOfMeasure: "kg", lastKnownCostMinor: 580 },
    });
    const flour = await testDb.ingredient.create({
      data: { name: "Wheat flour", unitOfMeasure: "kg", lastKnownCostMinor: 92 },
    });
    await testDb.ingredientMovement.create({
      data: {
        ingredientId: flour.id,
        locationId: restaurantId,
        quantity: 20,
        reason: "received",
        unitCostMinor: 92,
        staffMemberId: ownerId,
        occurredAt: new Date("2026-08-05T12:00:00Z"),
      },
    });
    const beef = await testDb.ingredient.findFirstOrThrow({ where: { name: "Beef" } });
    await testDb.ingredientMovement.create({
      data: {
        ingredientId: beef.id,
        locationId: restaurantId,
        quantity: 6,
        reason: "received",
        unitCostMinor: 580,
        staffMemberId: ownerId,
        occurredAt: new Date("2026-08-05T12:00:00Z"),
      },
    });

    const result = await getStoreLedger(testDb, owner(), {
      periodStart: new Date("2026-08-06T00:00:00Z"),
      periodEnd: new Date("2026-08-06T23:59:59Z"),
      search: "flour",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows.length).toBeGreaterThan(0);
    expect(result.rows.every((r) => r.ingredientName.toLowerCase().includes("flour"))).toBe(true);
  });
});
