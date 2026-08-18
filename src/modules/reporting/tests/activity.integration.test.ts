import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { hashPin } from "@/modules/people";
import type { AuthenticatedStaff } from "@/modules/people";
import { recordCounterSale, voidSale } from "@/modules/sales";
import { recordExpense, recordDrawingRepayment } from "@/modules/cash";
import { recordNonSalesConsumption, recordStockCount, correctStockCount, getStockCount } from "@/modules/stock";
import { recordAmendment } from "@/modules/people";
import { getActivity } from "../logic";
import { testDb } from "@/shared/test-db";

let restaurantId: string;
let canteenId: string;
let ownerId: string;
let cashierId: string;
let attendantId: string;
let sodaId: string;

function owner(): AuthenticatedStaff {
  return {
    staff: {
      id: ownerId,
      name: "Lucy",
      phone: "+254700139001",
      role: "owner",
      locationId: restaurantId,
      dailyRateMinor: 0,
      active: true,
    },
    location: { id: restaurantId, code: "restaurant", name: "Test Restaurant" },
  };
}

function cashier(): AuthenticatedStaff {
  return {
    staff: {
      id: cashierId,
      name: "Sarah",
      phone: "+254700139002",
      role: "cashier",
      locationId: restaurantId,
      dailyRateMinor: 550,
      active: true,
    },
    location: { id: restaurantId, code: "restaurant", name: "Test Restaurant" },
  };
}

function attendant(): AuthenticatedStaff {
  return {
    staff: {
      id: attendantId,
      name: "Anne",
      phone: "+254700139003",
      role: "attendant",
      locationId: canteenId,
      dailyRateMinor: 500,
      active: true,
    },
    location: { id: canteenId, code: "canteen", name: "Test Canteen" },
  };
}

async function resetDb() {
  await testDb.amendment.deleteMany({});
  await testDb.repayment.deleteMany({});
  await testDb.paymentLine.deleteMany({});
  await testDb.saleLine.deleteMany({});
  await testDb.sale.deleteMany({});
  await testDb.stockCountLine.deleteMany({});
  await testDb.stockCount.deleteMany({});
  await testDb.stockMovement.deleteMany({});
  await testDb.handover.deleteMany({});
  await testDb.drawingRepayment.deleteMany({});
  await testDb.drawingDebt.deleteMany({});
  await testDb.expense.deleteMany({});
  await testDb.daysWorked.deleteMany({});
  await testDb.staffMember.deleteMany({});
  await testDb.product.deleteMany({});
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

  const pinHash = await hashPin("1234");
  const [ownerRow, cashierRow, attendantRow] = await Promise.all([
    testDb.staffMember.create({
      data: { name: "Lucy", phone: "+254700139001", pinHash, role: "owner", locationId: restaurantId, dailyRateMinor: 0 },
    }),
    testDb.staffMember.create({
      data: { name: "Sarah", phone: "+254700139002", pinHash, role: "cashier", locationId: restaurantId, dailyRateMinor: 550 },
    }),
    testDb.staffMember.create({
      data: { name: "Anne", phone: "+254700139003", pinHash, role: "attendant", locationId: canteenId, dailyRateMinor: 500 },
    }),
  ]);
  ownerId = ownerRow.id;
  cashierId = cashierRow.id;
  attendantId = attendantRow.id;

  const soda = await testDb.product.create({ data: { name: "Soda 500ml", kind: "goods", priceMinor: 80, locationId: restaurantId } });
  sodaId = soda.id;

  // BUG-15's hard guard now rejects a sale line that exceeds on-hand
  // stock, so tests selling sodaId need real stock to sell from first.
  await testDb.stockMovement.create({
    data: { productId: sodaId, locationId: restaurantId, quantity: 100, reason: "received", staffMemberId: cashierId },
  });
  await testDb.stockMovement.create({
    data: { productId: sodaId, locationId: canteenId, quantity: 100, reason: "received", staffMemberId: attendantId },
  });
});

afterAll(async () => {
  await resetDb();
  await testDb.$disconnect();
});

function period() {
  const periodStart = new Date();
  periodStart.setDate(periodStart.getDate() - 10);
  periodStart.setHours(0, 0, 0, 0);
  const periodEnd = new Date();
  periodEnd.setDate(periodEnd.getDate() + 1);
  periodEnd.setHours(0, 0, 0, 0);
  return { periodStart, periodEnd };
}

