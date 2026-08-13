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
    await recordProductCost(testDb, owner, juice.value.id, {
      quantityOnHand: 0,
      quantityBought: 10,
      unitCostMinor: 70,
    });
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

  test("values a cooked-food product with a recipe at its per-unit recipe cost, not an estimate", async () => {
    const owner = staffAt("owner", restaurantId);
    const chips = await createProduct(testDb, owner, {
      name: "Chips",
      kind: "cooked_food",
      priceMinor: 150,
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
        unitCostMinor: 2000,
        valueMinor: 16000,
        isEstimated: false,
      },
    ]);
  });

  test("values a cooked-food product with no recipe at the labelled 60% estimate", async () => {
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
    expect(result.values).toEqual([
      {
        productId: mukimo.value.id,
        productName: "Mukimo",
        quantityOnHand: 5,
        unitCostMinor: 60,
        valueMinor: 300,
        isEstimated: true,
      },
    ]);
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
    await recordProductCost(testDb, owner, soda.value.id, {
      quantityOnHand: 0,
      quantityBought: 1,
      unitCostMinor: 50,
    });
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
