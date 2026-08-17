/**
 * Editable-ledger T3 — the three write functions.
 *
 * `amendScalar` (Kind C), `amendDayTotal` (Kind A) and
 * `amendDerivedPosition` (Kind B). Every editable ledger cell routes to one
 * of these; a new editable figure declares its kind and gets the semantics
 * for free (plan C1).
 *
 * The most valuable test here is C3's reconciliation invariant, at the
 * bottom: for any product, location and date range,
 * `closing == opening + in − out + corrected`, computed independently of
 * `buildProductLedgerRow`, holding after an arbitrary sequence of random
 * amendments. It is what catches a Kind B correction landing on the wrong
 * side of a date boundary and a `reversed: false` filter missed in one of
 * the sum sites.
 *
 * ## The boundary timestamps, stated once
 *
 * Two conventions in the existing code decide these, and they disagree:
 *
 *  - a ledger **day** D is the half-open interval `(D 00:00, D+1 00:00]`
 *    (`daysInPeriod` + `occurredAt: { gt: periodStart, lte: periodEnd }`)
 *  - **opening** at D is `occurredAt <= D 00:00` (`...AsOf`, `lte`)
 *
 * So for "opening on D should be N", the correction must be stamped at
 * **exactly `D 00:00:00.000`**: `lte` includes it in D's opening, while
 * `gt` excludes it from D's own movement columns. Stamping it a
 * millisecond earlier or later breaks one of the two.
 *
 * For "closing on D should be N", the same instant one day later:
 * `D+1 00:00:00.000`, which is D's own `lte` end and therefore inside D.
 */

import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";
import { hashPin } from "@/modules/people";
import type { AuthenticatedStaff } from "@/modules/people";
import { testDb } from "@/shared/test-db";
import { getProductLedger } from "@/modules/reporting";
import { amendDayTotal, amendDerivedPosition, amendScalar } from "../logic";

let restaurantId: string;
let productId: string;
let ownerId: string;
let cashierId: string;

const D = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const at = (iso: string, time: string) => new Date(`${iso}T${time}Z`);

function staffAt(role: "owner" | "cashier", id: string): AuthenticatedStaff {
  return {
    staff: {
      id,
      name: role === "owner" ? "Amend Owner" : "Amend Cashier",
      phone: role === "owner" ? "+254700444001" : "+254700444002",
      role,
      locationId: restaurantId,
      dailyRateMinor: 0,
      active: true,
    },
    location: { id: restaurantId, code: "restaurant", name: "Test" },
  };
}

const owner = () => staffAt("owner", ownerId);
const cashier = () => staffAt("cashier", cashierId);

beforeAll(async () => {
  await testDb.amendment.deleteMany({});
  await testDb.stockMovement.deleteMany({});
  await testDb.product.deleteMany({});
  await testDb.staffMember.deleteMany({});
  await testDb.location.deleteMany({});

  const restaurant = await testDb.location.create({
    data: { code: "restaurant", name: "Amend Restaurant" },
  });
  await testDb.location.create({ data: { code: "canteen", name: "Amend Canteen" } });
  restaurantId = restaurant.id;

  const ownerRow = await testDb.staffMember.create({
    data: {
      name: "Amend Owner",
      phone: "+254700444001",
      pinHash: await hashPin("1234"),
      role: "owner",
      locationId: restaurant.id,
      dailyRateMinor: 0,
    },
  });
  ownerId = ownerRow.id;

  const cashierRow = await testDb.staffMember.create({
    data: {
      name: "Amend Cashier",
      phone: "+254700444002",
      pinHash: await hashPin("1234"),
      role: "cashier",
      locationId: restaurant.id,
      dailyRateMinor: 500,
    },
  });
  cashierId = cashierRow.id;

  const product = await testDb.product.create({
    data: {
      name: "Beef stew",
      kind: "goods",
      locationId: restaurant.id,
      priceMinor: 300,
      lastKnownCostMinor: 180,
    },
  });
  productId = product.id;
});

afterEach(async () => {
  await testDb.amendment.deleteMany({});
  await testDb.stockMovement.deleteMany({});
});

afterAll(async () => {
  await testDb.amendment.deleteMany({});
  await testDb.stockMovement.deleteMany({});
  await testDb.product.deleteMany({});
  await testDb.staffMember.deleteMany({});
  await testDb.location.deleteMany({});
  await testDb.$disconnect();
});

