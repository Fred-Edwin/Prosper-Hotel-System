import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { hashPin } from "@/modules/people";
import type { AuthenticatedStaff } from "@/modules/people";
import { recordCounterSale, voidSale } from "@/modules/sales";
import { recordStockCount } from "@/modules/stock";
import {
  getTodaysHandoverForStaff,
  getTodaysHandovers,
  isDayClosedFor,
  recordHandover,
} from "../logic";
import { testDb } from "@/shared/test-db";

let restaurantId: string;
let canteenId: string;
let sodaId: string;

function staffAt(
  role: "owner" | "cashier" | "attendant",
  locationId: string,
  locationCode: "restaurant" | "canteen" = "restaurant",
): AuthenticatedStaff {
  return staffMemberAt("staff-1", "Test Staff", role, locationId, locationCode);
}

function staffMemberAt(
  id: string,
  name: string,
  role: "owner" | "cashier" | "attendant",
  locationId: string,
  locationCode: "restaurant" | "canteen" = "restaurant",
): AuthenticatedStaff {
  return {
    staff: {
      id,
      name,
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

  await testDb.staffMember.create({
    data: {
      id: "staff-1",
      name: "Test Cashier",
      phone: "+254700111334",
      pinHash: await hashPin("1234"),
      role: "cashier",
      locationId: restaurant.id,
      dailyRateMinor: 0,
    },
  });

  await testDb.staffMember.create({
    data: {
      id: "staff-2",
      name: "Other Cashier",
      phone: "+254700111335",
      pinHash: await hashPin("1234"),
      role: "cashier",
      locationId: restaurant.id,
      dailyRateMinor: 0,
    },
  });

  await testDb.staffMember.create({
    data: {
      id: "staff-3",
      name: "Test Attendant",
      phone: "+254700111336",
      pinHash: await hashPin("1234"),
      role: "attendant",
      locationId: canteen.id,
      dailyRateMinor: 0,
    },
  });

  const soda = await testDb.product.create({
    data: { name: "Soda 500ml", kind: "goods", priceMinor: 80, locationId: restaurantId },
  });
  sodaId = soda.id;
});

// BUG-15's hard guard now rejects a sale line that exceeds on-hand stock,
// so tests selling sodaId need real stock to sell from first.
const SEEDED_STOCK = 100;

beforeEach(async () => {
  // Canteen tests now seed sales via recordStockCount, which writes real
  // StockCount/StockCountLine rows (docs/scope.md's 2026-08-15 entry) —
  // clear those before staffMember/location, which they reference via
  // RESTRICT foreign keys.
  await testDb.handover.deleteMany({});
  await testDb.paymentLine.deleteMany({});
  await testDb.saleLine.deleteMany({});
  await testDb.sale.deleteMany({});
  await testDb.stockCountLine.deleteMany({});
  await testDb.stockCount.deleteMany({});
  await testDb.stockMovement.deleteMany({});
  await testDb.customer.deleteMany({});

  await testDb.stockMovement.create({
    data: { productId: sodaId, locationId: restaurantId, quantity: SEEDED_STOCK, reason: "received", staffMemberId: "staff-1" },
  });
  await testDb.stockMovement.create({
    data: { productId: sodaId, locationId: canteenId, quantity: SEEDED_STOCK, reason: "received", staffMemberId: "staff-1" },
  });
});

afterAll(async () => {
  await testDb.handover.deleteMany({});
  await testDb.paymentLine.deleteMany({});
  await testDb.saleLine.deleteMany({});
  await testDb.sale.deleteMany({});
  await testDb.stockCountLine.deleteMany({});
  await testDb.stockCount.deleteMany({});
  await testDb.stockMovement.deleteMany({});
  await testDb.customer.deleteMany({});
  await testDb.product.deleteMany({});
  await testDb.staffMember.deleteMany({});
  await testDb.location.deleteMany({});
  await testDb.$disconnect();
});

describe("recordHandover", () => {
  test("expected cash is the sum of that staff member's cash sales today", async () => {
    await recordCounterSale(testDb, staffAt("cashier", restaurantId), {
      lines: [{ productId: sodaId, quantity: 2 }],
      paymentLines: [{ method: "cash", amountMinor: 160 }],
    });

    const result = await recordHandover(testDb, staffAt("cashier", restaurantId), {
      cashMinor: 160,
      mpesaMinor: 0,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.handover.expectedCashMinor).toBe(160);
    expect(result.handover.actualCashMinor).toBe(160);
  });

  test("expected M-Pesa is the sum of that staff member's M-Pesa sales today, tracked separately from cash", async () => {
    await recordCounterSale(testDb, staffAt("cashier", restaurantId), {
      lines: [{ productId: sodaId, quantity: 1 }],
      paymentLines: [{ method: "mpesa", amountMinor: 80 }],
    });

    const result = await recordHandover(testDb, staffAt("cashier", restaurantId), {
      cashMinor: 0,
      mpesaMinor: 80,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.handover.expectedMpesaMinor).toBe(80);
    expect(result.handover.expectedCashMinor).toBe(0);
  });

  test("credit payment lines are excluded from both expected figures", async () => {
    const customer = await testDb.customer.create({ data: { name: "Jane Wanjiru" } });
    await recordCounterSale(testDb, staffAt("cashier", restaurantId), {
      lines: [{ productId: sodaId, quantity: 1 }],
      paymentLines: [{ method: "credit", amountMinor: 80, customerId: customer.id }],
    });

    const result = await recordHandover(testDb, staffAt("cashier", restaurantId), {
      cashMinor: 0,
      mpesaMinor: 0,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.handover.expectedCashMinor).toBe(0);
    expect(result.handover.expectedMpesaMinor).toBe(0);
  });

  test("a voided sale is excluded from the expected figure", async () => {
    const recorded = await recordCounterSale(testDb, staffAt("cashier", restaurantId), {
      lines: [{ productId: sodaId, quantity: 1 }],
      paymentLines: [{ method: "cash", amountMinor: 80 }],
    });
    expect(recorded.ok).toBe(true);
    if (!recorded.ok) return;
    await voidSale(testDb, staffAt("cashier", restaurantId), recorded.sale.id);

    const result = await recordHandover(testDb, staffAt("cashier", restaurantId), {
      cashMinor: 0,
      mpesaMinor: 0,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.handover.expectedCashMinor).toBe(0);
  });

  test("a mismatch between actual and expected does not block recording", async () => {
    await recordCounterSale(testDb, staffAt("cashier", restaurantId), {
      lines: [{ productId: sodaId, quantity: 1 }],
      paymentLines: [{ method: "cash", amountMinor: 80 }],
    });

    const result = await recordHandover(testDb, staffAt("cashier", restaurantId), {
      cashMinor: 50,
      mpesaMinor: 0,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.handover.expectedCashMinor).toBe(80);
    expect(result.handover.actualCashMinor).toBe(50);
  });

  test("a second attempt the same day, same staff, same location is rejected once the day is closed", async () => {
    const first = await recordHandover(testDb, staffAt("cashier", restaurantId), {
      cashMinor: 100,
      mpesaMinor: 0,
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const second = await recordHandover(testDb, staffAt("cashier", restaurantId), {
      cashMinor: 120,
      mpesaMinor: 0,
    });

    expect(second).toEqual({ ok: false, reason: "day_closed" });

    const all = await testDb.handover.findMany({ where: { staffMemberId: "staff-1" } });
    expect(all).toHaveLength(1);
    expect(all[0].actualCashMinor.toNumber()).toBe(100);
  });

  test("the owner can still edit a handover in place after the day is closed", async () => {
    const first = await recordHandover(testDb, staffAt("cashier", restaurantId), {
      cashMinor: 100,
      mpesaMinor: 0,
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const ownerAsSameStaff: AuthenticatedStaff = {
      staff: { ...staffAt("cashier", restaurantId).staff, role: "owner" },
      location: staffAt("cashier", restaurantId).location,
    };

    const second = await recordHandover(testDb, ownerAsSameStaff, {
      cashMinor: 120,
      mpesaMinor: 0,
    });

    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.handover.id).toBe(first.handover.id);
    expect(second.handover.actualCashMinor).toBe(120);

    const all = await testDb.handover.findMany({ where: { staffMemberId: "staff-1" } });
    expect(all).toHaveLength(1);
  });

  test("a cashier at a different location cannot record a handover for their own location under someone else's session", async () => {
    const cashierAtCanteen: AuthenticatedStaff = {
      staff: {
        id: "staff-1",
        name: "Test Cashier",
        phone: "+254700111334",
        role: "cashier",
        locationId: canteenId,
        dailyRateMinor: 0,
        active: true,
      },
      location: { id: canteenId, code: "canteen", name: "Test Canteen" },
    };

    const result = await recordHandover(testDb, cashierAtCanteen, { cashMinor: 0, mpesaMinor: 0 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.handover.locationId).toBe(canteenId);
  });
});

// Revised 2026-08-15: the canteen no longer records individual sales —
// recordCounterSale rejects a canteen location outright (docs/scope.md's
// "Canteen: count-derived sales" entry). Canteen sales now come from a
// stock count (recordStockCount), so these tests seed via a count against
// the 100-unit stock seeded in beforeEach, not via recordCounterSale.
// The expected figure is still the combined total of those (now
// count-derived) sales, and expectedMpesaMinor is still null (see
// Handover.expectedMpesaMinor's schema comment).
describe("recordHandover — canteen", () => {
  function attendant(): AuthenticatedStaff {
    return staffMemberAt("staff-3", "Test Attendant", "attendant", canteenId, "canteen");
  }

  test("expected is the combined total of today's count-derived sales, with no separate M-Pesa split", async () => {
    // 100 seeded, counted down to 98 -> 2 sodas sold at 80 each = 160.
    await recordStockCount(testDb, attendant(), {
      locationId: canteenId,
      lines: [{ itemType: "product", itemId: sodaId, countedQuantity: 98 }],
    });

    const result = await recordHandover(testDb, attendant(), {
      cashMinor: 100,
      mpesaMinor: 60,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.handover.expectedCashMinor).toBe(160);
    expect(result.handover.expectedMpesaMinor).toBeNull();
  });

  test("a mismatch between the combined actual and expected does not block recording", async () => {
    await recordStockCount(testDb, attendant(), {
      locationId: canteenId,
      lines: [{ itemType: "product", itemId: sodaId, countedQuantity: 98 }],
    });

    const result = await recordHandover(testDb, attendant(), {
      cashMinor: 100,
      mpesaMinor: 0,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.handover.expectedCashMinor).toBe(160);
    expect(result.handover.actualCashMinor).toBe(100);
  });

  test("can be recorded with nothing sold yet today — no Takings step blocking it", async () => {
    const result = await recordHandover(testDb, attendant(), { cashMinor: 0, mpesaMinor: 0 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.handover.expectedCashMinor).toBe(0);
  });

  test("a count with no shortfall (nothing sold) leaves the expected total at zero", async () => {
    // Credit sales are dropped entirely for the canteen (docs/scope.md's
    // 2026-08-15 entry) — there is no longer a canteen credit path to
    // exclude from the expected total. What replaces that concern: a
    // count that finds no shortfall infers no sale at all.
    await recordStockCount(testDb, attendant(), {
      locationId: canteenId,
      lines: [{ itemType: "product", itemId: sodaId, countedQuantity: 100 }],
    });

    const result = await recordHandover(testDb, attendant(), { cashMinor: 0, mpesaMinor: 0 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.handover.expectedCashMinor).toBe(0);
  });

  test("a second attempt the same day at the canteen is rejected once the day is closed", async () => {
    await recordStockCount(testDb, attendant(), {
      locationId: canteenId,
      lines: [{ itemType: "product", itemId: sodaId, countedQuantity: 98 }],
    });

    const first = await recordHandover(testDb, attendant(), { cashMinor: 160, mpesaMinor: 0 });
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const second = await recordHandover(testDb, attendant(), { cashMinor: 100, mpesaMinor: 0 });
    expect(second).toEqual({ ok: false, reason: "day_closed" });

    const all = await testDb.handover.findMany({ where: { staffMemberId: "staff-3" } });
    expect(all).toHaveLength(1);
    expect(all[0].actualCashMinor.toNumber()).toBe(160);
  });
});

// recordCounterSale itself is restaurant-only now — kept here as a direct
// regression check alongside sales/tests' own coverage, since a handover
// test file exercising the canteen is exactly where a stale caller would
// have silently no-opped if this gate weren't enforced.
describe("recordCounterSale — canteen (rejected)", () => {
  test("a canteen attendant cannot record an individual sale, even unpaid", async () => {
    const attendant = staffMemberAt("staff-3", "Test Attendant", "attendant", canteenId, "canteen");

    const result = await recordCounterSale(testDb, attendant, {
      lines: [{ productId: sodaId, quantity: 2 }],
      paymentLines: [],
    });

    expect(result).toEqual({ ok: false, reason: "forbidden" });
  });
});

describe("getTodaysHandoverForStaff", () => {
  test("returns null when nothing has been recorded today", async () => {
    const result = await getTodaysHandoverForStaff(testDb, staffAt("cashier", restaurantId));

    expect(result).toEqual({ ok: true, handover: null, canteenAwaitingTodaysCount: false });
  });

  test("returns the requester's own handover for today after recording", async () => {
    await recordHandover(testDb, staffAt("cashier", restaurantId), {
      cashMinor: 100,
      mpesaMinor: 50,
    });

    const result = await getTodaysHandoverForStaff(testDb, staffAt("cashier", restaurantId));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.handover?.actualCashMinor).toBe(100);
    expect(result.handover?.actualMpesaMinor).toBe(50);
  });

  test("never includes another staff member's handover", async () => {
    await recordHandover(
      testDb,
      staffMemberAt("staff-2", "Other Cashier", "cashier", restaurantId),
      { cashMinor: 100, mpesaMinor: 0 },
    );

    const result = await getTodaysHandoverForStaff(testDb, staffAt("cashier", restaurantId));

    expect(result).toEqual({ ok: true, handover: null, canteenAwaitingTodaysCount: false });
  });

  test("at the canteen, returns null with no blocking state when nothing has been recorded today", async () => {
    const attendant = staffMemberAt("staff-3", "Test Attendant", "attendant", canteenId, "canteen");

    const result = await getTodaysHandoverForStaff(testDb, attendant);

    // No stock count has ever been taken at this canteen — formulas.md
    // §10's gap applies from the start, not just once a count exists but
    // falls on an earlier day.
    expect(result).toEqual({ ok: true, handover: null, canteenAwaitingTodaysCount: true });
  });

  test("at the canteen, false once today's own count has landed", async () => {
    const attendant = staffMemberAt("staff-3", "Test Attendant", "attendant", canteenId, "canteen");
    await testDb.stockCount.create({
      data: { locationId: canteenId, staffMemberId: "staff-3", lines: { create: [] } },
    });

    const result = await getTodaysHandoverForStaff(testDb, attendant);

    expect(result).toEqual({ ok: true, handover: null, canteenAwaitingTodaysCount: false });
  });
});

describe("getTodaysHandovers", () => {
  test("a non-owner cannot view the handover roster", async () => {
    const result = await getTodaysHandovers(testDb, staffAt("cashier", restaurantId));

    expect(result).toEqual({ ok: false, reason: "forbidden" });
  });

  test("returns one row per staff member who has recorded a handover today, with their name", async () => {
    await recordHandover(testDb, staffAt("cashier", restaurantId), {
      cashMinor: 100,
      mpesaMinor: 0,
    });
    await recordHandover(
      testDb,
      staffMemberAt("staff-2", "Other Cashier", "cashier", restaurantId),
      { cashMinor: 50, mpesaMinor: 20 },
    );

    const result = await getTodaysHandovers(testDb, staffAt("owner", restaurantId));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.handovers).toHaveLength(2);
    const names = result.handovers.map((h) => h.staffName).sort();
    expect(names).toEqual(["Other Cashier", "Test Cashier"]);
  });

  test("a staff member who has not recorded a handover today does not appear", async () => {
    await recordHandover(testDb, staffAt("cashier", restaurantId), {
      cashMinor: 100,
      mpesaMinor: 0,
    });

    const result = await getTodaysHandovers(testDb, staffAt("owner", restaurantId));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.handovers).toHaveLength(1);
  });

  // 2026-08-13 canteen redesign: the canteen now records real handovers
  // too (docs/proposal.md §5), so the dashboard's roster spans both
  // locations rather than being restaurant-only.
  test("includes handovers from both locations", async () => {
    await recordHandover(testDb, staffAt("cashier", restaurantId), {
      cashMinor: 100,
      mpesaMinor: 0,
    });
    await recordHandover(
      testDb,
      staffMemberAt("staff-3", "Test Attendant", "attendant", canteenId, "canteen"),
      { cashMinor: 50, mpesaMinor: 0 },
    );

    const result = await getTodaysHandovers(testDb, staffAt("owner", restaurantId));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.handovers).toHaveLength(2);
    const names = result.handovers.map((h) => h.staffName).sort();
    expect(names).toEqual(["Test Attendant", "Test Cashier"]);
  });
});

describe("isDayClosedFor", () => {
  test("is false when no handover has been recorded today", async () => {
    const closed = await isDayClosedFor(testDb, "staff-1", restaurantId, new Date());
    expect(closed).toBe(false);
  });

  test("is true once a handover has been recorded for that staff member and location today", async () => {
    await recordHandover(testDb, staffAt("cashier", restaurantId), {
      cashMinor: 100,
      mpesaMinor: 0,
    });

    const closed = await isDayClosedFor(testDb, "staff-1", restaurantId, new Date());
    expect(closed).toBe(true);
  });

  test("is false for a different staff member at the same location on the same day", async () => {
    await recordHandover(testDb, staffAt("cashier", restaurantId), {
      cashMinor: 100,
      mpesaMinor: 0,
    });

    const closed = await isDayClosedFor(testDb, "staff-2", restaurantId, new Date());
    expect(closed).toBe(false);
  });

  test("is false for the same staff member at a different location", async () => {
    await recordHandover(testDb, staffAt("cashier", restaurantId), {
      cashMinor: 100,
      mpesaMinor: 0,
    });

    const closed = await isDayClosedFor(testDb, "staff-1", canteenId, new Date());
    expect(closed).toBe(false);
  });
});

describe("voidSale — day-close enforcement", () => {
  test("a non-owner cannot void a same-day sale after recording their own handover", async () => {
    const recorded = await recordCounterSale(testDb, staffAt("cashier", restaurantId), {
      lines: [{ productId: sodaId, quantity: 1 }],
      paymentLines: [{ method: "cash", amountMinor: 80 }],
    });
    expect(recorded.ok).toBe(true);
    if (!recorded.ok) return;

    const handover = await recordHandover(testDb, staffAt("cashier", restaurantId), {
      cashMinor: 0,
      mpesaMinor: 0,
    });
    expect(handover.ok).toBe(true);

    const result = await voidSale(testDb, staffAt("cashier", restaurantId), recorded.sale.id);

    expect(result).toEqual({ ok: false, reason: "day_closed" });
  });

  test("the owner can still void a same-day sale after the seller's handover is recorded", async () => {
    const recorded = await recordCounterSale(testDb, staffAt("cashier", restaurantId), {
      lines: [{ productId: sodaId, quantity: 1 }],
      paymentLines: [{ method: "cash", amountMinor: 80 }],
    });
    expect(recorded.ok).toBe(true);
    if (!recorded.ok) return;

    await recordHandover(testDb, staffAt("cashier", restaurantId), {
      cashMinor: 0,
      mpesaMinor: 0,
    });

    const owner = staffAt("owner", restaurantId);
    const result = await voidSale(testDb, owner, recorded.sale.id);

    expect(result.ok).toBe(true);
  });

  test("a different staff member's handover does not close this seller's day", async () => {
    const recorded = await recordCounterSale(testDb, staffAt("cashier", restaurantId), {
      lines: [{ productId: sodaId, quantity: 1 }],
      paymentLines: [{ method: "cash", amountMinor: 80 }],
    });
    expect(recorded.ok).toBe(true);
    if (!recorded.ok) return;

    await recordHandover(
      testDb,
      staffMemberAt("staff-2", "Other Cashier", "cashier", restaurantId),
      { cashMinor: 0, mpesaMinor: 0 },
    );

    const result = await voidSale(testDb, staffAt("cashier", restaurantId), recorded.sale.id);

    expect(result.ok).toBe(true);
  });
});
