import type { PrismaClient } from "@/generated/prisma/client";
import {
  canAccessLocation,
  getPayForStaff,
  markDaysWorkedPaid,
  type AuthenticatedStaff,
} from "@/modules/people";
import { listTodaysSalesForStaff } from "@/modules/sales";
import { findReceipt } from "@/modules/stock";
import {
  createDrawingDebt,
  createDrawingRepayment,
  createExpense,
  createHandoverRecord,
  createTakingsRecord,
  findDrawingDebtByExpenseId,
  findDrawingRepaymentById,
  findExpenseById,
  findTodaysHandover,
  findTodaysHandoversAtLocation,
  findTodaysTakings,
  listDrawingRepayments,
  listExpensesAtLocation,
  markDrawingDebtReversed,
  markDrawingRepaymentReversed,
  markExpenseReversed,
  sumExpensesMinorByMethod,
  sumHandoversMinor,
  sumRunningCostsMinorInPeriod,
  sumTakingsMinorAtLocationInPeriod,
  sumUnreversedDrawingDebt,
  sumUnreversedDrawingRepayment,
  updateHandoverActuals,
  updateTakingsAmounts,
  type HandoverWithStaffName,
} from "./queries";
import type {
  DrawingRepayment,
  Expense,
  ExpenseCategory,
  ExpensePaymentMethod,
  Handover,
  Takings,
} from "./schema";

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

// proposal.md §8: a person's day, at their location, is closed the moment
// their Handover for that day is recorded — per-person, per-location, not a
// global end-of-day switch. Reused by every same-day edit entry point that
// needs to reject non-owner edits after handover.
export async function isDayClosedFor(
  db: PrismaClient,
  staffMemberId: string,
  locationId: string,
  date: Date,
): Promise<boolean> {
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const handover = await findTodaysHandover(db, staffMemberId, locationId, dayStart, dayEnd);
  return handover !== null;
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

// CONTEXT.md's Handover, canteen case: expected is the takings the
// attendant declared at close (proposal.md §5, formulas.md §10) — not
// summed sales, since nothing is recorded per-sale at the canteen. If
// nothing has been recorded yet today, there is no real expected figure
// to compare against — reported distinctly from a zero takings row,
// which would silently compare against a false baseline.
async function computeExpectedFromTakings(
  db: PrismaClient,
  locationId: string,
  dayStart: Date,
  dayEnd: Date,
): Promise<
  { expectedCashMinor: number; expectedMpesaMinor: number } | { takingsNotRecorded: true }
> {
  const takings = await findTodaysTakings(db, locationId, dayStart, dayEnd);
  if (!takings) return { takingsNotRecorded: true };
  return { expectedCashMinor: takings.cashMinor, expectedMpesaMinor: takings.mpesaMinor };
}

export type RecordHandoverResult =
  | { ok: true; handover: Handover }
  | { ok: false; reason: "forbidden" | "takings_not_recorded" | "day_closed" };

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

  const { dayStart, dayEnd } = dayBounds();

  if (!requireOwner(requester)) {
    const closed = await isDayClosedFor(db, requester.staff.id, locationId, dayStart);
    if (closed) return { ok: false, reason: "day_closed" };
  }

  const expected =
    requester.location.code === "canteen"
      ? await computeExpectedFromTakings(db, locationId, dayStart, dayEnd)
      : await computeExpected(db, requester);
  if ("forbidden" in expected) return { ok: false, reason: "forbidden" };
  if ("takingsNotRecorded" in expected) return { ok: false, reason: "takings_not_recorded" };

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
  | { ok: true; handover: Handover | null; takingsRecordedToday: boolean }
  | { ok: false; reason: "forbidden" };

// takingsRecordedToday is only meaningful at the canteen (restaurant has no
// takings concept, so it's always reported true there) — the UI uses it to
// show the "record today's takings first" state before the attendant starts
// a count that has nothing real to be checked against.
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

  const takingsRecordedToday =
    requester.location.code === "canteen"
      ? (await findTodaysTakings(db, locationId, dayStart, dayEnd)) !== null
      : true;

  return { ok: true, handover, takingsRecordedToday };
}

export type RecordTakingsResult =
  | { ok: true; takings: Takings }
  | { ok: false; reason: "forbidden" | "invalid_amount" | "day_closed" };

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

  if (!requireOwner(requester)) {
    const closed = await isDayClosedFor(db, requester.staff.id, locationId, dayStart);
    if (closed) return { ok: false, reason: "day_closed" };
  }

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
    paymentMethod: ExpensePaymentMethod;
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
    paymentMethod: input.paymentMethod,
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

export type PayWagesResult =
  | { ok: true; expense: Expense }
  | { ok: false; reason: "forbidden" | "not_found" | "nothing_to_pay" };