async function movement(
  quantity: number,
  reason: "received" | "sold" | "produced" | "wasted",
  occurredAt: Date,
) {
  return testDb.stockMovement.create({
    data: {
      productId,
      locationId: restaurantId,
      quantity,
      reason,
      staffMemberId: cashierId,
      occurredAt,
    },
  });
}

/** The ledger row for one product over a period, via the real read path. */
async function ledgerRow(periodStart: Date, periodEnd: Date) {
  const result = await getProductLedger(testDb, owner(), { periodStart, periodEnd });
  if (!result.ok) throw new Error(`ledger read failed: ${result.reason}`);
  return result.rows.find((r) => r.productId === productId);
}

describe("amendDayTotal — Kind A", () => {
  test("edits the row in place when exactly one backs the day", async () => {
    const original = await movement(3, "received", at("2026-08-16", "09:00:00.000"));

    const result = await amendDayTotal(testDb, owner(), {
      itemType: "product",
      itemId: productId,
      locationId: restaurantId,
      date: D("2026-08-16"),
      reason: "received",
      newTotal: 5,
    });
    expect(result.ok).toBe(true);

    const reloaded = await testDb.stockMovement.findUnique({ where: { id: original.id } });
    // The delivery becomes 5, because one delivery is what happened — no
    // second balancing row posing as another delivery (plan §3.1).
    expect(reloaded?.quantity.toNumber()).toBe(5);
    expect(await testDb.stockMovement.count()).toBe(1);
  });

  test("the trail records the day-level fact, not the row that absorbed it", async () => {
    await movement(3, "received", at("2026-08-16", "09:00:00.000"));

    await amendDayTotal(testDb, owner(), {
      itemType: "product",
      itemId: productId,
      locationId: restaurantId,
      date: D("2026-08-16"),
      reason: "received",
      newTotal: 5,
    });

    const amendments = await testDb.amendment.findMany({});
    expect(amendments).toHaveLength(1);
    expect(amendments[0]).toMatchObject({
      field: "received",
      previousValue: "3",
      newValue: "5",
      staffMemberId: ownerId,
      locationId: restaurantId,
    });
    expect(amendments[0]?.effectiveDate?.getTime()).toBe(D("2026-08-16").getTime());
    // "which of the three deliveries" is a question she never asked to be
    // asked — the trail states the fact she stated.
    expect(amendments[0]?.ledgerContext).toContain("received");
    expect(amendments[0]?.ledgerContext).toContain("Beef stew");
  });

  test("the most recent row absorbs the difference when several back the day", async () => {
    await movement(1, "received", at("2026-08-16", "08:00:00.000"));
    await movement(1, "received", at("2026-08-16", "10:00:00.000"));
    const latest = await movement(1, "received", at("2026-08-16", "14:00:00.000"));

    await amendDayTotal(testDb, owner(), {
      itemType: "product",
      itemId: productId,
      locationId: restaurantId,
      date: D("2026-08-16"),
      reason: "received",
      newTotal: 5,
    });

    const reloaded = await testDb.stockMovement.findUnique({ where: { id: latest.id } });
    expect(reloaded?.quantity.toNumber()).toBe(3);

    const row = await ledgerRow(D("2026-08-16"), at("2026-08-16", "23:59:59.999"));
    expect(row?.received).toBe(5);
  });

  test("writes one new movement when the day has no rows for that reason", async () => {
    const result = await amendDayTotal(testDb, owner(), {
      itemType: "product",
      itemId: productId,
      locationId: restaurantId,
      date: D("2026-08-16"),
      reason: "received",
      newTotal: 5,
    });
    expect(result.ok).toBe(true);

    const rows = await testDb.stockMovement.findMany({});
    expect(rows).toHaveLength(1);
    expect(rows[0]?.quantity.toNumber()).toBe(5);
    // Flagged so the UI labels it a correction rather than dressing it as
    // an ordinary delivery.
    expect(rows[0]?.isAmendment).toBe(true);
    // Real stock movement, so it counts in every sum.
    expect(rows[0]?.reversed).toBe(false);
  });

  test("handles an out-reason, where quantity is stored negative", async () => {
    await movement(-8, "sold", at("2026-08-16", "12:00:00.000"));

    await amendDayTotal(testDb, owner(), {
      itemType: "product",
      itemId: productId,
      locationId: restaurantId,
      date: D("2026-08-16"),
      reason: "sold",
      newTotal: 6,
    });

    const row = await ledgerRow(D("2026-08-16"), at("2026-08-16", "23:59:59.999"));
    // The ledger's `sold` column is a positive "out" figure...
    expect(row?.sold).toBe(6);
    // ...while the movement stays signed negative. A wrong sign here turns
    // a sale into a delivery.
    const rows = await testDb.stockMovement.findMany({});
    expect(rows[0]?.quantity.toNumber()).toBe(-6);
  });

  test("is owner-only", async () => {
    await movement(3, "received", at("2026-08-16", "09:00:00.000"));

    const result = await amendDayTotal(testDb, cashier(), {
      itemType: "product",
      itemId: productId,
      locationId: restaurantId,
      date: D("2026-08-16"),
      reason: "received",
      newTotal: 5,
    });

    expect(result).toEqual({ ok: false, reason: "forbidden" });
    expect(await testDb.amendment.count()).toBe(0);
  });

  test("a no-op edit writes nothing at all", async () => {
    await movement(3, "received", at("2026-08-16", "09:00:00.000"));

    const result = await amendDayTotal(testDb, owner(), {
      itemType: "product",
      itemId: productId,
      locationId: restaurantId,
      date: D("2026-08-16"),
      reason: "received",
      newTotal: 3,
    });

    expect(result.ok).toBe(true);
    expect(await testDb.amendment.count()).toBe(0);
    expect(await testDb.stockMovement.count()).toBe(1);
  });

  test("only touches the named day, leaving neighbours alone", async () => {
    await movement(3, "received", at("2026-08-15", "09:00:00.000"));
    await movement(3, "received", at("2026-08-16", "09:00:00.000"));
    await movement(3, "received", at("2026-08-17", "09:00:00.000"));

    await amendDayTotal(testDb, owner(), {
      itemType: "product",
      itemId: productId,
      locationId: restaurantId,
      date: D("2026-08-16"),
      reason: "received",
      newTotal: 5,
    });

    const row = await ledgerRow(D("2026-08-15"), at("2026-08-17", "23:59:59.999"));
    const byDate = new Map(row?.days.map((d) => [d.date, d]));
    expect(byDate.get("2026-08-15")?.received).toBe(3);
    expect(byDate.get("2026-08-16")?.received).toBe(5);
    expect(byDate.get("2026-08-17")?.received).toBe(3);
  });
});

