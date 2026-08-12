import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { hashPin } from "@/modules/people";
import type { AuthenticatedStaff } from "@/modules/people";
import { createProduct, recordProductCost } from "@/modules/catalogue";
import { getNonSalesConsumptionValue, recordNonSalesConsumption } from "../logic";
import { testDb } from "@/shared/test-db";

let restaurantId: string;
let canteenId: string;
let ownerId: string;

function owner(locationId: string): AuthenticatedStaff {
  return {
    staff: {
      id: ownerId,
      name: "Test Owner",
      phone: "+254700111700",
      role: "owner",
      locationId,
      active: true,
      dailyRateMinor: 0,
    },
    location: { id: locationId, code: "restaurant", name: "Test" },
  };
}

function attendant(locationId: string): AuthenticatedStaff {
  return {
    staff: {
      id: "attendant-1",
      name: "Test Attendant",
      phone: "+254700111701",
      role: "attendant",
      locationId,
      active: true,
      dailyRateMinor: 0,
    },
    location: { id: locationId, code: "canteen", name: "Test" },
  };
}

beforeEach(async () => {
  await testDb.stockMovement.deleteMany({});
  await testDb.product.deleteMany({});
  await testDb.staffMember.deleteMany({});
  await testDb.location.deleteMany({});

  const restaurant = await testDb.location.create({
    data: { code: "restaurant", name: "Test Restaurant" },
  });
  restaurantId = restaurant.id;
  const canteen = await testDb.location.create({
    data: { code: "canteen", name: "Test Canteen" },
  });
  canteenId = canteen.id;

  const ownerStaff = await testDb.staffMember.create({
    data: {
      name: "Test Owner",
      phone: "+254700111702",
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
      phone: "+254700111703",
      pinHash: await hashPin("1234"),
      role: "attendant",
      locationId: canteen.id,
      dailyRateMinor: 0,
    },
  });
});

afterAll(async () => {
  await testDb.stockMovement.deleteMany({});
  await testDb.product.deleteMany({});
  await testDb.staffMember.deleteMany({});
  await testDb.location.deleteMany({});
  await testDb.$disconnect();
});

