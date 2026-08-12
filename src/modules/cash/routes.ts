import { db } from "@/shared/db";
import { getSession, findStaffMembersByIds, findLocationByCode } from "@/modules/people";
import { listReceiptsAtLocation } from "@/modules/stock";
import {
  getTodaysHandoverForStaff,
  getTodaysHandoversAtLocation,
  getTodaysTakingsForStaff,
  getRunningCashBalance,
  recordHandover,
  recordTakings,
  listExpenses,
  recordExpense,
  reverseExpense,
  drawingDebtOwed,
  listDrawingRepaymentsForOwner,
  recordDrawingRepayment,
  reverseDrawingRepayment,
  payWages,
} from "./logic";
import type { ExpenseCategory } from "./schema";

function writeStatus(reason: string): number {
  if (reason === "forbidden" || reason === "day_closed") return 403;
  return reason === "not_found" ? 404 : 400;
}

function writeDrawingRepaymentStatus(reason: string): number {
  if (reason === "forbidden") return 403;
  if (reason === "not_found") return 404;
  return 400;
}

// The blind-count decision (docs/design.md via the design-reference
// handover-body.tsx precedent): the staff member who records this never
// sees expectedCashMinor/expectedMpesaMinor back. Only the actual amounts
// they just entered are echoed here — the comparison is the owner's alone
// (ticket 14). This is the actual enforcement point, not just the UI.
export async function recordHandoverRoute(request: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: "unauthenticated" }, { status: 401 });

  const body = await request.json();
  const result = await recordHandover(db, session, {
    cashMinor: body.cashMinor,
    mpesaMinor: body.mpesaMinor,
  });
  if (!result.ok) {
    return Response.json({ error: result.reason }, { status: writeStatus(result.reason) });
  }

  return Response.json({
    handover: {
      id: result.handover.id,
      actualCashMinor: result.handover.actualCashMinor,
      actualMpesaMinor: result.handover.actualMpesaMinor,
      occurredAt: result.handover.occurredAt,
    },
  });
}

export async function todaysHandoverRoute(): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: "unauthenticated" }, { status: 401 });

  const result = await getTodaysHandoverForStaff(db, session);
  if (!result.ok) {
    return Response.json({ error: result.reason }, { status: writeStatus(result.reason) });
  }

  return Response.json({
    handover: result.handover
      ? {
          id: result.handover.id,
          actualCashMinor: result.handover.actualCashMinor,
          actualMpesaMinor: result.handover.actualMpesaMinor,
          occurredAt: result.handover.occurredAt,
        }
      : null,
    locationCode: session.location.code,
    takingsRecordedToday: result.takingsRecordedToday,
  });
}

// Dashboard's Handover section (ticket 14): today's restaurant handovers,
// all staff, expected vs. actual — the owner's comparison, never sent to
// the staff member who recorded it (see recordHandoverRoute's note above).
export async function todaysHandoversAtRestaurantRoute(): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: "unauthenticated" }, { status: 401 });

  const restaurant = await findLocationByCode(db, "restaurant");
  if (!restaurant) return Response.json({ error: "not_found" }, { status: 404 });

  const result = await getTodaysHandoversAtLocation(db, session, restaurant.id);
  if (!result.ok) {
    return Response.json({ error: result.reason }, { status: writeStatus(result.reason) });
  }

  return Response.json({
    handovers: result.handovers.map((h) => ({
      id: h.id,
      staffName: h.staffName,
      expectedCashMinor: h.expectedCashMinor,
      expectedMpesaMinor: h.expectedMpesaMinor,
      actualCashMinor: h.actualCashMinor,
      actualMpesaMinor: h.actualMpesaMinor,
      occurredAt: h.occurredAt,
    })),
  });
}

export async function recordTakingsRoute(request: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: "unauthenticated" }, { status: 401 });

  const body = await request.json();
  const result = await recordTakings(db, session, {
    cashMinor: body.cashMinor,
    mpesaMinor: body.mpesaMinor,
  });
  if (!result.ok) {
    return Response.json({ error: result.reason }, { status: writeStatus(result.reason) });
  }

  return Response.json({
    takings: {
      cashMinor: result.takings.cashMinor,
      mpesaMinor: result.takings.mpesaMinor,
    },
  });
}

export async function todaysTakingsRoute(): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: "unauthenticated" }, { status: 401 });

  const result = await getTodaysTakingsForStaff(db, session);
  if (!result.ok) {
    return Response.json({ error: result.reason }, { status: writeStatus(result.reason) });
  }

  return Response.json({
    takings: result.takings
      ? {
          cashMinor: result.takings.cashMinor,
          mpesaMinor: result.takings.mpesaMinor,
        }
      : null,
  });
}

