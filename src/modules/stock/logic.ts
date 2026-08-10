import type { PrismaClient } from "@/generated/prisma/client";
import {
  canAccessLocation,
  findLocationById,
  type AuthenticatedStaff,
} from "@/modules/people";
import {
  findIngredientsByIds,
  findProductsByIds,
  getCurrentRecipe,
  recordIngredientCost,
} from "@/modules/catalogue";
import {
  createIngredientConsumptionMovement,
  createIngredientMovement,
  createStockMovement,
  findReceiptById,
  findReceiptsAtLocation,
  sumMovementsByProductAtLocation,
} from "./queries";
import type {
  IngredientMovement,
  NonSalesCategory,
  Receipt,
  StockLevel,
  StockMovement,
  StockMovementReason,
} from "./schema";

// CONTEXT.md's Non-sales Stock Consumption: where no per-unit cost is
// known, cost is estimated at 60% of selling price, per the owner's own
// discovery figure. See docs/formulas.md §4.
const ESTIMATED_COST_RATE = 0.6;

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

export type RecordNonSalesConsumptionResult =
  | { ok: true; movement: StockMovement | IngredientMovement }
  | {
      ok: false;
      reason: "forbidden" | "invalid_quantity" | "inactive_item" | "not_found" | "invalid_cost";
    };

// CONTEXT.md: unlike receiving, any staff member may record wastage,
// consumption or a give-away observed at their own location — not
// restricted to store manager/owner.
export async function recordNonSalesConsumption(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  input: {
    itemType: "product" | "ingredient";
    itemId: string;
    locationId: string;
    quantity: number;
    category: NonSalesCategory;
  },
): Promise<RecordNonSalesConsumptionResult> {
  if (!canAccessLocation(requester.staff.role, requester.staff.locationId, input.locationId)) {
    return { ok: false, reason: "forbidden" };
  }

  if (input.quantity <= 0) {
    return { ok: false, reason: "invalid_quantity" };
  }

  if (input.itemType === "product") {
    const [product] = await findProductsByIds(db, [input.itemId]);
    if (!product) return { ok: false, reason: "not_found" };
    if (!product.active) return { ok: false, reason: "inactive_item" };

    const recipe = product.kind === "cooked_food" ? await getCurrentRecipe(db, product.id) : null;
    const sellingValueMinor = product.priceMinor;

    let costBasisMinor: number;
    let isEstimated: boolean;
    if (recipe?.perUnitCostMinor != null) {
      costBasisMinor = recipe.perUnitCostMinor;
      isEstimated = false;
    } else if (sellingValueMinor != null) {
      costBasisMinor = Math.round(sellingValueMinor * ESTIMATED_COST_RATE);
      isEstimated = true;
    } else {
      // No recipe cost and no selling price to estimate from.
      return { ok: false, reason: "invalid_cost" };
    }

    const movement = await createStockMovement(db, {
      productId: product.id,
      locationId: input.locationId,
      quantity: -input.quantity,
      reason: input.category,
      staffMemberId: requester.staff.id,
      costBasisMinor: costBasisMinor * input.quantity,
      sellingValueMinor: sellingValueMinor != null ? sellingValueMinor * input.quantity : null,
      isEstimated,
    });
    return { ok: true, movement };
  }

  const [ingredient] = await findIngredientsByIds(db, [input.itemId]);
  if (!ingredient) return { ok: false, reason: "not_found" };
  if (!ingredient.active) return { ok: false, reason: "inactive_item" };

  // Ingredients are never sold (CONTEXT.md), so there is no selling price
  // to estimate a cost from — where lastKnownCostMinor is unset, no cost
  // figure can be produced at all.
  if (ingredient.lastKnownCostMinor == null) {
    return { ok: false, reason: "invalid_cost" };
  }

  const movement = await createIngredientConsumptionMovement(db, {
    ingredientId: ingredient.id,
    locationId: input.locationId,
    quantity: -input.quantity,
    reason: input.category,
    staffMemberId: requester.staff.id,
    costBasisMinor: ingredient.lastKnownCostMinor * input.quantity,
    isEstimated: false,
  });
  return { ok: true, movement };
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
