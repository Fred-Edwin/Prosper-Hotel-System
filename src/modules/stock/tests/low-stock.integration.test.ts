import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { hashPin } from "@/modules/people";
import type { AuthenticatedStaff } from "@/modules/people";
import { createIngredient, createProduct, updateIngredient, updateProduct } from "@/modules/catalogue";
import { getLowStockItems, recordStockCount } from "../logic";
import { testDb } from "@/shared/test-db";

let restaurantId: string;
let canteenId: string;
let ownerId: string;

function staffAt(role: "owner" | "cashier", locationId: string, locationCode: "restaurant" | "canteen"): AuthenticatedStaff {
  return {
    staff: {
      id: ownerId,
      name: "Test Staff",
      phone: "+254700111999",
      role,
      locationId,
      dailyRateMinor: 0,
      active: true,
    },
    location: { id: locationId, code: locationCode, name: "Test" },
  };
}

beforeEach(async () => {
  await testDb.stockCountLine.deleteMany({});
  await testDb.stockCount.deleteMany({});
  await testDb.stockMovement.deleteMany({});
  await testDb.ingredientMovement.deleteMany({});
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
      phone: "+254700111998",
      pinHash: await hashPin("1234"),
      role: "owner",
      locationId: restaurant.id,
      dailyRateMinor: 0,
    },
  });
  ownerId = owner.id;
});

afterAll(async () => {
  await testDb.stockCountLine.deleteMany({});
  await testDb.stockCount.deleteMany({});
  await testDb.stockMovement.deleteMany({});
  await testDb.ingredientMovement.deleteMany({});
  await testDb.product.deleteMany({});
  await testDb.ingredient.deleteMany({});
  await testDb.staffMember.deleteMany({});
  await testDb.location.deleteMany({});
  await testDb.$disconnect();
});

describe("getLowStockItems", () => {
  test("restaurant: a product at or below its threshold is low, above is not", async () => {
    const owner = staffAt("owner", restaurantId, "restaurant");

    const low = await createProduct(testDb, owner, { name: "Low soda", kind: "goods" });
    const high = await createProduct(testDb, owner, { name: "High soda", kind: "goods" });
    if (!low.ok || !high.ok) throw new Error("expected create to succeed");
    await updateProduct(testDb, owner, low.value.id, {
      name: "Low soda",
      kind: "goods",
      lowStockLevel: 10,
    });
    await updateProduct(testDb, owner, high.value.id, {
      name: "High soda",
      kind: "goods",
      lowStockLevel: 10,
    });

    await testDb.stockMovement.createMany({
      data: [
        { productId: low.value.id, locationId: restaurantId, quantity: 10, reason: "received", staffMemberId: ownerId },
        { productId: high.value.id, locationId: restaurantId, quantity: 50, reason: "received", staffMemberId: ownerId },
      ],
    });

    const result = await getLowStockItems(testDb, owner, restaurantId);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.items.map((i) => i.itemId)).toEqual([low.value.id]);
    expect(result.items[0]).toMatchObject({
      itemType: "product",
      itemId: low.value.id,
      quantityOnHand: 10,
      lowStockLevel: 10,
      asOf: null,
    });
  });

  test("restaurant: an ingredient at or below its threshold is low", async () => {
    const owner = staffAt("owner", restaurantId, "restaurant");

    const flour = await createIngredient(testDb, owner, { name: "Flour", unitOfMeasure: "kg" });
    if (!flour.ok) throw new Error("expected create to succeed");
    await updateIngredient(testDb, owner, flour.value.id, {
      name: "Flour",
      unitOfMeasure: "kg",
      lowStockLevel: 5,
    });

    await testDb.ingredientMovement.create({
      data: { ingredientId: flour.value.id, locationId: restaurantId, quantity: 5, reason: "received", staffMemberId: ownerId },
    });

    const result = await getLowStockItems(testDb, owner, restaurantId);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.items).toEqual([
      expect.objectContaining({ itemType: "ingredient", itemId: flour.value.id, quantityOnHand: 5, lowStockLevel: 5, asOf: null }),
    ]);
  });

  test("an item with no threshold set is never low, even at zero stock", async () => {
    const owner = staffAt("owner", restaurantId, "restaurant");

    const noThreshold = await createProduct(testDb, owner, { name: "No threshold", kind: "goods" });
    if (!noThreshold.ok) throw new Error("expected create to succeed");

    const result = await getLowStockItems(testDb, owner, restaurantId);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.items).toEqual([]);
  });

  test("canteen: compares against the quantity as at the most recent count, not live on-hand", async () => {
    const owner = staffAt("owner", canteenId, "canteen");

    const product = await createProduct(testDb, owner, { name: "Canteen soda", kind: "goods" });
    if (!product.ok) throw new Error("expected create to succeed");
    await updateProduct(testDb, owner, product.value.id, {
      name: "Canteen soda",
      kind: "goods",
      lowStockLevel: 10,
    });

    // Live movements would put this well above threshold...
    await testDb.stockMovement.create({
      data: { productId: product.value.id, locationId: canteenId, quantity: 100, reason: "received", staffMemberId: ownerId },
    });
    // ...but the most recent count recorded it low.
    const counted = await recordStockCount(testDb, owner, {
      locationId: canteenId,
      lines: [{ itemType: "product", itemId: product.value.id, countedQuantity: 8 }],
    });
    if (!counted.ok) throw new Error("expected count to succeed");

    const result = await getLowStockItems(testDb, owner, canteenId);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.items).toEqual([
      expect.objectContaining({
        itemType: "product",
        itemId: product.value.id,
        quantityOnHand: 8,
        lowStockLevel: 10,
        asOf: counted.count.occurredAt,
      }),
    ]);
  });

  test("canteen: an item with no count yet is excluded, not shown as low", async () => {
    const owner = staffAt("owner", canteenId, "canteen");

    const product = await createProduct(testDb, owner, { name: "Never counted", kind: "goods" });
    if (!product.ok) throw new Error("expected create to succeed");
    await updateProduct(testDb, owner, product.value.id, {
      name: "Never counted",
      kind: "goods",
      lowStockLevel: 10,
    });

    const result = await getLowStockItems(testDb, owner, canteenId);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.items).toEqual([]);
  });

  test("a non-owner or wrong-location staff member is denied, same as the existing stock read", async () => {
    const cashier: AuthenticatedStaff = {
      staff: {
        id: "cashier-1",
        name: "Cashier",
        phone: "+254700111997",
        role: "cashier",
        locationId: restaurantId,
        dailyRateMinor: 0,
        active: true,
      },
      location: { id: restaurantId, code: "restaurant", name: "Test" },
    };

    const result = await getLowStockItems(testDb, cashier, canteenId);

    expect(result).toEqual({ ok: false, reason: "forbidden" });
  });
});
