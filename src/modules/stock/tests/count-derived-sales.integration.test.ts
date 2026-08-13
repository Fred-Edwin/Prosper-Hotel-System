import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { hashPin } from "@/modules/people";
import type { AuthenticatedStaff } from "@/modules/people";
import { recordCounterSale } from "@/modules/sales";
import { getCurrentStockAtLocation, recordStockCount } from "../logic";
import { testDb } from "@/shared/test-db";

let canteenId: string;
let restaurantId: string;
let sodaId: string;
let attendantId: string;

function staffAt(
  role: "owner" | "store_manager" | "attendant" | "cashier",
  locationId: string,
  staffId: string = attendantId,
): AuthenticatedStaff {
  return {
    staff: {
      id: staffId,
      name: "Test Attendant",
      phone: "+254700113001",
      role,
      locationId,
      dailyRateMinor: 0,
      active: true,
    },
    location: { id: locationId, code: "canteen", name: "Test" },
  };
}

beforeEach(async () => {
  await testDb.paymentLine.deleteMany({});
  await testDb.saleLine.deleteMany({});
  await testDb.sale.deleteMany({});
  await testDb.stockCountLine.deleteMany({});
  await testDb.stockCount.deleteMany({});
  await testDb.stockMovement.deleteMany({});
  await testDb.ingredientMovement.deleteMany({});
  await testDb.product.deleteMany({});
  await testDb.staffMember.deleteMany({});
  await testDb.location.deleteMany({});

  const [canteen, restaurant] = await Promise.all([
    testDb.location.create({ data: { code: "canteen", name: "Test Canteen" } }),
    testDb.location.create({ data: { code: "restaurant", name: "Test Restaurant" } }),
  ]);
  canteenId = canteen.id;
  restaurantId = restaurant.id;

  const attendant = await testDb.staffMember.create({
    data: {
      name: "Test Attendant",
      phone: "+254700113002",
      pinHash: await hashPin("1234"),
      role: "attendant",
      locationId: canteen.id,
      dailyRateMinor: 0,
    },
  });
  attendantId = attendant.id;

  const soda = await testDb.product.create({
    data: { name: "Soda", kind: "goods", priceMinor: 100, locationId: canteenId },
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
  await testDb.product.deleteMany({});
  await testDb.staffMember.deleteMany({});
  await testDb.location.deleteMany({});
  await testDb.$disconnect();
});

describe("count-derived sales at the canteen", () => {
  test("computes sold = previous count + received + transferred in − credit sales − wasted − consumed − given away − transferred out − this count", async () => {
    const requester = staffAt("attendant", canteenId);

    // Previous count: 40 on hand at the canteen.
    const previous = await recordStockCount(testDb, requester, {
      locationId: canteenId,
      lines: [{ itemType: "product", itemId: sodaId, countedQuantity: 40 }],
    });
    if (!previous.ok) throw new Error("setup failed");

    // Movements in the period since the previous count.
    await testDb.stockMovement.create({
      data: {
        productId: sodaId,
        locationId: canteenId,
        quantity: 24, // received
        reason: "received",
        staffMemberId: attendantId,
      },
    });
    await testDb.stockMovement.create({
      data: {
        productId: sodaId,
        locationId: canteenId,
        quantity: 10, // transferred in from the restaurant
        reason: "transferred",
        staffMemberId: attendantId,
      },
    });
    await testDb.stockMovement.create({
      data: {
        productId: sodaId,
        locationId: canteenId,
        quantity: -5, // transferred out to the restaurant
        reason: "transferred",
        staffMemberId: attendantId,
      },
    });
    await testDb.stockMovement.create({
      data: {
        productId: sodaId,
        locationId: canteenId,
        quantity: -2, // wasted
        reason: "wasted",
        staffMemberId: attendantId,
        costBasisMinor: 120,
        sellingValueMinor: 200,
        isEstimated: true,
      },
    });
    await testDb.stockMovement.create({
      data: {
        productId: sodaId,
        locationId: canteenId,
        quantity: -1, // consumed
        reason: "consumed",
        staffMemberId: attendantId,
        costBasisMinor: 60,
        sellingValueMinor: 100,
        isEstimated: true,
      },
    });
    await testDb.stockMovement.create({
      data: {
        productId: sodaId,
        locationId: canteenId,
        quantity: -1, // given away
        reason: "given_away",
        staffMemberId: attendantId,
        costBasisMinor: 60,
        sellingValueMinor: 100,
        isEstimated: true,
      },
    });

    // A recorded credit sale of 3 in the same period.
    const creditSale = await recordCounterSale(testDb, requester, {
      lines: [{ productId: sodaId, quantity: 3 }],
      paymentLines: [{ method: "credit", amountMinor: 300, customerId: undefined }],
    });
    expect(creditSale.ok).toBe(false); // credit requires a named customer

    const customer = await testDb.customer.create({ data: { name: "Test Customer" } });
    const creditSaleWithCustomer = await recordCounterSale(testDb, requester, {
      lines: [{ productId: sodaId, quantity: 3 }],
      paymentLines: [{ method: "credit", amountMinor: 300, customerId: customer.id }],
    });
    if (!creditSaleWithCustomer.ok) throw new Error("setup failed: credit sale");

    // Quantity on hand right now: 40 + 24 + 10 - 5 - 2 - 1 - 1 - 3(credit, recorded as `sold`) = 62
    const currentStock = await getCurrentStockAtLocation(testDb, requester, canteenId);
    expect(currentStock.ok).toBe(true);

    // This count finds 30 on hand.
    const thisCount = await recordStockCount(testDb, requester, {
      locationId: canteenId,
      lines: [{ itemType: "product", itemId: sodaId, countedQuantity: 30 }],
    });
    expect(thisCount.ok).toBe(true);

    // sold = 40 + 24 + 10 − 3 − 2 − 1 − 1 − 5 − 30 = 32
    const movements = await testDb.stockMovement.findMany({
      where: { productId: sodaId, locationId: canteenId, reason: "sold_derived" },
    });
    expect(movements).toHaveLength(1);
    expect(movements[0]).toEqual(
      expect.objectContaining({
        quantity: -32,
        sellingValueMinor: 3200,
      }),
    );
  });

  test("writes no sold_derived movement for the first-ever count at a location", async () => {
    const requester = staffAt("attendant", canteenId);

    await testDb.stockMovement.create({
      data: {
        productId: sodaId,
        locationId: canteenId,
        quantity: 20,
        reason: "received",
        staffMemberId: attendantId,
      },
    });

    const result = await recordStockCount(testDb, requester, {
      locationId: canteenId,
      lines: [{ itemType: "product", itemId: sodaId, countedQuantity: 18 }],
    });
    expect(result.ok).toBe(true);

    const movements = await testDb.stockMovement.findMany({
      where: { productId: sodaId, locationId: canteenId, reason: "sold_derived" },
    });
    expect(movements).toHaveLength(0);
  });

  test("writes no sold_derived movement when the derived quantity is zero", async () => {
    const requester = staffAt("attendant", canteenId);

    const previous = await recordStockCount(testDb, requester, {
      locationId: canteenId,
      lines: [{ itemType: "product", itemId: sodaId, countedQuantity: 10 }],
    });
    if (!previous.ok) throw new Error("setup failed");

    // Nothing moved in between — this count also finds 10.
    const thisCount = await recordStockCount(testDb, requester, {
      locationId: canteenId,
      lines: [{ itemType: "product", itemId: sodaId, countedQuantity: 10 }],
    });
    expect(thisCount.ok).toBe(true);

    const movements = await testDb.stockMovement.findMany({
      where: { productId: sodaId, locationId: canteenId, reason: "sold_derived" },
    });
    expect(movements).toHaveLength(0);
  });

  test("does not compute derived sales for a restaurant count", async () => {
    const restaurantRequester: AuthenticatedStaff = {
      staff: {
        id: attendantId,
        name: "Test Attendant",
        phone: "+254700113002",
        role: "store_manager",
        locationId: restaurantId,
        dailyRateMinor: 0,
        active: true,
      },
      location: { id: restaurantId, code: "restaurant", name: "Test Restaurant" },
    };
    await testDb.staffMember.update({
      where: { id: attendantId },
      data: { role: "store_manager", locationId: restaurantId },
    });

    const previous = await recordStockCount(testDb, restaurantRequester, {
      locationId: restaurantId,
      lines: [{ itemType: "product", itemId: sodaId, countedQuantity: 40 }],
    });
    if (!previous.ok) throw new Error("setup failed");

    const thisCount = await recordStockCount(testDb, restaurantRequester, {
      locationId: restaurantId,
      lines: [{ itemType: "product", itemId: sodaId, countedQuantity: 30 }],
    });
    expect(thisCount.ok).toBe(true);

    const movements = await testDb.stockMovement.findMany({
      where: { productId: sodaId, locationId: restaurantId, reason: "sold_derived" },
    });
    expect(movements).toHaveLength(0);
  });

  test("getCurrentStockAtLocation includes sold_derived in its sum", async () => {
    const requester = staffAt("attendant", canteenId);

    // Establish 40 actually on hand via a real movement, not just a count
    // figure — a count records what was found, it is not itself a
    // movement, so quantityOnHand before any sold_derived write is exactly
    // what the underlying movements sum to.
    await testDb.stockMovement.create({
      data: {
        productId: sodaId,
        locationId: canteenId,
        quantity: 40,
        reason: "received",
        staffMemberId: attendantId,
      },
    });

    const previous = await recordStockCount(testDb, requester, {
      locationId: canteenId,
      lines: [{ itemType: "product", itemId: sodaId, countedQuantity: 40 }],
    });
    if (!previous.ok) throw new Error("setup failed");

    // No other movements — this count finds 25 (15 sold, purely derived).
    const thisCount = await recordStockCount(testDb, requester, {
      locationId: canteenId,
      lines: [{ itemType: "product", itemId: sodaId, countedQuantity: 25 }],
    });
    expect(thisCount.ok).toBe(true);

    const result = await getCurrentStockAtLocation(testDb, requester, canteenId);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const line = result.levels.find((l) => l.productId === sodaId);
    // 40 received − 15 derived sold = 25, matching the count found.
    expect(line?.quantityOnHand).toBe(25);
  });

  test("only compares items counted in both this count and the previous one", async () => {
    const requester = staffAt("attendant", canteenId);
    const biscuit = await testDb.product.create({
      data: { name: "Biscuit", kind: "goods", priceMinor: 50, locationId: canteenId },
    });

    const previous = await recordStockCount(testDb, requester, {
      locationId: canteenId,
      lines: [{ itemType: "product", itemId: sodaId, countedQuantity: 40 }],
    });
    if (!previous.ok) throw new Error("setup failed");

    // This count adds a newly-counted item (biscuit) with no prior count —
    // it should produce no derived-sold detail, only soda should.
    const thisCount = await recordStockCount(testDb, requester, {
      locationId: canteenId,
      lines: [
        { itemType: "product", itemId: sodaId, countedQuantity: 35 },
        { itemType: "product", itemId: biscuit.id, countedQuantity: 12 },
      ],
    });
    expect(thisCount.ok).toBe(true);

    const movements = await testDb.stockMovement.findMany({
      where: { locationId: canteenId, reason: "sold_derived" },
    });
    expect(movements).toHaveLength(1);
    expect(movements[0].productId).toBe(sodaId);
  });
});
