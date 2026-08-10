import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { hashPin } from "@/modules/people";
import type { AuthenticatedStaff } from "@/modules/people";
import { getCurrentStockAtLocation, recordTransfer, recordTransfers, reverseTransfer } from "../logic";
import { testDb } from "@/shared/test-db";

let restaurantId: string;
let canteenId: string;
let productId: string;
let ingredientId: string;
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
      phone: "+254700112001",
      role,
      locationId,
      dailyRateMinor: 0,
      active: true,
    },
    location: { id: locationId, code: "restaurant", name: "Test" },
  };
}

beforeEach(async () => {
  await testDb.stockMovement.deleteMany({});
  await testDb.ingredientMovement.deleteMany({});
  await testDb.product.deleteMany({});
  await testDb.ingredient.deleteMany({});
  await testDb.staffMember.deleteMany({});
  await testDb.location.deleteMany({});

  const [restaurant, canteen] = await Promise.all([
    testDb.location.create({ data: { code: "restaurant", name: "Test Restaurant" } }),
    testDb.location.create({ data: { code: "canteen", name: "Test Canteen" } }),
  ]);
  restaurantId = restaurant.id;
  canteenId = canteen.id;

  const manager = await testDb.staffMember.create({
    data: {
      name: "Test Store Manager",
      phone: "+254700112002",
      pinHash: await hashPin("1234"),
      role: "store_manager",
      locationId: restaurant.id,
      dailyRateMinor: 0,
    },
  });
  storeManagerId = manager.id;

  const [product, ingredient] = await Promise.all([
    testDb.product.create({ data: { name: "Sodas (500ml)", kind: "goods", priceMinor: 100 } }),
    testDb.ingredient.create({ data: { name: "Flour", unitOfMeasure: "kg" } }),
  ]);
  productId = product.id;
  ingredientId = ingredient.id;

  await testDb.stockMovement.create({
    data: {
      productId,
      locationId: restaurantId,
      quantity: 12,
      reason: "received",
      staffMemberId: storeManagerId,
    },
  });
  await testDb.ingredientMovement.createMany({
    data: [restaurantId, canteenId].map((locationId) => ({
      ingredientId,
      locationId,
      quantity: 9,
      reason: "received" as const,
      unitCostMinor: 8000,
      receiptId: `seed-receipt-${locationId}`,
      staffMemberId: storeManagerId,
    })),
  });
});

afterAll(async () => {
  await testDb.stockMovement.deleteMany({});
  await testDb.ingredientMovement.deleteMany({});
  await testDb.product.deleteMany({});
  await testDb.ingredient.deleteMany({});
  await testDb.staffMember.deleteMany({});
  await testDb.location.deleteMany({});
  await testDb.$disconnect();
});