// proposal.md §11's pay figure, disbursed: pays out every unpaid day
// worked this month for one staff member as a single running-cost expense
// (proposal.md §10: wages are a running cost) — the same category and
// profit treatment as gas, charcoal, electricity, rent. staffMemberId on
// the Expense stays "who recorded it" (the owner); payeeStaffMemberId is
// who was paid. people/logic.ts's markDaysWorkedPaid tags the covered
// DaysWorked rows with this Expense's id, mirroring receiptId's grouping
// pattern — cash never reaches past people's index.ts to write them itself.
export async function payWages(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  input: { staffMemberId: string; locationId: string; paymentMethod: ExpensePaymentMethod },
): Promise<PayWagesResult> {
  if (!requireOwner(requester)) return { ok: false, reason: "forbidden" };

  const pay = await getPayForStaff(db, requester, input.staffMemberId);
  if (!pay.ok) return { ok: false, reason: pay.reason === "forbidden" ? "forbidden" : "not_found" };
  if (pay.value.unpaidMinor <= 0) return { ok: false, reason: "nothing_to_pay" };

  const expense = await createExpense(db, {
    locationId: input.locationId,
    staffMemberId: requester.staff.id,
    category: "running",
    amountMinor: pay.value.unpaidMinor,
    paymentMethod: input.paymentMethod,
    note: null,
    receiptId: null,
    payeeStaffMemberId: input.staffMemberId,
  });

  await markDaysWorkedPaid(db, input.staffMemberId, expense.id);

  return { ok: true, expense };
}

// Ticket 32: the outstanding balance nets unreversed debt against
// unreversed repayments — proposal.md §6's "outstanding balance." Ticket
// 16 left this as an ever-growing total since no repayment mechanism
// existed yet; this is the update once one does.
export async function drawingDebtOwed(db: PrismaClient): Promise<number> {
  const [debt, repaid] = await Promise.all([
    sumUnreversedDrawingDebt(db),
    sumUnreversedDrawingRepayment(db),
  ]);
  return debt - repaid;
}

export type RecordDrawingRepaymentResult =
  | { ok: true; repayment: DrawingRepayment }
  | { ok: false; reason: "forbidden" | "invalid_amount" | "exceeds_outstanding" };

// Owner-only, matching every other drawings-adjacent write. Rejects an
// amount larger than the current outstanding balance — resolved with
// Edwinfred: "overpaying" a debt that isn't real accounting isn't a
// state this tracker represents (formulas.md's scope).
export async function recordDrawingRepayment(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  input: { amountMinor: number },
): Promise<RecordDrawingRepaymentResult> {
  if (!requireOwner(requester)) {
    return { ok: false, reason: "forbidden" };
  }

  if (input.amountMinor <= 0) {
    return { ok: false, reason: "invalid_amount" };
  }

  const outstanding = await drawingDebtOwed(db);
  if (input.amountMinor > outstanding) {
    return { ok: false, reason: "exceeds_outstanding" };
  }

  const repayment = await createDrawingRepayment(db, {
    amountMinor: input.amountMinor,
    recordedBy: requester.staff.id,
  });

  return { ok: true, repayment };
}

export type ReverseDrawingRepaymentResult =
  | { ok: true; repayment: DrawingRepayment }
  | { ok: false; reason: "forbidden" | "not_found" | "already_reversed" | "not_same_day" };

// Owner-only, same-day only — mirrors reverseExpense's reasoning: a
// mistaken repayment shouldn't silently understate what's still owed.
export async function reverseDrawingRepayment(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  repaymentId: string,
): Promise<ReverseDrawingRepaymentResult> {
  if (!requireOwner(requester)) {
    return { ok: false, reason: "forbidden" };
  }

  const repayment = await findDrawingRepaymentById(db, repaymentId);
  if (!repayment) return { ok: false, reason: "not_found" };

  if (repayment.reversed) return { ok: false, reason: "already_reversed" };

  const { dayStart } = dayBounds();
  if (repayment.occurredAt < dayStart) return { ok: false, reason: "not_same_day" };

  const reversed = await markDrawingRepaymentReversed(db, repaymentId);
  return { ok: true, repayment: reversed };
}

export type ListDrawingRepaymentsResult =
  | { ok: true; repayments: DrawingRepayment[] }
  | { ok: false; reason: "forbidden" };

// Owner-only read, same access pattern as listExpenses.
export async function listDrawingRepaymentsForOwner(
  db: PrismaClient,
  requester: AuthenticatedStaff,
): Promise<ListDrawingRepaymentsResult> {
  if (!requireOwner(requester)) {
    return { ok: false, reason: "forbidden" };
  }

  const repayments = await listDrawingRepayments(db);
  return { ok: true, repayments };
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

export type GetRunningCashBalanceResult =
  | { ok: true; cashMinor: number; mpesaMinor: number }
  | { ok: false; reason: "forbidden" };

// Ticket 31 — formulas.md §9: handovers received minus stock, running
// costs, equipment/assets and drawings, cash and M-Pesa kept separate
// throughout. Equipment and drawings reduce cash the same as stock and
// running costs even though they don't reduce profit — this is a cash
// question, not a profit one.
export async function getRunningCashBalance(
  db: PrismaClient,
  requester: AuthenticatedStaff,
): Promise<GetRunningCashBalanceResult> {
  if (!requireOwner(requester)) {
    return { ok: false, reason: "forbidden" };
  }

  const [moneyIn, moneyOut] = await Promise.all([sumHandoversMinor(db), sumExpensesMinorByMethod(db)]);

  return {
    ok: true,
    cashMinor: moneyIn.cashMinor - moneyOut.cashMinor,
    mpesaMinor: moneyIn.mpesaMinor - moneyOut.mpesaMinor,
  };
}
