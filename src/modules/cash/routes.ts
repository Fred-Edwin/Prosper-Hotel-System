import { db } from "@/shared/db";
import { getSession, findStaffMembersByIds } from "@/modules/people";
import { listReceiptsAtLocation } from "@/modules/stock";
import { getTodaysHandoverForStaff, recordHandover, listExpenses, recordExpense, reverseExpense } from "./logic";
import type { ExpenseCategory } from "./schema";

function writeStatus(reason: string): number {
  return reason === "forbidden" ? 403 : reason === "not_found" ? 404 : 400;
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
    note: body.note,
    receiptId: body.receiptId,
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
