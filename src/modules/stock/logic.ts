import type { PrismaClient } from "@/generated/prisma/client";
import {
  canAccessLocation,
  findLocationById,
  type AuthenticatedStaff,
} from "@/modules/people";
import { findProductsByIds } from "@/modules/catalogue";
import { createStockMovement, sumMovementsByProductAtLocation } from "./queries";
import type { StockLevel, StockMovement, StockMovementReason } from "./schema";

export type StockAccessResult =
  | { ok: true; levels: StockLevel[] }
  | { ok: false; reason: "forbidden" | "not_found" };

export type RecordMovementResult =
  | { ok: true; movement: StockMovement }
  | { ok: false; reason: "forbidden" };

// Callers (e.g. sales recording a `sold` line) pass a signed quantity —
// this function does not infer sign from reason, so reversals (ticket 09)
// can reuse it unchanged.
export async function recordStockMovement(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  input: {
    productId: string;
    locationId: string;
    quantity: number;
    reason: StockMovementReason;
  },
): Promise<RecordMovementResult> {
  if (!canAccessLocation(requester.staff.role, requester.staff.locationId, input.locationId)) {
    return { ok: false, reason: "forbidden" };
  }

  const movement = await createStockMovement(db, {
    productId: input.productId,
    locationId: input.locationId,
    quantity: input.quantity,
    reason: input.reason,
    staffMemberId: requester.staff.id,
  });
  return { ok: true, movement };
}

export async function getCurrentStockAtLocation(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  locationId: string,
): Promise<StockAccessResult> {
  if (!canAccessLocation(requester.staff.role, requester.staff.locationId, locationId)) {
    return { ok: false, reason: "forbidden" };
  }

  // canAccessLocation lets an owner through for any ID unconditionally —
  // confirm the location actually exists rather than silently returning an
  // empty list for a stale or mistyped ID.
  const location = await findLocationById(db, locationId);
  if (!location) {
    return { ok: false, reason: "not_found" };
  }

  const sums = await sumMovementsByProductAtLocation(db, locationId);
  const products = await findProductsByIds(
    db,
    sums.map((s) => s.productId),
  );
  const nameById = new Map(products.map((p) => [p.id, p.name]));

  const levels: StockLevel[] = sums
    .map((s) => ({
      productId: s.productId,
      productName: nameById.get(s.productId) ?? "Unknown product",
      quantityOnHand: s.quantityOnHand,
    }))
    .sort((a, b) => a.productName.localeCompare(b.productName));

  return { ok: true, levels };
}
