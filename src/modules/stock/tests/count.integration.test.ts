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
  // recordStockCount now writes real Sale/SaleLine rows for canteen
  // count-derived sales (docs/scope.md's 2026-08-15 entry) — these must
  // be cleared before product/staffMember/location, which they reference
  // via RESTRICT foreign keys.
  await testDb.paymentLine.deleteMany({});
  await testDb.saleLine.deleteMany({});
  await testDb.sale.deleteMany({});
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
  await testDb.paymentLine.deleteMany({});
  await testDb.saleLine.deleteMany({});
  await testDb.sale.deleteMany({});
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
    // A restaurant count stays a blind independent check for a non-owner
    // submitter (docs/architecture.md) — expectedQuantity is not echoed
    // back in the confirmation, same filter getStockCount already applied
    // to the read path.
    expect(result.count.lines).toEqual([
      expect.objectContaining({
        itemType: "product",
        itemId: sodaId,
        countedQuantity: 37,
      }),
    ]);
    expect((result.count.lines[0] as { expectedQuantity?: number }).expectedQuantity).toBeUndefined();
  });

  test("owner submitting a restaurant count still sees expectedQuantity", async () => {
    await testDb.stockMovement.create({
      data: {
        productId: sodaId,
        locationId: restaurantId,
        quantity: 40,
        reason: "received",
        staffMemberId: storeManagerId,
      },
    });

    const requester = staffAt("owner", restaurantId, storeManagerId);

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

  test("a canteen attendant sees expectedQuantity in her own count's confirmation", async () => {
    const canteen = await testDb.location.create({
      data: { code: "canteen", name: "Test Canteen" },
    });
    const attendant = await testDb.staffMember.create({
      data: {
        name: "Test Attendant",
        phone: "+254700111447",
        pinHash: await hashPin("1234"),
        role: "attendant",
        locationId: canteen.id,
        dailyRateMinor: 600,
      },
    });
    await testDb.stockMovement.create({
      data: {
        productId: sodaId,
        locationId: canteen.id,
        quantity: 40,
        reason: "received",
        staffMemberId: attendant.id,
      },
    });
    const requester = staffAt("attendant", canteen.id, attendant.id);

    const result = await recordStockCount(testDb, requester, {
      locationId: canteen.id,
      lines: [{ itemType: "product", itemId: sodaId, countedQuantity: 33 }],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Unlike the restaurant, the canteen count is how the sold figure gets
    // produced — the attendant is shown what it implied, same detail the
    // owner gets, not filtered out the way a restaurant submitter's is.
    expect(result.count.lines).toEqual([
      expect.objectContaining({
        itemType: "product",
        itemId: sodaId,
        countedQuantity: 33,
        expectedQuantity: 40,
      }),
    ]);
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
    expect(
      correctionMovement && {
        ...correctionMovement,
        quantity: correctionMovement.quantity.toNumber(),
        costBasisMinor: correctionMovement.costBasisMinor?.toNumber() ?? null,
        sellingValueMinor: correctionMovement.sellingValueMinor?.toNumber() ?? null,
      },
    ).toEqual(
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
    expect(
      correctionMovement && {
        ...correctionMovement,
        quantity: correctionMovement.quantity.toNumber(),
        costBasisMinor: correctionMovement.costBasisMinor?.toNumber() ?? null,
        sellingValueMinor: correctionMovement.sellingValueMinor?.toNumber() ?? null,
      },
    ).toEqual(
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
    expect(
      correctionMovement && {
        ...correctionMovement,
        quantity: correctionMovement.quantity.toNumber(),
        costBasisMinor: correctionMovement.costBasisMinor?.toNumber() ?? null,
        sellingValueMinor: correctionMovement.sellingValueMinor?.toNumber() ?? null,
      },
    ).toEqual(
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
    expect(
      correctionMovement && {
        ...correctionMovement,
        quantity: correctionMovement.quantity.toNumber(),
        costBasisMinor: correctionMovement.costBasisMinor?.toNumber() ?? null,
        sellingValueMinor: correctionMovement.sellingValueMinor?.toNumber() ?? null,
      },
    ).toEqual(
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

// docs/scope.md's 2026-08-15 "Canteen: count-derived sales" entry — a
// canteen count now infers what sold rather than being a pure shrinkage
// check (that stays restaurant-only, see recordStockCount's tests above).
describe("recordStockCount — canteen count-derived sales", () => {
  let canteenId: string;
  let canteenSodaId: string;
  let attendantId: string;

  beforeEach(async () => {
    const canteen = await testDb.location.create({
      data: { code: "canteen", name: "Test Canteen" },
    });
    canteenId = canteen.id;

    const attendant = await testDb.staffMember.create({
      data: {
        name: "Test Attendant",
        phone: "+254700111447",
        pinHash: await hashPin("1234"),
        role: "attendant",
        locationId: canteen.id,
        dailyRateMinor: 600,
      },
    });
    attendantId = attendant.id;

    const canteenSoda = await testDb.product.create({
      data: { name: "Canteen Soda", kind: "goods", priceMinor: 100, locationId: canteenId },
    });
    canteenSodaId = canteenSoda.id;

    await testDb.stockMovement.create({
      data: {
        productId: canteenSodaId,
        locationId: canteenId,
        quantity: 40,
        reason: "received",
        staffMemberId: attendantId,
      },
    });
  });

  test("a shortfall writes a sold movement and a matching Sale with no payment lines", async () => {
    const requester = staffAt("attendant", canteenId, attendantId);

    const result = await recordStockCount(testDb, requester, {
      locationId: canteenId,
      lines: [{ itemType: "product", itemId: canteenSodaId, countedQuantity: 33 }],
    });

    expect(result.ok).toBe(true);

    const soldMovements = await testDb.stockMovement.findMany({
      where: { productId: canteenSodaId, locationId: canteenId, reason: "sold" },
    });
    expect(soldMovements).toHaveLength(1);
    expect(soldMovements[0].quantity.toNumber()).toBe(-7);
    expect(soldMovements[0].sellingValueMinor?.toNumber()).toBe(700);

    const sales = await testDb.sale.findMany({
      where: { locationId: canteenId },
      include: { lines: true, paymentLines: true },
    });
    expect(sales).toHaveLength(1);
    expect(sales[0].totalMinor.toNumber()).toBe(700);
    expect(sales[0].paymentLines).toHaveLength(0);
    expect(sales[0].lines).toEqual([
      expect.objectContaining({ productId: canteenSodaId, quantity: expect.anything() }),
    ]);
    expect(sales[0].lines[0].quantity.toNumber()).toBe(7);
  });

  test("the sold movement and Sale are dated to the count's occurredAt, not now", async () => {
    const requester = staffAt("attendant", canteenId, attendantId);

    const result = await recordStockCount(testDb, requester, {
      locationId: canteenId,
      lines: [{ itemType: "product", itemId: canteenSodaId, countedQuantity: 30 }],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const soldMovement = await testDb.stockMovement.findFirst({
      where: { productId: canteenSodaId, locationId: canteenId, reason: "sold" },
    });
    const sale = await testDb.sale.findFirst({ where: { locationId: canteenId } });

    expect(soldMovement?.occurredAt.getTime()).toBe(result.count.occurredAt.getTime());
    expect(sale?.occurredAt.getTime()).toBe(result.count.occurredAt.getTime());
  });

  test("no shortfall (surplus or exact match) writes no sold movement and no Sale", async () => {
    const requester = staffAt("attendant", canteenId, attendantId);

    const result = await recordStockCount(testDb, requester, {
      locationId: canteenId,
      lines: [{ itemType: "product", itemId: canteenSodaId, countedQuantity: 45 }],
    });
    expect(result.ok).toBe(true);

    const soldMovements = await testDb.stockMovement.findMany({
      where: { productId: canteenSodaId, locationId: canteenId, reason: "sold" },
    });
    expect(soldMovements).toHaveLength(0);

    const sales = await testDb.sale.findMany({ where: { locationId: canteenId } });
    expect(sales).toHaveLength(0);
  });

  test("an ingredient line at the canteen is unaffected — no product, no sale inference", async () => {
    const ingredient = await testDb.ingredient.create({
      data: { name: "Cups", unitOfMeasure: "unit", lastKnownCostMinor: 500 },
    });
    await testDb.ingredientMovement.create({
      data: {
        ingredientId: ingredient.id,
        locationId: canteenId,
        quantity: 20,
        reason: "received",
        staffMemberId: attendantId,
      },
    });

    const requester = staffAt("attendant", canteenId, attendantId);
    const result = await recordStockCount(testDb, requester, {
      locationId: canteenId,
      lines: [{ itemType: "ingredient", itemId: ingredient.id, countedQuantity: 15 }],
    });
    expect(result.ok).toBe(true);

    const sales = await testDb.sale.findMany({ where: { locationId: canteenId } });
    expect(sales).toHaveLength(0);
  });

  test("multiple shortfall lines in one count produce one Sale with multiple lines", async () => {
    const chips = await testDb.product.create({
      data: { name: "Canteen Chips", kind: "goods", priceMinor: 50, locationId: canteenId },
    });
    await testDb.stockMovement.create({
      data: {
        productId: chips.id,
        locationId: canteenId,
        quantity: 20,
        reason: "received",
        staffMemberId: attendantId,
      },
    });

    const requester = staffAt("attendant", canteenId, attendantId);
    const result = await recordStockCount(testDb, requester, {
      locationId: canteenId,
      lines: [
        { itemType: "product", itemId: canteenSodaId, countedQuantity: 33 },
        { itemType: "product", itemId: chips.id, countedQuantity: 18 },
      ],
    });
    expect(result.ok).toBe(true);

    const sales = await testDb.sale.findMany({
      where: { locationId: canteenId },
      include: { lines: true },
    });
    expect(sales).toHaveLength(1);
    expect(sales[0].lines).toHaveLength(2);
    // 7 sodas at 100 + 2 chips at 50 = 800
    expect(sales[0].totalMinor.toNumber()).toBe(800);
  });
});

describe("correctStockCount — canteen count-derived sale already booked", () => {
  let canteenId: string;
  let canteenSodaId: string;
  let attendantId: string;
  let canteenOwnerId: string;

  beforeEach(async () => {
    const canteen = await testDb.location.create({
      data: { code: "canteen", name: "Test Canteen" },
    });
    canteenId = canteen.id;

    const attendant = await testDb.staffMember.create({
      data: {
        name: "Test Attendant",
        phone: "+254700111449",
        pinHash: await hashPin("1234"),
        role: "attendant",
        locationId: canteen.id,
        dailyRateMinor: 600,
      },
    });
    attendantId = attendant.id;

    const canteenOwner = await testDb.staffMember.create({
      data: {
        name: "Test Owner (canteen count corrections)",
        phone: "+254700111450",
        pinHash: await hashPin("1234"),
        role: "owner",
        locationId: canteen.id,
        dailyRateMinor: 0,
      },
    });
    canteenOwnerId = canteenOwner.id;

    const canteenSoda = await testDb.product.create({
      data: { name: "Canteen Soda", kind: "goods", priceMinor: 100, locationId: canteenId },
    });
    canteenSodaId = canteenSoda.id;

    await testDb.stockMovement.create({
      data: {
        productId: canteenSodaId,
        locationId: canteenId,
        quantity: 40,
        reason: "received",
        staffMemberId: attendantId,
      },
    });
  });

  test("correcting to the same figure the attendant counted writes no further movement", async () => {
    // expected 40, counted 33 -> recordStockCount already wrote sold -7,
    // stock now at 33. The owner re-examines and agrees 33 was right.
    const requester = staffAt("attendant", canteenId, attendantId);
    const recorded = await recordStockCount(testDb, requester, {
      locationId: canteenId,
      lines: [{ itemType: "product", itemId: canteenSodaId, countedQuantity: 33 }],
    });
    if (!recorded.ok) throw new Error("setup failed");

    const ownerRequester = staffAt("owner", canteenId, canteenOwnerId);
    const result = await correctStockCount(testDb, ownerRequester, {
      stockCountId: recorded.count.id,
      lineId: recorded.count.lines[0].id,
      correctedQuantity: 33,
    });
    expect(result).toEqual({ ok: true });

    const correctionMovements = await testDb.stockMovement.findMany({
      where: { productId: canteenSodaId, locationId: canteenId, reason: "corrected" },
    });
    expect(correctionMovements).toHaveLength(0);

    const movements = await testDb.stockMovement.findMany({
      where: { productId: canteenSodaId, locationId: canteenId },
    });
    const quantityOnHand = movements.reduce((sum, m) => sum + m.quantity.toNumber(), 0);
    expect(quantityOnHand).toBe(33);
  });

  test("correcting against the already-counted figure, not the stale expected figure, avoids double-counting the shrinkage", async () => {
    // expected 40, counted 33 -> sold -7 written, stock at 33. Owner later
    // finds the true count should have been 30 (attendant misread the
    // shelf). The correction must move stock from 33 -> 30 (delta -3), not
    // from the stale expected 40 -> 30 (which would double the -7 already
    // booked as a sale).
    const requester = staffAt("attendant", canteenId, attendantId);
    const recorded = await recordStockCount(testDb, requester, {
      locationId: canteenId,
      lines: [{ itemType: "product", itemId: canteenSodaId, countedQuantity: 33 }],
    });
    if (!recorded.ok) throw new Error("setup failed");

    const ownerRequester = staffAt("owner", canteenId, canteenOwnerId);
    const result = await correctStockCount(testDb, ownerRequester, {
      stockCountId: recorded.count.id,
      lineId: recorded.count.lines[0].id,
      correctedQuantity: 30,
    });
    expect(result).toEqual({ ok: true });

    const correctionMovements = await testDb.stockMovement.findMany({
      where: { productId: canteenSodaId, locationId: canteenId, reason: "corrected" },
    });
    expect(correctionMovements).toHaveLength(1);
    expect(correctionMovements[0].quantity.toNumber()).toBe(-3);

    const movements = await testDb.stockMovement.findMany({
      where: { productId: canteenSodaId, locationId: canteenId },
    });
    const quantityOnHand = movements.reduce((sum, m) => sum + m.quantity.toNumber(), 0);
    expect(quantityOnHand).toBe(30);
  });

  test("a canteen count with no shortfall (nothing sold) still corrects against expected as normal", async () => {
    // expected 40, counted 42 (surplus) -> no sold movement written.
    // countedQuantity (42) and expectedQuantity (40) both make sense as a
    // base here since nothing was already booked as a sale; the
    // canteen-specific deltaBase only matters when a shortfall occurred.
    const requester = staffAt("attendant", canteenId, attendantId);
    const recorded = await recordStockCount(testDb, requester, {
      locationId: canteenId,
      lines: [{ itemType: "product", itemId: canteenSodaId, countedQuantity: 42 }],
    });
    if (!recorded.ok) throw new Error("setup failed");

    const ownerRequester = staffAt("owner", canteenId, canteenOwnerId);
    const result = await correctStockCount(testDb, ownerRequester, {
      stockCountId: recorded.count.id,
      lineId: recorded.count.lines[0].id,
      correctedQuantity: 45,
    });
    expect(result).toEqual({ ok: true });

    const movements = await testDb.stockMovement.findMany({
      where: { productId: canteenSodaId, locationId: canteenId },
    });
    const quantityOnHand = movements.reduce((sum, m) => sum + m.quantity.toNumber(), 0);
    expect(quantityOnHand).toBe(45);
  });
});
