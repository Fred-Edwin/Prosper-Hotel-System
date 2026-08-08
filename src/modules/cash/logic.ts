import type { PrismaClient } from "@/generated/prisma/client";
import { canAccessLocation, type AuthenticatedStaff } from "@/modules/people";
import { findReceipt } from "@/modules/stock";
import {
  createDrawingDebt,
  createExpense,
  findDrawingDebtByExpenseId,
  findExpenseById,
  listExpensesAtLocation,
  markDrawingDebtReversed,
  markExpenseReversed,
  sumUnreversedDrawingDebt,
} from "./queries";
import type { Expense, ExpenseCategory } from "./schema";

function requireOwner(requester: AuthenticatedStaff): boolean {
  return requester.staff.role === "owner";
}

export type RecordExpenseResult =
  | { ok: true; expense: Expense }
  | {
      ok: false;
      reason: "forbidden" | "invalid_amount" | "receipt_required" | "receipt_not_found";
    };

export async function recordExpense(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  input: {
    locationId: string;
    category: ExpenseCategory;
    amountMinor: number;
    note?: string | null;
    receiptId?: string | null;
  },
): Promise<RecordExpenseResult> {
  if (!requireOwner(requester)) {
    return { ok: false, reason: "forbidden" };
  }

  if (input.amountMinor <= 0) {
    return { ok: false, reason: "invalid_amount" };
  }

  if (input.category === "stock") {
    if (!input.receiptId) {
      return { ok: false, reason: "receipt_required" };
    }
    const receipt = await findReceipt(db, input.receiptId);
    if (!receipt || receipt.locationId !== input.locationId) {
      return { ok: false, reason: "receipt_not_found" };
    }
  }

  const expense = await createExpense(db, {
    locationId: input.locationId,
    staffMemberId: requester.staff.id,
    category: input.category,
    amountMinor: input.amountMinor,
    note: input.note ?? null,
    receiptId: input.category === "stock" ? (input.receiptId ?? null) : null,
  });

  // CONTEXT.md: a drawing is "recorded as a cash movement out and a debt
  // owed back to the business."
  if (input.category === "drawing") {
    await createDrawingDebt(db, { expenseId: expense.id, amountMinor: input.amountMinor });
  }

  return { ok: true, expense };
}

// No "settled" concept exists yet (ticket 16) — the simplest honest shape
// is a single ever-growing total of unreversed drawing debt.
export async function drawingDebtOwed(db: PrismaClient): Promise<number> {
  return sumUnreversedDrawingDebt(db);
}

export type ReverseExpenseResult =
  | { ok: true; expense: Expense }
  | { ok: false; reason: "forbidden" | "not_found" | "already_reversed" | "not_same_day" };

// Owner-only (unlike voidSale, which any role at the location can do) —
// architecture.md: "only the owner... pays money out," so only she
// corrects a wrong payment. Same-day only; post-close reversal is out of
// scope (no "closed day" state exists yet).
export async function reverseExpense(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  expenseId: string,
): Promise<ReverseExpenseResult> {
  if (!requireOwner(requester)) {
    return { ok: false, reason: "forbidden" };
  }

  const expense = await findExpenseById(db, expenseId);
  if (!expense) return { ok: false, reason: "not_found" };

  if (expense.reversed) return { ok: false, reason: "already_reversed" };

  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  if (expense.occurredAt < dayStart) return { ok: false, reason: "not_same_day" };

  if (expense.category === "drawing") {
    const debt = await findDrawingDebtByExpenseId(db, expenseId);
    if (debt && !debt.reversed) {
      await markDrawingDebtReversed(db, debt.id);
    }
  }

  const reversed = await markExpenseReversed(db, expenseId, requester.staff.id);
  return { ok: true, expense: reversed };
}

export type ListExpensesResult =
  | { ok: true; expenses: Expense[] }
  | { ok: false; reason: "forbidden" };

// Read is owner-only too — architecture.md: recording payments out is
// owner-restricted, and money-out's screen is owner-only end to end.
export async function listExpenses(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  locationId: string,
  category?: ExpenseCategory,
): Promise<ListExpensesResult> {
  if (
    !requireOwner(requester) ||
    !canAccessLocation(requester.staff.role, requester.staff.locationId, locationId)
  ) {
    return { ok: false, reason: "forbidden" };
  }

  const expenses = await listExpensesAtLocation(db, locationId, category);
  return { ok: true, expenses };
}
