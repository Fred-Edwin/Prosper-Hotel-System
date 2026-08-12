import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { hashPin } from "@/modules/people";
import type { AuthenticatedStaff } from "@/modules/people";
import { recordCounterSale, voidSale, recordSaleCorrection } from "@/modules/sales";
import { recordExpense, recordDrawingRepayment } from "@/modules/cash";
import { recordNonSalesConsumption, recordStockCount, correctStockCount, getStockCount } from "@/modules/stock";
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
  await testDb.repayment.deleteMany({});
  await testDb.paymentLine.deleteMany({});
  await testDb.saleLine.deleteMany({});
  await testDb.sale.deleteMany({});
  await testDb.stockCountLine.deleteMany({});
  await testDb.stockCount.deleteMany({});
  await testDb.stockMovement.deleteMany({});
  await testDb.takings.deleteMany({});
  await testDb.handover.deleteMany({});
  await testDb.drawingRepayment.deleteMany({});
  await testDb.drawingDebt.deleteMany({});
  await testDb.expense.deleteMany({});
  await testDb.daysWorked.deleteMany({});
  await testDb.staffMember.deleteMany({});
  await testDb.location.deleteMany({});
  await testDb.product.deleteMany({});
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

  const soda = await testDb.product.create({ data: { name: "Soda 500ml", kind: "goods", priceMinor: 80 } });
  sodaId = soda.id;
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

    // correction (restaurant, owner Lucy, recorded for Sarah)
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const correction = await recordSaleCorrection(testDb, owner(), {
      staffMemberId: cashierId,
      locationId: restaurantId,
      effectiveDate: threeDaysAgo,
      reason: "M-Pesa message arrived late",
      lines: [{ productId: sodaId, quantity: 1 }],
      paymentLines: [{ method: "cash", amountMinor: 80 }],
    });
    expect(correction.ok).toBe(true);

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

    // takings (canteen, Anne)
    await testDb.takings.create({
      data: { locationId: canteenId, cashMinor: 4800, mpesaMinor: 0, staffMemberId: attendantId },
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
        "sale",
        "void",
        "correction",
        "movement", // wastage
        "movement", // the stock count itself
        "movement", // the owner's count correction
        "handover",
        "takings",
        "expense", // running
        "expense", // drawing
        "repayment",
        "days_worked",
      ].sort(),
    );

    const correctionRow = result.rows.find((r) => r.kind === "correction");
    expect(correctionRow?.reason).toBe("M-Pesa message arrived late");
    expect(correctionRow?.who).toBe("Sarah");
    expect(correctionRow?.effectiveOn.toDateString()).toBe(threeDaysAgo.toDateString());
    expect(correctionRow?.enteredAt.toDateString()).toBe(new Date().toDateString());

    const takingsRow = result.rows.find((r) => r.kind === "takings");
    expect(takingsRow?.who).toBe("Anne");

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
        effectiveAt: oldSale,
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

  test("search matches description and reason text", async () => {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    await recordSaleCorrection(testDb, owner(), {
      staffMemberId: cashierId,
      locationId: restaurantId,
      effectiveDate: threeDaysAgo,
      reason: "M-Pesa message arrived late",
      lines: [{ productId: sodaId, quantity: 1 }],
      paymentLines: [{ method: "cash", amountMinor: 80 }],
    });

    const { periodStart, periodEnd } = period();

    const found = await getActivity(testDb, owner(), {
      periodStart,
      periodEnd,
      search: "M-Pesa message",
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
