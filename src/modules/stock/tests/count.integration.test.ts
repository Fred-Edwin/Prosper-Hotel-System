import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { hashPin } from "@/modules/people";
import type { AuthenticatedStaff } from "@/modules/people";
import { correctStockCount, getStockCount, recordStockCount } from "../logic";
import { testDb } from "@/shared/test-db";

let restaurantId: string;
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
  await testDb.stockCountLine.deleteMany({});
  await testDb.stockCount.deleteMany({});
  await testDb.stockMovement.deleteMany({});
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

  const soda = await testDb.product.create({
    data: { name: "Soda", kind: "goods", priceMinor: 100 },
  });
  sodaId = soda.id;
});

afterAll(async () => {
  await testDb.stockCountLine.deleteMany({});
  await testDb.stockCount.deleteMany({});
  await testDb.stockMovement.deleteMany({});
  await testDb.product.deleteMany({});
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
      data: { name: "Discontinued snack", kind: "goods", active: false },
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
  test("returns the count's lines with expected, counted and difference derivable", async () => {
    const recorder = staffAt("store_manager", restaurantId, storeManagerId);
    const recorded = await recordStockCount(testDb, recorder, {
      locationId: restaurantId,
      lines: [{ itemType: "product", itemId: sodaId, countedQuantity: 12 }],
    });
    if (!recorded.ok) throw new Error("setup failed");

    const result = await getStockCount(testDb, recorder, recorded.count.id);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.count.lines).toEqual([
      expect.objectContaining({ itemType: "product", itemId: sodaId, countedQuantity: 12 }),
    ]);
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
  test("owner correcting a disagreeing line writes a corrected movement bringing stock in line", async () => {
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

    const owner = await testDb.staffMember.create({
      data: {
        name: "Test Owner",
        phone: "+254700111448",
        pinHash: await hashPin("1234"),
        role: "owner",
        locationId: restaurantId,
        dailyRateMinor: 0,
      },
    });
    const ownerRequester = staffAt("owner", restaurantId, owner.id);

    const result = await correctStockCount(testDb, ownerRequester, {
      stockCountId: recorded.count.id,
      lineId: recorded.count.lines[0].id,
    });

    expect(result).toEqual({ ok: true });

    const movements = await testDb.stockMovement.findMany({
      where: { productId: sodaId, locationId: restaurantId },
    });
    const quantityOnHand = movements.reduce((sum, m) => sum + m.quantity, 0);
    expect(quantityOnHand).toBe(37);

    const correctionMovement = movements.find((m) => m.reason === "corrected");
    expect(correctionMovement).toEqual(expect.objectContaining({ quantity: -3 }));
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

    const owner = await testDb.staffMember.create({
      data: {
        name: "Test Owner",
        phone: "+254700111449",
        pinHash: await hashPin("1234"),
        role: "owner",
        locationId: restaurantId,
        dailyRateMinor: 0,
      },
    });
    const ownerRequester = staffAt("owner", restaurantId, owner.id);

    await correctStockCount(testDb, ownerRequester, {
      stockCountId: recorded.count.id,
      lineId: recorded.count.lines[0].id,
    });

    const result = await correctStockCount(testDb, ownerRequester, {
      stockCountId: recorded.count.id,
      lineId: recorded.count.lines[0].id,
    });

    expect(result).toEqual({ ok: false, reason: "already_corrected" });
  });
});
