import type { PrismaClient } from "@/generated/prisma/client";
import {
  canAccessLocation,
  getPayForStaff,
  listLocations,
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
  findDrawingDebtByExpenseId,
  findDrawingRepaymentById,
  findExpenseById,
  findTodaysHandover,
  findTodaysHandoversAtLocations,
  listDrawingRepayments,
  listDrawingRepaymentsInPeriod,
  listExpensesAtLocation,
  listExpensesInPeriod,
  listHandoversInPeriod,
  markDrawingDebtReversed,
  markDrawingRepaymentReversed,
  markExpenseReversed,
  sumExpensesMinorByMethod,
  sumHandoversMinor,
  sumRunningCostsMinorInPeriod,
  sumUnreversedDrawingDebt,
  sumUnreversedDrawingRepayment,
  sumUnreversedDrawingRepaymentByMethod,
  updateHandoverActuals,
  type HandoverWithStaffName,
} from "./queries";
import type {
  DrawingRepayment,
  Expense,
  ExpenseCategory,
  ExpensePaymentMethod,
  Handover,
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

// CONTEXT.md's Handover, canteen case (revised 2026-08-13): expected is
// the sum of that day's recorded sales, the same basis as the
// restaurant — but as a single combined figure rather than cash/M-Pesa
// split. A canteen sale carries no payment method at entry (too slow for
// rush trade — proposal.md §4), so the split isn't knowable from the
// sale record; only the total is. Credit sales are excluded via their
// "credit" payment line, same exclusion the restaurant applies.
// expectedMpesaMinor is null, not 0 — see Handover.expectedMpesaMinor's
// schema comment: null means "not tracked separately, see
// expectedCashMinor for the combined total," which is a different claim
// than "expected zero M-Pesa."
async function computeExpectedFromSales(
  db: PrismaClient,
  requester: AuthenticatedStaff,
): Promise<{ expectedCashMinor: number; expectedMpesaMinor: null } | { forbidden: true }> {
  const result = await listTodaysSalesForStaff(db, requester);
  if (!result.ok) return { forbidden: true };

  let expectedTotalMinor = 0;
  for (const sale of result.sales) {
    if (sale.voided) continue;
    if (sale.paymentLines.some((line) => line.method === "credit")) continue;
    expectedTotalMinor += sale.totalMinor;
  }
  return { expectedCashMinor: expectedTotalMinor, expectedMpesaMinor: null };
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
      ? await computeExpectedFromSales(db, requester)
      : await computeExpected(db, requester);
  if ("forbidden" in expected) return { ok: false, reason: "forbidden" };

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
  input: { amountMinor: number; paymentMethod: ExpensePaymentMethod },
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
    paymentMethod: input.paymentMethod,
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

export type GetTodaysHandoversResult =
  | { ok: true; handovers: HandoverWithStaffName[] }
  | { ok: false; reason: "forbidden" };

// Dashboard's Handover section (ticket 14, extended by the 2026-08-13
// canteen redesign): owner-only, both locations — the canteen now records
// real handovers too (docs/proposal.md §5's combined cash+M-Pesa check),
// so restricting this to the restaurant left every canteen handover
// silently absent from the dashboard.
export async function getTodaysHandovers(
  db: PrismaClient,
  requester: AuthenticatedStaff,
): Promise<GetTodaysHandoversResult> {
  if (requester.staff.role !== "owner") {
    return { ok: false, reason: "forbidden" };
  }

  const { dayStart, dayEnd } = dayBounds();
  const locations = await listLocations(db);
  const handovers = await findTodaysHandoversAtLocations(
    db,
    locations.map((l) => l.id),
    dayStart,
    dayEnd,
  );
  return { ok: true, handovers };
}

export type RunningCostsResult =
  | { ok: true; totalMinor: number }
  | { ok: false; reason: "forbidden" };

// Ticket 25 — formulas.md §7's running costs, owner-only same as every
// other dashboard-feeding read here. `locationId` is optional — omitted,
// this is the business-wide figure; passed, it scopes to that location's
// own Expense rows (ticket 46, for the Profit panel's per-location split).
export async function getRunningCosts(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  periodStart: Date,
  periodEnd: Date,
  locationId?: string,
): Promise<RunningCostsResult> {
  if (!requireOwner(requester)) {
    return { ok: false, reason: "forbidden" };
  }
  const totalMinor = await sumRunningCostsMinorInPeriod(db, periodStart, periodEnd, locationId);
  return { ok: true, totalMinor };
}


export type GetRunningCashBalanceResult =
  | { ok: true; cashMinor: number; mpesaMinor: number }
  | { ok: false; reason: "forbidden" };

// Ticket 31 — formulas.md §9: handovers received minus stock, running
// costs, equipment/assets and drawings, cash and M-Pesa kept separate
// throughout. Equipment and drawings reduce cash the same as stock and
// running costs even though they don't reduce profit — this is a cash
// question, not a profit one. Ticket 40 — repayments are also money in
// (a drawing debt being paid back) and were missing here since ticket 32
// added them after this function was written; folded in so this figure
// and the cash ledger's closing balance agree.
export async function getRunningCashBalance(
  db: PrismaClient,
  requester: AuthenticatedStaff,
): Promise<GetRunningCashBalanceResult> {
  if (!requireOwner(requester)) {
    return { ok: false, reason: "forbidden" };
  }

  const [handovers, repayments, moneyOut] = await Promise.all([
    sumHandoversMinor(db),
    sumUnreversedDrawingRepaymentByMethod(db),
    sumExpensesMinorByMethod(db),
  ]);

  return {
    ok: true,
    cashMinor: handovers.cashMinor + repayments.cashMinor - moneyOut.cashMinor,
    mpesaMinor: handovers.mpesaMinor + repayments.mpesaMinor - moneyOut.mpesaMinor,
  };
}

export type GetCashLedgerTransactionsResult =
  | {
      ok: true;
      handovers: Handover[];
      expenses: Expense[];
      repayments: DrawingRepayment[];
    }
  | { ok: false; reason: "forbidden" };

// Ticket 40 — the raw money-in/money-out records the cash ledger folds
// into day rows: business-wide (not per-location, same as
// getRunningCashBalance), every category getRunningCashBalance's formula
// counts (handovers and repayments in; stock/running/asset/drawing
// expenses out). Reporting composes these into the ledger's day-by-day
// shape rather than reading cash's queries.ts directly, per
// docs/architecture.md. Staff names are resolved by the caller (via
// people's findStaffMembersByIds), same pattern as getProductLedger
// resolving product names through catalogue.
export async function getCashLedgerTransactions(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  periodStart: Date,
  periodEnd: Date,
): Promise<GetCashLedgerTransactionsResult> {
  if (!requireOwner(requester)) {
    return { ok: false, reason: "forbidden" };
  }

  const [handovers, expenses, repayments] = await Promise.all([
    listHandoversInPeriod(db, periodStart, periodEnd),
    listExpensesInPeriod(db, periodStart, periodEnd),
    listDrawingRepaymentsInPeriod(db, periodStart, periodEnd),
  ]);

  return { ok: true, handovers, expenses, repayments };
}
