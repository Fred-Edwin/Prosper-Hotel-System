import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { hashPin } from "@/modules/people";
import type { AuthenticatedStaff } from "@/modules/people";
import { getExceptions } from "../logic";
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
  await testDb.handover.deleteMany({});
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

describe("getExceptions", () => {
  test("lists today's handover shortfall with staff, location and amount detail", async () => {
    const today = new Date("2026-08-12T10:00:00Z");

    await testDb.handover.create({
      data: {
        locationId: restaurantId,
        staffMemberId: ownerId,
        expectedCashMinor: 5000,
        expectedMpesaMinor: 2000,
        actualCashMinor: 4500,
        actualMpesaMinor: 2000,
        occurredAt: today,
      },
    });

    const result = await getExceptions(testDb, owner(), { today });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.shortfalls).toHaveLength(1);
    expect(result.shortfalls[0]).toMatchObject({
      staffName: "Test Owner",
      locationCode: "restaurant",
      cashDiffMinor: -500,
      mpesaDiffMinor: 0,
    });
    expect(result.voidedSales).toHaveLength(0);
  });

  test("lists today's voided sale with who, reason and amount detail", async () => {
    const today = new Date("2026-08-12T10:00:00Z");

    const chips = await testDb.product.create({
      data: { name: "Chips", kind: "cooked_food", priceMinor: 100, locationId: restaurantId },
    });
    const sale = await testDb.sale.create({
      data: {
        locationId: restaurantId,
        staffMemberId: ownerId,
        fulfilment: "counter",
        totalMinor: 500,
        occurredAt: today,
        lines: { create: [{ productId: chips.id, quantity: 5, priceMinor: 100 }] },
      },
    });
    await testDb.sale.update({
      where: { id: sale.id },
      data: { voided: true, voidedAt: today, voidedBy: ownerId },
    });

    const result = await getExceptions(testDb, owner(), { today });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.voidedSales).toHaveLength(1);
    expect(result.voidedSales[0]).toMatchObject({
      saleId: sale.id,
      voidedByName: "Test Owner",
      totalMinor: 500,
      locationCode: "restaurant",
    });
    expect(result.shortfalls).toHaveLength(0);
  });

  test("returns empty lists when everything agreed and nothing was voided today", async () => {
    const today = new Date("2026-08-12T10:00:00Z");

    await testDb.handover.create({
      data: {
        locationId: restaurantId,
        staffMemberId: ownerId,
        expectedCashMinor: 5000,
        expectedMpesaMinor: 2000,
        actualCashMinor: 5000,
        actualMpesaMinor: 2000,
        occurredAt: today,
      },
    });

    const result = await getExceptions(testDb, owner(), { today });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.shortfalls).toHaveLength(0);
    expect(result.voidedSales).toHaveLength(0);
  });

  test("shortfalls at both locations on the same day are both included", async () => {
    const today = new Date("2026-08-12T10:00:00Z");

    await testDb.handover.create({
      data: {
        locationId: restaurantId,
        staffMemberId: ownerId,
        expectedCashMinor: 5000,
        expectedMpesaMinor: 2000,
        actualCashMinor: 4500,
        actualMpesaMinor: 2000,
        occurredAt: today,
      },
    });
    await testDb.handover.create({
      data: {
        locationId: canteenId,
        staffMemberId: "attendant-1",
        expectedCashMinor: 3000,
        expectedMpesaMinor: 1000,
        actualCashMinor: 3000,
        actualMpesaMinor: 800,
        occurredAt: today,
      },
    });

    const result = await getExceptions(testDb, owner(), { today });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.shortfalls).toHaveLength(2);
    const locations = result.shortfalls.map((s) => s.locationCode).sort();
    expect(locations).toEqual(["canteen", "restaurant"]);
  });

  test("a handover from yesterday is not included today", async () => {
    const today = new Date("2026-08-12T10:00:00Z");
    const yesterday = new Date("2026-08-11T10:00:00Z");

    await testDb.handover.create({
      data: {
        locationId: restaurantId,
        staffMemberId: ownerId,
        expectedCashMinor: 5000,
        expectedMpesaMinor: 2000,
        actualCashMinor: 4500,
        actualMpesaMinor: 2000,
        occurredAt: yesterday,
      },
    });

    const result = await getExceptions(testDb, owner(), { today });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.shortfalls).toHaveLength(0);
  });

  test("non-owner is denied", async () => {
    const today = new Date("2026-08-12T10:00:00Z");
    const result = await getExceptions(testDb, attendant(canteenId), { today });
    expect(result).toEqual({ ok: false, reason: "forbidden" });
  });
});
