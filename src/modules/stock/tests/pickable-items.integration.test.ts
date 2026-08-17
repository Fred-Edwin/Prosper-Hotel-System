import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { hashPin } from "@/modules/people";
import type { AuthenticatedStaff } from "@/modules/people";
import type { StaffRole } from "@/generated/prisma/client";
import { getPickableItemsAtLocation, getTransferableItems } from "../logic";
import { testDb } from "@/shared/test-db";

/**
 * The blind-picking fix: Receiving, Issue to Kitchen and Wastage all showed
 * an item picker with no quantity on it, because they read the catalogue
 * (what exists) rather than the movement ledger (how much is here).
 *
 * getPickableItemsAtLocation is the shared reader. It generalises
 * getTransferableItems along the two axes those screens differ on:
 *
 *   - `includeZeroStock` — Transfer filters to > 0 (you cannot transfer what
 *     you do not hold), but Receiving must show a zero-stock item (being out
 *     of it is the reason to receive it) and Issue/Wastage must show the zero
 *     rather than drop the row, so staff see it instead of wondering where
 *     the item went.
 *   - `permit` — each screen's read must match its own write-time rule, so a
 *     picker never offers an item the user could not then act on. Transfer
 *     bars cashiers, receiving allows attendants, issuing does not.
 *
 * Transfer's own behaviour must not change: it had no direct test coverage
 * before this file, so the two delegation tests at the bottom pin it.
 */

let restaurantId: string;
let canteenId: string;
let ownerId: string;
let storeManagerId: string;
let cashierId: string;

let stockedProductId: string;
let zeroStockProductId: string;
let inactiveProductId: string;
let stockedIngredientId: string;
let zeroStockIngredientId: string;

function staffAt(
  staffId: string,
  role: StaffRole,
  locationId: string,
): AuthenticatedStaff {
  return {
    staff: {
      id: staffId,
      name: `Test ${role}`,
      phone: "+254700111400",
      role,
      locationId,
      dailyRateMinor: 0,
      active: true,
    },
    location: { id: locationId, code: "restaurant", name: "Test" },
  };
}

