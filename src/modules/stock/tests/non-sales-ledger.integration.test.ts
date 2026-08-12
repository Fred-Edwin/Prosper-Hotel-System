import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { hashPin } from "@/modules/people";
import type { AuthenticatedStaff } from "@/modules/people";
import { createProduct, createIngredient, recordProductCost, recordIngredientCost } from "@/modules/catalogue";
import { getNonSalesConsumptionValue, getNonSalesLedger, recordNonSalesConsumption } from "../logic";
import { testDb } from "@/shared/test-db";

let restaurantId: string;
let canteenId: string;
let ownerId: string;

function owner(locationId: string): AuthenticatedStaff {
  return {
    staff: {
      id: ownerId,
      name: "Test Owner",
      phone: "+254700111800",
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
      phone: "+254700111801",
      role: "attendant",
      locationId,
      active: true,
      dailyRateMinor: 0,
    },
    location: { id: locationId, code: "canteen", name: "Test" },
  };
}

async function resetDb() {
  await testDb.stockMovement.deleteMany({});
  await testDb.ingredientMovement.deleteMany({});
  await testDb.product.deleteMany({});
  await testDb.ingredient.deleteMany({});
  await testDb.staffMember.deleteMany({});
  await testDb.location.deleteMany({});
}

beforeEach(async () => {
  await resetDb();

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
      phone: "+254700111802",
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
      phone: "+254700111803",
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

describe("getNonSalesLedger — proposal.md §10.5, line-level", () => {
  test("denies access to a location the requester cannot reach", async () => {
    const result = await getNonSalesLedger(
      testDb,
      attendant(canteenId),
      restaurantId,
      new Date("2026-08-01T00:00:00Z"),
      new Date("2026-08-08T00:00:00Z"),
    );
    expect(result).toEqual({ ok: false, reason: "forbidden" });
  });

  test("one row per entry across products, ingredients, and all three reasons, valued at snapshotted cost, reconciling with getNonSalesConsumptionValue's total", async () => {
    const ownerStaff = owner(restaurantId);

    // Product with a known cost — costed (non-estimated) basis.
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

    // Product with no recipe/recorded cost — estimated basis (60% of price).
    const crisps = await createProduct(testDb, ownerStaff, {
      name: "Crisps",
      kind: "goods",
      priceMinor: 150,
    });
    if (!crisps.ok) throw new Error("expected product create to succeed");

    // Ingredient — cost-only, no selling price.
    const potatoes = await createIngredient(testDb, ownerStaff, {
      name: "Potatoes",
      unitOfMeasure: "kg",
    });
    if (!potatoes.ok) throw new Error("expected ingredient create to succeed");
    await recordIngredientCost(testDb, ownerStaff, potatoes.value.id, {
      quantityOnHand: 0,
      quantityBought: 50,
      unitCostMinor: 40,
    });
    await testDb.ingredientMovement.create({
      data: {
        ingredientId: potatoes.value.id,
        locationId: restaurantId,
        quantity: 50,
        reason: "received",
        unitCostMinor: 40,
        staffMemberId: ownerId,
      },
    });

    const periodStart = new Date("2026-08-01T00:00:00Z");
    const periodEnd = new Date("2026-08-08T00:00:00Z");
    const occurredAt = new Date("2026-08-03T12:00:00Z");

    // Soda wasted (costed).
    const wastedSoda = await recordNonSalesConsumption(testDb, ownerStaff, {
      itemType: "product",
      itemId: soda.value.id,
      locationId: restaurantId,
      quantity: 3,
      category: "wasted",
    });
    if (!wastedSoda.ok) throw new Error("expected wastage to record");
    await testDb.stockMovement.update({
      where: { id: (wastedSoda.movement as { id: string }).id },
      data: { occurredAt },
    });

    // Crisps given away (estimated).
    const givenAwayCrisps = await recordNonSalesConsumption(testDb, ownerStaff, {
      itemType: "product",
      itemId: crisps.value.id,
      locationId: restaurantId,
      quantity: 1,
      category: "given_away",
    });
    if (!givenAwayCrisps.ok) throw new Error("expected give-away to record");
    await testDb.stockMovement.update({
      where: { id: (givenAwayCrisps.movement as { id: string }).id },
      data: { occurredAt },
    });

    // Potatoes consumed as staff meal (ingredient-side).
    const consumedPotatoes = await recordNonSalesConsumption(testDb, ownerStaff, {
      itemType: "ingredient",
      itemId: potatoes.value.id,
      locationId: restaurantId,
      quantity: 5,
      category: "consumed",
    });
    if (!consumedPotatoes.ok) throw new Error("expected consumption to record");
    await testDb.ingredientMovement.update({
      where: { id: (consumedPotatoes.movement as { id: string }).id },
      data: { occurredAt },
    });

    const result = await getNonSalesLedger(testDb, ownerStaff, restaurantId, periodStart, periodEnd);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.lines).toHaveLength(3);

    const sodaLine = result.lines.find((l) => l.itemId === soda.value.id);
    expect(sodaLine).toMatchObject({
      itemType: "product",
      itemName: "Soda",
      reason: "wasted",
      quantity: -3,
      costBasisMinor: 3 * 60,
      sellingValueMinor: 3 * 100,
      isEstimated: false,
      staffMemberName: "Test Owner",
    });

    const crispsLine = result.lines.find((l) => l.itemId === crisps.value.id);
    expect(crispsLine).toMatchObject({
      itemType: "product",
      itemName: "Crisps",
      reason: "given_away",
      isEstimated: true,
    });
    expect(crispsLine!.costBasisMinor).toBe(Math.round(150 * 0.6));

    const potatoesLine = result.lines.find((l) => l.itemId === potatoes.value.id);
    expect(potatoesLine).toMatchObject({
      itemType: "ingredient",
      itemName: "Potatoes",
      reason: "consumed",
      quantity: -5,
      costBasisMinor: 5 * 40,
      sellingValueMinor: null,
      isEstimated: false,
    });

    // The line-level total must reconcile exactly with the existing aggregate.
    const aggregate = await getNonSalesConsumptionValue(testDb, ownerStaff, restaurantId, periodStart, periodEnd);
    expect(aggregate.ok).toBe(true);
    if (!aggregate.ok) return;
    const lineTotalAtCost = result.lines.reduce((sum, l) => sum + (l.costBasisMinor ?? 0), 0);
    const lineTotalAtPrice = result.lines.reduce((sum, l) => sum + (l.sellingValueMinor ?? 0), 0);
    expect(lineTotalAtCost).toBe(aggregate.atCostMinor);
    expect(lineTotalAtPrice).toBe(aggregate.atPriceMinor);
  });

  test("does not fold a repeated reason for the same item into one row — two separate wastage entries stay two rows", async () => {
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

    const result = await getNonSalesLedger(testDb, ownerStaff, restaurantId, periodStart, periodEnd);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.lines).toHaveLength(2);
    expect(result.lines.every((l) => l.itemId === soda.value.id && l.reason === "wasted")).toBe(true);
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

    const result = await getNonSalesLedger(
      testDb,
      ownerStaff,
      restaurantId,
      new Date("2026-08-01T00:00:00Z"),
      new Date("2026-08-08T00:00:00Z"),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.lines).toHaveLength(0);
  });
});
