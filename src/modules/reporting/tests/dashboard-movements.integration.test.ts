import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { hashPin } from "@/modules/people";
import type { AuthenticatedStaff } from "@/modules/people";
import { getDashboardStockMovements, getDashboardStoreMovements, getProductLedger, getStoreLedger } from "../logic";
import { testDb } from "@/shared/test-db";

let restaurantId: string;
let canteenId: string;
let ownerId: string;

function owner(): AuthenticatedStaff {
  return {
    staff: {
      id: ownerId,
      name: "Test Owner",
      phone: "+254700119003",
      role: "owner",
      locationId: restaurantId,
      dailyRateMinor: 0,
      active: true,
    },
    location: { id: restaurantId, code: "restaurant", name: "Test Restaurant" },
  };
}

function attendant(locationId: string): AuthenticatedStaff {
  return {
    staff: {
      id: "attendant-1",
      name: "Test Attendant",
      phone: "+254700119002",
      role: "attendant",
      locationId,
      dailyRateMinor: 0,
      active: true,
    },
    location: { id: locationId, code: "canteen", name: "Test Canteen" },
  };
}

async function resetDb() {
  await testDb.paymentLine.deleteMany({});
  await testDb.saleLine.deleteMany({});
  await testDb.sale.deleteMany({});
  await testDb.stockCountLine.deleteMany({});
  await testDb.stockCount.deleteMany({});
  await testDb.stockMovement.deleteMany({});
  await testDb.ingredientMovement.deleteMany({});
  await testDb.expense.deleteMany({});
  await testDb.takings.deleteMany({});
  await testDb.recipeLine.deleteMany({});
  await testDb.recipe.deleteMany({});
  await testDb.product.deleteMany({});
  await testDb.category.deleteMany({});
  await testDb.ingredient.deleteMany({});
  await testDb.staffMember.deleteMany({});
  await testDb.location.deleteMany({});
}

beforeEach(async () => {
  await resetDb();

  const [restaurant, canteen] = await Promise.all([
    testDb.location.create({ data: { code: "restaurant", name: "Test Restaurant" } }),
    testDb.location.create({ data: { code: "canteen", name: "Test Canteen" } }),
  ]);
  restaurantId = restaurant.id;
  canteenId = canteen.id;

  const ownerStaff = await testDb.staffMember.create({
    data: {
      name: "Test Owner",
      phone: "+254700119003",
      pinHash: await hashPin("1234"),
      role: "owner",
      locationId: restaurant.id,
      dailyRateMinor: 0,
    },
  });
  ownerId = ownerStaff.id;

  await testDb.staffMember.create({
    data: {
      id: "attendant-1",
      name: "Test Attendant",
      phone: "+254700119002",
      pinHash: await hashPin("1234"),
      role: "attendant",
      locationId: canteen.id,
      dailyRateMinor: 0,
    },
  });
});

afterAll(async () => {
  await resetDb();
  await testDb.$disconnect();
});

function todayBounds(): { dayStart: Date; dayEnd: Date } {
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);
  return { dayStart, dayEnd };
}

// A time firmly inside "today" regardless of what hour the test runs at.
function todayAt(hour: number): Date {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  return d;
}

