import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { hashPin } from "@/modules/people";
import type { AuthenticatedStaff } from "@/modules/people";
import { recordExpense, recordDrawingRepayment } from "@/modules/cash";
import { getCashLedger } from "../logic";
import { testDb } from "@/shared/test-db";

let restaurantId: string;
let canteenId: string;
let ownerId: string;
let cashierId: string;

function owner(): AuthenticatedStaff {
  return {
    staff: {
      id: ownerId,
      name: "Test Owner",
      phone: "+254700129001",
      role: "owner",
      locationId: restaurantId,
      dailyRateMinor: 0,
      active: true,
    },
    location: { id: restaurantId, code: "restaurant", name: "Test Restaurant" },
  };
}

function attendant(): AuthenticatedStaff {
  return {
    staff: {
      id: "attendant-1",
      name: "Test Attendant",
      phone: "+254700129003",
      role: "attendant",
      locationId: canteenId,
      dailyRateMinor: 0,
      active: true,
    },
    location: { id: canteenId, code: "canteen", name: "Test Canteen" },
  };
}

async function resetDb() {
  await testDb.drawingRepayment.deleteMany({});
  await testDb.drawingDebt.deleteMany({});
  await testDb.expense.deleteMany({});
  await testDb.handover.deleteMany({});
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
      phone: "+254700129004",
      pinHash: await hashPin("1234"),
      role: "owner",
      locationId: restaurant.id,
      dailyRateMinor: 0,
    },
  });
  ownerId = ownerStaff.id;

  const cashierStaff = await testDb.staffMember.create({
    data: {
      name: "Test Cashier",
      phone: "+254700129002",
      pinHash: await hashPin("1234"),
      role: "cashier",
      locationId: restaurant.id,
      dailyRateMinor: 0,
    },
  });
  cashierId = cashierStaff.id;

  await testDb.staffMember.create({
    data: {
      id: "attendant-1",
      name: "Test Attendant",
      phone: "+254700129003",
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

// Directly seeds a Handover row — recordHandover requires the declaring
// staff member's own today-only path, which doesn't let us backdate across
// a multi-day fixture the way this ledger's day-by-day arithmetic needs to
// be tested.
async function seedHandover(
  staffMemberId: string,
  locationId: string,
  cashMinor: number,
  mpesaMinor: number,
  occurredAt: Date,
) {
  await testDb.handover.create({
    data: {
      locationId,
      staffMemberId,
      expectedCashMinor: cashMinor,
      expectedMpesaMinor: mpesaMinor,
      actualCashMinor: cashMinor,
      actualMpesaMinor: mpesaMinor,
      occurredAt,
    },
  });
}

async function seedExpense(
  category: "stock" | "running" | "asset" | "drawing",
  amountMinor: number,
  paymentMethod: "cash" | "mpesa",
  occurredAt: Date,
) {
  const expense = await testDb.expense.create({
    data: {
      locationId: restaurantId,
      staffMemberId: ownerId,
      category,
      amountMinor,
      paymentMethod,
      occurredAt,
    },
  });
  if (category === "drawing") {
    await testDb.drawingDebt.create({ data: { expenseId: expense.id, amountMinor } });
  }
  return expense;
}

async function seedRepayment(amountMinor: number, paymentMethod: "cash" | "mpesa", occurredAt: Date) {
  return testDb.drawingRepayment.create({
    data: { amountMinor, paymentMethod, recordedBy: ownerId, occurredAt },
  });
}

describe("getCashLedger", () => {
  test("forbidden for non-owner roles", async () => {
    const result = await getCashLedger(testDb, attendant(), {
      periodStart: new Date("2026-08-05T00:00:00Z"),
      periodEnd: new Date("2026-08-06T23:59:59Z"),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("forbidden");
  });

  test("each day's closing balance equals opening plus in minus out, cash and M-Pesa independently, across all five categories", async () => {
    // Day 1 opening is implicitly zero (no prior activity).
    await seedHandover(cashierId, restaurantId, 10000, 5000, new Date("2026-08-05T08:00:00Z"));
    await seedRepayment(2000, "cash", new Date("2026-08-05T09:00:00Z"));
    await seedExpense("stock", 3000, "cash", new Date("2026-08-05T10:00:00Z"));
    await seedExpense("running", 1000, "mpesa", new Date("2026-08-05T11:00:00Z"));
    await seedExpense("asset", 1500, "cash", new Date("2026-08-05T12:00:00Z"));
    await seedExpense("drawing", 500, "mpesa", new Date("2026-08-05T13:00:00Z"));

    const result = await getCashLedger(testDb, owner(), {
      periodStart: new Date("2026-08-05T00:00:00Z"),
      periodEnd: new Date("2026-08-05T23:59:59Z"),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.days).toHaveLength(1);
    const day = result.days[0];
    expect(day.date).toBe("2026-08-05");
    expect(day.openingCashMinor).toBe(0);
    expect(day.openingMpesaMinor).toBe(0);
    // Handover total is cash + M-Pesa combined (10,000 + 5,000) — the
    // column sums money in via that category, same as the reference.
    expect(day.handoversMinor).toBe(15000);
    expect(day.repaymentsMinor).toBe(2000);
    expect(day.stockMinor).toBe(3000);
    expect(day.runningMinor).toBe(1000);
    expect(day.assetsMinor).toBe(1500);
    expect(day.drawingsMinor).toBe(500);
    // Cash: 0 + 10,000 (handover) + 2,000 (repayment) - 3,000 (stock) - 1,500 (asset) = 7,500.
    expect(day.closingCashMinor).toBe(7500);
    // M-Pesa: 0 + 5,000 (handover) - 1,000 (running) - 500 (drawing) = 3,500.
    expect(day.closingMpesaMinor).toBe(3500);
  });

  test("a day's closing balance equals the next day's opening balance", async () => {
    await seedHandover(cashierId, restaurantId, 10000, 0, new Date("2026-08-05T08:00:00Z"));
    await seedExpense("stock", 4000, "cash", new Date("2026-08-05T09:00:00Z"));

    await seedHandover(cashierId, restaurantId, 6000, 0, new Date("2026-08-06T08:00:00Z"));

    const result = await getCashLedger(testDb, owner(), {
      periodStart: new Date("2026-08-05T00:00:00Z"),
      periodEnd: new Date("2026-08-06T23:59:59Z"),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.days).toHaveLength(2);
    const [day1, day2] = result.days;
    expect(day1.closingCashMinor).toBe(6000);
    expect(day2.openingCashMinor).toBe(day1.closingCashMinor);
    expect(day2.closingCashMinor).toBe(12000);
  });

  test("filtering by category narrows both day rows and the expanded transaction list", async () => {
    await seedHandover(cashierId, restaurantId, 10000, 0, new Date("2026-08-05T08:00:00Z"));
    await seedExpense("stock", 4000, "cash", new Date("2026-08-05T09:00:00Z"));

    await seedExpense("running", 2000, "cash", new Date("2026-08-06T09:00:00Z"));

    const result = await getCashLedger(testDb, owner(), {
      periodStart: new Date("2026-08-05T00:00:00Z"),
      periodEnd: new Date("2026-08-06T23:59:59Z"),
      category: "stock",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Only day 1 has a stock transaction.
    expect(result.days).toHaveLength(1);
    expect(result.days[0].date).toBe("2026-08-05");
    expect(result.days[0].transactions).toHaveLength(1);
    expect(result.days[0].transactions[0].category).toBe("stock");
    // Category columns must narrow with the filter too, not just the transaction list —
    // otherwise a filtered day row shows money in a category with nothing matching underneath it.
    expect(result.days[0].stockMinor).toBe(4000);
    expect(result.days[0].handoversMinor).toBe(0);
  });

  test("expanding a day shows its individual transactions with method, category, description, amount, and recorded-by", async () => {
    await seedHandover(cashierId, restaurantId, 10000, 0, new Date("2026-08-05T08:00:00Z"));
    await seedExpense("running", 1500, "mpesa", new Date("2026-08-05T09:00:00Z"));

    const result = await getCashLedger(testDb, owner(), {
      periodStart: new Date("2026-08-05T00:00:00Z"),
      periodEnd: new Date("2026-08-05T23:59:59Z"),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const transactions = result.days[0].transactions;
    expect(transactions).toHaveLength(2);

    const handoverTx = transactions.find((t) => t.category === "handover");
    expect(handoverTx).toBeDefined();
    expect(handoverTx?.method).toBe("cash");
    expect(handoverTx?.amountMinor).toBe(10000);
    expect(handoverTx?.recordedBy).toBe("Test Cashier");

    const expenseTx = transactions.find((t) => t.category === "running");
    expect(expenseTx).toBeDefined();
    expect(expenseTx?.method).toBe("mpesa");
    expect(expenseTx?.amountMinor).toBe(1500);
    expect(expenseTx?.recordedBy).toBe("Test Owner");
  });

  test("empty period has no day rows", async () => {
    const result = await getCashLedger(testDb, owner(), {
      periodStart: new Date("2026-08-05T00:00:00Z"),
      periodEnd: new Date("2026-08-05T23:59:59Z"),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.days).toHaveLength(0);
  });

  test("a reversed expense is excluded from the ledger", async () => {
    await seedHandover(cashierId, restaurantId, 10000, 0, new Date("2026-08-05T08:00:00Z"));
    const expense = await seedExpense("running", 2000, "cash", new Date("2026-08-05T09:00:00Z"));
    await testDb.expense.update({
      where: { id: expense.id },
      data: { reversed: true, reversedAt: new Date(), reversedBy: ownerId },
    });

    const result = await getCashLedger(testDb, owner(), {
      periodStart: new Date("2026-08-05T00:00:00Z"),
      periodEnd: new Date("2026-08-05T23:59:59Z"),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.days[0].runningMinor).toBe(0);
    expect(result.days[0].closingCashMinor).toBe(10000);
    expect(result.days[0].transactions.some((t) => t.category === "running")).toBe(false);
  });

  test("repeated categories on the same day sum correctly (no dedupe by category)", async () => {
    await seedHandover(cashierId, restaurantId, 10000, 0, new Date("2026-08-05T08:00:00Z"));
    await seedExpense("running", 1000, "cash", new Date("2026-08-05T09:00:00Z"));
    await seedExpense("running", 500, "cash", new Date("2026-08-05T10:00:00Z"));

    const result = await getCashLedger(testDb, owner(), {
      periodStart: new Date("2026-08-05T00:00:00Z"),
      periodEnd: new Date("2026-08-05T23:59:59Z"),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.days[0].runningMinor).toBe(1500);
    expect(result.days[0].transactions.filter((t) => t.category === "running")).toHaveLength(2);
  });
});

// Exercises the real owner-facing write paths for expenses/repayments
// (rather than seeding those tables directly), so recordExpense's
// drawing-debt side effect and recordDrawingRepayment's outstanding-balance
// check are both real. Handover is still seeded directly — recordHandover
// requires today-only, own-location, expected-vs-actual machinery this
// ledger test doesn't need to exercise.
describe("getCashLedger, driven through cash's public write paths", () => {
  test("a drawing and its repayment both appear on the ledger", async () => {
    await seedHandover(cashierId, restaurantId, 20000, 0, new Date());
    const expense = await recordExpense(testDb, owner(), {
      locationId: restaurantId,
      category: "drawing",
      amountMinor: 5000,
      paymentMethod: "cash",
    });
    expect(expense.ok).toBe(true);
    const repayment = await recordDrawingRepayment(testDb, owner(), {
      amountMinor: 2000,
      paymentMethod: "cash",
    });
    expect(repayment.ok).toBe(true);

    const today = new Date();
    const periodStart = new Date(today);
    periodStart.setHours(0, 0, 0, 0);
    const periodEnd = new Date(today);
    periodEnd.setHours(23, 59, 59, 999);

    const result = await getCashLedger(testDb, owner(), { periodStart, periodEnd });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.days).toHaveLength(1);
    expect(result.days[0].drawingsMinor).toBe(5000);
    expect(result.days[0].repaymentsMinor).toBe(2000);
    // 20,000 in - 5,000 drawing + 2,000 repaid = 17,000.
    expect(result.days[0].closingCashMinor).toBe(17000);
  });
});