describe("amendDerivedPosition — Kind B", () => {
  test("opening = N shifts every following day by the same delta", async () => {
    // The worked example from the plan: opening on 16 Aug shows 1, she
    // types 5, so a corrected +4 lands before the day starts.
    await movement(1, "received", at("2026-08-14", "09:00:00.000"));
    await movement(2, "received", at("2026-08-16", "09:00:00.000"));
    await movement(-1, "sold", at("2026-08-17", "09:00:00.000"));

    const result = await amendDerivedPosition(testDb, owner(), {
      itemType: "product",
      itemId: productId,
      locationId: restaurantId,
      date: D("2026-08-16"),
      position: "opening",
      newValue: 5,
    });
    expect(result.ok).toBe(true);

    const row = await ledgerRow(D("2026-08-15"), at("2026-08-18", "23:59:59.999"));
    const byDate = new Map(row?.days.map((d) => [d.date, d]));
    expect(byDate.get("2026-08-16")?.opening).toBe(5);
    expect(byDate.get("2026-08-16")?.closing).toBe(7);
    expect(byDate.get("2026-08-17")?.opening).toBe(7);
    expect(byDate.get("2026-08-17")?.closing).toBe(6);
  });

  test("the correction row is labelled, never dressed as a delivery", async () => {
    await movement(1, "received", at("2026-08-14", "09:00:00.000"));

    await amendDerivedPosition(testDb, owner(), {
      itemType: "product",
      itemId: productId,
      locationId: restaurantId,
      date: D("2026-08-16"),
      position: "opening",
      newValue: 5,
    });

    const correction = await testDb.stockMovement.findFirst({ where: { reason: "corrected" } });
    expect(correction).not.toBeNull();
    expect(correction?.quantity.toNumber()).toBe(4);
    expect(correction?.isAmendment).toBe(true);
    // Not a receipt, not a production — reason "corrected" is what makes
    // the row truthful (plan §3.1's Kind B note).
    expect(correction?.reason).toBe("corrected");
    expect(correction?.receiptId).toBeNull();
  });

  test("an opening correction lands on the exact day boundary", async () => {
    await movement(1, "received", at("2026-08-14", "09:00:00.000"));

    await amendDerivedPosition(testDb, owner(), {
      itemType: "product",
      itemId: productId,
      locationId: restaurantId,
      date: D("2026-08-16"),
      position: "opening",
      newValue: 5,
    });

    const correction = await testDb.stockMovement.findFirst({ where: { reason: "corrected" } });
    // Exactly D 00:00:00.000 — inside opening's `lte`, outside the day's
    // own `gt`. See this file's header.
    expect(correction?.occurredAt.toISOString()).toBe("2026-08-16T00:00:00.000Z");
  });

  test("an opening correction does not appear in that day's own movement columns", async () => {
    await movement(1, "received", at("2026-08-14", "09:00:00.000"));
    await movement(2, "received", at("2026-08-16", "09:00:00.000"));

    await amendDerivedPosition(testDb, owner(), {
      itemType: "product",
      itemId: productId,
      locationId: restaurantId,
      date: D("2026-08-16"),
      position: "opening",
      newValue: 5,
    });

    const row = await ledgerRow(D("2026-08-16"), at("2026-08-16", "23:59:59.999"));
    const day = row?.days.find((d) => d.date === "2026-08-16");
    // The +4 belongs to the gap before the day, not to the day's receipts.
    expect(day?.received).toBe(2);
    expect(day?.corrected).toBe(0);
    expect(day?.opening).toBe(5);
  });

  /**
   * The plan's §3.1 says days *before* D "keep their own openings and
   * closings unchanged", with the adjustment sitting "in the gap between
   * D−1's close and D's open".
   *
   * **There is no such gap, and that wording is unachievable.** Day
   * windows are contiguous — D−1 is `(D−1 00:00, D 00:00]` and opening at
   * D is `<= D 00:00` — so the instant that raises D's opening is
   * necessarily inside D−1's window. Stamping it a millisecond earlier
   * changes nothing; it is still inside D−1.
   *
   * The resolution is that D−1's *closing* moves, and it must: D−1's
   * closing and D's opening are the same quantity viewed from two sides.
   * Leaving them different would mean the ledger says stock was 1 at the
   * end of the 15th and 5 at the start of the 16th, with nothing in
   * between — which is precisely the unexplained jump the reconciliation
   * invariant exists to forbid.
   *
   * Days strictly before D−1 are untouched, which is the part of the
   * plan's intent that survives.
   */
  test("the correction lands on the boundary, so D−1's closing moves with D's opening", async () => {
    await movement(1, "received", at("2026-08-14", "09:00:00.000"));

    await amendDerivedPosition(testDb, owner(), {
      itemType: "product",
      itemId: productId,
      locationId: restaurantId,
      date: D("2026-08-16"),
      position: "opening",
      newValue: 5,
    });

    const row = await ledgerRow(D("2026-08-14"), at("2026-08-16", "23:59:59.999"));
    const byDate = new Map(row?.days.map((d) => [d.date, d]));
    // Strictly earlier days are untouched.
    expect(byDate.get("2026-08-14")?.closing).toBe(1);
    expect(byDate.get("2026-08-15")?.opening).toBe(1);
    // D−1's closing is D's opening. They agree, as they must.
    expect(byDate.get("2026-08-15")?.closing).toBe(5);
    expect(byDate.get("2026-08-16")?.opening).toBe(5);
    // And the movement is visible in D−1's corrections column, so the jump
    // is explained on screen rather than unaccounted for.
    expect(byDate.get("2026-08-15")?.corrected).toBe(4);
  });

  test("closing = N leaves that day's opening and movements unchanged", async () => {
    await movement(1, "received", at("2026-08-15", "09:00:00.000"));
    await movement(2, "received", at("2026-08-16", "09:00:00.000"));

    const result = await amendDerivedPosition(testDb, owner(), {
      itemType: "product",
      itemId: productId,
      locationId: restaurantId,
      date: D("2026-08-16"),
      position: "closing",
      newValue: 10,
    });
    expect(result.ok).toBe(true);

    const row = await ledgerRow(D("2026-08-15"), at("2026-08-17", "23:59:59.999"));
    const byDate = new Map(row?.days.map((d) => [d.date, d]));
    expect(byDate.get("2026-08-16")?.opening).toBe(1);
    expect(byDate.get("2026-08-16")?.received).toBe(2);
    expect(byDate.get("2026-08-16")?.closing).toBe(10);
    // D+1's opening becomes N and cascades on.
    expect(byDate.get("2026-08-17")?.opening).toBe(10);
  });

  test("a closing correction lands at the end of the day it closes", async () => {
    await movement(1, "received", at("2026-08-16", "09:00:00.000"));

    await amendDerivedPosition(testDb, owner(), {
      itemType: "product",
      itemId: productId,
      locationId: restaurantId,
      date: D("2026-08-16"),
      position: "closing",
      newValue: 10,
    });

    const correction = await testDb.stockMovement.findFirst({ where: { reason: "corrected" } });
    // D+1 00:00:00.000 — the `lte` end of day D, so it is inside D.
    expect(correction?.occurredAt.toISOString()).toBe("2026-08-17T00:00:00.000Z");
  });

  test("records the day-level fact in the trail", async () => {
    await movement(1, "received", at("2026-08-14", "09:00:00.000"));

    await amendDerivedPosition(testDb, owner(), {
      itemType: "product",
      itemId: productId,
      locationId: restaurantId,
      date: D("2026-08-16"),
      position: "opening",
      newValue: 5,
    });

    const amendments = await testDb.amendment.findMany({});
    expect(amendments).toHaveLength(1);
    expect(amendments[0]).toMatchObject({
      field: "opening",
      previousValue: "1",
      newValue: "5",
    });
  });

  test("is owner-only", async () => {
    const result = await amendDerivedPosition(testDb, cashier(), {
      itemType: "product",
      itemId: productId,
      locationId: restaurantId,
      date: D("2026-08-16"),
      position: "opening",
      newValue: 5,
    });
    expect(result).toEqual({ ok: false, reason: "forbidden" });
    expect(await testDb.stockMovement.count()).toBe(0);
  });

  test("a no-op edit writes nothing", async () => {
    await movement(5, "received", at("2026-08-14", "09:00:00.000"));

    const result = await amendDerivedPosition(testDb, owner(), {
      itemType: "product",
      itemId: productId,
      locationId: restaurantId,
      date: D("2026-08-16"),
      position: "opening",
      newValue: 5,
    });

    expect(result.ok).toBe(true);
    expect(await testDb.stockMovement.count()).toBe(1);
    expect(await testDb.amendment.count()).toBe(0);
  });
});

