import type { ExpenseCategory } from "@/generated/prisma/enums";

export type { ExpenseCategory };

export type Handover = {
  id: string;
  locationId: string;
  staffMemberId: string;
  expectedCashMinor: number;
  expectedMpesaMinor: number;
  actualCashMinor: number;
  actualMpesaMinor: number;
  occurredAt: Date;
};

export type Expense = {
  id: string;
  locationId: string;
  staffMemberId: string;
  category: ExpenseCategory;
  amountMinor: number;
  note: string | null;
  receiptId: string | null;
  occurredAt: Date;
  reversed: boolean;
  reversedAt: Date | null;
  reversedBy: string | null;
};

// CONTEXT.md's Cash Movement: a drawing is "recorded as a cash movement
// out and a debt owed back to the business." One row per drawing-category
// Expense.
export type DrawingDebt = {
  id: string;
  expenseId: string;
  amountMinor: number;
  reversed: boolean;
  reversedAt: Date | null;
};
