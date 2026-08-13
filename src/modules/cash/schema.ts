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
  // Null at the canteen (2026-08-13 revision) — see the schema comment
  // on the Handover model: "not tracked separately here, see
  // expectedCashMinor for the combined total," not "expected zero."
  expectedMpesaMinor: number | null;
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
  // Set only for a wages payment (category = running): who was paid, as
  // distinct from staffMemberId (who recorded the payment). Ticket 35.
  payeeStaffMemberId: string | null;
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

// Ticket 32 — a repayment against the outstanding drawings balance.
// Symmetric to DrawingDebt: append-only, never edited, only reversible.
// paymentMethod added ticket 40 — the cash ledger needs a method on
// every transaction, same narrowing as ExpensePaymentMethod.
export type DrawingRepayment = {
  id: string;
  amountMinor: number;
  paymentMethod: ExpensePaymentMethod;
  recordedBy: string;
  occurredAt: Date;
  reversed: boolean;
  reversedAt: Date | null;
};
