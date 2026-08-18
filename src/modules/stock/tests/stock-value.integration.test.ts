import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { hashPin } from "@/modules/people";
import type { AuthenticatedStaff } from "@/modules/people";
import { createIngredient, createProduct, createRecipe, recordProductCost } from "@/modules/catalogue";
import { getCurrentStockAtLocation, getProductStockValueAtLocation } from "../logic";
import { testDb } from "@/shared/test-db";

let restaurantId: string;
let canteenId: string;
let ownerId: string;
let cashierId: string;

function staffAt(role: "owner" | "cashier", locationId: string): AuthenticatedStaff {
  const staffId = role === "owner" ? ownerId : cashierId;
  return {
    staff: {
      id: staffId,
      name: "Test Staff",
      phone: "+254700111600",
      role,
      locationId,
      active: true,
      dailyRateMinor: 0,
    },
    location: { id: locationId, code: "restaurant", name: "Test" },
  };
}

beforeEach(async () => {
  await testDb.stockMovement.deleteMany({});
  await testDb.recipeLine.deleteMany({});
  await testDb.recipe.deleteMany({});
  await testDb.product.deleteMany({});
  await testDb.ingredient.deleteMany({});
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

  const owner = await testDb.staffMember.create({
    data: {
      name: "Test Owner",
      phone: "+254700111601",
      pinHash: await hashPin("1234"),
      role: "owner",
      locationId: restaurant.id,
      dailyRateMinor: 0,
    },
  });
  ownerId = owner.id;

  const cashier = await testDb.staffMember.create({
    data: {
      name: "Test Cashier",
      phone: "+254700111602",
      pinHash: await hashPin("1234"),
      role: "cashier",
      locationId: restaurant.id,
      dailyRateMinor: 0,
    },
  });
  cashierId = cashier.id;
});

afterAll(async () => {
  await testDb.stockMovement.deleteMany({});
  await testDb.recipeLine.deleteMany({});
  await testDb.recipe.deleteMany({});
  await testDb.product.deleteMany({});
  await testDb.ingredient.deleteMany({});
  await testDb.staffMember.deleteMany({});
  await testDb.location.deleteMany({});
  await testDb.$disconnect();
});

