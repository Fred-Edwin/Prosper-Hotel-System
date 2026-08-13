import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { hashPin } from "@/modules/people";
import type { AuthenticatedStaff } from "@/modules/people";
import { createProduct, recordProductCost } from "@/modules/catalogue";
import { recordNonSalesConsumption } from "@/modules/stock";
import { getNonSalesLedgerReport } from "../logic";
import { testDb } from "@/shared/test-db";

let restaurantId: string;
let canteenId: string;
let ownerId: string;

function owner(locationId: string): AuthenticatedStaff {
  return {
    staff: {
      id: ownerId,
      name: "Test Owner",
      phone: "+254700111900",
      role: "owner",
      locationId,
      active: true,
      dailyRateMinor: 0,
    },
    location: { id: locationId, code: "restaurant", name: "Test" },
  };
}

function attendant(locationId: string): AuthenticatedStaff {
  return {
    staff: {
      id: "attendant-1",
      name: "Test Attendant",
      phone: "+254700111901",
      role: "attendant",
      locationId,
      active: true,
      dailyRateMinor: 0,
    },
    location: { id: locationId, code: "canteen", name: "Test" },
  };
}

async function resetDb() {
  await testDb.stockMovement.deleteMany({});
  await testDb.ingredientMovement.deleteMany({});
  await testDb.product.deleteMany({});
  await testDb.ingredient.deleteMany({});
  await testDb.staffMember.deleteMany({});
  await testDb.location.deleteMany({});
}

beforeEach(async () => {
  await resetDb();

  const restaurant = await testDb.location.create({
    data: { code: "restaurant", name: "Test Restaurant" },
  });
  restaurantId = restaurant.id;
  const canteen = await testDb.location.create({
    data: { code: "canteen", name: "Test Canteen" },
  });
  canteenId = canteen.id;

  const ownerStaff = await testDb.staffMember.create({
    data: {
      name: "Test Owner",
      phone: "+254700111902",
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
      phone: "+254700111903",
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

describe("getNonSalesLedgerReport", () => {
  test("forbidden for non-owner roles", async () => {
    const result = await getNonSalesLedgerReport(testDb, attendant(canteenId), {
      periodStart: new Date("2026-08-01T00:00:00Z"),
      periodEnd: new Date("2026-08-08T00:00:00Z"),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("forbidden");
  });

  test("reason filter and search by item/recorded-by combine (AND), and the filtered total matches the filtered rows", async () => {
    const ownerStaff = owner(restaurantId);
    const soda = await createProduct(testDb, ownerStaff, {
      name: "Soda",
      kind: "goods",
      priceMinor: 100,
      locationId: restaurantId,
    });
    if (!soda.ok) throw new Error("expected product create to succeed");
    await recordProductCost(testDb, ownerStaff, soda.value.id, {
      quantityOnHand: 0,
      quantityBought: 30,
      unitCostMinor: 60,
    });
    await testDb.stockMovement.create({
      data: {
        productId: soda.value.id,
        locationId: restaurantId,
        quantity: 30,
        reason: "received",
        staffMemberId: ownerId,
      },
    });

    const crisps = await createProduct(testDb, ownerStaff, {
      name: "Crisps",
      kind: "goods",
      priceMinor: 150,
      locationId: restaurantId,
    });
    if (!crisps.ok) throw new Error("expected product create to succeed");
    await recordProductCost(testDb, ownerStaff, crisps.value.id, {
      quantityOnHand: 0,
      quantityBought: 10,
      unitCostMinor: 90,
    });
    await testDb.stockMovement.create({
      data: {
        productId: crisps.value.id,
        locationId: restaurantId,
        quantity: 10,
        reason: "received",
        staffMemberId: ownerId,
      },
    });

    const periodStart = new Date("2026-08-01T00:00:00Z");
    const periodEnd = new Date("2026-08-08T00:00:00Z");
    const occurredAt = new Date("2026-08-03T12:00:00Z");

    // Soda wasted.
    const wastedSoda = await recordNonSalesConsumption(testDb, ownerStaff, {
      itemType: "product",
      itemId: soda.value.id,
      locationId: restaurantId,
      quantity: 2,
      category: "wasted",
    });
    if (!wastedSoda.ok) throw new Error("expected wastage to record");
    await testDb.stockMovement.update({
      where: { id: (wastedSoda.movement as { id: string }).id },
      data: { occurredAt },
    });

    // Crisps given away.
    const givenAwayCrisps = await recordNonSalesConsumption(testDb, ownerStaff, {
      itemType: "product",
      itemId: crisps.value.id,
      locationId: restaurantId,
      quantity: 1,
      category: "given_away",
    });
    if (!givenAwayCrisps.ok) throw new Error("expected give-away to record");
    await testDb.stockMovement.update({
      where: { id: (givenAwayCrisps.movement as { id: string }).id },
      data: { occurredAt },
    });

    // Soda given away too — same item, different reason, tests reason filter narrows within one item.
    const givenAwaySoda = await recordNonSalesConsumption(testDb, ownerStaff, {
      itemType: "product",
      itemId: soda.value.id,
      locationId: restaurantId,
      quantity: 1,
      category: "given_away",
    });
    if (!givenAwaySoda.ok) throw new Error("expected give-away to record");
    await testDb.stockMovement.update({
      where: { id: (givenAwaySoda.movement as { id: string }).id },
      data: { occurredAt },
    });

    const all = await getNonSalesLedgerReport(testDb, ownerStaff, { periodStart, periodEnd });
    expect(all.ok).toBe(true);
    if (!all.ok) return;
    expect(all.rows).toHaveLength(3);

    const wastedOnly = await getNonSalesLedgerReport(testDb, ownerStaff, {
      periodStart,
      periodEnd,
      reason: "wasted",
    });
    expect(wastedOnly.ok).toBe(true);
    if (!wastedOnly.ok) return;
    expect(wastedOnly.rows).toHaveLength(1);
    expect(wastedOnly.rows[0]?.itemName).toBe("Soda");

    const sodaSearch = await getNonSalesLedgerReport(testDb, ownerStaff, {
      periodStart,
      periodEnd,
      search: "soda",
    });
    expect(sodaSearch.ok).toBe(true);
    if (!sodaSearch.ok) return;
    expect(sodaSearch.rows).toHaveLength(2);

    // AND: reason=given_away + search=soda narrows to just the one soda give-away row.
    const combined = await getNonSalesLedgerReport(testDb, ownerStaff, {
      periodStart,
      periodEnd,
      reason: "given_away",
      search: "soda",
    });
    expect(combined.ok).toBe(true);
    if (!combined.ok) return;
    expect(combined.rows).toHaveLength(1);
    expect(combined.rows[0]?.itemName).toBe("Soda");
    expect(combined.rows[0]?.reason).toBe("given_away");

    // Search by recorded-by name.
    const byRecorder = await getNonSalesLedgerReport(testDb, ownerStaff, {
      periodStart,
      periodEnd,
      search: "test owner",
    });
    expect(byRecorder.ok).toBe(true);
    if (!byRecorder.ok) return;
    expect(byRecorder.rows).toHaveLength(3);

    // The filtered total sums exactly the filtered rows, not the unfiltered set.
    const filteredTotal = wastedOnly.rows.reduce((sum, r) => sum + (r.costBasisMinor ?? 0), 0);
    expect(filteredTotal).toBe(2 * 60);
  });
});
