import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { hashPin } from "@/modules/people";
import type { AuthenticatedStaff } from "@/modules/people";
import { createIngredient, createProduct, createRecipe } from "@/modules/catalogue";
import { getCurrentStockAtLocation, recordProduction } from "../logic";
import { testDb } from "@/shared/test-db";

let restaurantId: string;
let storeManagerId: string;
let owner: AuthenticatedStaff;
let chipsId: string;
let potatoesId: string;

function staffAt(
  role: "owner" | "store_manager" | "attendant" | "cashier",
  locationId: string,
  staffId: string = storeManagerId,
): AuthenticatedStaff {
  return {
    staff: {
      id: staffId,
      name: "Test Staff",
      phone: "+254700111888",
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
  await testDb.ingredientMovement.deleteMany({});
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

  const storeManager = await testDb.staffMember.create({
    data: {
      name: "Test Store Manager",
      phone: "+254700111889",
      pinHash: await hashPin("1234"),
      role: "store_manager",
      locationId: restaurant.id,
      dailyRateMinor: 700,
    },
  });
  storeManagerId = storeManager.id;

  const ownerRow = await testDb.staffMember.create({
    data: {
      name: "Owner",
      phone: "+254700111890",
      pinHash: await hashPin("1234"),
      role: "owner",
      locationId: restaurant.id,
      dailyRateMinor: 0,
    },
  });

  owner = {
    staff: {
      id: ownerRow.id,
      name: "Owner",
      phone: "+254700111890",
      role: "owner",
      locationId: restaurantId,
      active: true,
      dailyRateMinor: 0,
    },
    location: { id: restaurantId, code: "restaurant", name: "Test" },
  };

  const product = await createProduct(testDb, owner, {
    name: "Chips",
    kind: "cooked_food",
    priceMinor: 150,
  });
  if (!product.ok) throw new Error("expected product create to succeed");
  chipsId = product.value.id;

  const potatoes = await createIngredient(testDb, owner, {
    name: "Potatoes",
    unitOfMeasure: "kg",
    lastKnownCostMinor: 10000,
  });
  if (!potatoes.ok) throw new Error("expected ingredient create to succeed");
  potatoesId = potatoes.value.id;

  // 10000/kg, 2kg per batch, yield 10 units -> 2000/unit
  await createRecipe(testDb, owner, {
    productId: chipsId,
    yieldQuantity: 10,
    lines: [{ ingredientId: potatoesId, quantity: 2 }],
  });

  // Ingredient stock so deduction has something to draw from.
  await testDb.ingredientMovement.create({
    data: {
      ingredientId: potatoesId,
      locationId: restaurantId,
      quantity: 100,
      reason: "received",
      unitCostMinor: 10000,
      staffMemberId: storeManagerId,
      receiptId: crypto.randomUUID(),
    },
  });
});

afterAll(async () => {
  await testDb.stockMovement.deleteMany({});
  await testDb.ingredientMovement.deleteMany({});
  await testDb.recipeLine.deleteMany({});
  await testDb.recipe.deleteMany({});
  await testDb.product.deleteMany({});
  await testDb.ingredient.deleteMany({});
  await testDb.staffMember.deleteMany({});
  await testDb.location.deleteMany({});
  await testDb.$disconnect();
});

describe("recordProduction", () => {
  test("records a produced movement for the product and deducts recipe ingredients from the store", async () => {
    const requester = staffAt("store_manager", restaurantId);

    const result = await recordProduction(testDb, requester, {
      productId: chipsId,
      locationId: restaurantId,
      quantity: 4,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.movement).toEqual(
      expect.objectContaining({
        productId: chipsId,
        locationId: restaurantId,
        quantity: 4,
        reason: "produced",
        costBasisMinor: 8000, // 2000/unit * 4
        sellingValueMinor: 600, // 150 * 4
        isEstimated: false,
      }),
    );

    const stockResult = await getCurrentStockAtLocation(testDb, owner, restaurantId);
    expect(stockResult.ok).toBe(true);
    if (!stockResult.ok) return;
    const chipsLevel = stockResult.levels.find((l) => l.productId === chipsId);
    expect(chipsLevel?.quantityOnHand).toBe(4);

    const ingredientMovements = await testDb.ingredientMovement.findMany({
      where: { ingredientId: potatoesId, locationId: restaurantId, reason: "issued" },
    });
    expect(ingredientMovements).toHaveLength(1);
    expect(ingredientMovements[0].quantity).toBe(-8); // 2kg * 4 units

    const allPotatoMovements = await testDb.ingredientMovement.findMany({
      where: { ingredientId: potatoesId, locationId: restaurantId },
    });
    const onHand = allPotatoMovements.reduce((sum, m) => sum + m.quantity, 0);
    expect(onHand).toBe(92); // 100 received - 8 consumed
  });

  test("rejects a product with no current recipe", async () => {
    const noRecipeProduct = await createProduct(testDb, owner, {
      name: "Soda",
      kind: "goods",
      priceMinor: 100,
    });
    if (!noRecipeProduct.ok) throw new Error("expected product create to succeed");

    const requester = staffAt("store_manager", restaurantId);
    const result = await recordProduction(testDb, requester, {
      productId: noRecipeProduct.value.id,
      locationId: restaurantId,
      quantity: 2,
    });

    expect(result).toEqual({ ok: false, reason: "no_recipe" });
  });

  test("rejects an inactive product", async () => {
    const { deactivateProduct } = await import("@/modules/catalogue");
    const deactivated = await deactivateProduct(testDb, owner, chipsId);
    expect(deactivated.ok).toBe(true);

    const requester = staffAt("store_manager", restaurantId);
    const result = await recordProduction(testDb, requester, {
      productId: chipsId,
      locationId: restaurantId,
      quantity: 2,
    });

    expect(result).toEqual({ ok: false, reason: "inactive_product" });
  });

  test("rejects a non-positive quantity", async () => {
    const requester = staffAt("store_manager", restaurantId);

    const result = await recordProduction(testDb, requester, {
      productId: chipsId,
      locationId: restaurantId,
      quantity: 0,
    });

    expect(result).toEqual({ ok: false, reason: "invalid_quantity" });
  });

  test("denies a cashier from recording production", async () => {
    const cashier = await testDb.staffMember.create({
      data: {
        name: "Test Cashier",
        phone: "+254700111891",
        pinHash: await hashPin("1234"),
        role: "cashier",
        locationId: restaurantId,
        dailyRateMinor: 550,
      },
    });
    const requester = staffAt("cashier", restaurantId, cashier.id);

    const result = await recordProduction(testDb, requester, {
      productId: chipsId,
      locationId: restaurantId,
      quantity: 2,
    });

    expect(result).toEqual({ ok: false, reason: "forbidden" });
  });

  test("denies an attendant from recording production", async () => {
    const canteen = await testDb.location.create({
      data: { code: "canteen", name: "Test Canteen" },
    });
    const attendant = await testDb.staffMember.create({
      data: {
        name: "Test Attendant",
        phone: "+254700111892",
        pinHash: await hashPin("1234"),
        role: "attendant",
        locationId: canteen.id,
        dailyRateMinor: 600,
      },
    });
    const requester = staffAt("attendant", canteen.id, attendant.id);

    const result = await recordProduction(testDb, requester, {
      productId: chipsId,
      locationId: canteen.id,
      quantity: 2,
    });

    expect(result).toEqual({ ok: false, reason: "forbidden" });
  });

  test("denies a staff member recording at a location they can't access", async () => {
    const canteen = await testDb.location.create({
      data: { code: "canteen", name: "Test Canteen" },
    });
    const requester = staffAt("store_manager", restaurantId);

    const result = await recordProduction(testDb, requester, {
      productId: chipsId,
      locationId: canteen.id,
      quantity: 2,
    });

    expect(result).toEqual({ ok: false, reason: "forbidden" });
  });

  test("allows the owner to record production at any location", async () => {
    const result = await recordProduction(testDb, owner, {
      productId: chipsId,
      locationId: restaurantId,
      quantity: 1,
    });

    expect(result.ok).toBe(true);
  });
});
