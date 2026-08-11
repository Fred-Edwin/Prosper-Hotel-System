import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { hashPin } from "@/modules/people";
import type { AuthenticatedStaff } from "@/modules/people";
import { findReceipt, listReceiptsAtLocation, recordIngredientReceipt } from "../logic";
import { testDb } from "@/shared/test-db";

let restaurantId: string;
let flourId: string;
let sodaId: string;
let storeManagerId: string;

function staffAt(
  role: "owner" | "store_manager" | "attendant" | "cashier",
  locationId: string,
  staffId: string = storeManagerId,
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
  await testDb.ingredientMovement.deleteMany({});
  await testDb.stockMovement.deleteMany({});
  await testDb.ingredient.deleteMany({});
  await testDb.product.deleteMany({});
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

  const flour = await testDb.ingredient.create({
    data: { name: "Flour", unitOfMeasure: "kg" },
  });
  flourId = flour.id;

  const soda = await testDb.product.create({
    data: { name: "Soda (500ml)", kind: "goods" },
  });
  sodaId = soda.id;
});

afterAll(async () => {
  await testDb.ingredientMovement.deleteMany({});
  await testDb.stockMovement.deleteMany({});
  await testDb.ingredient.deleteMany({});
  await testDb.product.deleteMany({});
  await testDb.staffMember.deleteMany({});
  await testDb.location.deleteMany({});
  await testDb.$disconnect();
});

