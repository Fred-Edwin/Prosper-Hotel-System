import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { hashPin } from "@/modules/people";
import type { AuthenticatedStaff } from "@/modules/people";
import { getCurrentStockAtLocation } from "../logic";
import { testDb } from "@/shared/test-db";

let restaurantId: string;
let canteenId: string;
let productId: string;

function staffAt(role: "owner" | "cashier", locationId: string): AuthenticatedStaff {
  return {
    staff: {
      id: "staff-1",
      name: "Test Staff",
      phone: "+254700111333",
      role,
      locationId,
      active: true,
    },
    location: { id: locationId, code: "restaurant", name: "Test" },
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
});
