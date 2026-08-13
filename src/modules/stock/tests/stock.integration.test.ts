import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { hashPin } from "@/modules/people";
import type { AuthenticatedStaff } from "@/modules/people";
import { getCurrentStockAtLocation, getCurrentStockAtLocationBySource } from "../logic";
import { testDb } from "@/shared/test-db";

let restaurantId: string;
let canteenId: string;
let productId: string;

function staffAt(
  role: "owner" | "cashier",
  locationId: string,
  locationCode: "restaurant" | "canteen" = "restaurant",
): AuthenticatedStaff {
  return {
    staff: {
      id: "staff-1",
      name: "Test Staff",
      phone: "+254700111333",
      role,
      locationId,
      dailyRateMinor: 0,
      active: true,
    },
    location: { id: locationId, code: locationCode, name: "Test" },
  };
}

beforeAll(async () => {
  const restaurant = await testDb.location.create({
    data: { code: "restaurant", name: "Test Restaurant" },
  });
  const canteen = await testDb.location.create({
    data: { code: "canteen", name: "Test Canteen" },
  });
  restaurantId = restaurant.id;
  canteenId = canteen.id;

  const staff = await testDb.staffMember.create({
    data: {
      name: "Test Cashier",
      phone: "+254700111334",
      pinHash: await hashPin("1234"),
      role: "cashier",
      locationId: restaurant.id,
      dailyRateMinor: 550,
    },
  });

  const product = await testDb.product.create({
    data: { name: "Sodas (500ml)", kind: "goods" },
  });
  productId = product.id;

  await testDb.stockMovement.createMany({
    data: [
      {
        productId,
        locationId: restaurant.id,
        quantity: 50,
        reason: "received",
        staffMemberId: staff.id,
      },
      {
        productId,
        locationId: restaurant.id,
        quantity: -8,
        reason: "sold",
        staffMemberId: staff.id,
      },
    ],
  });
});

afterAll(async () => {
  await testDb.stockMovement.deleteMany({});
  await testDb.product.deleteMany({});
  await testDb.staffMember.deleteMany({});
  await testDb.location.deleteMany({});
  await testDb.$disconnect();
});

describe("getCurrentStockAtLocation", () => {
  test("sums movements into current stock at a staff member's own location", async () => {
    const result = await getCurrentStockAtLocation(
      testDb,
      staffAt("cashier", restaurantId),
      restaurantId,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.levels).toEqual([
      { productId, productName: "Sodas (500ml)", quantityOnHand: 42 },
    ]);
  });

  test("denies a staff member access to the other location's stock", async () => {
    const result = await getCurrentStockAtLocation(
      testDb,
      staffAt("cashier", restaurantId),
      canteenId,
    );

    expect(result).toEqual({ ok: false, reason: "forbidden" });
  });

  test("the owner can access any location's stock", async () => {
    const result = await getCurrentStockAtLocation(
      testDb,
      staffAt("owner", restaurantId),
      canteenId,
    );

    expect(result.ok).toBe(true);
  });

  test("a location with no movements has no stock, not an error", async () => {
    const result = await getCurrentStockAtLocation(
      testDb,
      staffAt("owner", restaurantId),
      canteenId,
    );

    expect(result).toEqual({ ok: true, levels: [] });
  });

  test("the owner querying a nonexistent location gets not_found, not an empty list", async () => {
    const result = await getCurrentStockAtLocation(
      testDb,
      staffAt("owner", restaurantId),
      "does-not-exist",
    );

    expect(result).toEqual({ ok: false, reason: "not_found" });
  });
});

// 2026-08-13 canteen redesign, item 3 — canteen-owned vs restaurant-supplied,
// per docs/formulas.md: "a product received directly from a supplier is the
// canteen's own goods... a product that reached the canteen via a transfer
// from the restaurant is restaurant-supplied."
describe("getCurrentStockAtLocationBySource", () => {
  let transferredOnlyProductId: string;
  let bothSourcesProductId: string;

  beforeAll(async () => {
    const transferredOnlyProduct = await testDb.product.create({
      data: { name: "Chapati", kind: "cooked_food" },
    });
    transferredOnlyProductId = transferredOnlyProduct.id;

    const bothSourcesProduct = await testDb.product.create({
      data: { name: "Biscuits", kind: "goods" },
    });
    bothSourcesProductId = bothSourcesProduct.id;

    const staff = await testDb.staffMember.findFirstOrThrow({
      where: { locationId: restaurantId },
    });

    await testDb.stockMovement.createMany({
      data: [
        {
          productId: transferredOnlyProductId,
          locationId: canteenId,
          quantity: 20,
          reason: "transferred",
          staffMemberId: staff.id,
        },
        {
          productId: bothSourcesProductId,
          locationId: canteenId,
          quantity: 10,
          reason: "transferred",
          staffMemberId: staff.id,
        },
        {
          productId: bothSourcesProductId,
          locationId: canteenId,
          quantity: 15,
          reason: "received",
          staffMemberId: staff.id,
        },
      ],
    });
  });

  test("classifies a product only ever transferred-in as restaurant-supplied", async () => {
    const result = await getCurrentStockAtLocationBySource(
      testDb,
      staffAt("cashier", canteenId, "canteen"),
      canteenId,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const line = result.levels.find((l) => l.productId === transferredOnlyProductId);
    expect(line).toMatchObject({ source: "restaurant-supplied", quantityOnHand: 20 });
  });

  test("classifies a product ever received directly as own goods, even if also transferred-in", async () => {
    const result = await getCurrentStockAtLocationBySource(
      testDb,
      staffAt("cashier", canteenId, "canteen"),
      canteenId,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const line = result.levels.find((l) => l.productId === bothSourcesProductId);
    expect(line).toMatchObject({ source: "own", quantityOnHand: 25 });
  });

  test("denies a staff member access to the other location's stock", async () => {
    const result = await getCurrentStockAtLocationBySource(
      testDb,
      staffAt("cashier", restaurantId),
      canteenId,
    );

    expect(result).toEqual({ ok: false, reason: "forbidden" });
  });
});
