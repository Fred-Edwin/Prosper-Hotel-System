import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { hashPin } from "@/modules/people";
import type { AuthenticatedStaff } from "@/modules/people";
import { createIngredient, createProduct, createRecipe } from "@/modules/catalogue";
import { correctStockCount, getStockCount, recordStockCount } from "../logic";
import { testDb } from "@/shared/test-db";

let restaurantId: string;
let sodaId: string;
let storeManagerId: string;
let ownerId: string;

function staffAt(
  role: "owner" | "store_manager" | "attendant" | "cashier",
  locationId: string,
  staffId: string,
): AuthenticatedStaff {
  return {
    staff: {
      id: staffId,
      name: "Test Staff",
      phone: "+254700111444",
      role,
      locationId,
      dailyRateMinor: 0,
      active: true,
    },
    location: { id: locationId, code: "restaurant", name: "Test" },
  };
}

beforeEach(async () => {
  await testDb.stockCountLine.deleteMany({});
  await testDb.stockCount.deleteMany({});
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
      phone: "+254700111445",
      pinHash: await hashPin("1234"),
      role: "store_manager",
      locationId: restaurant.id,
      dailyRateMinor: 700,
    },
  });
  storeManagerId = storeManager.id;

  const owner = await testDb.staffMember.create({
    data: {
      name: "Test Owner",
      phone: "+254700111448",
      pinHash: await hashPin("1234"),
      role: "owner",
      locationId: restaurant.id,
      dailyRateMinor: 0,
    },
  });
  ownerId = owner.id;

  const soda = await testDb.product.create({
    data: { name: "Soda", kind: "goods", priceMinor: 100, locationId: restaurant.id },
  });
  sodaId = soda.id;
});

