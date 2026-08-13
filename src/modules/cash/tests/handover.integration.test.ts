import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { hashPin } from "@/modules/people";
import type { AuthenticatedStaff } from "@/modules/people";
import { recordCounterSale, voidSale } from "@/modules/sales";
import {
  getTodaysHandoverForStaff,
  getTodaysHandoversAtLocation,
  isDayClosedFor,
  recordHandover,
  recordTakings,
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

beforeEach(async () => {
  await testDb.handover.deleteMany({});
  await testDb.takings.deleteMany({});
  await testDb.paymentLine.deleteMany({});
  await testDb.saleLine.deleteMany({});
  await testDb.sale.deleteMany({});
  await testDb.stockMovement.deleteMany({});
  await testDb.customer.deleteMany({});
});

afterAll(async () => {
  await testDb.handover.deleteMany({});
  await testDb.takings.deleteMany({});
  await testDb.paymentLine.deleteMany({});
  await testDb.saleLine.deleteMany({});
  await testDb.sale.deleteMany({});
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
    expect(all[0].actualCashMinor).toBe(100);
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

    await recordTakings(testDb, cashierAtCanteen, { cashMinor: 0, mpesaMinor: 0 });
    const result = await recordHandover(testDb, cashierAtCanteen, { cashMinor: 0, mpesaMinor: 0 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.handover.locationId).toBe(canteenId);
  });
});

describe("recordHandover — canteen", () => {
  function attendant(): AuthenticatedStaff {
    return staffMemberAt("staff-3", "Test Attendant", "attendant", canteenId, "canteen");
  }

  test("expected cash/M-Pesa equal today's recorded Takings exactly, not summed sales", async () => {
    await recordTakings(testDb, attendant(), { cashMinor: 5000, mpesaMinor: 3200 });

    const result = await recordHandover(testDb, attendant(), {
      cashMinor: 5000,
      mpesaMinor: 3200,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.handover.expectedCashMinor).toBe(5000);
    expect(result.handover.expectedMpesaMinor).toBe(3200);
  });

  test("a mismatch between actual and takings-derived expected does not block recording", async () => {
    await recordTakings(testDb, attendant(), { cashMinor: 5000, mpesaMinor: 3200 });

    const result = await recordHandover(testDb, attendant(), {
      cashMinor: 4750,
      mpesaMinor: 3200,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.handover.expectedCashMinor).toBe(5000);
    expect(result.handover.actualCashMinor).toBe(4750);
  });

  test("is blocked with takings_not_recorded when no takings have been recorded yet today", async () => {
    const result = await recordHandover(testDb, attendant(), { cashMinor: 100, mpesaMinor: 0 });

    expect(result).toEqual({ ok: false, reason: "takings_not_recorded" });

    const rows = await testDb.handover.findMany({ where: { locationId: canteenId } });
    expect(rows).toHaveLength(0);
  });

  test("a second attempt the same day at the canteen is rejected once the day is closed", async () => {
    await recordTakings(testDb, attendant(), { cashMinor: 5000, mpesaMinor: 3200 });

    const first = await recordHandover(testDb, attendant(), { cashMinor: 5000, mpesaMinor: 3200 });
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const second = await recordHandover(testDb, attendant(), { cashMinor: 4800, mpesaMinor: 3200 });
    expect(second).toEqual({ ok: false, reason: "day_closed" });

    const all = await testDb.handover.findMany({ where: { staffMemberId: "staff-3" } });
    expect(all).toHaveLength(1);
    expect(all[0].actualCashMinor).toBe(5000);
  });
});

describe("getTodaysHandoverForStaff", () => {
  test("returns null when nothing has been recorded today", async () => {
    const result = await getTodaysHandoverForStaff(testDb, staffAt("cashier", restaurantId));

    expect(result).toEqual({ ok: true, handover: null, takingsRecordedToday: true });
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

    expect(result).toEqual({ ok: true, handover: null, takingsRecordedToday: true });
  });

  test("reports takingsRecordedToday false at the canteen when no takings have been recorded", async () => {
    const attendant = staffMemberAt("staff-3", "Test Attendant", "attendant", canteenId, "canteen");

    const result = await getTodaysHandoverForStaff(testDb, attendant);

    expect(result).toEqual({ ok: true, handover: null, takingsRecordedToday: false });
  });

  test("reports takingsRecordedToday true at the canteen once takings have been recorded", async () => {
    const attendant = staffMemberAt("staff-3", "Test Attendant", "attendant", canteenId, "canteen");
    await recordTakings(testDb, attendant, { cashMinor: 5000, mpesaMinor: 3200 });

    const result = await getTodaysHandoverForStaff(testDb, attendant);

    expect(result).toEqual({ ok: true, handover: null, takingsRecordedToday: true });
  });
});

describe("getTodaysHandoversAtLocation", () => {
  test("a non-owner cannot view the location's handover roster", async () => {
    const result = await getTodaysHandoversAtLocation(
      testDb,
      staffAt("cashier", restaurantId),
      restaurantId,
    );

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

    const result = await getTodaysHandoversAtLocation(
      testDb,
      staffAt("owner", restaurantId),
      restaurantId,
    );

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

    const result = await getTodaysHandoversAtLocation(
      testDb,
      staffAt("owner", restaurantId),
      restaurantId,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.handovers).toHaveLength(1);
  });

  test("does not include handovers from a different location", async () => {
    await recordHandover(
      testDb,
      staffMemberAt("staff-2", "Other Cashier", "cashier", canteenId, "canteen"),
      { cashMinor: 50, mpesaMinor: 0 },
    );

    const result = await getTodaysHandoversAtLocation(
      testDb,
      staffAt("owner", restaurantId),
      restaurantId,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.handovers).toHaveLength(0);
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

describe("recordTakings — day-close enforcement", () => {
  function attendant(): AuthenticatedStaff {
    return staffMemberAt("staff-3", "Test Attendant", "attendant", canteenId, "canteen");
  }

  test("a non-owner cannot edit takings after recording their own handover for the day", async () => {
    await recordTakings(testDb, attendant(), { cashMinor: 5000, mpesaMinor: 3200 });
    const handover = await recordHandover(testDb, attendant(), {
      cashMinor: 5000,
      mpesaMinor: 3200,
    });
    expect(handover.ok).toBe(true);

    const result = await recordTakings(testDb, attendant(), {
      cashMinor: 5100,
      mpesaMinor: 3200,
    });

    expect(result).toEqual({ ok: false, reason: "day_closed" });

    const takings = await testDb.takings.findFirst({ where: { locationId: canteenId } });
    expect(takings?.cashMinor).toBe(5000);
  });

  test("the owner can still edit takings after a handover has been recorded", async () => {
    await recordTakings(testDb, attendant(), { cashMinor: 5000, mpesaMinor: 3200 });
    await recordHandover(testDb, attendant(), { cashMinor: 5000, mpesaMinor: 3200 });

    const owner = staffAt("owner", canteenId, "canteen");
    const result = await recordTakings(testDb, owner, { cashMinor: 5100, mpesaMinor: 3200 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.takings.cashMinor).toBe(5100);
  });

  test("before any handover is recorded, takings can still be edited same-day", async () => {
    await recordTakings(testDb, attendant(), { cashMinor: 5000, mpesaMinor: 3200 });

    const result = await recordTakings(testDb, attendant(), { cashMinor: 5100, mpesaMinor: 3200 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.takings.cashMinor).toBe(5100);
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