describe("amendScalar — Kind C", () => {
  test("edits a product's selling price in place and trails it", async () => {
    const result = await amendScalar(testDb, owner(), {
      recordType: "Product",
      recordId: productId,
      field: "priceMinor",
      newValue: 350,
      locationId: restaurantId,
      ledgerContext: "selling price · Beef stew",
    });
    expect(result.ok).toBe(true);

    const product = await testDb.product.findUnique({ where: { id: productId } });
    expect(product?.priceMinor?.toNumber()).toBe(350);

    const amendments = await testDb.amendment.findMany({});
    expect(amendments).toHaveLength(1);
    expect(amendments[0]).toMatchObject({
      recordType: "Product",
      field: "priceMinor",
      previousValue: "300",
      newValue: "350",
    });

    // Restore, so later tests see the seeded price.
    await testDb.product.update({ where: { id: productId }, data: { priceMinor: 300 } });
  });

  test("is owner-only", async () => {
    const result = await amendScalar(testDb, cashier(), {
      recordType: "Product",
      recordId: productId,
      field: "priceMinor",
      newValue: 999,
    });
    expect(result).toEqual({ ok: false, reason: "forbidden" });

    const product = await testDb.product.findUnique({ where: { id: productId } });
    expect(product?.priceMinor?.toNumber()).toBe(300);
  });

  test("rejects a field that is not editable, rather than writing it", async () => {
    const result = await amendScalar(testDb, owner(), {
      recordType: "Product",
      recordId: productId,
      // Not on the allow-list: an editable-field allow-list is what stops a
      // ledger cell id becoming an arbitrary column write.
      field: "id",
      newValue: 1,
    });
    expect(result).toEqual({ ok: false, reason: "field_not_editable" });
  });

  test("a no-op edit writes nothing", async () => {
    const result = await amendScalar(testDb, owner(), {
      recordType: "Product",
      recordId: productId,
      field: "priceMinor",
      newValue: 300,
    });
    expect(result.ok).toBe(true);
    expect(await testDb.amendment.count()).toBe(0);
  });
});

