import type { ExpenseCategory, PaymentMethod } from "@/generated/prisma/enums";

export type { ExpenseCategory };
// Expense only ever uses cash or mpesa — never credit, which is a
// sales-side concept for money coming in.
export type ExpensePaymentMethod = Extract<PaymentMethod, "cash" | "mpesa">;

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
  paymentMethod: ExpensePaymentMethod;
  note: string | null;
  receiptId: string | null;
  occurredAt: Date;
  reversed: boolean;
  reversedAt: Date | null;
  reversedBy: string | null;
};

// CONTEXT.md's Takings: cash and M-Pesa totals declared at close, the
// canteen's substitute for per-sale recording — no expected figure, since
// nothing was recorded per-sale to expect against.
export type Takings = {
  id: string;
  locationId: string;
  cashMinor: number;
  mpesaMinor: number;
  occurredAt: Date;
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

// Ticket 32 — a repayment against the outstanding drawings balance.
// Symmetric to DrawingDebt: append-only, never edited, only reversible.
export type DrawingRepayment = {
  id: string;
  amountMinor: number;
  recordedBy: string;
  occurredAt: Date;
  reversed: boolean;
  reversedAt: Date | null;
};