describe("getDashboardStockMovements", () => {
  test("forbidden for non-owner roles", async () => {
    const result = await getDashboardStockMovements(testDb, attendant(canteenId), { today: new Date() });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("forbidden");
  });

  test("reconciles today's totals with getProductLedger for the same day, split by reason and location", async () => {
    const chips = await testDb.product.create({
      data: { name: "Chips", kind: "cooked_food", priceMinor: 100, lastKnownCostMinor: null, locationId: restaurantId },
    });

    await testDb.stockMovement.create({
      data: {
        productId: chips.id,
        locationId: restaurantId,
        quantity: 20,
        reason: "produced",
        costBasisMinor: 40,
        staffMemberId: ownerId,
        occurredAt: todayAt(8),
      },
    });
    await testDb.stockMovement.create({
      data: {
        productId: chips.id,
        locationId: restaurantId,
        quantity: -15,
        reason: "sold",
        staffMemberId: ownerId,
        occurredAt: todayAt(11),
      },
    });
    await testDb.stockMovement.create({
      data: {
        productId: chips.id,
        locationId: restaurantId,
        quantity: -3,
        reason: "wasted",
        costBasisMinor: 40,
        staffMemberId: ownerId,
        occurredAt: todayAt(12),
      },
    });

    const { dayStart, dayEnd } = todayBounds();
    const [summary, ledger] = await Promise.all([
      getDashboardStockMovements(testDb, owner(), { today: new Date() }),
      getProductLedger(testDb, owner(), { periodStart: dayStart, periodEnd: dayEnd }),
    ]);
    expect(summary.ok).toBe(true);
    expect(ledger.ok).toBe(true);
    if (!summary.ok || !ledger.ok) return;

    const producedRow = summary.rows.find((r) => r.reason === "produced" && r.locationCode === "restaurant");
    const soldRow = summary.rows.find((r) => r.reason === "sold" && r.locationCode === "restaurant");
    const wastedRow = summary.rows.find((r) => r.reason === "wasted" && r.locationCode === "restaurant");

    expect(producedRow?.qty).toBe(20);
    expect(soldRow?.qty).toBe(15);
    expect(wastedRow?.qty).toBe(3);

    const ledgerRow = ledger.rows.find((r) => r.productId === chips.id && r.locationId === restaurantId);
    expect(ledgerRow).toBeDefined();
    expect(producedRow?.qty).toBe(ledgerRow!.produced);
    expect(soldRow?.qty).toBe(ledgerRow!.sold);
    expect(soldRow?.valueMinor).toBe(ledgerRow!.salesValueMinor);
    expect(wastedRow?.qty).toBe(ledgerRow!.nonSales);
  });

  test("wasted, consumed and given-away are reported as separate rows, not folded together", async () => {
    const soda = await testDb.product.create({
      data: { name: "Soda", kind: "goods", priceMinor: 50, lastKnownCostMinor: 30, locationId: restaurantId },
    });

    await testDb.stockMovement.create({
      data: {
        productId: soda.id,
        locationId: restaurantId,
        quantity: -2,
        reason: "wasted",
        staffMemberId: ownerId,
        occurredAt: todayAt(9),
      },
    });
    await testDb.stockMovement.create({
      data: {
        productId: soda.id,
        locationId: restaurantId,
        quantity: -1,
        reason: "consumed",
        staffMemberId: ownerId,
        occurredAt: todayAt(10),
      },
    });
    await testDb.stockMovement.create({
      data: {
        productId: soda.id,
        locationId: restaurantId,
        quantity: -1,
        reason: "given_away",
        staffMemberId: ownerId,
        occurredAt: todayAt(13),
      },
    });

    const result = await getDashboardStockMovements(testDb, owner(), { today: new Date() });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const wasted = result.rows.find((r) => r.reason === "wasted" && r.locationCode === "restaurant");
    const consumed = result.rows.find((r) => r.reason === "consumed" && r.locationCode === "restaurant");
    const givenAway = result.rows.find((r) => r.reason === "given_away" && r.locationCode === "restaurant");

    expect(wasted?.qty).toBe(2);
    expect(consumed?.qty).toBe(1);
    expect(givenAway?.qty).toBe(1);
  });

  test("no movements today returns an empty row list", async () => {
    const result = await getDashboardStockMovements(testDb, owner(), { today: new Date() });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows).toEqual([]);
  });
});

describe("getDashboardStoreMovements", () => {
  test("forbidden for non-owner roles", async () => {
    const result = await getDashboardStoreMovements(testDb, attendant(canteenId), { today: new Date() });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("forbidden");
  });

  test("reconciles today's per-ingredient flow with getStoreLedger for the restaurant only", async () => {
    const potatoes = await testDb.ingredient.create({
      data: { name: "Potatoes", unitOfMeasure: "kg", lastKnownCostMinor: 65 },
    });

    await testDb.ingredientMovement.create({
      data: {
        ingredientId: potatoes.id,
        locationId: restaurantId,
        quantity: 40,
        reason: "received",
        unitCostMinor: 65,
        staffMemberId: ownerId,
        occurredAt: todayAt(8),
      },
    });
    await testDb.ingredientMovement.create({
      data: {
        ingredientId: potatoes.id,
        locationId: restaurantId,
        quantity: -25,
        reason: "issued",
        staffMemberId: ownerId,
        occurredAt: todayAt(9),
      },
    });

    // Canteen movement on the same ingredient/day — must not leak into the
    // restaurant-only summary.
    await testDb.ingredientMovement.create({
      data: {
        ingredientId: potatoes.id,
        locationId: canteenId,
        quantity: 10,
        reason: "received",
        unitCostMinor: 65,
        staffMemberId: ownerId,
        occurredAt: todayAt(8),
      },
    });

    const { dayStart, dayEnd } = todayBounds();
    const [summary, ledger] = await Promise.all([
      getDashboardStoreMovements(testDb, owner(), { today: new Date() }),
      getStoreLedger(testDb, owner(), { periodStart: dayStart, periodEnd: dayEnd, locationId: restaurantId }),
    ]);
    expect(summary.ok).toBe(true);
    expect(ledger.ok).toBe(true);
    if (!summary.ok || !ledger.ok) return;

    const row = summary.rows.find((r) => r.ingredientName === "Potatoes");
    const ledgerRow = ledger.rows.find((r) => r.ingredientId === potatoes.id);
    expect(row).toBeDefined();
    expect(ledgerRow).toBeDefined();
    expect(row!.received).toBe(ledgerRow!.purchasedQty);
    expect(row!.issuedToKitchen).toBe(ledgerRow!.issuedToKitchen);
    expect(row!.closingQty).toBe(ledgerRow!.closingQty);
    expect(row!.received).toBe(40);
    expect(row!.issuedToKitchen).toBe(25);
  });

  test("no movements today returns an empty row list", async () => {
    const result = await getDashboardStoreMovements(testDb, owner(), { today: new Date() });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows).toEqual([]);
  });
});