describe("getActivity", () => {
  test("composes one row per action across sales, stock, cash and people for a multi-person, multi-location fixture", async () => {
    // sale (restaurant, Sarah)
    const sale = await recordCounterSale(testDb, cashier(), {
      lines: [{ productId: sodaId, quantity: 2 }],
      paymentLines: [{ method: "cash", amountMinor: 160 }],
    });
    expect(sale.ok).toBe(true);
    if (!sale.ok) return;

    // void (restaurant, Sarah)
    const voided = await voidSale(testDb, cashier(), sale.sale.id);
    expect(voided.ok).toBe(true);

    // wastage (restaurant, Sarah) — a movement kind
    const wastage = await recordNonSalesConsumption(testDb, cashier(), {
      itemType: "product",
      itemId: sodaId,
      locationId: restaurantId,
      quantity: 1,
      category: "wasted",
    });
    expect(wastage.ok).toBe(true);

    // stock count + owner correction (canteen, Anne counts, Lucy corrects)
    // — 2026-08-15: this count's own shortfall (100 on hand, 5 counted) is
    // now what produces the canteen's "sale" row (docs/scope.md's
    // "Canteen: count-derived sales" entry), so there is no longer a
    // separate recordCounterSale call to seed one — recordCounterSale
    // rejects the canteen outright now.
    const count = await recordStockCount(testDb, attendant(), {
      locationId: canteenId,
      lines: [{ itemType: "product", itemId: sodaId, countedQuantity: 5 }],
    });
    expect(count.ok).toBe(true);
    if (!count.ok) return;
    const countDetail = await getStockCount(testDb, owner(), count.count.id);
    expect(countDetail.ok).toBe(true);
    if (!countDetail.ok || !countDetail.count) return;
    const correctResult = await correctStockCount(testDb, owner(), {
      stockCountId: count.count.id,
      lineId: countDetail.count.lines[0].id,
      correctedQuantity: 4,
    });
    expect(correctResult.ok).toBe(true);

    // handover (canteen, Anne) — seeded directly, same as cash-ledger's test precedent
    await testDb.handover.create({
      data: {
        locationId: canteenId,
        staffMemberId: attendantId,
        expectedCashMinor: 5270,
        expectedMpesaMinor: 0,
        actualCashMinor: 5270,
        actualMpesaMinor: 0,
      },
    });

    // expense (restaurant, owner)
    const expense = await recordExpense(testDb, owner(), {
      locationId: restaurantId,
      category: "running",
      amountMinor: 1600,
      paymentMethod: "cash",
      note: "Charcoal",
    });
    expect(expense.ok).toBe(true);

    // drawing + repayment (business-wide, owner)
    await recordExpense(testDb, owner(), {
      locationId: restaurantId,
      category: "drawing",
      amountMinor: 2000,
      paymentMethod: "cash",
    });
    const repayment = await recordDrawingRepayment(testDb, owner(), {
      amountMinor: 500,
      paymentMethod: "cash",
    });
    expect(repayment.ok).toBe(true);

    // days worked (restaurant, Sarah, recorded by owner)
    await testDb.daysWorked.create({
      data: { staffMemberId: cashierId, date: new Date(), recordedByStaffMemberId: ownerId },
    });

    const { periodStart, periodEnd } = period();
    const result = await getActivity(testDb, owner(), { periodStart, periodEnd, page: 1, pageSize: 50 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const kinds = result.rows.map((r) => r.kind).sort();
    expect(kinds).toEqual(
      [
        "sale", // Sarah's restaurant sale
        "sale", // Anne's canteen sale
        "void",
        "movement", // wastage
        "movement", // the stock count itself
        "movement", // the owner's count correction
        "handover",
        "expense", // running
        "expense", // drawing
        "repayment",
        "days_worked",
      ].sort(),
    );

    const canteenSaleRow = result.rows.find((r) => r.kind === "sale" && r.who === "Anne");
    expect(canteenSaleRow).toBeDefined();

    // voidSale's own stock reversal shares StockMovement.reason
    // "corrected" with an owner's count correction, but must not surface
    // as a second Activity row alongside the "void" row for the same
    // event — exactly one movement row for the count correction, not two.
    const movementRows = result.rows.filter((r) => r.kind === "movement");
    expect(movementRows).toHaveLength(3);
  });

  test("filters by person and by date range, and combines both", async () => {
    const sale1 = await recordCounterSale(testDb, cashier(), {
      lines: [{ productId: sodaId, quantity: 1 }],
      paymentLines: [{ method: "cash", amountMinor: 80 }],
    });
    expect(sale1.ok).toBe(true);

    const attendantSale = await testDb.sale.create({
      data: {
        locationId: canteenId,
        staffMemberId: attendantId,
        fulfilment: "counter",
        totalMinor: 80,
        lines: { create: [{ productId: sodaId, quantity: 1, priceMinor: 80 }] },
        paymentLines: { create: [{ method: "cash", amountMinor: 80 }] },
      },
    });

    const oldSale = new Date();
    oldSale.setDate(oldSale.getDate() - 20);
    await testDb.sale.create({
      data: {
        locationId: restaurantId,
        staffMemberId: cashierId,
        fulfilment: "counter",
        totalMinor: 80,
        occurredAt: oldSale,
        lines: { create: [{ productId: sodaId, quantity: 1, priceMinor: 80 }] },
        paymentLines: { create: [{ method: "cash", amountMinor: 80 }] },
      },
    });

    const { periodStart, periodEnd } = period();

    const byPerson = await getActivity(testDb, owner(), {
      periodStart,
      periodEnd,
      personId: attendantId,
      page: 1,
      pageSize: 50,
    });
    expect(byPerson.ok).toBe(true);
    if (!byPerson.ok) return;
    expect(byPerson.rows).toHaveLength(1);
    expect(byPerson.rows[0].who).toBe("Anne");

    const byDate = await getActivity(testDb, owner(), {
      periodStart,
      periodEnd,
      page: 1,
      pageSize: 50,
    });
    expect(byDate.ok).toBe(true);
    if (!byDate.ok) return;
    // The 20-day-old sale falls outside the 10-day period window.
    expect(byDate.rows.map((r) => r.what)).not.toContain(expect.stringContaining("old"));
    expect(byDate.rows.length).toBe(2);

    const combined = await getActivity(testDb, owner(), {
      periodStart,
      periodEnd,
      personId: cashierId,
      page: 1,
      pageSize: 50,
    });
    expect(combined.ok).toBe(true);
    if (!combined.ok) return;
    expect(combined.rows).toHaveLength(1);
    expect(combined.rows[0].who).toBe("Sarah");

    void attendantSale;
  });

  /**
   * Was "search matches description and reason text", fixtured on a
   * backdated sale correction whose reason string it searched for.
   *
   * T11 removed that mechanism, and with it **the only activity row that
   * ever carried a non-null `reason`** — every remaining row kind sets it
   * to null. The field stays on `ActivityEntry` and `getActivity` still
   * searches it, so a future row kind that carries a reason is matched
   * for free; there is simply nothing producing one today. Asserting on
   * reason text here would mean fabricating a row shape that the app
   * cannot currently emit.
   *
   * So this now covers the half that is still real: matching on the
   * description text.
   */
  test("search matches description text", async () => {
    await recordCounterSale(testDb, cashier(), {
      lines: [{ productId: sodaId, quantity: 1 }],
      paymentLines: [{ method: "cash", amountMinor: 80 }],
    });

    const { periodStart, periodEnd } = period();

    const found = await getActivity(testDb, owner(), {
      periodStart,
      periodEnd,
      search: "Soda",
      page: 1,
      pageSize: 50,
    });
    expect(found.ok).toBe(true);
    if (!found.ok) return;
    expect(found.rows).toHaveLength(1);

    const notFound = await getActivity(testDb, owner(), {
      periodStart,
      periodEnd,
      search: "nonexistent phrase",
      page: 1,
      pageSize: 50,
    });
    expect(notFound.ok).toBe(true);
    if (!notFound.ok) return;
    expect(notFound.rows).toHaveLength(0);
  });

  test("pagination works past one page", async () => {
    for (let i = 0; i < 5; i++) {
      const sale = await recordCounterSale(testDb, cashier(), {
        lines: [{ productId: sodaId, quantity: 1 }],
        paymentLines: [{ method: "cash", amountMinor: 80 }],
      });
      expect(sale.ok).toBe(true);
    }

    const { periodStart, periodEnd } = period();

    const page1 = await getActivity(testDb, owner(), { periodStart, periodEnd, page: 1, pageSize: 2 });
    expect(page1.ok).toBe(true);
    if (!page1.ok) return;
    expect(page1.rows).toHaveLength(2);
    expect(page1.total).toBe(5);

    const page2 = await getActivity(testDb, owner(), { periodStart, periodEnd, page: 2, pageSize: 2 });
    expect(page2.ok).toBe(true);
    if (!page2.ok) return;
    expect(page2.rows).toHaveLength(2);

    const page3 = await getActivity(testDb, owner(), { periodStart, periodEnd, page: 3, pageSize: 2 });
    expect(page3.ok).toBe(true);
    if (!page3.ok) return;
    expect(page3.rows).toHaveLength(1);

    const idsAcrossPages = new Set([...page1.rows, ...page2.rows, ...page3.rows].map((r) => r.id));
    expect(idsAcrossPages.size).toBe(5);
  });

  test("is forbidden for a non-owner", async () => {
    const { periodStart, periodEnd } = period();
    const result = await getActivity(testDb, cashier(), { periodStart, periodEnd, page: 1, pageSize: 50 });

    expect(result).toEqual({ ok: false, reason: "forbidden" });
  });
});

// Editable-ledger T2 — the amendment trail as an Activity source.
describe("getActivity — amendments", () => {
  test("shows an in-place edit in the owner's terms, not the app's", async () => {
    const { periodStart, periodEnd } = period();
    await recordAmendment(testDb, {
      recordType: "StockMovement",
      recordId: "movement-xyz",
      field: "received",
      previousValue: "3",
      newValue: "5",
      staffMemberId: ownerId,
      ledgerContext: "received · Sodas (500ml) · restaurant",
      effectiveDate: new Date("2026-08-16T00:00:00.000Z"),
      locationId: restaurantId,
    });

    const result = await getActivity(testDb, owner(), { periodStart, periodEnd, page: 1, pageSize: 50 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const row = result.rows.find((r) => r.kind === "amendment");
    expect(row).toBeDefined();
    // The row names the cell she edited, never a movement id.
    expect(row?.what).toBe("received · Sodas (500ml) · restaurant: 3 → 5");
    expect(row?.what).not.toContain("movement-xyz");
    expect(row?.who).toBe("Lucy");
    expect(row?.locationName).toBe("Test Restaurant");
  });

  test("separates the ledger day it applies to from the day it was typed", async () => {
    const { periodStart, periodEnd } = period();
    const ledgerDay = new Date("2026-08-16T00:00:00.000Z");
    await recordAmendment(testDb, {
      recordType: "StockMovement",
      recordId: "movement-abc",
      field: "received",
      previousValue: "3",
      newValue: "5",
      staffMemberId: ownerId,
      ledgerContext: "received · Sodas (500ml) · restaurant",
      effectiveDate: ledgerDay,
      locationId: restaurantId,
    });

    const result = await getActivity(testDb, owner(), { periodStart, periodEnd, page: 1, pageSize: 50 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const row = result.rows.find((r) => r.kind === "amendment");
    expect(row?.effectiveOn.getTime()).toBe(ledgerDay.getTime());
    expect(row?.enteredAt.getTime()).toBeGreaterThan(ledgerDay.getTime());
  });

  test("is filterable as its own kind", async () => {
    const { periodStart, periodEnd } = period();
    await recordAmendment(testDb, {
      recordType: "Customer",
      recordId: "customer-1",
      field: "name",
      previousValue: "Mama Njeri",
      newValue: "Mama Njeri Kamau",
      staffMemberId: ownerId,
    });

    const result = await getActivity(testDb, owner(), {
      periodStart,
      periodEnd,
      kind: "amendment",
      page: 1,
      pageSize: 50,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows).toHaveLength(1);
    // No ledger context — the record type and field describe it instead.
    expect(result.rows[0]?.what).toBe("Customer name: Mama Njeri → Mama Njeri Kamau");
  });
});
