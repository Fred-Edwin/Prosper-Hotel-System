import type { PrismaClient } from "@/generated/prisma/client";
import {
  canAccessLocation,
  findLocationById,
  type AuthenticatedStaff,
} from "@/modules/people";
import { findIngredientsByIds, findProductsByIds, recordIngredientCost } from "@/modules/catalogue";
import {
  createIngredientMovement,
  createStockMovement,
  findReceiptById,
  findReceiptsAtLocation,
  sumMovementsByProductAtLocation,
} from "./queries";
import type { IngredientMovement, Receipt, StockLevel, StockMovement, StockMovementReason } from "./schema";

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

export type RecordIngredientReceiptResult =
  | { ok: true; movements: IngredientMovement[] }
  | { ok: false; reason: "forbidden" | "invalid_quantity" | "invalid_cost" | "inactive_ingredient" };

// architecture.md: receiving is a store-manager/attendant capability, each
// at their own location, plus the owner — not restaurant-only.
function canReceive(role: string): boolean {
  return role === "owner" || role === "store_manager" || role === "attendant";
}

export async function recordIngredientReceipt(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  input: {
    locationId: string;
    lines: { ingredientId: string; quantity: number; unitCostMinor: number }[];
  },
): Promise<RecordIngredientReceiptResult> {
  if (
    !canReceive(requester.staff.role) ||
    !canAccessLocation(requester.staff.role, requester.staff.locationId, input.locationId)
  ) {
    return { ok: false, reason: "forbidden" };
  }

  if (input.lines.some((line) => line.quantity <= 0)) {
    return { ok: false, reason: "invalid_quantity" };
  }

  if (input.lines.some((line) => line.unitCostMinor < 0)) {
    return { ok: false, reason: "invalid_cost" };
  }

  const ingredients = await findIngredientsByIds(
    db,
    input.lines.map((line) => line.ingredientId),
  );
  const ingredientById = new Map(ingredients.map((i) => [i.id, i]));
  const allActive = input.lines.every((line) => ingredientById.get(line.ingredientId)?.active);
  if (!allActive) return { ok: false, reason: "inactive_ingredient" };

  // Shared by every line in this call — what a Stock-category Expense
  // (cash module) references as "the receipt it pays for."
  const receiptId = crypto.randomUUID();

  const movements: IngredientMovement[] = [];
  for (const line of input.lines) {
    const movement = await createIngredientMovement(db, {
      ingredientId: line.ingredientId,
      locationId: input.locationId,
      quantity: line.quantity,
      reason: "received",
      unitCostMinor: line.unitCostMinor,
      staffMemberId: requester.staff.id,
      receiptId,
    });
    movements.push(movement);
    await recordIngredientCost(db, requester, line.ingredientId, line.unitCostMinor);
  }

  return { ok: true, movements };
}

export type ReceiptsAtLocationResult =
  | { ok: true; receipts: Receipt[] }
  | { ok: false; reason: "forbidden" };

// Ticket 16: cash's Stock-category expense form picks from these rather
// than typing a receipt id.
export async function listReceiptsAtLocation(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  locationId: string,
): Promise<ReceiptsAtLocationResult> {
  if (!canAccessLocation(requester.staff.role, requester.staff.locationId, locationId)) {
    return { ok: false, reason: "forbidden" };
  }

  const receipts = await findReceiptsAtLocation(db, locationId);
  return { ok: true, receipts };
}

// Ticket 16: cash validates a Stock-category expense references a real
// receipt at the same location before recording the payment.
export async function findReceipt(
  db: PrismaClient,
  receiptId: string,
): Promise<{ receiptId: string; locationId: string } | null> {
  return findReceiptById(db, receiptId);
}
