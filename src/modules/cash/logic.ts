import type { PrismaClient } from "@/generated/prisma/client";
import { canAccessLocation, type AuthenticatedStaff } from "@/modules/people";
import { listTodaysSalesForStaff } from "@/modules/sales";
import { findReceipt } from "@/modules/stock";
import {
  createDrawingDebt,
  createExpense,
  createHandoverRecord,
  createTakingsRecord,
  findDrawingDebtByExpenseId,
  findExpenseById,
  findTodaysHandover,
  findTodaysHandoversAtLocation,
  findTodaysTakings,
  listExpensesAtLocation,
  markDrawingDebtReversed,
  markExpenseReversed,
  sumRunningCostsMinorInPeriod,
  sumTakingsMinorAtLocationInPeriod,
  sumUnreversedDrawingDebt,
  updateHandoverActuals,
  updateTakingsAmounts,
  type HandoverWithStaffName,
} from "./queries";
import type { Expense, ExpenseCategory, Handover, Takings } from "./schema";

function dayBounds(): { dayStart: Date; dayEnd: Date } {
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);
  return { dayStart, dayEnd };
}

function requireOwner(requester: AuthenticatedStaff): boolean {
  return requester.staff.role === "owner";
}

// CONTEXT.md's Handover, restaurant case: expected is the sum of that
// person's non-void recorded sales for the day, cash and M-Pesa separately.
// Credit is excluded — no money changed hands at the point of sale.
async function computeExpected(
  db: PrismaClient,
  requester: AuthenticatedStaff,
): Promise<{ expectedCashMinor: number; expectedMpesaMinor: number } | { forbidden: true }> {
  const result = await listTodaysSalesForStaff(db, requester);
  if (!result.ok) return { forbidden: true };

  let expectedCashMinor = 0;
  let expectedMpesaMinor = 0;
  for (const sale of result.sales) {
    if (sale.voided) continue;
    for (const line of sale.paymentLines) {
      if (line.method === "cash") expectedCashMinor += line.amountMinor;
      if (line.method === "mpesa") expectedMpesaMinor += line.amountMinor;
    }
  }
  return { expectedCashMinor, expectedMpesaMinor };
}

export type RecordHandoverResult =
  | { ok: true; handover: Handover }
  | { ok: false; reason: "forbidden" };

// A second attempt the same day, same staff member, same location edits the
// existing row in place rather than creating a second one — proposal.md §5 /
// architecture.md's same-day self-edit rule, mirroring ticket 10's void.
// Expected is recomputed against today's current sales each time this runs,
// so an edit after a late-arriving sale reflects it; a same-day void is
// still same-day so this stays consistent with what listTodaysSalesForStaff
// already excludes.
export async function recordHandover(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  input: { cashMinor: number; mpesaMinor: number },
): Promise<RecordHandoverResult> {
  const locationId = requester.staff.locationId;
  if (!canAccessLocation(requester.staff.role, requester.staff.locationId, locationId)) {
    return { ok: false, reason: "forbidden" };
  }

  const expected = await computeExpected(db, requester);
  if ("forbidden" in expected) return { ok: false, reason: "forbidden" };

  const { dayStart, dayEnd } = dayBounds();
  const existing = await findTodaysHandover(db, requester.staff.id, locationId, dayStart, dayEnd);

  const handover = existing
    ? await updateHandoverActuals(db, existing.id, {
        actualCashMinor: input.cashMinor,
        actualMpesaMinor: input.mpesaMinor,
      })
    : await createHandoverRecord(db, {
        locationId,
        staffMemberId: requester.staff.id,
        expectedCashMinor: expected.expectedCashMinor,
        expectedMpesaMinor: expected.expectedMpesaMinor,
        actualCashMinor: input.cashMinor,
        actualMpesaMinor: input.mpesaMinor,
      });

  return { ok: true, handover };
}

export type GetTodaysHandoverResult =
  | { ok: true; handover: Handover | null }
  | { ok: false; reason: "forbidden" };

export async function getTodaysHandoverForStaff(
  db: PrismaClient,
  requester: AuthenticatedStaff,
): Promise<GetTodaysHandoverResult> {
  const locationId = requester.staff.locationId;
  if (!canAccessLocation(requester.staff.role, requester.staff.locationId, locationId)) {
    return { ok: false, reason: "forbidden" };
  }

  const { dayStart, dayEnd } = dayBounds();
  const handover = await findTodaysHandover(db, requester.staff.id, locationId, dayStart, dayEnd);
  return { ok: true, handover };
}