beforeAll(async () => {
  const restaurant = await testDb.location.create({
    data: { code: "restaurant", name: "Pickable Test Restaurant" },
  });
  const canteen = await testDb.location.create({
    data: { code: "canteen", name: "Pickable Test Canteen" },
  });
  restaurantId = restaurant.id;
  canteenId = canteen.id;

  const owner = await testDb.staffMember.create({
    data: {
      name: "Pickable Test Owner",
      phone: "+254700111400",
      pinHash: await hashPin("1234"),
      role: "owner",
      locationId: restaurant.id,
      dailyRateMinor: 0,
    },
  });
  ownerId = owner.id;

  const storeManager = await testDb.staffMember.create({
    data: {
      name: "Pickable Test Store Manager",
      phone: "+254700111401",
      pinHash: await hashPin("1234"),
      role: "store_manager",
      locationId: restaurant.id,
      dailyRateMinor: 0,
    },
  });
  storeManagerId = storeManager.id;

  const cashier = await testDb.staffMember.create({
    data: {
      name: "Pickable Test Cashier",
      phone: "+254700111402",
      pinHash: await hashPin("1234"),
      role: "cashier",
      locationId: restaurant.id,
      dailyRateMinor: 0,
    },
  });
  cashierId = cashier.id;

  const stockedProduct = await testDb.product.create({
    data: { name: "Pickable Stocked Product", kind: "goods", locationId: restaurant.id },
  });
  stockedProductId = stockedProduct.id;

  // Received then fully consumed: net zero on hand, but it has real history,
  // so it is the exact case Transfer must drop and the other three must keep.
  const zeroStockProduct = await testDb.product.create({
    data: { name: "Pickable Zero Product", kind: "goods", locationId: restaurant.id },
  });
  zeroStockProductId = zeroStockProduct.id;

  const inactiveProduct = await testDb.product.create({
    data: {
      name: "Pickable Inactive Product",
      kind: "goods",
      locationId: restaurant.id,
      active: false,
    },
  });
  inactiveProductId = inactiveProduct.id;

  const stockedIngredient = await testDb.ingredient.create({
    data: { name: "Pickable Stocked Ingredient", unitOfMeasure: "kg" },
  });
  stockedIngredientId = stockedIngredient.id;

  const zeroStockIngredient = await testDb.ingredient.create({
    data: { name: "Pickable Zero Ingredient", unitOfMeasure: "litres" },
  });
  zeroStockIngredientId = zeroStockIngredient.id;

  await testDb.stockMovement.createMany({
    data: [
      {
        productId: stockedProductId,
        locationId: restaurantId,
        quantity: 12,
        reason: "received",
        staffMemberId: ownerId,
      },
      {
        productId: zeroStockProductId,
        locationId: restaurantId,
        quantity: 4,
        reason: "received",
        staffMemberId: ownerId,
      },
      {
        productId: zeroStockProductId,
        locationId: restaurantId,
        quantity: -4,
        reason: "sold",
        staffMemberId: ownerId,
      },
      {
        productId: inactiveProductId,
        locationId: restaurantId,
        quantity: 7,
        reason: "received",
        staffMemberId: ownerId,
      },
    ],
  });

  await testDb.ingredientMovement.createMany({
    data: [
      {
        ingredientId: stockedIngredientId,
        locationId: restaurantId,
        // Fractional: the till only ever dealt in whole units, so decimals
        // are new ground for a picker and must survive the round-trip.
        quantity: 2.5,
        reason: "received",
        staffMemberId: ownerId,
      },
      {
        ingredientId: zeroStockIngredientId,
        locationId: restaurantId,
        quantity: 3,
        reason: "received",
        staffMemberId: ownerId,
      },
      {
        ingredientId: zeroStockIngredientId,
        locationId: restaurantId,
        quantity: -3,
        reason: "issued",
        staffMemberId: ownerId,
      },
    ],
  });
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

describe("getPickableItemsAtLocation — quantities", () => {
  test("carries the ledger quantity for products and ingredients", async () => {
    const result = await getPickableItemsAtLocation(
      testDb,
      staffAt(ownerId, "owner", restaurantId),
      restaurantId,
      { includeZeroStock: true },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const product = result.items.find((i) => i.itemId === stockedProductId);
    expect(product?.quantityOnHand).toBe(12);

    const ingredient = result.items.find((i) => i.itemId === stockedIngredientId);
    expect(ingredient?.quantityOnHand).toBe(2.5);
  });

  test("carries each item's unit, so a fractional ingredient reads in its own unit of measure", async () => {
    const result = await getPickableItemsAtLocation(
      testDb,
      staffAt(ownerId, "owner", restaurantId),
      restaurantId,
      { includeZeroStock: true },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.items.find((i) => i.itemId === stockedIngredientId)?.unit).toBe("kg");
    expect(result.items.find((i) => i.itemId === zeroStockIngredientId)?.unit).toBe("litres");
    expect(result.items.find((i) => i.itemId === stockedProductId)?.unit).toBe("units");
  });
});

describe("getPickableItemsAtLocation — includeZeroStock", () => {
  test("includes zero-stock items when asked, reporting them as 0 rather than omitting them", async () => {
    const result = await getPickableItemsAtLocation(
      testDb,
      staffAt(ownerId, "owner", restaurantId),
      restaurantId,
      { includeZeroStock: true },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.items.find((i) => i.itemId === zeroStockProductId)?.quantityOnHand).toBe(0);
    expect(result.items.find((i) => i.itemId === zeroStockIngredientId)?.quantityOnHand).toBe(0);
  });

  test("omits zero-stock items when not asked", async () => {
    const result = await getPickableItemsAtLocation(
      testDb,
      staffAt(ownerId, "owner", restaurantId),
      restaurantId,
      { includeZeroStock: false },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const ids = result.items.map((i) => i.itemId);
    expect(ids).not.toContain(zeroStockProductId);
    expect(ids).not.toContain(zeroStockIngredientId);
    expect(ids).toContain(stockedProductId);
  });

  test("never includes an inactive item, even with stock on hand", async () => {
    const result = await getPickableItemsAtLocation(
      testDb,
      staffAt(ownerId, "owner", restaurantId),
      restaurantId,
      { includeZeroStock: true },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.items.map((i) => i.itemId)).not.toContain(inactiveProductId);
  });
});

describe("getPickableItemsAtLocation — permissions", () => {
  test("refuses a location the requester cannot access", async () => {
    const result = await getPickableItemsAtLocation(
      testDb,
      staffAt(storeManagerId, "store_manager", restaurantId),
      canteenId,
      { includeZeroStock: true },
    );

    expect(result).toEqual({ ok: false, reason: "forbidden" });
  });

  test("applies the caller's own role rule, so a picker never offers what its write would refuse", async () => {
    // Issuing is owner/store_manager only — a cashier must be refused the
    // read as well, matching recordIngredientIssue's canIssue gate.
    const refused = await getPickableItemsAtLocation(
      testDb,
      staffAt(cashierId, "cashier", restaurantId),
      restaurantId,
      { includeZeroStock: true, permit: (role) => role === "owner" || role === "store_manager" },
    );
    expect(refused).toEqual({ ok: false, reason: "forbidden" });

    const allowed = await getPickableItemsAtLocation(
      testDb,
      staffAt(storeManagerId, "store_manager", restaurantId),
      restaurantId,
      { includeZeroStock: true, permit: (role) => role === "owner" || role === "store_manager" },
    );
    expect(allowed.ok).toBe(true);
  });

  test("permits every accessing role when no role rule is given", async () => {
    const result = await getPickableItemsAtLocation(
      testDb,
      staffAt(cashierId, "cashier", restaurantId),
      restaurantId,
      { includeZeroStock: true },
    );

    expect(result.ok).toBe(true);
  });
});

describe("getTransferableItems — unchanged by the shared reader", () => {
  test("still omits zero-stock items", async () => {
    const result = await getTransferableItems(
      testDb,
      staffAt(storeManagerId, "store_manager", restaurantId),
      restaurantId,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const ids = result.items.map((i) => i.itemId);
    expect(ids).toContain(stockedProductId);
    expect(ids).toContain(stockedIngredientId);
    expect(ids).not.toContain(zeroStockProductId);
    expect(ids).not.toContain(zeroStockIngredientId);
  });

  test("still refuses a cashier", async () => {
    const result = await getTransferableItems(
      testDb,
      staffAt(cashierId, "cashier", restaurantId),
      restaurantId,
    );

    expect(result).toEqual({ ok: false, reason: "forbidden" });
  });
});