export async function listExpensesRoute(request: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: "unauthenticated" }, { status: 401 });

  const url = new URL(request.url);
  const category = url.searchParams.get("category") as ExpenseCategory | null;

  const result = await listExpenses(db, session, session.staff.locationId, category ?? undefined);
  if (!result.ok) {
    return Response.json({ error: result.reason }, { status: writeStatus(result.reason) });
  }

  const staff = await findStaffMembersByIds(
    db,
    result.expenses.map((e) => e.staffMemberId),
  );
  const nameById = new Map(staff.map((s) => [s.id, s.name]));
  const expenses = result.expenses.map((e) => ({
    ...e,
    staffMemberName: nameById.get(e.staffMemberId) ?? "Unknown",
  }));

  return Response.json({ expenses });
}

// Ticket 31 — the running cash/M-Pesa balance shown alongside money-out's
// payment list. Owner-only, same access pattern as listExpenses.
export async function runningCashBalanceRoute(): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: "unauthenticated" }, { status: 401 });

  const result = await getRunningCashBalance(db, session);
  if (!result.ok) {
    return Response.json({ error: result.reason }, { status: writeStatus(result.reason) });
  }

  return Response.json({ cashMinor: result.cashMinor, mpesaMinor: result.mpesaMinor });
}

export async function receiptsForExpenseRoute(): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: "unauthenticated" }, { status: 401 });

  const result = await listReceiptsAtLocation(db, session, session.staff.locationId);
  if (!result.ok) {
    return Response.json({ error: result.reason }, { status: writeStatus(result.reason) });
  }

  return Response.json({ receipts: result.receipts });
}

export async function recordExpenseRoute(request: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: "unauthenticated" }, { status: 401 });

  const body = await request.json();
  const result = await recordExpense(db, session, {
    locationId: session.staff.locationId,
    category: body.category,
    amountMinor: body.amountMinor,
    paymentMethod: body.paymentMethod,
    note: body.note,
    receiptId: body.receiptId,
  });
  if (!result.ok) {
    return Response.json({ error: result.reason }, { status: writeStatus(result.reason) });
  }

  return Response.json({ expense: result.expense });
}

export async function payWagesRoute(request: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: "unauthenticated" }, { status: 401 });

  const body = await request.json();
  const result = await payWages(db, session, {
    staffMemberId: body.staffMemberId,
    locationId: session.staff.locationId,
    paymentMethod: body.paymentMethod,
  });
  if (!result.ok) {
    return Response.json({ error: result.reason }, { status: writeStatus(result.reason) });
  }

  return Response.json({ expense: result.expense });
}

export async function reverseExpenseRoute(
  _request: Request,
  { params }: { params: Promise<{ expenseId: string }> },
): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: "unauthenticated" }, { status: 401 });

  const { expenseId } = await params;
  const result = await reverseExpense(db, session, expenseId);
  if (!result.ok) {
    return Response.json({ error: result.reason }, { status: writeStatus(result.reason) });
  }

  return Response.json({ expense: result.expense });
}

// Ticket 32 — the outstanding drawings balance, netting debt minus
// unreversed repayments. Owner-only, same access pattern as
// runningCashBalanceRoute.
export async function drawingDebtOwedRoute(): Promise<Response> {
  const session = await getSession();
  if (session?.staff.role !== "owner") {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const outstandingMinor = await drawingDebtOwed(db);
  return Response.json({ outstandingMinor });
}

export async function listDrawingRepaymentsRoute(): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: "unauthenticated" }, { status: 401 });

  const result = await listDrawingRepaymentsForOwner(db, session);
  if (!result.ok) {
    return Response.json({ error: result.reason }, { status: writeStatus(result.reason) });
  }

  return Response.json({ repayments: result.repayments });
}

export async function recordDrawingRepaymentRoute(request: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: "unauthenticated" }, { status: 401 });

  const body = await request.json();
  const result = await recordDrawingRepayment(db, session, {
    amountMinor: body.amountMinor,
    paymentMethod: body.paymentMethod,
  });
  if (!result.ok) {
    return Response.json(
      { error: result.reason },
      { status: writeDrawingRepaymentStatus(result.reason) },
    );
  }

  return Response.json({ repayment: result.repayment });
}

export async function reverseDrawingRepaymentRoute(
  _request: Request,
  { params }: { params: Promise<{ repaymentId: string }> },
): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: "unauthenticated" }, { status: 401 });

  const { repaymentId } = await params;
  const result = await reverseDrawingRepayment(db, session, repaymentId);
  if (!result.ok) {
    return Response.json(
      { error: result.reason },
      { status: writeDrawingRepaymentStatus(result.reason) },
    );
  }

  return Response.json({ repayment: result.repayment });
}
