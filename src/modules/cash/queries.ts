import type { PrismaClient } from "@/generated/prisma/client";
import type { DrawingDebt, Expense, ExpenseCategory, Handover } from "./schema";

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
    expectedMpesaMinor: number;
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
    note: string | null;
    receiptId: string | null;
  },
): Promise<Expense> {
  return db.expense.create({ data });
}

export async function createDrawingDebt(
  db: PrismaClient,
  data: { expenseId: string; amountMinor: number },
): Promise<DrawingDebt> {
  return db.drawingDebt.create({ data });
}

export async function findExpenseById(db: PrismaClient, id: string): Promise<Expense | null> {
  return db.expense.findUnique({ where: { id } });
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
  return db.expense.update({
    where: { id: expenseId },
    data: { reversed: true, reversedAt: new Date(), reversedBy },
  });
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
  return db.expense.findMany({
    where: { locationId, ...(category ? { category } : {}) },
    orderBy: { occurredAt: "desc" },
  });
}

export async function sumUnreversedDrawingDebt(db: PrismaClient): Promise<number> {
  const result = await db.drawingDebt.aggregate({
    where: { reversed: false },
    _sum: { amountMinor: true },
  });
  return result._sum.amountMinor ?? 0;
}
