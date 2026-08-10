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
  createIngredientCorrectionMovement,
  createIngredientIssueMovement,
  createIngredientMovement,
  createProductionMovement,
  createStockCount,
  createStockMovement,
  findReceiptById,
  findReceiptsAtLocation,
  findStockCountById,
  markStockCountLineCorrected,
  sumMovementsByIngredientAtLocation,
  sumMovementsByProductAtLocation,
} from "./queries";
import type {
  IngredientMovement,
  NonSalesCategory,
  Receipt,
  StockCount,
  StockCountItemType,
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

export type RecordIngredientIssueResult =
  | { ok: true; movements: IngredientMovement[] }
  | { ok: false; reason: "forbidden" | "invalid_quantity" | "inactive_ingredient" };

// architecture.md: store manager and owner only — same as receiving, but
// narrower (no attendant: the canteen has no kitchen to issue to).
function canIssue(role: string): boolean {
  return role === "owner" || role === "store_manager";
}

export async function recordIngredientIssue(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  input: {
    locationId: string;
    lines: { ingredientId: string; quantity: number }[];
  },
): Promise<RecordIngredientIssueResult> {
  if (
    !canIssue(requester.staff.role) ||
    !canAccessLocation(requester.staff.role, requester.staff.locationId, input.locationId)
  ) {
    return { ok: false, reason: "forbidden" };
  }

  if (input.lines.some((line) => line.quantity <= 0)) {
    return { ok: false, reason: "invalid_quantity" };
  }

  const ingredients = await findIngredientsByIds(
    db,
    input.lines.map((line) => line.ingredientId),
  );
  const ingredientById = new Map(ingredients.map((i) => [i.id, i]));
  const allActive = input.lines.every((line) => ingredientById.get(line.ingredientId)?.active);
  if (!allActive) return { ok: false, reason: "inactive_ingredient" };

  const movements: IngredientMovement[] = [];
  for (const line of input.lines) {
    const movement = await createIngredientIssueMovement(db, {
      ingredientId: line.ingredientId,
      locationId: input.locationId,
      quantity: -line.quantity,
      staffMemberId: requester.staff.id,
    });
    movements.push(movement);
  }

  return { ok: true, movements };
}

export type RecordProductionResult =
  | { ok: true; movement: StockMovement }
  | {
      ok: false;
      reason: "forbidden" | "invalid_quantity" | "inactive_product" | "not_found" | "no_recipe";
    };

// architecture.md: store manager and owner only — same actors as issuing.
function canProduce(role: string): boolean {
  return role === "owner" || role === "store_manager";
}

// Ticket 19: producing a product consumes ingredients according to its
// current recipe (catalogue's getCurrentRecipe) rather than referencing a
// specific prior issue — no lot-tracking. Deduction and produced-quantity
// costing both derive from the same recipe read.
export async function recordProduction(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  input: {
    productId: string;
    locationId: string;
    quantity: number;
  },
): Promise<RecordProductionResult> {
  if (
    !canProduce(requester.staff.role) ||
    !canAccessLocation(requester.staff.role, requester.staff.locationId, input.locationId)
  ) {
    return { ok: false, reason: "forbidden" };
  }

  if (input.quantity <= 0) {
    return { ok: false, reason: "invalid_quantity" };
  }

  const [product] = await findProductsByIds(db, [input.productId]);
  if (!product) return { ok: false, reason: "not_found" };
  if (!product.active) return { ok: false, reason: "inactive_product" };

  const recipe = await getCurrentRecipe(db, product.id);
  if (!recipe || recipe.perUnitCostMinor == null) {
    return { ok: false, reason: "no_recipe" };
  }

  for (const line of recipe.lines) {
    await createIngredientIssueMovement(db, {
      ingredientId: line.ingredientId,
      locationId: input.locationId,
      quantity: -(line.quantity * input.quantity),
      staffMemberId: requester.staff.id,
    });
  }

  const movement = await createProductionMovement(db, {
    productId: product.id,
    locationId: input.locationId,
    quantity: input.quantity,
    staffMemberId: requester.staff.id,
    costBasisMinor: recipe.perUnitCostMinor * input.quantity,
    sellingValueMinor: product.priceMinor != null ? product.priceMinor * input.quantity : null,
  });

  return { ok: true, movement };
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

export type RecordStockCountResult =
  | { ok: true; count: StockCount }
  | { ok: false; reason: "forbidden" | "invalid_quantity" | "inactive_item" | "not_found" };

// docs/architecture.md: "the count never changes the record on its own —
// it records what was counted and shows the gap." Any role that can
// access the location may record a count, same as receiving/issuing —
// store manager and attendant per the ticket, owner always.
export async function recordStockCount(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  input: {
    locationId: string;
    lines: { itemType: StockCountItemType; itemId: string; countedQuantity: number }[];
  },
): Promise<RecordStockCountResult> {
  if (!canAccessLocation(requester.staff.role, requester.staff.locationId, input.locationId)) {
    return { ok: false, reason: "forbidden" };
  }

  if (input.lines.some((line) => line.countedQuantity < 0)) {
    return { ok: false, reason: "invalid_quantity" };
  }

  const productIds = input.lines.filter((l) => l.itemType === "product").map((l) => l.itemId);
  const ingredientIds = input.lines
    .filter((l) => l.itemType === "ingredient")
    .map((l) => l.itemId);

  const products = productIds.length > 0 ? await findProductsByIds(db, productIds) : [];
  const ingredients =
    ingredientIds.length > 0 ? await findIngredientsByIds(db, ingredientIds) : [];
  const productById = new Map(products.map((p) => [p.id, p]));
  const ingredientById = new Map(ingredients.map((i) => [i.id, i]));

  for (const line of input.lines) {
    if (line.itemType === "product") {
      const product = productById.get(line.itemId);
      if (!product) return { ok: false, reason: "not_found" };
      if (!product.active) return { ok: false, reason: "inactive_item" };
    } else {
      const ingredient = ingredientById.get(line.itemId);
      if (!ingredient) return { ok: false, reason: "not_found" };
      if (!ingredient.active) return { ok: false, reason: "inactive_item" };
    }
  }

  const productSums = await sumMovementsByProductAtLocation(db, input.locationId);
  const ingredientSums = await sumMovementsByIngredientAtLocation(db, input.locationId);
  const expectedByProduct = new Map(productSums.map((s) => [s.productId, s.quantityOnHand]));
  const expectedByIngredient = new Map(
    ingredientSums.map((s) => [s.ingredientId, s.quantityOnHand]),
  );

  const count = await createStockCount(db, {
    locationId: input.locationId,
    staffMemberId: requester.staff.id,
    lines: input.lines.map((line) => ({
      itemType: line.itemType,
      itemId: line.itemId,
      countedQuantity: line.countedQuantity,
      expectedQuantity:
        (line.itemType === "product"
          ? expectedByProduct.get(line.itemId)
          : expectedByIngredient.get(line.itemId)) ?? 0,
    })),
  });

  return { ok: true, count };
}

export type StockCountResult = { ok: true; count: StockCount } | { ok: false; reason: "forbidden" | "not_found" };

// Read is location-scoped the same way as every other stock read — a
// store-manager-recorded count is visible to anyone who can see that
// location, not just the owner (only the correct action is owner-only).
export async function getStockCount(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  stockCountId: string,
): Promise<StockCountResult> {
  const count = await findStockCountById(db, stockCountId);
  if (!count) return { ok: false, reason: "not_found" };

  if (!canAccessLocation(requester.staff.role, requester.staff.locationId, count.locationId)) {
    return { ok: false, reason: "forbidden" };
  }

  return { ok: true, count };
}

export type CorrectStockCountResult =
  | { ok: true }
  | { ok: false; reason: "forbidden" | "not_found" | "already_corrected" };

// docs/architecture.md: "only the owner may correct" — the person who
// counts is not the person who adjusts. Writes a `corrected` movement
// bringing getCurrentStockAtLocation in line with what was counted.
export async function correctStockCount(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  input: { stockCountId: string; lineId: string },
): Promise<CorrectStockCountResult> {
  if (requester.staff.role !== "owner") {
    return { ok: false, reason: "forbidden" };
  }

  const count = await findStockCountById(db, input.stockCountId);
  if (!count) return { ok: false, reason: "not_found" };

  const line = count.lines.find((l) => l.id === input.lineId);
  if (!line) return { ok: false, reason: "not_found" };
  if (line.correctedAt) return { ok: false, reason: "already_corrected" };

  const delta = line.countedQuantity - line.expectedQuantity;
  if (delta !== 0) {
    if (line.itemType === "product") {
      await createStockMovement(db, {
        productId: line.itemId,
        locationId: count.locationId,
        quantity: delta,
        reason: "corrected",
        staffMemberId: requester.staff.id,
      });
    } else {
      await createIngredientCorrectionMovement(db, {
        ingredientId: line.itemId,
        locationId: count.locationId,
        quantity: delta,
        staffMemberId: requester.staff.id,
      });
    }
  }

  await markStockCountLineCorrected(db, line.id, requester.staff.id);

  return { ok: true };
}
