import type { PrismaClient } from "@/generated/prisma/client";
import type {
  Expense as PrismaExpense,
  DrawingRepayment as PrismaDrawingRepayment,
} from "@/generated/prisma/client";
import type {
  DrawingDebt,
  DrawingRepayment,
  Expense,
  ExpenseCategory,
  ExpensePaymentMethod,
  Handover,
} from "./schema";

// Prisma's generated PaymentMethod is shared with PaymentLine, so it
// includes "credit" — a sales-only concept. createExpense never writes
// it, so this narrowing is safe; it just isn't expressible in the
// Prisma-generated type itself.
function toExpense(row: PrismaExpense): Expense {
  return { ...row, paymentMethod: row.paymentMethod as ExpensePaymentMethod };
}

function toDrawingRepayment(row: PrismaDrawingRepayment): DrawingRepayment {
  return { ...row, paymentMethod: row.paymentMethod as ExpensePaymentMethod };
}

export async function findTodaysHandover(
  db: PrismaClient,
  staffMemberId: string,
  locationId: string,
  dayStart: Date,
  dayEnd: Date,
): Promise<Handover | null> {
  return db.handover.findFirst({
    where: {
      staffMemberId,
      locationId,
      occurredAt: { gte: dayStart, lt: dayEnd },
    },
  });
}

export async function createHandoverRecord(
  db: PrismaClient,
  data: {
    locationId: string;
    staffMemberId: string;
    expectedCashMinor: number;
    // Null at the canteen — see Handover.expectedMpesaMinor's schema
    // comment: "not tracked separately," not "expected zero."
    expectedMpesaMinor: number | null;
    actualCashMinor: number;
    actualMpesaMinor: number;
  },
): Promise<Handover> {
  return db.handover.create({ data });
}

export async function updateHandoverActuals(
  db: PrismaClient,
  id: string,
  data: { actualCashMinor: number; actualMpesaMinor: number },
): Promise<Handover> {
  return db.handover.update({ where: { id }, data });
}

export async function createExpense(
  db: PrismaClient,
  data: {
    locationId: string;
    staffMemberId: string;
    category: ExpenseCategory;
    amountMinor: number;
    paymentMethod: ExpensePaymentMethod;
    note: string | null;
    receiptId: string | null;
    payeeStaffMemberId?: string | null;
  },
): Promise<Expense> {
  const row = await db.expense.create({ data });
  return toExpense(row);
}

export async function createDrawingDebt(
  db: PrismaClient,
  data: { expenseId: string; amountMinor: number },
): Promise<DrawingDebt> {
  return db.drawingDebt.create({ data });
}

export async function findExpenseById(db: PrismaClient, id: string): Promise<Expense | null> {
  const row = await db.expense.findUnique({ where: { id } });
  return row ? toExpense(row) : null;
}

export async function findDrawingDebtByExpenseId(
  db: PrismaClient,
  expenseId: string,
): Promise<DrawingDebt | null> {
  return db.drawingDebt.findUnique({ where: { expenseId } });
}

export async function markExpenseReversed(
  db: PrismaClient,
  expenseId: string,
  reversedBy: string,
): Promise<Expense> {
  const row = await db.expense.update({
    where: { id: expenseId },
    data: { reversed: true, reversedAt: new Date(), reversedBy },
  });
  return toExpense(row);
}

export async function markDrawingDebtReversed(db: PrismaClient, id: string): Promise<DrawingDebt> {
  return db.drawingDebt.update({
    where: { id },
    data: { reversed: true, reversedAt: new Date() },
  });
}

export async function listExpensesAtLocation(
  db: PrismaClient,
  locationId: string,
  category?: ExpenseCategory,
): Promise<Expense[]> {
  const rows = await db.expense.findMany({
    where: { locationId, ...(category ? { category } : {}) },
    orderBy: { occurredAt: "desc" },
  });
  return rows.map(toExpense);
}

// Ticket 25 — formulas.md §7's running costs (gas, charcoal, electricity,
// rent, wages): business-wide, not per-location, so no locationId filter
// — Expense.locationId is always one real location, never "both", so a
// rent payment recorded at either location still counts once here.
// Cancelled entries count nowhere (formulas.md's opening rule) — reversed
// excluded.
export async function sumRunningCostsMinorInPeriod(
  db: PrismaClient,
  periodStart: Date,
  periodEnd: Date,
  locationId?: string,
): Promise<number> {
  const result = await db.expense.aggregate({
    where: {
      category: "running",
      reversed: false,
      occurredAt: { gt: periodStart, lte: periodEnd },
      ...(locationId ? { locationId } : {}),
    },
    _sum: { amountMinor: true },
  });
  return result._sum.amountMinor ?? 0;
}

export async function sumUnreversedDrawingDebt(db: PrismaClient): Promise<number> {
  const result = await db.drawingDebt.aggregate({
    where: { reversed: false },
    _sum: { amountMinor: true },
  });
  return result._sum.amountMinor ?? 0;
}

// Ticket 32 — symmetric counterpart to sumUnreversedDrawingDebt.
export async function sumUnreversedDrawingRepayment(db: PrismaClient): Promise<number> {
  const result = await db.drawingRepayment.aggregate({
    where: { reversed: false },
    _sum: { amountMinor: true },
  });
  return result._sum.amountMinor ?? 0;
}

// Ticket 40 — getRunningCashBalance needs repayments split by method the
// same way handovers and expenses already are, so "money in" actually
// includes every money-in category.
export async function sumUnreversedDrawingRepaymentByMethod(
  db: PrismaClient,
): Promise<{ cashMinor: number; mpesaMinor: number }> {
  const [cash, mpesa] = await Promise.all([
    db.drawingRepayment.aggregate({
      where: { reversed: false, paymentMethod: "cash" },
      _sum: { amountMinor: true },
    }),
    db.drawingRepayment.aggregate({
      where: { reversed: false, paymentMethod: "mpesa" },
      _sum: { amountMinor: true },
    }),
  ]);
  return {
    cashMinor: cash._sum.amountMinor ?? 0,
    mpesaMinor: mpesa._sum.amountMinor ?? 0,
  };
}

