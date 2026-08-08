import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { hashPin } from "@/modules/people";
import type { AuthenticatedStaff } from "@/modules/people";
import { createIngredient, createProduct, createRecipe } from "@/modules/catalogue";
import { getCurrentStockAtLocation, recordNonSalesConsumption } from "../logic";
import { testDb } from "@/shared/test-db";

let restaurantId: string;
let sodaId: string;
let cashierId: string;

function staffAt(
  role: "owner" | "store_manager" | "attendant" | "cashier",
  locationId: string,
  staffId: string = cashierId,
): AuthenticatedStaff {
  return {
    staff: {
      id: staffId,
      name: "Test Staff",
      phone: "+254700111555",
      role,
      locationId,
      active: true,
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

  const cashier = await testDb.staffMember.create({
    data: {
      name: "Test Cashier",
      phone: "+254700111556",
      pinHash: await hashPin("1234"),
      role: "cashier",
      locationId: restaurant.id,
    },
  });
  cashierId = cashier.id;

  const soda = await testDb.product.create({
    data: { name: "Sodas (500ml)", kind: "goods", priceMinor: 100 },
  });
  sodaId = soda.id;
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

describe("recordNonSalesConsumption", () => {
  test("records wastage for a product with no known cost, estimated at 60% of selling price", async () => {
    const requester = staffAt("cashier", restaurantId);

    const result = await recordNonSalesConsumption(testDb, requester, {
      itemType: "product",
      itemId: sodaId,
      locationId: restaurantId,
      quantity: 3,
      category: "wasted",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.movement).toEqual(
      expect.objectContaining({
        productId: sodaId,
        locationId: restaurantId,
        quantity: -3,
        reason: "wasted",
        costBasisMinor: 180,
        sellingValueMinor: 300,
        isEstimated: true,
      }),
    );
  });

  test("uses the recipe's per-unit cost instead of the estimate when one exists", async () => {
    const owner: AuthenticatedStaff = {
      staff: {
        id: "owner-1",
        name: "Owner",
        phone: "+254700111557",
        role: "owner",
        locationId: restaurantId,
        active: true,
      },
      location: { id: restaurantId, code: "restaurant", name: "Test" },
    };

    const product = await createProduct(testDb, owner, {
      name: "Chips",
      kind: "cooked_food",
      priceMinor: 150,
    });
    if (!product.ok) throw new Error("expected product create to succeed");
    const flour = await createIngredient(testDb, owner, {
      name: "Potatoes",
      unitOfMeasure: "kg",
      lastKnownCostMinor: 10000,
    });
    if (!flour.ok) throw new Error("expected ingredient create to succeed");
    // 10000/kg, 2kg per batch, yield 10 units -> 2000/unit
    await createRecipe(testDb, owner, {
      productId: product.value.id,
      yieldQuantity: 10,
      lines: [{ ingredientId: flour.value.id, quantity: 2 }],
    });

    const requester = staffAt("cashier", restaurantId);
    const result = await recordNonSalesConsumption(testDb, requester, {
      itemType: "product",
      itemId: product.value.id,
      locationId: restaurantId,
      quantity: 2,
      category: "wasted",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.movement).toEqual(
      expect.objectContaining({
        quantity: -2,
        costBasisMinor: 4000,
        sellingValueMinor: 300,
        isEstimated: false,
      }),
    );
  });

  test("records consumption for an ingredient at its last known cost, with no selling value", async () => {
    const owner: AuthenticatedStaff = {
      staff: {
        id: "owner-2",
        name: "Owner",
        phone: "+254700111558",
        role: "owner",
        locationId: restaurantId,
        active: true,
      },
      location: { id: restaurantId, code: "restaurant", name: "Test" },
    };
    const flour = await createIngredient(testDb, owner, {
      name: "Flour",
      unitOfMeasure: "kg",
      lastKnownCostMinor: 8000,
    });
    if (!flour.ok) throw new Error("expected ingredient create to succeed");

    const requester = staffAt("cashier", restaurantId);
    const result = await recordNonSalesConsumption(testDb, requester, {
      itemType: "ingredient",
      itemId: flour.value.id,
      locationId: restaurantId,
      quantity: 5,
      category: "consumed",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.movement).toEqual(
      expect.objectContaining({
        ingredientId: flour.value.id,
        locationId: restaurantId,
        quantity: -5,
        reason: "consumed",
        costBasisMinor: 40000,
        sellingValueMinor: null,
        isEstimated: false,
      }),
    );
  });

  test("rejects an ingredient with no known cost", async () => {
    const owner: AuthenticatedStaff = {
      staff: {
        id: "owner-3",
        name: "Owner",
        phone: "+254700111559",
        role: "owner",
        locationId: restaurantId,
        active: true,
      },
      location: { id: restaurantId, code: "restaurant", name: "Test" },
    };
    const spice = await createIngredient(testDb, owner, {
      name: "Spice",
      unitOfMeasure: "kg",
    });
    if (!spice.ok) throw new Error("expected ingredient create to succeed");

    const requester = staffAt("cashier", restaurantId);
    const result = await recordNonSalesConsumption(testDb, requester, {
      itemType: "ingredient",
      itemId: spice.value.id,
      locationId: restaurantId,
      quantity: 1,
      category: "wasted",
    });

    expect(result).toEqual({ ok: false, reason: "invalid_cost" });
  });

  test("rejects an inactive product", async () => {
    const inactive = await testDb.product.create({
      data: { name: "Discontinued soda", kind: "goods", priceMinor: 100, active: false },
    });
    const requester = staffAt("cashier", restaurantId);

    const result = await recordNonSalesConsumption(testDb, requester, {
      itemType: "product",
      itemId: inactive.id,
      locationId: restaurantId,
      quantity: 1,
      category: "wasted",
    });

    expect(result).toEqual({ ok: false, reason: "inactive_item" });
  });

  test("rejects a non-positive quantity", async () => {
    const requester = staffAt("cashier", restaurantId);

    const result = await recordNonSalesConsumption(testDb, requester, {
      itemType: "product",
      itemId: sodaId,
      locationId: restaurantId,
      quantity: 0,
      category: "wasted",
    });

    expect(result).toEqual({ ok: false, reason: "invalid_quantity" });
  });

  test("denies recording at a location the staff member can't access", async () => {
    const canteen = await testDb.location.create({
      data: { code: "canteen", name: "Test Canteen" },
    });
    const requester = staffAt("cashier", restaurantId);

    const result = await recordNonSalesConsumption(testDb, requester, {
      itemType: "product",
      itemId: sodaId,
      locationId: canteen.id,
      quantity: 1,
      category: "wasted",
    });

    expect(result).toEqual({ ok: false, reason: "forbidden" });
  });

  test("records a given_away entry with the given_away reason", async () => {
    const requester = staffAt("cashier", restaurantId);

    const result = await recordNonSalesConsumption(testDb, requester, {
      itemType: "product",
      itemId: sodaId,
      locationId: restaurantId,
      quantity: 1,
      category: "given_away",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.movement).toEqual(expect.objectContaining({ reason: "given_away" }));
  });

  test("recording wastage reduces current stock at the location", async () => {
    const requester = staffAt("cashier", restaurantId);
    await testDb.stockMovement.create({
      data: {
        productId: sodaId,
        locationId: restaurantId,
        quantity: 20,
        reason: "received",
        staffMemberId: cashierId,
      },
    });

    await recordNonSalesConsumption(testDb, requester, {
      itemType: "product",
      itemId: sodaId,
      locationId: restaurantId,
      quantity: 4,
      category: "wasted",
    });

    const stock = await getCurrentStockAtLocation(testDb, requester, restaurantId);
    expect(stock.ok).toBe(true);
    if (!stock.ok) return;
    expect(stock.levels).toEqual([
      expect.objectContaining({ productId: sodaId, quantityOnHand: 16 }),
    ]);
  });
});