afterAll(async () => {
  await testDb.stockCountLine.deleteMany({});
  await testDb.stockCount.deleteMany({});
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

describe("recordStockCount", () => {
  test("records a line with counted and expected quantity from movements", async () => {
    await testDb.stockMovement.create({
      data: {
        productId: sodaId,
        locationId: restaurantId,
        quantity: 40,
        reason: "received",
        staffMemberId: storeManagerId,
      },
    });

    const requester = staffAt("store_manager", restaurantId, storeManagerId);

    const result = await recordStockCount(testDb, requester, {
      locationId: restaurantId,
      lines: [{ itemType: "product", itemId: sodaId, countedQuantity: 37 }],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.count.lines).toEqual([
      expect.objectContaining({
        itemType: "product",
        itemId: sodaId,
        countedQuantity: 37,
        expectedQuantity: 40,
      }),
    ]);
  });

  test("rejects a negative counted quantity", async () => {
    const requester = staffAt("store_manager", restaurantId, storeManagerId);

    const result = await recordStockCount(testDb, requester, {
      locationId: restaurantId,
      lines: [{ itemType: "product", itemId: sodaId, countedQuantity: -1 }],
    });

    expect(result).toEqual({ ok: false, reason: "invalid_quantity" });
  });

  test("rejects a line for an inactive product", async () => {
    const inactive = await testDb.product.create({
      data: { name: "Discontinued snack", kind: "goods", active: false, locationId: restaurantId },
    });
    const requester = staffAt("store_manager", restaurantId, storeManagerId);

    const result = await recordStockCount(testDb, requester, {
      locationId: restaurantId,
      lines: [{ itemType: "product", itemId: inactive.id, countedQuantity: 5 }],
    });

    expect(result).toEqual({ ok: false, reason: "inactive_item" });
  });

  test("denies a staff member recording at a location they can't access", async () => {
    const canteen = await testDb.location.create({
      data: { code: "canteen", name: "Test Canteen" },
    });
    const requester = staffAt("store_manager", restaurantId, storeManagerId);

    const result = await recordStockCount(testDb, requester, {
      locationId: canteen.id,
      lines: [{ itemType: "product", itemId: sodaId, countedQuantity: 5 }],
    });

    expect(result).toEqual({ ok: false, reason: "forbidden" });
  });

  test("allows an attendant to record a count at their own location", async () => {
    const canteen = await testDb.location.create({
      data: { code: "canteen", name: "Test Canteen" },
    });
    const attendant = await testDb.staffMember.create({
      data: {
        name: "Test Attendant",
        phone: "+254700111446",
        pinHash: await hashPin("1234"),
        role: "attendant",
        locationId: canteen.id,
        dailyRateMinor: 600,
      },
    });
    const requester = staffAt("attendant", canteen.id, attendant.id);

    const result = await recordStockCount(testDb, requester, {
      locationId: canteen.id,
      lines: [{ itemType: "product", itemId: sodaId, countedQuantity: 5 }],
    });

    expect(result.ok).toBe(true);
  });
});

describe("getStockCount", () => {
  test("returns a store manager's own count with expected/difference omitted", async () => {
    const recorder = staffAt("store_manager", restaurantId, storeManagerId);
    const recorded = await recordStockCount(testDb, recorder, {
      locationId: restaurantId,
      lines: [{ itemType: "product", itemId: sodaId, countedQuantity: 12 }],
    });
    if (!recorded.ok) throw new Error("setup failed");

    const result = await getStockCount(testDb, recorder, recorded.count.id);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.count.lines[0]).toEqual(
      expect.objectContaining({ itemType: "product", itemId: sodaId, countedQuantity: 12 }),
    );
    expect(result.count.lines[0]).not.toHaveProperty("expectedQuantity");
  });

  test("returns the owner a count with expected quantity and difference included", async () => {
    const recorder = staffAt("store_manager", restaurantId, storeManagerId);
    const recorded = await recordStockCount(testDb, recorder, {
      locationId: restaurantId,
      lines: [{ itemType: "product", itemId: sodaId, countedQuantity: 12 }],
    });
    if (!recorded.ok) throw new Error("setup failed");

    const ownerRequester = staffAt("owner", restaurantId, ownerId);
    const result = await getStockCount(testDb, ownerRequester, recorded.count.id);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.count.lines[0]).toEqual(
      expect.objectContaining({
        itemType: "product",
        itemId: sodaId,
        countedQuantity: 12,
        expectedQuantity: 0,
      }),
    );
  });

  test("denies a staff member reading a count at a location they can't access", async () => {
    const recorder = staffAt("store_manager", restaurantId, storeManagerId);
    const recorded = await recordStockCount(testDb, recorder, {
      locationId: restaurantId,
      lines: [{ itemType: "product", itemId: sodaId, countedQuantity: 12 }],
    });
    if (!recorded.ok) throw new Error("setup failed");

    const canteen = await testDb.location.create({
      data: { code: "canteen", name: "Test Canteen" },
    });
    const attendant = await testDb.staffMember.create({
      data: {
        name: "Test Attendant",
        phone: "+254700111446",
        pinHash: await hashPin("1234"),
        role: "attendant",
        locationId: canteen.id,
        dailyRateMinor: 600,
      },
    });
    const requester = staffAt("attendant", canteen.id, attendant.id);

    const result = await getStockCount(testDb, requester, recorded.count.id);

    expect(result).toEqual({ ok: false, reason: "forbidden" });
  });

  test("returns not_found for a nonexistent count", async () => {
    const requester = staffAt("store_manager", restaurantId, storeManagerId);

    const result = await getStockCount(testDb, requester, "nonexistent");

    expect(result).toEqual({ ok: false, reason: "not_found" });
  });
});

describe("correctStockCount", () => {
  test("values a negative product correction at estimated cost and the product's selling price", async () => {
    await testDb.stockMovement.create({
      data: {
        productId: sodaId,
        locationId: restaurantId,
        quantity: 40,
        reason: "received",
        staffMemberId: storeManagerId,
      },
    });

    const recorder = staffAt("store_manager", restaurantId, storeManagerId);
    const recorded = await recordStockCount(testDb, recorder, {
      locationId: restaurantId,
      lines: [{ itemType: "product", itemId: sodaId, countedQuantity: 37 }],
    });
    if (!recorded.ok) throw new Error("setup failed");

    const ownerRequester = staffAt("owner", restaurantId, ownerId);

    // Owner investigates and confirms the counted figure is correct.
    const result = await correctStockCount(testDb, ownerRequester, {
      stockCountId: recorded.count.id,
      lineId: recorded.count.lines[0].id,
      correctedQuantity: 37,
    });

    expect(result).toEqual({ ok: true });

    const movements = await testDb.stockMovement.findMany({
      where: { productId: sodaId, locationId: restaurantId },
    });
    const quantityOnHand = movements.reduce((sum, m) => sum + m.quantity.toNumber(), 0);
    expect(quantityOnHand).toBe(37);

    const correctionMovement = movements.find((m) => m.reason === "corrected");
    // Soda priceMinor 100, no recipe -> estimated cost 60% = 60/unit, 3 short.
    expect(correctionMovement && { ...correctionMovement, quantity: correctionMovement.quantity.toNumber() }).toEqual(
      expect.objectContaining({
        quantity: -3,
        costBasisMinor: 180,
        sellingValueMinor: 300,
        isEstimated: true,
      }),
    );
  });

  test("values a positive product correction at cost only, no selling value", async () => {
    await testDb.stockMovement.create({
      data: {
        productId: sodaId,
        locationId: restaurantId,
        quantity: 40,
        reason: "received",
        staffMemberId: storeManagerId,
      },
    });

    const recorder = staffAt("store_manager", restaurantId, storeManagerId);
    const recorded = await recordStockCount(testDb, recorder, {
      locationId: restaurantId,
      lines: [{ itemType: "product", itemId: sodaId, countedQuantity: 37 }],
    });
    if (!recorded.ok) throw new Error("setup failed");

    const ownerRequester = staffAt("owner", restaurantId, ownerId);

    // Owner investigates and finds 5 more than were even counted.
    const result = await correctStockCount(testDb, ownerRequester, {
      stockCountId: recorded.count.id,
      lineId: recorded.count.lines[0].id,
      correctedQuantity: 42,
    });

    expect(result).toEqual({ ok: true });

    const movements = await testDb.stockMovement.findMany({
      where: { productId: sodaId, locationId: restaurantId },
    });
    const correctionMovement = movements.find((m) => m.reason === "corrected");
    expect(correctionMovement && { ...correctionMovement, quantity: correctionMovement.quantity.toNumber() }).toEqual(
      expect.objectContaining({
        quantity: 2,
        costBasisMinor: 120,
        sellingValueMinor: null,
        isEstimated: true,
      }),
    );
  });

  test("uses the recipe's per-unit cost instead of the estimate when one exists", async () => {
    const ownerRequester = staffAt("owner", restaurantId, ownerId);
    const product = await createProduct(testDb, ownerRequester, {
      name: "Chips",
      kind: "cooked_food",
      priceMinor: 150,
      locationId: restaurantId,
    });
    if (!product.ok) throw new Error("expected product create to succeed");
    const potatoes = await createIngredient(testDb, ownerRequester, {
      name: "Potatoes",
      unitOfMeasure: "kg",
      lastKnownCostMinor: 10000,
    });
    if (!potatoes.ok) throw new Error("expected ingredient create to succeed");
    // 10000/kg, 2kg per batch, yield 10 units -> 2000/unit
    await createRecipe(testDb, ownerRequester, {
      productId: product.value.id,
      yieldQuantity: 10,
      lines: [{ ingredientId: potatoes.value.id, quantity: 2 }],
    });

    const recorder = staffAt("store_manager", restaurantId, storeManagerId);
    const recorded = await recordStockCount(testDb, recorder, {
      locationId: restaurantId,
      lines: [{ itemType: "product", itemId: product.value.id, countedQuantity: 8 }],
    });
    if (!recorded.ok) throw new Error("setup failed");

    const result = await correctStockCount(testDb, ownerRequester, {
      stockCountId: recorded.count.id,
      lineId: recorded.count.lines[0].id,
      correctedQuantity: 8,
    });

    expect(result).toEqual({ ok: true });

    const movements = await testDb.stockMovement.findMany({
      where: { productId: product.value.id, locationId: restaurantId },
    });
    const correctionMovement = movements.find((m) => m.reason === "corrected");
    // No prior movements, so expectedQuantity is 0 — correcting to 8 is a
    // surplus (positive delta), cost-only, no selling value recognised.
    expect(correctionMovement && { ...correctionMovement, quantity: correctionMovement.quantity.toNumber() }).toEqual(
      expect.objectContaining({
        quantity: 8,
        costBasisMinor: 16000,
        sellingValueMinor: null,
        isEstimated: false,
      }),
    );
  });

  test("values an ingredient correction at last known cost, either direction, never with a selling value", async () => {
    const ownerRequester = staffAt("owner", restaurantId, ownerId);
    const flour = await createIngredient(testDb, ownerRequester, {
      name: "Flour",
      unitOfMeasure: "kg",
      lastKnownCostMinor: 8000,
    });
    if (!flour.ok) throw new Error("expected ingredient create to succeed");

    await testDb.ingredientMovement.create({
      data: {
        ingredientId: flour.value.id,
        locationId: restaurantId,
        quantity: 20,
        reason: "received",
        unitCostMinor: 8000,
        staffMemberId: storeManagerId,
      },
    });

    const recorder = staffAt("store_manager", restaurantId, storeManagerId);
    const recorded = await recordStockCount(testDb, recorder, {
      locationId: restaurantId,
      lines: [{ itemType: "ingredient", itemId: flour.value.id, countedQuantity: 18 }],
    });
    if (!recorded.ok) throw new Error("setup failed");

    const result = await correctStockCount(testDb, ownerRequester, {
      stockCountId: recorded.count.id,
      lineId: recorded.count.lines[0].id,
      correctedQuantity: 18,
    });

    expect(result).toEqual({ ok: true });

    const movements = await testDb.ingredientMovement.findMany({
      where: { ingredientId: flour.value.id, locationId: restaurantId },
    });
    const correctionMovement = movements.find((m) => m.reason === "corrected");
    expect(correctionMovement && { ...correctionMovement, quantity: correctionMovement.quantity.toNumber() }).toEqual(
      expect.objectContaining({
        quantity: -2,
        costBasisMinor: 16000,
        sellingValueMinor: null,
        isEstimated: false,
      }),
    );
  });

  test("rejects a product correction that can't be valued (no recipe, no price)", async () => {
    const ownerRequester = staffAt("owner", restaurantId, ownerId);
    const unpriced = await createProduct(testDb, ownerRequester, {
      name: "Unpriced good",
      kind: "goods",
      priceMinor: null,
      locationId: restaurantId,
    });
    if (!unpriced.ok) throw new Error("expected product create to succeed");

    const recorder = staffAt("store_manager", restaurantId, storeManagerId);
    const recorded = await recordStockCount(testDb, recorder, {
      locationId: restaurantId,
      lines: [{ itemType: "product", itemId: unpriced.value.id, countedQuantity: 3 }],
    });
    if (!recorded.ok) throw new Error("setup failed");

    const result = await correctStockCount(testDb, ownerRequester, {
      stockCountId: recorded.count.id,
      lineId: recorded.count.lines[0].id,
      correctedQuantity: 5,
    });

    expect(result).toEqual({ ok: false, reason: "invalid_cost" });

    const movements = await testDb.stockMovement.findMany({
      where: { productId: unpriced.value.id, locationId: restaurantId },
    });
    expect(movements.find((m) => m.reason === "corrected")).toBeUndefined();
  });

  test("rejects an ingredient correction with no known cost", async () => {
    const ownerRequester = staffAt("owner", restaurantId, ownerId);
    const mystery = await createIngredient(testDb, ownerRequester, {
      name: "Mystery ingredient",
      unitOfMeasure: "kg",
      lastKnownCostMinor: null,
    });
    if (!mystery.ok) throw new Error("expected ingredient create to succeed");

    const recorder = staffAt("store_manager", restaurantId, storeManagerId);
    const recorded = await recordStockCount(testDb, recorder, {
      locationId: restaurantId,
      lines: [{ itemType: "ingredient", itemId: mystery.value.id, countedQuantity: 3 }],
    });
    if (!recorded.ok) throw new Error("setup failed");

    const result = await correctStockCount(testDb, ownerRequester, {
      stockCountId: recorded.count.id,
      lineId: recorded.count.lines[0].id,
      correctedQuantity: 5,
    });

    expect(result).toEqual({ ok: false, reason: "invalid_cost" });
  });

  test("denies a store manager applying a correction", async () => {
    const recorder = staffAt("store_manager", restaurantId, storeManagerId);
    const recorded = await recordStockCount(testDb, recorder, {
      locationId: restaurantId,
      lines: [{ itemType: "product", itemId: sodaId, countedQuantity: 37 }],
    });
    if (!recorded.ok) throw new Error("setup failed");

    const result = await correctStockCount(testDb, recorder, {
      stockCountId: recorded.count.id,
      lineId: recorded.count.lines[0].id,
      correctedQuantity: 37,
    });

    expect(result).toEqual({ ok: false, reason: "forbidden" });
  });

  test("rejects correcting an already-corrected line", async () => {
    const recorder = staffAt("store_manager", restaurantId, storeManagerId);
    const recorded = await recordStockCount(testDb, recorder, {
      locationId: restaurantId,
      lines: [{ itemType: "product", itemId: sodaId, countedQuantity: 37 }],
    });
    if (!recorded.ok) throw new Error("setup failed");

    const ownerRequester = staffAt("owner", restaurantId, ownerId);

    await correctStockCount(testDb, ownerRequester, {
      stockCountId: recorded.count.id,
      lineId: recorded.count.lines[0].id,
      correctedQuantity: 37,
    });

    const result = await correctStockCount(testDb, ownerRequester, {
      stockCountId: recorded.count.id,
      lineId: recorded.count.lines[0].id,
      correctedQuantity: 37,
    });

    expect(result).toEqual({ ok: false, reason: "already_corrected" });
  });

  test("does not write a movement or mark corrected when the delta is zero", async () => {
    const recorder = staffAt("store_manager", restaurantId, storeManagerId);
    const recorded = await recordStockCount(testDb, recorder, {
      locationId: restaurantId,
      lines: [{ itemType: "product", itemId: sodaId, countedQuantity: 0 }],
    });
    if (!recorded.ok) throw new Error("setup failed");

    const ownerRequester = staffAt("owner", restaurantId, ownerId);
    const result = await correctStockCount(testDb, ownerRequester, {
      stockCountId: recorded.count.id,
      lineId: recorded.count.lines[0].id,
      correctedQuantity: 0,
    });

    expect(result).toEqual({ ok: true });

    const movements = await testDb.stockMovement.findMany({
      where: { productId: sodaId, locationId: restaurantId, reason: "corrected" },
    });
    expect(movements).toHaveLength(0);
  });
});