export async function createDrawingRepayment(
  db: PrismaClient,
  data: { amountMinor: number; paymentMethod: ExpensePaymentMethod; recordedBy: string },
): Promise<DrawingRepayment> {
  const row = await db.drawingRepayment.create({ data });
  return toDrawingRepayment(row);
}

export async function findDrawingRepaymentById(
  db: PrismaClient,
  id: string,
): Promise<DrawingRepayment | null> {
  const row = await db.drawingRepayment.findUnique({ where: { id } });
  return row ? toDrawingRepayment(row) : null;
}

export async function markDrawingRepaymentReversed(
  db: PrismaClient,
  id: string,
): Promise<DrawingRepayment> {
  const row = await db.drawingRepayment.update({
    where: { id },
    data: { reversed: true, reversedAt: new Date() },
  });
  return toDrawingRepayment(row);
}

// Business-wide, not location-scoped — drawings aren't a location concept
// (proposal.md §6), same reasoning as sumHandoversMinor/sumExpensesMinorByMethod.
export async function listDrawingRepayments(db: PrismaClient): Promise<DrawingRepayment[]> {
  const rows = await db.drawingRepayment.findMany({ orderBy: { occurredAt: "desc" } });
  return rows.map(toDrawingRepayment);
}

// Ticket 40 — the cash ledger's day-expansion needs individual repayment
// rows across an arbitrary period, business-wide like every other
// drawings read. Unreversed only, same convention as sumExpensesMinorByMethod.
export async function listDrawingRepaymentsInPeriod(
  db: PrismaClient,
  periodStart: Date,
  periodEnd: Date,
): Promise<DrawingRepayment[]> {
  const rows = await db.drawingRepayment.findMany({
    where: { reversed: false, occurredAt: { gt: periodStart, lte: periodEnd } },
    orderBy: { occurredAt: "asc" },
  });
  return rows.map(toDrawingRepayment);
}

// Ticket 31 — formulas.md §9's "handovers received" term. Business-wide
// (not per-location, proposal.md §6), all-time (the running balance is
// current, not periodic), cash and M-Pesa kept separate. Handover has no
// void/reversal concept, so every row counts.
export async function sumHandoversMinor(
  db: PrismaClient,
): Promise<{ cashMinor: number; mpesaMinor: number }> {
  const result = await db.handover.aggregate({
    _sum: { actualCashMinor: true, actualMpesaMinor: true },
  });
  return {
    cashMinor: result._sum.actualCashMinor ?? 0,
    mpesaMinor: result._sum.actualMpesaMinor ?? 0,
  };
}

// Ticket 31 — formulas.md §9's money-out terms (stock, running costs,
// equipment/assets, drawings), split by payment method the same way
// money-in already is. Business-wide, all-time, unreversed only —
// cancelled entries count nowhere (formulas.md's opening rule).
export async function sumExpensesMinorByMethod(
  db: PrismaClient,
): Promise<{ cashMinor: number; mpesaMinor: number }> {
  const [cash, mpesa] = await Promise.all([
    db.expense.aggregate({
      where: { reversed: false, paymentMethod: "cash" },
      _sum: { amountMinor: true },
    }),
    db.expense.aggregate({
      where: { reversed: false, paymentMethod: "mpesa" },
      _sum: { amountMinor: true },
    }),
  ]);
  return {
    cashMinor: cash._sum.amountMinor ?? 0,
    mpesaMinor: mpesa._sum.amountMinor ?? 0,
  };
}

export type HandoverWithStaffName = Handover & { staffName: string };

export async function findTodaysHandoversAtLocations(
  db: PrismaClient,
  locationIds: string[],
  dayStart: Date,
  dayEnd: Date,
): Promise<HandoverWithStaffName[]> {
  const handovers = await db.handover.findMany({
    where: { locationId: { in: locationIds }, occurredAt: { gte: dayStart, lt: dayEnd } },
    include: { staffMember: true },
    orderBy: { staffMember: { name: "asc" } },
  });
  return handovers.map(({ staffMember, ...handover }) => ({
    ...handover,
    staffName: staffMember.name,
  }));
}

// Ticket 40 — the cash ledger's day-expansion needs individual handover
// rows across an arbitrary period, business-wide (both locations), unlike
// findTodaysHandoversAtLocations which still takes explicit location ids
// for its own caller's use. No void/reversal concept, so every row counts,
// same as sumHandoversMinor.
export async function listHandoversInPeriod(
  db: PrismaClient,
  periodStart: Date,
  periodEnd: Date,
): Promise<Handover[]> {
  return db.handover.findMany({
    where: { occurredAt: { gt: periodStart, lte: periodEnd } },
    orderBy: { occurredAt: "asc" },
  });
}

// Ticket 40 — the cash ledger's day-expansion needs individual expense
// rows (stock/running/asset/drawing categories) across an arbitrary
// period, business-wide, unreversed only — same convention as
// sumExpensesMinorByMethod/sumRunningCostsMinorInPeriod.
export async function listExpensesInPeriod(
  db: PrismaClient,
  periodStart: Date,
  periodEnd: Date,
): Promise<Expense[]> {
  const rows = await db.expense.findMany({
    where: { reversed: false, occurredAt: { gt: periodStart, lte: periodEnd } },
    orderBy: { occurredAt: "asc" },
  });
  return rows.map(toExpense);
}