describe("getProductStockValueAtLocation", () => {
  test("values a product with a recorded running-average cost, not an estimate", async () => {
    const owner = staffAt("owner", restaurantId);
    const juice = await createProduct(testDb, owner, {
      name: "Juice (500ml)",
      kind: "goods",
      priceMinor: 120,
      locationId: restaurantId,
    });
    if (!juice.ok) throw new Error("expected product create to succeed");
    await recordProductCost(testDb, owner, juice.value.id, { unitCostMinor: 70 });
    await testDb.stockMovement.create({
      data: {
        productId: juice.value.id,
        locationId: restaurantId,
        quantity: 10,
        reason: "received",
        staffMemberId: ownerId,
      },
    });

    const result = await getProductStockValueAtLocation(testDb, owner, restaurantId);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.values).toEqual([
      {
        productId: juice.value.id,
        productName: "Juice (500ml)",
        quantityOnHand: 10,
        unitCostMinor: 70,
        valueMinor: 700,
        isEstimated: false,
      },
    ]);
  });

  // 2026-08-18: inverted — a recipe no longer sets cost (ADR 0005). The
  // buying price does, and for a made-from-ingredients product that is a
  // deliberate 0, since the ingredients were already valued as stock.
  test("values a cooked-food product at its buying price, ignoring any recipe", async () => {
    const owner = staffAt("owner", restaurantId);
    const chips = await createProduct(testDb, owner, {
      name: "Chips",
      kind: "cooked_food",
      priceMinor: 150,
      lastKnownCostMinor: 0,
      locationId: restaurantId,
    });
    if (!chips.ok) throw new Error("expected product create to succeed");
    const potatoes = await createIngredient(testDb, owner, {
      name: "Potatoes",
      unitOfMeasure: "kg",
      lastKnownCostMinor: 10000,
    });
    if (!potatoes.ok) throw new Error("expected ingredient create to succeed");
    // 10000/kg, 2kg per batch, yield 10 units -> 2000/unit
    await createRecipe(testDb, owner, {
      productId: chips.value.id,
      yieldQuantity: 10,
      lines: [{ ingredientId: potatoes.value.id, quantity: 2 }],
    });
    await testDb.stockMovement.create({
      data: {
        productId: chips.value.id,
        locationId: restaurantId,
        quantity: 8,
        reason: "produced",
        staffMemberId: ownerId,
      },
    });

    const result = await getProductStockValueAtLocation(testDb, owner, restaurantId);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.values).toEqual([
      {
        productId: chips.value.id,
        productName: "Chips",
        quantityOnHand: 8,
        // Not the recipe's 2000/unit — the potatoes are already counted
        // in ingredient stock, so counting them here too would double.
        unitCostMinor: 0,
        valueMinor: 0,
        isEstimated: false,
      },
    ]);
  });

  // 2026-08-18: inverted. The 60%-of-selling-price estimate no longer
  // applies to stock valuation — it invented a cost that read as measured.
  // A product with no buying price is now omitted entirely rather than
  // valued at a guess, and surfaced as "Not set" in the catalogue.
  test("omits a product with no buying price rather than estimating one", async () => {
    const owner = staffAt("owner", restaurantId);
    const mukimo = await createProduct(testDb, owner, {
      name: "Mukimo",
      kind: "cooked_food",
      priceMinor: 100,
      locationId: restaurantId,
    });
    if (!mukimo.ok) throw new Error("expected product create to succeed");
    await testDb.stockMovement.create({
      data: {
        productId: mukimo.value.id,
        locationId: restaurantId,
        quantity: 5,
        reason: "produced",
        staffMemberId: ownerId,
      },
    });

    const result = await getProductStockValueAtLocation(testDb, owner, restaurantId);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.values).toEqual([]);
  });

  test("a repeated product id in the underlying movement sums is not double counted", async () => {
    const owner = staffAt("owner", restaurantId);
    const soda = await createProduct(testDb, owner, {
      name: "Soda",
      kind: "goods",
      priceMinor: 100,
      locationId: restaurantId,
    });
    if (!soda.ok) throw new Error("expected product create to succeed");
    await recordProductCost(testDb, owner, soda.value.id, { unitCostMinor: 50 });
    await testDb.stockMovement.createMany({
      data: [
        {
          productId: soda.value.id,
          locationId: restaurantId,
          quantity: 20,
          reason: "received",
          staffMemberId: ownerId,
        },
        {
          productId: soda.value.id,
          locationId: restaurantId,
          quantity: -5,
          reason: "sold",
          staffMemberId: ownerId,
        },
      ],
    });

    const result = await getProductStockValueAtLocation(testDb, owner, restaurantId);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.values).toEqual([
      {
        productId: soda.value.id,
        productName: "Soda",
        quantityOnHand: 15,
        unitCostMinor: 50,
        valueMinor: 750,
        isEstimated: false,
      },
    ]);
  });

  test("matches getCurrentStockAtLocation's quantities exactly", async () => {
    const owner = staffAt("owner", restaurantId);
    const soda = await createProduct(testDb, owner, {
      name: "Soda",
      kind: "goods",
      priceMinor: 100,
      // Bought and resold, so it carries a real buying price. Without one
      // it would now be omitted from the valuation entirely and this
      // quantities-match assertion would compare against an empty list.
      lastKnownCostMinor: 60,
      locationId: restaurantId,
    });
    if (!soda.ok) throw new Error("expected product create to succeed");
    await testDb.stockMovement.createMany({
      data: [
        {
          productId: soda.value.id,
          locationId: restaurantId,
          quantity: 30,
          reason: "received",
          staffMemberId: ownerId,
        },
        {
          productId: soda.value.id,
          locationId: restaurantId,
          quantity: -12,
          reason: "sold",
          staffMemberId: ownerId,
        },
      ],
    });

    const stock = await getCurrentStockAtLocation(testDb, owner, restaurantId);
    const value = await getProductStockValueAtLocation(testDb, owner, restaurantId);

    expect(stock.ok).toBe(true);
    expect(value.ok).toBe(true);
    if (!stock.ok || !value.ok) return;
    expect(value.values.map((v) => ({ productId: v.productId, quantityOnHand: v.quantityOnHand }))).toEqual(
      stock.levels.map((l) => ({ productId: l.productId, quantityOnHand: l.quantityOnHand })),
    );
  });

  test("denies a staff member access to the other location's stock value", async () => {
    const result = await getProductStockValueAtLocation(
      testDb,
      staffAt("cashier", restaurantId),
      canteenId,
    );

    expect(result).toEqual({ ok: false, reason: "forbidden" });
  });

  test("the owner can access any location's stock value", async () => {
    const result = await getProductStockValueAtLocation(
      testDb,
      staffAt("owner", restaurantId),
      canteenId,
    );

    expect(result.ok).toBe(true);
  });

  test("a location with no movements has no stock value, not an error", async () => {
    const result = await getProductStockValueAtLocation(
      testDb,
      staffAt("owner", restaurantId),
      canteenId,
    );

    expect(result).toEqual({ ok: true, values: [] });
  });
});