/**
 * C3 — the reconciliation invariant, property-based.
 *
 * `closing == opening + in − out + corrected` must hold for every day and
 * for the period as a whole, after an arbitrary sequence of amendments.
 * The identity is computed here from the ledger's own published columns,
 * independently of how `buildProductLedgerRow` derived them — opening and
 * closing come from separate as-of reads, so this really is checking two
 * code paths against each other rather than restating one.
 */
describe("C3 — the reconciliation invariant holds after arbitrary amendments", () => {
  const PERIOD_START = D("2026-08-14");
  const PERIOD_END = at("2026-08-20", "23:59:59.999");

  function assertReconciles(row: NonNullable<Awaited<ReturnType<typeof ledgerRow>>>) {
    // Period level.
    const periodClosing =
      row.openingQty +
      row.produced +
      row.received +
      row.transferredIn +
      row.corrected -
      row.sold -
      row.transferredOut -
      row.nonSales;
    expect(periodClosing).toBeCloseTo(row.closingQty, 6);

    // Day level, and the chain between days.
    let expectedOpening = row.openingQty;
    for (const day of row.days) {
      expect(day.opening).toBeCloseTo(expectedOpening, 6);
      const dayClosing =
        day.opening +
        day.produced +
        day.received +
        day.transferredIn +
        day.corrected -
        day.sold -
        day.transferredOut -
        day.nonSales;
      expect(day.closing).toBeCloseTo(dayClosing, 6);
      expectedOpening = day.closing;
    }
    expect(expectedOpening).toBeCloseTo(row.closingQty, 6);
  }

  test("holds on a seeded ledger before any amendment", async () => {
    await movement(20, "received", at("2026-08-14", "09:00:00.000"));
    await movement(-6, "sold", at("2026-08-15", "12:00:00.000"));
    await movement(-2, "wasted", at("2026-08-16", "15:00:00.000"));
    await movement(10, "produced", at("2026-08-17", "08:00:00.000"));

    const row = await ledgerRow(PERIOD_START, PERIOD_END);
    expect(row).toBeDefined();
    assertReconciles(row!);
  });

  test("holds after a pseudo-random sequence of amendments", async () => {
    // Deterministic PRNG: a failure must be reproducible, so no Math.random.
    let seed = 20260817;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)]!;
    const dates = ["2026-08-14", "2026-08-15", "2026-08-16", "2026-08-17", "2026-08-18"] as const;
    const reasons = ["received", "produced", "sold"] as const;

    // A starting ledger with something on every day.
    await movement(30, "received", at("2026-08-14", "09:00:00.000"));
    for (const date of dates) {
      await movement(-2, "sold", at(date, "12:00:00.000"));
      await movement(3, "received", at(date, "16:00:00.000"));
    }

    for (let i = 0; i < 40; i++) {
      const date = D(pick(dates));
      const roll = rand();
      if (roll < 0.5) {
        await amendDayTotal(testDb, owner(), {
          itemType: "product",
          itemId: productId,
          locationId: restaurantId,
          date,
          reason: pick(reasons),
          newTotal: Math.floor(rand() * 8),
        });
      } else if (roll < 0.8) {
        await amendDerivedPosition(testDb, owner(), {
          itemType: "product",
          itemId: productId,
          locationId: restaurantId,
          date,
          position: "opening",
          newValue: Math.floor(rand() * 40),
        });
      } else {
        await amendDerivedPosition(testDb, owner(), {
          itemType: "product",
          itemId: productId,
          locationId: restaurantId,
          date,
          position: "closing",
          newValue: Math.floor(rand() * 40),
        });
      }

      const row = await ledgerRow(PERIOD_START, PERIOD_END);
      expect(row, `ledger row missing after amendment ${i}`).toBeDefined();
      assertReconciles(row!);
    }
  });

  test("an amendment sets the figure it names, and the cascade follows", async () => {
    // The property test above proves internal consistency; this proves the
    // amendments actually did something, so a no-op implementation could
    // not pass both.
    await movement(10, "received", at("2026-08-14", "09:00:00.000"));

    await amendDayTotal(testDb, owner(), {
      itemType: "product",
      itemId: productId,
      locationId: restaurantId,
      date: D("2026-08-14"),
      reason: "received",
      newTotal: 25,
    });

    const row = await ledgerRow(PERIOD_START, PERIOD_END);
    expect(row?.received).toBe(25);
    expect(row?.closingQty).toBe(25);
    assertReconciles(row!);
  });
});
