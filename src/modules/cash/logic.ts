import type { PrismaClient } from "@/generated/prisma/client";
import { canAccessLocation, type AuthenticatedStaff } from "@/modules/people";
import { listTodaysSalesForStaff } from "@/modules/sales";
import {
  createHandoverRecord,
  findTodaysHandover,
  findTodaysHandoversAtLocation,
  updateHandoverActuals,
  type HandoverWithStaffName,
} from "./queries";
import type { Handover } from "./schema";

function dayBounds(): { dayStart: Date; dayEnd: Date } {
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);
  return { dayStart, dayEnd };
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
