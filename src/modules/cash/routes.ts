import { db } from "@/shared/db";
import { getSession, findLocationByCode } from "@/modules/people";
import { getTodaysHandoverForStaff, getTodaysHandoversAtLocation, recordHandover } from "./logic";

function writeStatus(reason: string): number {
  if (reason === "forbidden") return 403;
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
