import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { hashPin } from "@/modules/people";
import type { AuthenticatedStaff } from "@/modules/people";
import { createIngredient, createProduct, createRecipe, recordProductCost } from "@/modules/catalogue";
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

  const cashier = await testDb.staffMember.create({
    data: {
      name: "Test Cashier",
      phone: "+254700111556",
      pinHash: await hashPin("1234"),
      role: "cashier",
      locationId: restaurant.id,
      dailyRateMinor: 0,
    },
  });
  cashierId = cashier.id;

  const soda = await testDb.product.create({
    data: { name: "Sodas (500ml)", kind: "goods", priceMinor: 100, locationId: restaurant.id },
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

  // 2026-08-18: inverted, and it is the wastage case specifically that
  // shows why the 60% estimate was KEPT here while being removed from cost
  // of goods sold. A recipe no longer sets cost, and a made-from-
  // ingredients product carries a buying price of 0 — so valuing wastage
  // at the buying price alone would report a thrown-away plate of chips as
  // worth nothing. Non-sales consumption is a reporting figure that is
  // never deducted from profit again, so an estimate here cannot distort
  // profit; it can only make an otherwise-invisible loss visible.
  test("falls back to the 60% estimate for wastage where the buying price is zero", async () => {
    const owner: AuthenticatedStaff = {
      staff: {
        id: "owner-1",
        name: "Owner",
        phone: "+254700111557",
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
      // Made from ingredients: already costed upstream, so 0 here.
      lastKnownCostMinor: 0,
      locationId: restaurantId,
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
        // 60% of the 150 selling price = 90/unit, 2 wasted = 180. Not the
        // recipe's 2000/unit, and not the 0 buying price.
        costBasisMinor: 180,
        sellingValueMinor: 300,
        isEstimated: true,
      }),
    );
  });

  test("uses the product's recorded running-average cost instead of the estimate when one is known", async () => {
    const owner: AuthenticatedStaff = {
      staff: {
        id: "owner-3",
        name: "Owner",
        phone: "+254700111559",
        role: "owner",
        locationId: restaurantId,
        active: true,
        dailyRateMinor: 0,
      },
      location: { id: restaurantId, code: "restaurant", name: "Test" },
    };

    // formulas.md §4: bought-in goods use the running average, not the
    // 60%-of-price estimate — even though this product has a priceMinor
    // that an estimate could be derived from, the recorded cost wins.
    const juice = await createProduct(testDb, owner, {
      name: "Juice (500ml)",
      kind: "goods",
      priceMinor: 120,
      locationId: restaurantId,
    });
    if (!juice.ok) throw new Error("expected product create to succeed");
    await recordProductCost(testDb, owner, juice.value.id, { unitCostMinor: 70 });

    const requester = staffAt("cashier", restaurantId);
    const result = await recordNonSalesConsumption(testDb, requester, {
      itemType: "product",
      itemId: juice.value.id,
      locationId: restaurantId,
      quantity: 3,
      category: "wasted",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.movement).toEqual(
      expect.objectContaining({
        quantity: -3,
        costBasisMinor: 210,
        sellingValueMinor: 360,
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
        dailyRateMinor: 0,
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
        dailyRateMinor: 0,
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
      data: { name: "Discontinued soda", kind: "goods", priceMinor: 100, active: false, locationId: restaurantId },
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
