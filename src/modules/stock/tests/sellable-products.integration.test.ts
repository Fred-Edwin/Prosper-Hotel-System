import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { hashPin } from "@/modules/people";
import type { AuthenticatedStaff } from "@/modules/people";
import { getSellableProductsAtLocation } from "../logic";
import { testDb } from "@/shared/test-db";

let restaurantId: string;
let canteenId: string;
let staffId: string;
let ownProductId: string;
let transferredInProductId: string;
let neitherProductId: string;

function staffAt(locationId: string): AuthenticatedStaff {
  return {
    staff: {
      id: staffId,
      name: "Test Cashier",
      phone: "+254700111335",
      role: "cashier",
      locationId,
      dailyRateMinor: 0,
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
      name: "Sellable Test Cashier",
      phone: "+254700111335",
      pinHash: await hashPin("1234"),
      role: "cashier",
      locationId: canteen.id,
      dailyRateMinor: 550,
    },
  });
  staffId = staff.id;

  // Home location is the canteen, but it has never moved there — this is
  // the literal BUG-14 repro when queried at the restaurant.
  const ownProduct = await testDb.product.create({
    data: { name: "Own Canteen Product", kind: "goods", locationId: canteen.id },
  });
  ownProductId = ownProduct.id;

  // Home location is the restaurant, but it was transferred to the canteen
  // and the transfer is reflected in the ledger (the current transfer
  // model writes both legs atomically — there is no separate "confirmed"
  // step in the schema yet, see docs/architecture.md's transfer model).
  const transferredInProduct = await testDb.product.create({
    data: { name: "Transferred Product", kind: "goods", locationId: restaurantId },
  });
  transferredInProductId = transferredInProduct.id;

  // Home location is the restaurant, and it has never moved to the canteen
  // at all — must never appear at the canteen.
  const neitherProduct = await testDb.product.create({
    data: { name: "Restaurant Only Product", kind: "goods", locationId: restaurantId },
  });
  neitherProductId = neitherProduct.id;

  await testDb.stockMovement.createMany({
    data: [
      // ownProduct: never moved anywhere — sellable at the canteen purely
      // because its home location is the canteen.
      // transferredInProduct: transferred restaurant -> canteen.
      {
        productId: transferredInProductId,
        locationId: restaurantId,
        quantity: -5,
        reason: "transferred",
        staffMemberId: staffId,
      },
      {
        productId: transferredInProductId,
        locationId: canteenId,
        quantity: 5,
        reason: "transferred",
        staffMemberId: staffId,
      },
      // neitherProduct: only ever moved at its home location, restaurant.
      {
        productId: neitherProductId,
        locationId: restaurantId,
        quantity: 10,
        reason: "received",
        staffMemberId: staffId,
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

describe("getSellableProductsAtLocation", () => {
  test("includes a product whose home location is here, even with no movement history", async () => {
    const result = await getSellableProductsAtLocation(testDb, staffAt(canteenId), canteenId);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const ids = result.products.map((p) => p.id);
    expect(ids).toContain(ownProductId);
  });

  test("includes a product transferred in and reflected in the ledger, even though home location differs", async () => {
    const result = await getSellableProductsAtLocation(testDb, staffAt(canteenId), canteenId);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const ids = result.products.map((p) => p.id);
    expect(ids).toContain(transferredInProductId);
  });

  test("excludes a product with no home-location match and no stock history here (BUG-14)", async () => {
    const result = await getSellableProductsAtLocation(testDb, staffAt(canteenId), canteenId);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const ids = result.products.map((p) => p.id);
    expect(ids).not.toContain(neitherProductId);
  });

  test("a product whose home location is elsewhere and has no stock here at all is excluded from that other location too", async () => {
    const result = await getSellableProductsAtLocation(testDb, staffAt(restaurantId), restaurantId);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const ids = result.products.map((p) => p.id);
    // ownProduct's home is canteen and it never moved to the restaurant.
    expect(ids).not.toContain(ownProductId);
    // neitherProduct's home is the restaurant and it has movements there.
    expect(ids).toContain(neitherProductId);
    // transferredInProduct's home is the restaurant, and it still has
    // positive stock there too (only 5 of an unspecified starting amount
    // left the restaurant) — home-location match alone is enough regardless.
    expect(ids).toContain(transferredInProductId);
  });
});