export type RecordTakingsResult =
  | { ok: true; takings: Takings }
  | { ok: false; reason: "forbidden" | "invalid_amount" };

// CONTEXT.md's Takings: the canteen's structural substitute for per-sale
// recording — no expected figure to compute or compare against, unlike
// recordHandover. Same upsert-if-exists-today shape though: a miscount is
// corrected by re-entry, not a reversing entry (ticket 13's reasoning for
// handover actuals applies the same way here).
export async function recordTakings(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  input: { cashMinor: number; mpesaMinor: number },
): Promise<RecordTakingsResult> {
  const locationId = requester.staff.locationId;
  if (!canAccessLocation(requester.staff.role, requester.staff.locationId, locationId)) {
    return { ok: false, reason: "forbidden" };
  }

  if (input.cashMinor < 0 || input.mpesaMinor < 0) {
    return { ok: false, reason: "invalid_amount" };
  }

  const { dayStart, dayEnd } = dayBounds();
  const existing = await findTodaysTakings(db, locationId, dayStart, dayEnd);

  const takings = existing
    ? await updateTakingsAmounts(db, existing.id, {
        cashMinor: input.cashMinor,
        mpesaMinor: input.mpesaMinor,
      })
    : await createTakingsRecord(db, {
        locationId,
        cashMinor: input.cashMinor,
        mpesaMinor: input.mpesaMinor,
      });

  return { ok: true, takings };
}

export type GetTodaysTakingsResult =
  | { ok: true; takings: Takings | null }
  | { ok: false; reason: "forbidden" };

export async function getTodaysTakingsForStaff(
  db: PrismaClient,
  requester: AuthenticatedStaff,
): Promise<GetTodaysTakingsResult> {
  const locationId = requester.staff.locationId;
  if (!canAccessLocation(requester.staff.role, requester.staff.locationId, locationId)) {
    return { ok: false, reason: "forbidden" };
  }

  const { dayStart, dayEnd } = dayBounds();
  const takings = await findTodaysTakings(db, locationId, dayStart, dayEnd);
  return { ok: true, takings };
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

  const { dayStart } = dayBounds();
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

export type GetTodaysHandoversAtLocationResult =
  | { ok: true; handovers: HandoverWithStaffName[] }
  | { ok: false; reason: "forbidden" };

// Dashboard's own-staff-only Handover section (ticket 14). Owner-only,
// restaurant-scoped: the canteen has no handover concept yet, and this
// screen must not imply canteen coverage that doesn't exist.
export async function getTodaysHandoversAtLocation(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  locationId: string,
): Promise<GetTodaysHandoversAtLocationResult> {
  if (requester.staff.role !== "owner") {
    return { ok: false, reason: "forbidden" };
  }

  const { dayStart, dayEnd } = dayBounds();
  const handovers = await findTodaysHandoversAtLocation(db, locationId, dayStart, dayEnd);
  return { ok: true, handovers };
}

export type RunningCostsResult =
  | { ok: true; totalMinor: number }
  | { ok: false; reason: "forbidden" };

// Ticket 25 — formulas.md §7's running costs, owner-only same as every
// other dashboard-feeding read here.
export async function getRunningCosts(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  periodStart: Date,
  periodEnd: Date,
): Promise<RunningCostsResult> {
  if (!requireOwner(requester)) {
    return { ok: false, reason: "forbidden" };
  }
  const totalMinor = await sumRunningCostsMinorInPeriod(db, periodStart, periodEnd);
  return { ok: true, totalMinor };
}

export type TakingsAtLocationResult =
  | { ok: true; cashMinor: number; mpesaMinor: number }
  | { ok: false; reason: "forbidden" };

// Ticket 25 — formulas.md §5/§6's takings figure at an arbitrary
// location/period, gated the same way as every other location-scoped
// read (owner passes canAccessLocation for any location).
export async function getTakingsAtLocation(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  locationId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<TakingsAtLocationResult> {
  if (!canAccessLocation(requester.staff.role, requester.staff.locationId, locationId)) {
    return { ok: false, reason: "forbidden" };
  }
  const totals = await sumTakingsMinorAtLocationInPeriod(db, locationId, periodStart, periodEnd);
  return { ok: true, ...totals };
}