describe("recordTransfer", () => {
  test("records all draft lines as one linked transfer event", async () => {
    const result = await recordTransfers(testDb, staffAt("store_manager", restaurantId), {
      fromLocationId: restaurantId,
      toLocationId: canteenId,
      lines: [
        { itemType: "product", itemId: productId, quantity: 4 },
        { itemType: "ingredient", itemId: ingredientId, quantity: 3 },
      ],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.movements).toHaveLength(4);
    expect(new Set(result.movements.map((movement) => movement.transferId)).size).toBe(1);
  });

  test("records linked outgoing and incoming product movements and updates both locations", async () => {
    const result = await recordTransfer(testDb, staffAt("store_manager", restaurantId), {
      fromLocationId: restaurantId,
      toLocationId: canteenId,
      itemType: "product",
      itemId: productId,
      quantity: 4,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.movements).toEqual([
      expect.objectContaining({
        productId,
        locationId: restaurantId,
        quantity: -4,
        reason: "transferred",
      }),
      expect.objectContaining({
        productId,
        locationId: canteenId,
        quantity: 4,
        reason: "transferred",
      }),
    ]);
    expect(result.movements[0].transferId).toBe(result.movements[1].transferId);

    const [restaurantStock, canteenStock] = await Promise.all([
      getCurrentStockAtLocation(testDb, staffAt("store_manager", restaurantId), restaurantId),
      getCurrentStockAtLocation(testDb, staffAt("owner", restaurantId), canteenId),
    ]);
    expect(restaurantStock).toMatchObject({ ok: true, levels: [{ productId, quantityOnHand: 8 }] });
    expect(canteenStock).toMatchObject({ ok: true, levels: [{ productId, quantityOnHand: 4 }] });
  });

  test("reverses a recorded transfer with a new linked movement pair", async () => {
    const transfer = await recordTransfer(testDb, staffAt("store_manager", restaurantId), { fromLocationId: restaurantId, toLocationId: canteenId, itemType: "product", itemId: productId, quantity: 4 });
    if (!transfer.ok) throw new Error("expected transfer");
    const reversed = await reverseTransfer(testDb, staffAt("store_manager", restaurantId), transfer.movements[0].transferId as string);
    expect(reversed.ok).toBe(true);
    const stock = await getCurrentStockAtLocation(testDb, staffAt("store_manager", restaurantId), restaurantId);
    expect(stock).toMatchObject({ ok: true, levels: [{ productId, quantityOnHand: 12 }] });
  });

  test("transfers an ingredient in the opposite direction", async () => {
    const attendant = await testDb.staffMember.create({
      data: {
        name: "Test Attendant",
        phone: "+254700112003",
        pinHash: await hashPin("1234"),
        role: "attendant",
        locationId: canteenId,
        dailyRateMinor: 0,
      },
    });

    const result = await recordTransfer(testDb, staffAt("attendant", canteenId, attendant.id), {
      fromLocationId: canteenId,
      toLocationId: restaurantId,
      itemType: "ingredient",
      itemId: ingredientId,
      quantity: 3,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.movements).toEqual([
      expect.objectContaining({ ingredientId, locationId: canteenId, quantity: -3, reason: "transferred" }),
      expect.objectContaining({ ingredientId, locationId: restaurantId, quantity: 3, reason: "transferred" }),
    ]);
    expect(result.movements[0].transferId).toBe(result.movements[1].transferId);
  });

  test.each([
    [0, "invalid_quantity"],
    [-1, "invalid_quantity"],
  ])("rejects a non-positive quantity", async (quantity, reason) => {
    await expect(
      recordTransfer(testDb, staffAt("store_manager", restaurantId), {
        fromLocationId: restaurantId,
        toLocationId: canteenId,
        itemType: "product",
        itemId: productId,
        quantity,
      }),
    ).resolves.toEqual({ ok: false, reason });
  });

  test("rejects transfers to the same location and stock the source does not hold", async () => {
    await expect(
      recordTransfer(testDb, staffAt("store_manager", restaurantId), {
        fromLocationId: restaurantId,
        toLocationId: restaurantId,
        itemType: "product",
        itemId: productId,
        quantity: 1,
      }),
    ).resolves.toEqual({ ok: false, reason: "same_location" });

    await expect(
      recordTransfer(testDb, staffAt("store_manager", restaurantId), {
        fromLocationId: restaurantId,
        toLocationId: canteenId,
        itemType: "product",
        itemId: productId,
        quantity: 13,
      }),
    ).resolves.toEqual({ ok: false, reason: "insufficient_stock" });
  });

  test("rejects inactive items and cashier transfers", async () => {
    await testDb.product.update({ where: { id: productId }, data: { active: false } });
    await expect(
      recordTransfer(testDb, staffAt("store_manager", restaurantId), {
        fromLocationId: restaurantId,
        toLocationId: canteenId,
        itemType: "product",
        itemId: productId,
        quantity: 1,
      }),
    ).resolves.toEqual({ ok: false, reason: "inactive_item" });

    await expect(
      recordTransfer(testDb, staffAt("cashier", restaurantId), {
        fromLocationId: restaurantId,
        toLocationId: canteenId,
        itemType: "ingredient",
        itemId: ingredientId,
        quantity: 1,
      }),
    ).resolves.toEqual({ ok: false, reason: "forbidden" });
  });
});