describe("getNonSalesConsumptionValue — proposal.md §10.5", () => {
  test("sums wasted, consumed and given-away movements at cost and at selling price", async () => {
    const ownerStaff = owner(restaurantId);
    const soda = await createProduct(testDb, ownerStaff, {
      name: "Soda",
      kind: "goods",
      priceMinor: 100,
    });
    if (!soda.ok) throw new Error("expected product create to succeed");
    await recordProductCost(testDb, ownerStaff, soda.value.id, {
      quantityOnHand: 0,
      quantityBought: 30,
      unitCostMinor: 60,
    });
    await testDb.stockMovement.create({
      data: {
        productId: soda.value.id,
        locationId: restaurantId,
        quantity: 30,
        reason: "received",
        staffMemberId: ownerId,
      },
    });

    const periodStart = new Date("2026-08-01T00:00:00Z");
    const periodEnd = new Date("2026-08-08T00:00:00Z");
    const occurredAt = new Date("2026-08-03T12:00:00Z");

    // 3 wasted at KSh 60 cost / KSh 100 price each.
    const wasted = await recordNonSalesConsumption(testDb, ownerStaff, {
      itemType: "product",
      itemId: soda.value.id,
      locationId: restaurantId,
      quantity: 3,
      category: "wasted",
    });
    if (!wasted.ok) throw new Error("expected wastage to record");
    await testDb.stockMovement.update({
      where: { id: (wasted.movement as { id: string }).id },
      data: { occurredAt },
    });

    // 2 given away at the same basis.
    const givenAway = await recordNonSalesConsumption(testDb, ownerStaff, {
      itemType: "product",
      itemId: soda.value.id,
      locationId: restaurantId,
      quantity: 2,
      category: "given_away",
    });
    if (!givenAway.ok) throw new Error("expected give-away to record");
    await testDb.stockMovement.update({
      where: { id: (givenAway.movement as { id: string }).id },
      data: { occurredAt },
    });

    const result = await getNonSalesConsumptionValue(
      testDb,
      ownerStaff,
      restaurantId,
      periodStart,
      periodEnd,
    );

    expect(result).toEqual({
      ok: true,
      atCostMinor: 5 * 60,
      atPriceMinor: 5 * 100,
    });
  });

  test("does not double count a repeated reason across multiple movements", async () => {
    const ownerStaff = owner(restaurantId);
    const soda = await createProduct(testDb, ownerStaff, {
      name: "Soda",
      kind: "goods",
      priceMinor: 100,
    });
    if (!soda.ok) throw new Error("expected product create to succeed");
    await recordProductCost(testDb, ownerStaff, soda.value.id, {
      quantityOnHand: 0,
      quantityBought: 10,
      unitCostMinor: 60,
    });
    await testDb.stockMovement.create({
      data: {
        productId: soda.value.id,
        locationId: restaurantId,
        quantity: 10,
        reason: "received",
        staffMemberId: ownerId,
      },
    });

    const periodStart = new Date("2026-08-01T00:00:00Z");
    const periodEnd = new Date("2026-08-08T00:00:00Z");
    const occurredAt = new Date("2026-08-03T12:00:00Z");

    for (const qty of [1, 1]) {
      const wasted = await recordNonSalesConsumption(testDb, ownerStaff, {
        itemType: "product",
        itemId: soda.value.id,
        locationId: restaurantId,
        quantity: qty,
        category: "wasted",
      });
      if (!wasted.ok) throw new Error("expected wastage to record");
      await testDb.stockMovement.update({
        where: { id: (wasted.movement as { id: string }).id },
        data: { occurredAt },
      });
    }

    const result = await getNonSalesConsumptionValue(
      testDb,
      ownerStaff,
      restaurantId,
      periodStart,
      periodEnd,
    );

    expect(result).toEqual({ ok: true, atCostMinor: 2 * 60, atPriceMinor: 2 * 100 });
  });

  test("excludes movements outside the period", async () => {
    const ownerStaff = owner(restaurantId);
    const soda = await createProduct(testDb, ownerStaff, {
      name: "Soda",
      kind: "goods",
      priceMinor: 100,
    });
    if (!soda.ok) throw new Error("expected product create to succeed");
    await recordProductCost(testDb, ownerStaff, soda.value.id, {
      quantityOnHand: 0,
      quantityBought: 10,
      unitCostMinor: 60,
    });
    await testDb.stockMovement.create({
      data: {
        productId: soda.value.id,
        locationId: restaurantId,
        quantity: 10,
        reason: "received",
        staffMemberId: ownerId,
      },
    });

    const outsideWasted = await recordNonSalesConsumption(testDb, ownerStaff, {
      itemType: "product",
      itemId: soda.value.id,
      locationId: restaurantId,
      quantity: 1,
      category: "wasted",
    });
    if (!outsideWasted.ok) throw new Error("expected wastage to record");
    await testDb.stockMovement.update({
      where: { id: (outsideWasted.movement as { id: string }).id },
      data: { occurredAt: new Date("2026-07-01T00:00:00Z") },
    });

    const result = await getNonSalesConsumptionValue(
      testDb,
      ownerStaff,
      restaurantId,
      new Date("2026-08-01T00:00:00Z"),
      new Date("2026-08-08T00:00:00Z"),
    );

    expect(result).toEqual({ ok: true, atCostMinor: 0, atPriceMinor: 0 });
  });

  test("a location with no non-sales movements in the period has zero value, not an error", async () => {
    const result = await getNonSalesConsumptionValue(
      testDb,
      owner(restaurantId),
      canteenId,
      new Date("2026-08-01T00:00:00Z"),
      new Date("2026-08-08T00:00:00Z"),
    );

    expect(result).toEqual({ ok: true, atCostMinor: 0, atPriceMinor: 0 });
  });

  test("denies a staff member access to the other location's non-sales value", async () => {
    const result = await getNonSalesConsumptionValue(
      testDb,
      attendant(canteenId),
      restaurantId,
      new Date("2026-08-01T00:00:00Z"),
      new Date("2026-08-08T00:00:00Z"),
    );

    expect(result).toEqual({ ok: false, reason: "forbidden" });
  });
});