describe("recordIngredientReceipt", () => {
  test("records a received movement per line and updates the ingredient's last known cost", async () => {
    const requester = staffAt("store_manager", restaurantId, storeManagerId);

    const result = await recordIngredientReceipt(testDb, requester, {
      locationId: restaurantId,
      lines: [{ itemType: "ingredient", itemId: flourId, quantity: 50, unitCostMinor: 8000 }],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.movements).toEqual([
      expect.objectContaining({
        ingredientId: flourId,
        locationId: restaurantId,
        quantity: 50,
        reason: "received",
        unitCostMinor: 8000,
      }),
    ]);

    const ingredient = await testDb.ingredient.findUnique({ where: { id: flourId } });
    expect(ingredient?.lastKnownCostMinor).toBe(8000);
  });

  test("denies a staff member recording at a location they can't access", async () => {
    const canteen = await testDb.location.create({
      data: { code: "canteen", name: "Test Canteen" },
    });
    const requester = staffAt("store_manager", restaurantId, storeManagerId);

    const result = await recordIngredientReceipt(testDb, requester, {
      locationId: canteen.id,
      lines: [{ itemType: "ingredient", itemId: flourId, quantity: 50, unitCostMinor: 8000 }],
    });

    expect(result).toEqual({ ok: false, reason: "forbidden" });
  });

  test("denies a cashier from recording a receipt", async () => {
    const cashier = await testDb.staffMember.create({
      data: {
        name: "Test Cashier",
        phone: "+254700111446",
        pinHash: await hashPin("1234"),
        role: "cashier",
        locationId: restaurantId,
        dailyRateMinor: 550,
      },
    });
    const requester = staffAt("cashier", restaurantId, cashier.id);

    const result = await recordIngredientReceipt(testDb, requester, {
      locationId: restaurantId,
      lines: [{ itemType: "ingredient", itemId: flourId, quantity: 50, unitCostMinor: 8000 }],
    });

    expect(result).toEqual({ ok: false, reason: "forbidden" });
  });

  test("allows an attendant to record a receipt at their own location", async () => {
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
    const requester = staffAt("attendant", canteen.id, attendant.id);

    const result = await recordIngredientReceipt(testDb, requester, {
      locationId: canteen.id,
      lines: [{ itemType: "ingredient", itemId: flourId, quantity: 10, unitCostMinor: 8500 }],
    });

    expect(result.ok).toBe(true);
  });

  test("rejects a non-positive quantity", async () => {
    const requester = staffAt("store_manager", restaurantId, storeManagerId);

    const result = await recordIngredientReceipt(testDb, requester, {
      locationId: restaurantId,
      lines: [{ itemType: "ingredient", itemId: flourId, quantity: 0, unitCostMinor: 8000 }],
    });

    expect(result).toEqual({ ok: false, reason: "invalid_quantity" });
  });

  test("rejects a negative price", async () => {
    const requester = staffAt("store_manager", restaurantId, storeManagerId);

    const result = await recordIngredientReceipt(testDb, requester, {
      locationId: restaurantId,
      lines: [{ itemType: "ingredient", itemId: flourId, quantity: 50, unitCostMinor: -1 }],
    });

    expect(result).toEqual({ ok: false, reason: "invalid_cost" });
  });

  test("rejects a line for an inactive ingredient", async () => {
    const inactive = await testDb.ingredient.create({
      data: { name: "Discontinued spice", unitOfMeasure: "kg", active: false },
    });
    const requester = staffAt("store_manager", restaurantId, storeManagerId);

    const result = await recordIngredientReceipt(testDb, requester, {
      locationId: restaurantId,
      lines: [{ itemType: "ingredient", itemId: inactive.id, quantity: 50, unitCostMinor: 8000 }],
    });

    expect(result).toEqual({ ok: false, reason: "inactive_ingredient" });
  });

  // Ticket 22: a canteen supplier drop-off may include both ingredients
  // (e.g. printer paper) and products (e.g. airtime scratch cards) in one
  // visit — both families share one receipt id.
  test("accepts a product-only delivery, writing a received StockMovement and updating the product's last known cost", async () => {
    const requester = staffAt("store_manager", restaurantId, storeManagerId);

    const result = await recordIngredientReceipt(testDb, requester, {
      locationId: restaurantId,
      lines: [{ itemType: "product", itemId: sodaId, quantity: 24, unitCostMinor: 5000 }],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.movements).toEqual([
      expect.objectContaining({
        productId: sodaId,
        locationId: restaurantId,
        quantity: 24,
        reason: "received",
      }),
    ]);

    const product = await testDb.product.findUnique({ where: { id: sodaId } });
    expect(product?.lastKnownCostMinor).toBe(5000);
  });

  test("accepts a mixed delivery of product and ingredient lines sharing one receipt id", async () => {
    const requester = staffAt("store_manager", restaurantId, storeManagerId);

    const result = await recordIngredientReceipt(testDb, requester, {
      locationId: restaurantId,
      lines: [
        { itemType: "ingredient", itemId: flourId, quantity: 50, unitCostMinor: 8000 },
        { itemType: "product", itemId: sodaId, quantity: 24, unitCostMinor: 5000 },
      ],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.movements).toHaveLength(2);

    const receiptIds = new Set(
      result.movements.map((m) => ("receiptId" in m ? m.receiptId : undefined)),
    );
    expect(receiptIds.size).toBe(1);
    expect([...receiptIds][0]).toBeTruthy();

    const ingredient = await testDb.ingredient.findUnique({ where: { id: flourId } });
    expect(ingredient?.lastKnownCostMinor).toBe(8000);
    const product = await testDb.product.findUnique({ where: { id: sodaId } });
    expect(product?.lastKnownCostMinor).toBe(5000);
  });

  test("the running average applies correctly to a product line given quantity already on hand", async () => {
    const requester = staffAt("store_manager", restaurantId, storeManagerId);

    // 10 on hand at 80 (via an initial receipt), then buy 20 at 95 -> 90.
    const first = await recordIngredientReceipt(testDb, requester, {
      locationId: restaurantId,
      lines: [{ itemType: "product", itemId: sodaId, quantity: 10, unitCostMinor: 8000 }],
    });
    expect(first.ok).toBe(true);

    const second = await recordIngredientReceipt(testDb, requester, {
      locationId: restaurantId,
      lines: [{ itemType: "product", itemId: sodaId, quantity: 20, unitCostMinor: 9500 }],
    });
    expect(second.ok).toBe(true);

    const product = await testDb.product.findUnique({ where: { id: sodaId } });
    expect(product?.lastKnownCostMinor).toBe(9000);
  });

  test("rejects a line for an inactive product", async () => {
    const inactive = await testDb.product.create({
      data: { name: "Discontinued snack", kind: "goods", active: false },
    });
    const requester = staffAt("store_manager", restaurantId, storeManagerId);

    const result = await recordIngredientReceipt(testDb, requester, {
      locationId: restaurantId,
      lines: [{ itemType: "product", itemId: inactive.id, quantity: 10, unitCostMinor: 5000 }],
    });

    expect(result).toEqual({ ok: false, reason: "inactive_ingredient" });
  });

  test("rejects the whole delivery when one line in a mixed delivery is invalid", async () => {
    const requester = staffAt("store_manager", restaurantId, storeManagerId);

    const result = await recordIngredientReceipt(testDb, requester, {
      locationId: restaurantId,
      lines: [
        { itemType: "ingredient", itemId: flourId, quantity: 50, unitCostMinor: 8000 },
        { itemType: "product", itemId: sodaId, quantity: -1, unitCostMinor: 5000 },
      ],
    });

    expect(result).toEqual({ ok: false, reason: "invalid_quantity" });

    // Nothing was written — the valid ingredient line was not recorded either.
    const ingredient = await testDb.ingredient.findUnique({ where: { id: flourId } });
    expect(ingredient?.lastKnownCostMinor).toBeNull();
  });
});

describe("receipts spanning product and ingredient lines", () => {
  test("listReceiptsAtLocation includes a product-only receipt", async () => {
    const requester = staffAt("store_manager", restaurantId, storeManagerId);
    await recordIngredientReceipt(testDb, requester, {
      locationId: restaurantId,
      lines: [{ itemType: "product", itemId: sodaId, quantity: 24, unitCostMinor: 5000 }],
    });

    const result = await listReceiptsAtLocation(testDb, requester, restaurantId);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.receipts).toHaveLength(1);
    expect(result.receipts[0]).toEqual(
      expect.objectContaining({ locationId: restaurantId, lineCount: 1, totalMinor: 24 * 5000 }),
    );
  });

  test("listReceiptsAtLocation totals a mixed receipt across both families", async () => {
    const requester = staffAt("store_manager", restaurantId, storeManagerId);
    await recordIngredientReceipt(testDb, requester, {
      locationId: restaurantId,
      lines: [
        { itemType: "ingredient", itemId: flourId, quantity: 50, unitCostMinor: 8000 },
        { itemType: "product", itemId: sodaId, quantity: 24, unitCostMinor: 5000 },
      ],
    });

    const result = await listReceiptsAtLocation(testDb, requester, restaurantId);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.receipts).toHaveLength(1);
    expect(result.receipts[0]).toEqual(
      expect.objectContaining({
        locationId: restaurantId,
        lineCount: 2,
        totalMinor: 50 * 8000 + 24 * 5000,
      }),
    );
  });

  test("findReceipt resolves a product-only receipt's location", async () => {
    const requester = staffAt("store_manager", restaurantId, storeManagerId);
    const result = await recordIngredientReceipt(testDb, requester, {
      locationId: restaurantId,
      lines: [{ itemType: "product", itemId: sodaId, quantity: 24, unitCostMinor: 5000 }],
    });
    if (!result.ok) throw new Error("expected receipt to succeed");
    const receiptId = "receiptId" in result.movements[0] ? result.movements[0].receiptId : undefined;
    expect(receiptId).toBeTruthy();

    const receipt = await findReceipt(testDb, receiptId as string);
    expect(receipt).toEqual({ receiptId, locationId: restaurantId });
  });
});
