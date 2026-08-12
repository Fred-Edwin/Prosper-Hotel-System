import type { PrismaClient } from "@/generated/prisma/client";
import {
  canAccessLocation,
  findLocationById,
  findStaffMembersByIds,
  listLocations,
  type AuthenticatedStaff,
} from "@/modules/people";
import {
  findIngredientsByIds,
  findProductsByIds,
  getCurrentRecipe,
  recordIngredientCost,
  recordProductCost,
  type Product,
} from "@/modules/catalogue";
import { creditSaleQuantityByProductAtLocation } from "@/modules/sales";
import {
  createIngredientConsumptionMovement,
  createIngredientCorrectionMovement,
  createIngredientIssueMovement,
  createIngredientMovement,
  createProductionMovement,
  createStockCount,
  createStockMovement,
  findDerivedSalesAtOccurredAt,
  findLatestStockCountAtLocation,
  findPreviousStockCountAtLocation,
  findReceiptById,
  findReceiptsAtLocation,
  findStockCountById,
  markStockCountLineCorrected,
  sumIngredientMovementsAtLocationAsOf,
  sumIngredientMovementsByReasonAtLocationInPeriod,
  sumIngredientsBoughtMinorAtLocationInPeriod,
  sumIngredientsIssuedByIngredientAtLocationInPeriod,
  sumIngredientsPurchasedByIngredientAtLocationInPeriod,
  sumMovementsByIngredientAtLocation,
  sumMovementsByProductAtLocation,
  sumMovementsByProductAtLocationAsOf,
  sumMovementsByProductReasonAtLocationInPeriod,
  sumNonSalesValueAtLocationInPeriod,
  sumProductMovementsByReasonAtLocationInPeriod,
  findNonSalesMovementsAtLocationInPeriod,
} from "./queries";
import type {
  DerivedSaleLine,
  IngredientMovement,
  LowStockItem,
  NonSalesCategory,
  Receipt,
  StockCount,
  StockCountItemType,
  StockCountForReader,
  StockLevel,
  StockMovement,
  StockMovementReason,
} from "./schema";

// CONTEXT.md's Non-sales Stock Consumption: where no per-unit cost is
// known, cost is estimated at 60% of selling price, per the owner's own
// discovery figure. See docs/formulas.md §4.
const ESTIMATED_COST_RATE = 0.6;

export type ProductCostBasis = { costBasisMinor: number; isEstimated: boolean } | null;

// formulas.md §4's cost-per-unit table, in priority order: a recipe's
// ingredients-used ÷ yield first (cooked food only), then the product's
// own recorded running average (bought-in goods/packaging — recordProductCost's
// figure), then the labelled 60%-of-selling-price estimate as a last resort.
// null means no cost figure can be produced at all (no recipe, no recorded
// cost, no selling price to estimate from). Exported (ticket 39) so
// reporting's product ledger can resolve a row's cost basis even for
// products getProductStockValueAtLocation(AsOf) would otherwise skip
// (those functions drop any product with no cost basis at all; the ledger
// still needs a row for it, with cost/profit shown as unavailable).
export function resolveProductCostBasis(
  product: Pick<Product, "priceMinor" | "lastKnownCostMinor">,
  recipe: { perUnitCostMinor: number | null } | null,
): ProductCostBasis {
  if (recipe?.perUnitCostMinor != null) {
    return { costBasisMinor: recipe.perUnitCostMinor, isEstimated: false };
  }
  if (product.lastKnownCostMinor != null) {
    return { costBasisMinor: product.lastKnownCostMinor, isEstimated: false };
  }
  if (product.priceMinor != null) {
    return { costBasisMinor: Math.round(product.priceMinor * ESTIMATED_COST_RATE), isEstimated: true };
  }
  return null;
}

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

export type LowStockAccessResult =
  | { ok: true; items: LowStockItem[] }
  | { ok: false; reason: "forbidden" | "not_found" };

export type IngredientStockValue = {
  ingredientId: string;
  ingredientName: string;
  quantityOnHand: number;
  unitCostMinor: number;
  valueMinor: number;
  isEstimated: boolean;
};

export type IngredientStockValuesResult =
  | { ok: true; values: IngredientStockValue[] }
  | { ok: false; reason: "forbidden" };

// Ingredient-side, per-row counterpart to getProductStockValueAtLocation —
// ticket 44, so ingredient rows on AdminStockTable carry a Value figure
// the same way product rows already do. Unlike products, an ingredient
// has a single running-average cost (lastKnownCostMinor), never an
// estimate — isEstimated is always false, kept only so the row shape
// matches ProductStockValue for the UI. An ingredient with no known cost
// is excluded, not shown as zero value.
export async function getIngredientStockValuesAtLocation(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  locationId: string,
): Promise<IngredientStockValuesResult> {
  if (!canAccessLocation(requester.staff.role, requester.staff.locationId, locationId)) {
    return { ok: false, reason: "forbidden" };
  }

  const sums = await sumMovementsByIngredientAtLocation(db, locationId);
  const ingredients = await findIngredientsByIds(db, sums.map((s) => s.ingredientId));
  const ingredientById = new Map(ingredients.map((i) => [i.id, i]));

  const values: IngredientStockValue[] = [];
  for (const sum of sums) {
    const ingredient = ingredientById.get(sum.ingredientId);
    if (!ingredient || ingredient.lastKnownCostMinor == null) continue;

    values.push({
      ingredientId: ingredient.id,
      ingredientName: ingredient.name,
      quantityOnHand: sum.quantityOnHand,
      unitCostMinor: ingredient.lastKnownCostMinor,
      valueMinor: sum.quantityOnHand * ingredient.lastKnownCostMinor,
      isEstimated: false,
    });
  }

  return { ok: true, values };
}

// Ticket 44: proposal.md §7 — items at or below their own defined level.
// Restaurant compares live on-hand (same sums getCurrentStockAtLocation
// reads); canteen compares the quantity as at the most recent count,
// since canteen stock is provisional between counts (§10.4) the same way
// its cost is — an item with no count yet has no basis to compare and is
// excluded, not shown as low. An item with no threshold set is likewise
// excluded — there is nothing to compare against.
export async function getLowStockItems(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  locationId: string,
): Promise<LowStockAccessResult> {
  if (!canAccessLocation(requester.staff.role, requester.staff.locationId, locationId)) {
    return { ok: false, reason: "forbidden" };
  }

  const location = await findLocationById(db, locationId);
  if (!location) {
    return { ok: false, reason: "not_found" };
  }

  if (location.code === "canteen") {
    const count = await findLatestStockCountAtLocation(db, locationId);
    if (!count) return { ok: true, items: [] };

    const productIds = count.lines.filter((l) => l.itemType === "product").map((l) => l.itemId);
    const ingredientIds = count.lines
      .filter((l) => l.itemType === "ingredient")
      .map((l) => l.itemId);
    const products = productIds.length > 0 ? await findProductsByIds(db, productIds) : [];
    const ingredients =
      ingredientIds.length > 0 ? await findIngredientsByIds(db, ingredientIds) : [];
    const productById = new Map(products.map((p) => [p.id, p]));
    const ingredientById = new Map(ingredients.map((i) => [i.id, i]));

    const items: LowStockItem[] = [];
    for (const line of count.lines) {
      const item = line.itemType === "product" ? productById.get(line.itemId) : ingredientById.get(line.itemId);
      if (!item || item.lowStockLevel == null) continue;
      if (line.countedQuantity > item.lowStockLevel) continue;
      items.push({
        itemType: line.itemType,
        itemId: line.itemId,
        itemName: item.name,
        quantityOnHand: line.countedQuantity,
        lowStockLevel: item.lowStockLevel,
        asOf: count.occurredAt,
      });
    }
    return { ok: true, items: items.sort((a, b) => a.itemName.localeCompare(b.itemName)) };
  }

  const productSums = await sumMovementsByProductAtLocation(db, locationId);
  const ingredientSums = await sumMovementsByIngredientAtLocation(db, locationId);
  const products =
    productSums.length > 0 ? await findProductsByIds(db, productSums.map((s) => s.productId)) : [];
  const ingredients =
    ingredientSums.length > 0
      ? await findIngredientsByIds(db, ingredientSums.map((s) => s.ingredientId))
      : [];
  const productById = new Map(products.map((p) => [p.id, p]));
  const ingredientById = new Map(ingredients.map((i) => [i.id, i]));

  const items: LowStockItem[] = [];
  for (const sum of productSums) {
    const product = productById.get(sum.productId);
    if (!product || product.lowStockLevel == null) continue;
    if (sum.quantityOnHand > product.lowStockLevel) continue;
    items.push({
      itemType: "product",
      itemId: sum.productId,
      itemName: product.name,
      quantityOnHand: sum.quantityOnHand,
      lowStockLevel: product.lowStockLevel,
      asOf: null,
    });
  }
  for (const sum of ingredientSums) {
    const ingredient = ingredientById.get(sum.ingredientId);
    if (!ingredient || ingredient.lowStockLevel == null) continue;
    if (sum.quantityOnHand > ingredient.lowStockLevel) continue;
    items.push({
      itemType: "ingredient",
      itemId: sum.ingredientId,
      itemName: ingredient.name,
      quantityOnHand: sum.quantityOnHand,
      lowStockLevel: ingredient.lowStockLevel,
      asOf: null,
    });
  }
  return { ok: true, items: items.sort((a, b) => a.itemName.localeCompare(b.itemName)) };
}

export type TransferMovement = StockMovement | IngredientMovement;
export type TransferableItem = {
  itemType: "product" | "ingredient";
  itemId: string;
  name: string;
  quantityOnHand: number;
  unit: string;
};

export async function getTransferableItems(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  locationId: string,
): Promise<{ ok: true; items: TransferableItem[] } | { ok: false; reason: "forbidden" }> {
  if (requester.staff.role === "cashier" || !canAccessLocation(requester.staff.role, requester.staff.locationId, locationId)) {
    return { ok: false, reason: "forbidden" };
  }
  const [productSums, ingredientSums] = await Promise.all([
    sumMovementsByProductAtLocation(db, locationId),
    sumMovementsByIngredientAtLocation(db, locationId),
  ]);
  const [products, ingredients] = await Promise.all([
    findProductsByIds(db, productSums.filter((sum) => sum.quantityOnHand > 0).map((sum) => sum.productId)),
    findIngredientsByIds(db, ingredientSums.filter((sum) => sum.quantityOnHand > 0).map((sum) => sum.ingredientId)),
  ]);
  const productQuantity = new Map(productSums.map((sum) => [sum.productId, sum.quantityOnHand]));
  const ingredientQuantity = new Map(ingredientSums.map((sum) => [sum.ingredientId, sum.quantityOnHand]));
  return {
    ok: true,
    items: [
      ...products.filter((product) => product.active).map((product) => ({ itemType: "product" as const, itemId: product.id, name: product.name, quantityOnHand: productQuantity.get(product.id) ?? 0, unit: "units" })),
      ...ingredients.filter((ingredient) => ingredient.active).map((ingredient) => ({ itemType: "ingredient" as const, itemId: ingredient.id, name: ingredient.name, quantityOnHand: ingredientQuantity.get(ingredient.id) ?? 0, unit: ingredient.unitOfMeasure })),
    ].sort((a, b) => a.name.localeCompare(b.name)),
  };
}

export type RecordTransferResult =
  | { ok: true; movements: [TransferMovement, TransferMovement] }
  | {
      ok: false;
      reason:
        | "forbidden"
        | "invalid_quantity"
        | "same_location"
        | "inactive_item"
        | "not_found"
        | "insufficient_stock"
        | "already_reversed";
    };

export type RecordTransfersResult =
  | { ok: true; movements: TransferMovement[] }
  | Exclude<RecordTransferResult, { ok: true }>;

// A transfer is a paired ledger event: the source loses stock at the same
// moment the destination receives it. The transaction prevents a partial
// transfer from ever being visible if the second write fails.
export async function recordTransfer(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  input: {
    fromLocationId: string;
    toLocationId: string;
    itemType: "product" | "ingredient";
    itemId: string;
    quantity: number;
  },
): Promise<RecordTransferResult> {
  const result = await recordTransfers(db, requester, {
    fromLocationId: input.fromLocationId,
    toLocationId: input.toLocationId,
    lines: [{ itemType: input.itemType, itemId: input.itemId, quantity: input.quantity }],
  });
  if (!result.ok) return result;
  return { ok: true, movements: [result.movements[0], result.movements[1]] };
}

export async function recordTransfers(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  input: {
    fromLocationId: string;
    toLocationId: string;
    lines: { itemType: "product" | "ingredient"; itemId: string; quantity: number }[];
    allowReversalFromOtherLocation?: boolean;
    reversedTransferId?: string;
  },
): Promise<RecordTransfersResult> {
  if (
    requester.staff.role === "cashier" ||
    (!input.allowReversalFromOtherLocation &&
      !canAccessLocation(requester.staff.role, requester.staff.locationId, input.fromLocationId))
  ) {
    return { ok: false, reason: "forbidden" };
  }
  if (input.lines.length === 0 || input.lines.some((line) => line.quantity <= 0)) {
    return { ok: false, reason: "invalid_quantity" };
  }
  if (input.fromLocationId === input.toLocationId) return { ok: false, reason: "same_location" };

  const [fromLocation, toLocation] = await Promise.all([
    findLocationById(db, input.fromLocationId),
    findLocationById(db, input.toLocationId),
  ]);
  if (!fromLocation || !toLocation) return { ok: false, reason: "not_found" };

  return db.$transaction(async (tx) => {
    const transferId = crypto.randomUUID();
    const movements: TransferMovement[] = [];

    for (const line of input.lines) {
      if (line.itemType === "product") {
        const product = await tx.product.findUnique({ where: { id: line.itemId } });
      if (!product) return { ok: false, reason: "not_found" } as const;
      if (!product.active) return { ok: false, reason: "inactive_item" } as const;

      const stock = await tx.stockMovement.aggregate({
        where: { productId: product.id, locationId: input.fromLocationId },
        _sum: { quantity: true },
      });
        if ((stock._sum.quantity ?? 0) < line.quantity) {
        return { ok: false, reason: "insufficient_stock" } as const;
      }

      const outgoing = await tx.stockMovement.create({
        data: {
          productId: product.id,
          locationId: input.fromLocationId,
          quantity: -line.quantity,
          reason: "transferred",
          staffMemberId: requester.staff.id,
          transferId,
          reversedTransferId: input.reversedTransferId,
        },
      });
      const incoming = await tx.stockMovement.create({
        data: {
          productId: product.id,
          locationId: input.toLocationId,
          quantity: line.quantity,
          reason: "transferred",
          staffMemberId: requester.staff.id,
          transferId,
          reversedTransferId: input.reversedTransferId,
        },
      });
        movements.push(outgoing, incoming);
        continue;
      }

      const ingredient = await tx.ingredient.findUnique({ where: { id: line.itemId } });
    if (!ingredient) return { ok: false, reason: "not_found" } as const;
    if (!ingredient.active) return { ok: false, reason: "inactive_item" } as const;

    const stock = await tx.ingredientMovement.aggregate({
      where: { ingredientId: ingredient.id, locationId: input.fromLocationId },
      _sum: { quantity: true },
    });
      if ((stock._sum.quantity ?? 0) < line.quantity) {
      return { ok: false, reason: "insufficient_stock" } as const;
    }

    const outgoing = await tx.ingredientMovement.create({
      data: {
        ingredientId: ingredient.id,
        locationId: input.fromLocationId,
        quantity: -line.quantity,
        reason: "transferred",
        staffMemberId: requester.staff.id,
        transferId,
        reversedTransferId: input.reversedTransferId,
      },
    });
    const incoming = await tx.ingredientMovement.create({
      data: {
        ingredientId: ingredient.id,
        locationId: input.toLocationId,
        quantity: line.quantity,
        reason: "transferred",
        staffMemberId: requester.staff.id,
        transferId,
        reversedTransferId: input.reversedTransferId,
      },
    });
      movements.push(outgoing, incoming);
    }

    return { ok: true, movements } as const;
  });
}

export async function reverseTransfer(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  transferId: string,
): Promise<RecordTransfersResult> {
  const [products, ingredients, existingReversal] = await Promise.all([
    db.stockMovement.findMany({ where: { transferId } }),
    db.ingredientMovement.findMany({ where: { transferId } }),
    Promise.all([
      db.stockMovement.findFirst({ where: { reversedTransferId: transferId } }),
      db.ingredientMovement.findFirst({ where: { reversedTransferId: transferId } }),
    ]),
  ]);
  if (existingReversal[0] || existingReversal[1]) return { ok: false, reason: "already_reversed" };
  const productOut = products.filter((movement) => movement.quantity < 0);
  const ingredientOut = ingredients.filter((movement) => movement.quantity < 0);
  const original = productOut[0] ?? ingredientOut[0];
  if (!original) return { ok: false, reason: "not_found" };
  if (original.staffMemberId !== requester.staff.id && requester.staff.role !== "owner") {
    return { ok: false, reason: "forbidden" };
  }
  const incoming = products.find((movement) => movement.quantity > 0) ?? ingredients.find((movement) => movement.quantity > 0);
  if (!incoming) return { ok: false, reason: "not_found" };
  return recordTransfers(db, requester, {
    fromLocationId: incoming.locationId,
    toLocationId: original.locationId,
    allowReversalFromOtherLocation: true,
    reversedTransferId: transferId,
    lines: [
      ...productOut.map((movement) => ({ itemType: "product" as const, itemId: movement.productId, quantity: -movement.quantity })),
      ...ingredientOut.map((movement) => ({ itemType: "ingredient" as const, itemId: movement.ingredientId, quantity: -movement.quantity })),
    ],
  });
}

export type TransferHistoryLine = {
  itemType: "product" | "ingredient";
  itemId: string;
  name: string;
  quantity: number;
  unit: string;
};
export type TransferHistoryEntry = {
  transferId: string;
  direction: "sent" | "received";
  counterpartLocationName: string;
  occurredAt: Date;
  reversed: boolean;
  isReversal: boolean;
  lines: TransferHistoryLine[];
};

export async function listTransfersAtLocation(
  db: PrismaClient,
  requester: AuthenticatedStaff,
): Promise<{ ok: true; transfers: TransferHistoryEntry[] } | { ok: false; reason: "forbidden" }> {
  if (requester.staff.role === "cashier") return { ok: false, reason: "forbidden" };
  const locationId = requester.staff.locationId;
  const [ownProducts, ownIngredients, otherLegProducts, otherLegIngredients, locations] = await Promise.all([
    db.stockMovement.findMany({ where: { locationId, reason: "transferred", transferId: { not: null } }, orderBy: { occurredAt: "desc" } }),
    db.ingredientMovement.findMany({ where: { locationId, reason: "transferred", transferId: { not: null } }, orderBy: { occurredAt: "desc" } }),
    db.stockMovement.findMany({ where: { locationId: { not: locationId }, reason: "transferred", transferId: { not: null } } }),
    db.ingredientMovement.findMany({ where: { locationId: { not: locationId }, reason: "transferred", transferId: { not: null } } }),
    listLocations(db),
  ]);

  const locationNameById = new Map(locations.map((location) => [location.id, location.name]));
  const otherLegByTransferId = new Map<string, { locationId: string }>();
  for (const movement of [...otherLegProducts, ...otherLegIngredients]) {
    otherLegByTransferId.set(movement.transferId as string, { locationId: movement.locationId });
  }

  const reversedTransferIds = new Set(
    [...ownProducts, ...ownIngredients, ...otherLegProducts, ...otherLegIngredients]
      .map((movement) => movement.reversedTransferId)
      .filter((id): id is string => id !== null),
  );

  const byTransferId = new Map<string, { occurredAt: Date; isReversal: boolean; lines: TransferHistoryLine[] }>();
  for (const movement of [...ownProducts, ...ownIngredients]) {
    const transferId = movement.transferId as string;
    const group = byTransferId.get(transferId) ?? { occurredAt: movement.occurredAt, isReversal: movement.reversedTransferId !== null, lines: [] };
    group.lines.push({
      itemType: "productId" in movement ? "product" : "ingredient",
      itemId: "productId" in movement ? movement.productId : movement.ingredientId,
      name: "",
      quantity: Math.abs(movement.quantity),
      unit: "",
    });
    byTransferId.set(transferId, group);
  }

  const productIds = [...ownProducts].map((movement) => movement.productId);
  const ingredientIds = [...ownIngredients].map((movement) => movement.ingredientId);
  const [products, ingredients] = await Promise.all([
    findProductsByIds(db, productIds),
    findIngredientsByIds(db, ingredientIds),
  ]);
  const productNameById = new Map(products.map((product) => [product.id, product.name]));
  const ingredientById = new Map(ingredients.map((ingredient) => [ingredient.id, ingredient]));

  const transfers: TransferHistoryEntry[] = Array.from(byTransferId.entries()).map(([transferId, group]) => {
    const anyLeg = [...ownProducts, ...ownIngredients].find((movement) => movement.transferId === transferId)!;
    const direction: "sent" | "received" = anyLeg.quantity < 0 ? "sent" : "received";
    const counterpartLocationId = otherLegByTransferId.get(transferId)?.locationId;
    return {
      transferId,
      direction,
      counterpartLocationName: (counterpartLocationId && locationNameById.get(counterpartLocationId)) ?? "Unknown location",
      occurredAt: group.occurredAt,
      reversed: reversedTransferIds.has(transferId),
      isReversal: group.isReversal,
      lines: group.lines.map((line) => ({
        ...line,
        name: line.itemType === "product" ? (productNameById.get(line.itemId) ?? "Unknown product") : (ingredientById.get(line.itemId)?.name ?? "Unknown ingredient"),
        unit: line.itemType === "product" ? "units" : (ingredientById.get(line.itemId)?.unitOfMeasure ?? ""),
      })),
    };
  });

  transfers.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
  return { ok: true, transfers };
}

export type ReceiptLine = {
  itemType: "product" | "ingredient";
  itemId: string;
  quantity: number;
  unitCostMinor: number;
};

export type RecordIngredientReceiptResult =
  | { ok: true; movements: (StockMovement | IngredientMovement)[] }
  | { ok: false; reason: "forbidden" | "invalid_quantity" | "invalid_cost" | "inactive_ingredient" };

// architecture.md: receiving is a store-manager/attendant capability, each
// at their own location, plus the owner — not restaurant-only.
function canReceive(role: string): boolean {
  return role === "owner" || role === "store_manager" || role === "attendant";
}

// Ticket 22: a supplier drop-off may include both ingredients and products
// in one visit (e.g. the canteen receiving printer paper and airtime
// scratch cards together) — every line, of either family, shares one
// receipt id, per the pattern recordIngredientReceipt established (ticket
// 12). "inactive_ingredient" is kept as the shared reason for an inactive
// line of either type — no separate reason exists for products, since the
// two families are validated identically here.
export async function recordIngredientReceipt(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  input: {
    locationId: string;
    lines: ReceiptLine[];
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

  const productLines = input.lines.filter((line) => line.itemType === "product");
  const ingredientLines = input.lines.filter((line) => line.itemType === "ingredient");

  const [products, ingredients] = await Promise.all([
    findProductsByIds(db, productLines.map((line) => line.itemId)),
    findIngredientsByIds(db, ingredientLines.map((line) => line.itemId)),
  ]);
  const productById = new Map(products.map((p) => [p.id, p]));
  const ingredientById = new Map(ingredients.map((i) => [i.id, i]));

  const allActive =
    productLines.every((line) => productById.get(line.itemId)?.active) &&
    ingredientLines.every((line) => ingredientById.get(line.itemId)?.active);
  if (!allActive) return { ok: false, reason: "inactive_ingredient" };

  const [productSums, ingredientSums] = await Promise.all([
    sumMovementsByProductAtLocation(db, input.locationId),
    sumMovementsByIngredientAtLocation(db, input.locationId),
  ]);
  const productQuantityOnHand = new Map(productSums.map((s) => [s.productId, s.quantityOnHand]));
  const ingredientQuantityOnHand = new Map(
    ingredientSums.map((s) => [s.ingredientId, s.quantityOnHand]),
  );

  // Shared by every line in this call — what a Stock-category Expense
  // (cash module) references as "the receipt it pays for."
  const receiptId = crypto.randomUUID();

  const movements: (StockMovement | IngredientMovement)[] = [];
  for (const line of input.lines) {
    if (line.itemType === "product") {
      const movement = await createStockMovement(db, {
        productId: line.itemId,
        locationId: input.locationId,
        quantity: line.quantity,
        reason: "received",
        staffMemberId: requester.staff.id,
        receiptId,
      });
      movements.push(movement);
      const quantityOnHand = productQuantityOnHand.get(line.itemId) ?? 0;
      await recordProductCost(db, requester, line.itemId, {
        quantityOnHand,
        quantityBought: line.quantity,
        unitCostMinor: line.unitCostMinor,
      });
      // A second line for the same product later in this call must see
      // this line's delivery as already on hand — same as two sequential
      // recordIngredientReceipt calls would (review finding, PR #6).
      productQuantityOnHand.set(line.itemId, quantityOnHand + line.quantity);
      continue;
    }

    const movement = await createIngredientMovement(db, {
      ingredientId: line.itemId,
      locationId: input.locationId,
      quantity: line.quantity,
      reason: "received",
      unitCostMinor: line.unitCostMinor,
      staffMemberId: requester.staff.id,
      receiptId,
    });
    movements.push(movement);
    const quantityOnHand = ingredientQuantityOnHand.get(line.itemId) ?? 0;
    await recordIngredientCost(db, requester, line.itemId, {
      quantityOnHand,
      quantityBought: line.quantity,
      unitCostMinor: line.unitCostMinor,
    });
    // Same reasoning as the product branch above.
    ingredientQuantityOnHand.set(line.itemId, quantityOnHand + line.quantity);
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

    const basis = resolveProductCostBasis(product, recipe);
    if (!basis) {
      // No recipe cost, no recorded cost, and no selling price to estimate from.
      return { ok: false, reason: "invalid_cost" };
    }

    const movement = await createStockMovement(db, {
      productId: product.id,
      locationId: input.locationId,
      quantity: -input.quantity,
      reason: input.category,
      staffMemberId: requester.staff.id,
      costBasisMinor: basis.costBasisMinor * input.quantity,
      sellingValueMinor: sellingValueMinor != null ? sellingValueMinor * input.quantity : null,
      isEstimated: basis.isEstimated,
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

  // CONTEXT.md's "Sold, derived" / formulas.md §2: the canteen's only
  // source of item-by-item trading detail is worked out at a count, since
  // individual sales aren't recorded there. Restaurant-only counts never
  // trigger this — the restaurant records every sale directly.
  const location = await findLocationById(db, input.locationId);
  if (location?.code === "canteen") {
    await recordCountDerivedSales(db, requester, count);
  }

  return { ok: true, count };
}

// formulas.md §2's canteen formula:
//   sold = previous count + received + transferred in
//        − recorded credit sales − wasted − consumed − given away
//        − transferred out − this count
// Reads every reason's movements in the period strictly after the
// previous count and up to (inclusive of) this one, per product, then
// writes one `sold_derived` movement per item where the result is
// non-zero. Nothing is written for a product with no previous count to
// compare against ("the first period has no measured rate") — silently
// skipped, not treated as an error, since a first-ever canteen count is
// an expected, normal event.
//
// Reads credit-sale quantities from sales/index.ts (creditSaleQuantityByProductAtLocation)
// rather than through stock's own movement ledger — credit sales are
// recorded on the Sale/PaymentLine tables, not as stock movements. This is
// a one-directional stock -> sales read, the same shape as
// docs/architecture.md's tracer slice: "stock reading catalogue... two
// modules that actually need each other," never the reverse. sales/logic.ts
// separately imports recordStockMovement from stock (pre-existing, for
// recordCounterSale) — that's a different, older relationship this ticket
// didn't create and isn't in scope to invert. Reviewed and confirmed
// (ticket 24 review note) that reporting isn't the right home for this
// instead: reporting "owns no data," but this function writes a
// sold_derived StockMovement, which is stock's own data.
async function recordCountDerivedSales(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  count: StockCount,
): Promise<void> {
  const previousCount = await findPreviousStockCountAtLocation(
    db,
    count.locationId,
    count.occurredAt,
  );
  if (!previousCount) return;

  const previousByProduct = new Map(
    previousCount.lines
      .filter((line) => line.itemType === "product")
      .map((line) => [line.itemId, line.countedQuantity]),
  );

  const productIds = count.lines
    .filter((line) => line.itemType === "product" && previousByProduct.has(line.itemId))
    .map((line) => line.itemId);
  if (productIds.length === 0) return;

  const [movementSums, creditSales, products] = await Promise.all([
    sumMovementsByProductReasonAtLocationInPeriod(
      db,
      count.locationId,
      ["received", "transferred", "wasted", "consumed", "given_away"],
      previousCount.occurredAt,
      count.occurredAt,
    ),
    creditSaleQuantityByProductAtLocation(
      db,
      count.locationId,
      previousCount.occurredAt,
      count.occurredAt,
    ),
    findProductsByIds(db, productIds),
  ]);

  const productById = new Map(products.map((p) => [p.id, p]));
  const creditQuantityByProduct = new Map(creditSales.map((s) => [s.productId, s.quantity]));

  // transferred is signed (positive in, negative out) — split it back into
  // its two named terms rather than summing it once, since the formula
  // treats "transferred in" and "transferred out" as separate lines.
  const sumsByProduct = new Map<string, { transferredIn: number; transferredOut: number; wasted: number; consumed: number; givenAway: number }>();
  for (const sum of movementSums) {
    const entry = sumsByProduct.get(sum.productId) ?? {
      transferredIn: 0,
      transferredOut: 0,
      wasted: 0,
      consumed: 0,
      givenAway: 0,
    };
    if (sum.reason === "received") {
      // received is folded into the formula as its own positive term below.
    } else if (sum.reason === "transferred") {
      if (sum.quantity > 0) entry.transferredIn += sum.quantity;
      else entry.transferredOut += -sum.quantity;
    } else if (sum.reason === "wasted") {
      entry.wasted += -sum.quantity;
    } else if (sum.reason === "consumed") {
      entry.consumed += -sum.quantity;
    } else if (sum.reason === "given_away") {
      entry.givenAway += -sum.quantity;
    }
    sumsByProduct.set(sum.productId, entry);
  }
  const receivedByProduct = new Map(
    movementSums.filter((s) => s.reason === "received").map((s) => [s.productId, s.quantity]),
  );

  for (const line of count.lines) {
    if (line.itemType !== "product") continue;
    const previousCounted = previousByProduct.get(line.itemId);
    if (previousCounted === undefined) continue;

    const sums = sumsByProduct.get(line.itemId) ?? {
      transferredIn: 0,
      transferredOut: 0,
      wasted: 0,
      consumed: 0,
      givenAway: 0,
    };
    const received = receivedByProduct.get(line.itemId) ?? 0;
    const creditSold = creditQuantityByProduct.get(line.itemId) ?? 0;

    const sold =
      previousCounted +
      received +
      sums.transferredIn -
      creditSold -
      sums.wasted -
      sums.consumed -
      sums.givenAway -
      sums.transferredOut -
      line.countedQuantity;

    if (sold === 0) continue;

    const product = productById.get(line.itemId);
    const sellingValueMinor = product?.priceMinor != null ? product.priceMinor * sold : null;

    await createStockMovement(db, {
      productId: line.itemId,
      locationId: count.locationId,
      quantity: -sold,
      reason: "sold_derived",
      staffMemberId: requester.staff.id,
      sellingValueMinor,
      occurredAt: count.occurredAt,
    });
  }
}

async function withItemNames(
  db: PrismaClient,
  count: StockCount,
): Promise<StockCountForReader> {
  const productIds = count.lines.filter((l) => l.itemType === "product").map((l) => l.itemId);
  const ingredientIds = count.lines
    .filter((l) => l.itemType === "ingredient")
    .map((l) => l.itemId);

  const products = productIds.length > 0 ? await findProductsByIds(db, productIds) : [];
  const ingredients =
    ingredientIds.length > 0 ? await findIngredientsByIds(db, ingredientIds) : [];
  const nameById = new Map([
    ...products.map((p) => [p.id, p.name] as const),
    ...ingredients.map((i) => [i.id, i.name] as const),
  ]);

  return {
    ...count,
    lines: count.lines.map((line) => ({
      ...line,
      itemName: nameById.get(line.itemId) ?? "Unknown item",
    })),
  };
}

export type StockCountResult =
  | { ok: true; count: StockCountForReader }
  | { ok: false; reason: "forbidden" | "not_found" };

// Read is location-scoped the same way as every other stock read — a
// store-manager-recorded count is visible to anyone who can see that
// location, not just the owner (only the correct action is owner-only).
//
// The comparison (expected quantity, and therefore the difference) is
// owner-only regardless of who recorded the count — showing it to whoever
// is doing the physical count would anchor her count to what the system
// already believes, undermining the count as an independent check. Strip
// it here so a non-owner's response never contains the figure at all,
// rather than trusting the UI to hide a column it already received.
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

  const named = await withItemNames(db, count);

  if (requester.staff.role === "owner") {
    return { ok: true, count: named };
  }

  const counted: StockCountForReader = {
    ...named,
    lines: named.lines.map((line) => {
      const { expectedQuantity: _expectedQuantity, ...rest } = line;
      return rest as StockCountForReader["lines"][number];
    }),
  };
  return { ok: true, count: counted };
}

// Ticket 24: "since last count" is only ever meaningful at the canteen
// (the restaurant records every sale directly, per CONTEXT.md) and only
// once a previous count exists to derive against — formulas.md's "the
// first period has no measured rate" caveat. `available: false` covers
// both a restaurant count and a canteen first count; the UI shows the
// same "not yet available" messaging either way rather than distinguishing
// them, since the ticket only asks the detail be absent/labelled
// unavailable, not that the two reasons read differently.
// sincePreviousCountAt (ticket 25): the previous count's own occurredAt —
// the period the derived lines were measured over began strictly after
// this. Reporting's own-goods rate (formulas.md §6) needs to classify
// which of these products were restaurant-supplied vs. the canteen's own
// goods *within that same period*, which needs the period's start.
export type DerivedSalesDetail =
  | { available: false }
  | { available: true; lines: DerivedSaleLine[]; sincePreviousCountAt: Date };

export type LatestStockCountResult =
  | { ok: true; count: StockCountForReader | null; derivedSales: DerivedSalesDetail }
  | { ok: false; reason: "forbidden" };

async function derivedSalesDetailForCount(
  db: PrismaClient,
  locationId: string,
  count: StockCount,
): Promise<DerivedSalesDetail> {
  const location = await findLocationById(db, locationId);
  if (location?.code !== "canteen") return { available: false };

  const previousCount = await findPreviousStockCountAtLocation(db, locationId, count.occurredAt);
  if (!previousCount) return { available: false };

  const derived = await findDerivedSalesAtOccurredAt(db, locationId, count.occurredAt);
  const products = derived.length > 0 ? await findProductsByIds(db, derived.map((d) => d.productId)) : [];
  const nameById = new Map(products.map((p) => [p.id, p.name]));

  return {
    available: true,
    lines: derived.map((d) => ({
      productId: d.productId,
      itemName: nameById.get(d.productId) ?? "Unknown product",
      quantity: d.quantity,
      revenueMinor: d.sellingValueMinor,
    })),
    sincePreviousCountAt: previousCount.occurredAt,
  };
}

// The owner's review/correct table under the admin Stock destination —
// shows the current/most recent count at a location, not a full history
// (out of scope per the ticket). Owner-only: this is the comparison view,
// same restriction as getStockCount's expected/difference fields.
export async function getLatestStockCount(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  locationId: string,
): Promise<LatestStockCountResult> {
  if (
    requester.staff.role !== "owner" ||
    !canAccessLocation(requester.staff.role, requester.staff.locationId, locationId)
  ) {
    return { ok: false, reason: "forbidden" };
  }

  const count = await findLatestStockCountAtLocation(db, locationId);
  if (!count) return { ok: true, count: null, derivedSales: { available: false } };

  return {
    ok: true,
    count: await withItemNames(db, count),
    derivedSales: await derivedSalesDetailForCount(db, locationId, count),
  };
}

// Ticket 25 — formulas.md's count-correction figure ("estimated since
// last count" vs. "measured at the count") needs the rate in force
// *before* the latest count, i.e. the count immediately before it, with
// its own derived-sales detail computed the same way. Same shape and
// gating as getLatestStockCount, parameterised by "before this count"
// instead of "most recent."
export async function getPreviousStockCount(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  locationId: string,
  beforeOccurredAt: Date,
): Promise<LatestStockCountResult> {
  if (
    requester.staff.role !== "owner" ||
    !canAccessLocation(requester.staff.role, requester.staff.locationId, locationId)
  ) {
    return { ok: false, reason: "forbidden" };
  }

  const count = await findPreviousStockCountAtLocation(db, locationId, beforeOccurredAt);
  if (!count) return { ok: true, count: null, derivedSales: { available: false } };

  return {
    ok: true,
    count: await withItemNames(db, count),
    derivedSales: await derivedSalesDetailForCount(db, locationId, count),
  };
}

export type CorrectStockCountResult =
  | { ok: true }
  | { ok: false; reason: "forbidden" | "not_found" | "already_corrected" | "invalid_cost" };

// docs/architecture.md: "only the owner may correct" — the person who
// counts is not the person who adjusts. The owner investigates off-system
// and enters what she determines the actual correct quantity is — this may
// or may not equal what was originally counted — so the correction's delta
// is against her entered figure, not the count's own recorded difference.
//
// Financial valuation follows recordNonSalesConsumption's precedent: a
// product is valued at recipe cost if it has one, else an estimate from
// its selling price; an ingredient is valued at lastKnownCostMinor, cost
// only. A shortfall (negative delta) is a real loss and carries selling
// value the same way wastage does; a surplus (positive delta) is cost-only
// — a found item is not profit until it is actually sold.
export async function correctStockCount(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  input: { stockCountId: string; lineId: string; correctedQuantity: number },
): Promise<CorrectStockCountResult> {
  if (requester.staff.role !== "owner") {
    return { ok: false, reason: "forbidden" };
  }

  const count = await findStockCountById(db, input.stockCountId);
  if (!count) return { ok: false, reason: "not_found" };

  const line = count.lines.find((l) => l.id === input.lineId);
  if (!line) return { ok: false, reason: "not_found" };
  if (line.correctedAt) return { ok: false, reason: "already_corrected" };

  const delta = input.correctedQuantity - line.expectedQuantity;

  if (delta !== 0) {
    if (line.itemType === "product") {
      const [product] = await findProductsByIds(db, [line.itemId]);
      if (!product) return { ok: false, reason: "not_found" };

      const recipe = product.kind === "cooked_food" ? await getCurrentRecipe(db, product.id) : null;
      const sellingValueMinor = product.priceMinor;

      const basis = resolveProductCostBasis(product, recipe);
      if (!basis) {
        return { ok: false, reason: "invalid_cost" };
      }

      await createStockMovement(db, {
        productId: line.itemId,
        locationId: count.locationId,
        quantity: delta,
        reason: "corrected",
        staffMemberId: requester.staff.id,
        costBasisMinor: basis.costBasisMinor * Math.abs(delta),
        // A shortfall is a real, unexplained loss of sellable inventory —
        // value it the same way wastage does. A surplus is not profit
        // until it's actually sold, so no selling value is recognised.
        sellingValueMinor:
          delta < 0 && sellingValueMinor != null ? sellingValueMinor * Math.abs(delta) : null,
        isEstimated: basis.isEstimated,
      });
    } else {
      const [ingredient] = await findIngredientsByIds(db, [line.itemId]);
      if (!ingredient) return { ok: false, reason: "not_found" };
      if (ingredient.lastKnownCostMinor == null) {
        return { ok: false, reason: "invalid_cost" };
      }

      await createIngredientCorrectionMovement(db, {
        ingredientId: line.itemId,
        locationId: count.locationId,
        quantity: delta,
        staffMemberId: requester.staff.id,
        costBasisMinor: ingredient.lastKnownCostMinor * Math.abs(delta),
      });
    }
  }

  await markStockCountLineCorrected(db, line.id, requester.staff.id);

  return { ok: true };
}

// --- Ticket 25: reads reporting composes for the dashboard's Profit
// panel. Owner-gated like every other location-scoped read here — the
// dashboard itself is owner-only, but the gate belongs on the read, not
// assumed from the caller.

export type IngredientStockValueResult =
  | { ok: true; totalMinor: number }
  | { ok: false; reason: "forbidden" };

// formulas.md §12 valuation (quantity × unit cost), at a point in time —
// used for §6's restaurant "opening ingredients" / "closing ingredients"
// terms. Valued at each ingredient's *current* running-average cost
// (formulas.md §3 keeps no historical batch cost), same simplification
// correctStockCount already makes for a count correction's cost basis.
export async function getIngredientStockValueAtLocation(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  locationId: string,
  asOf: Date,
): Promise<IngredientStockValueResult> {
  if (!canAccessLocation(requester.staff.role, requester.staff.locationId, locationId)) {
    return { ok: false, reason: "forbidden" };
  }
  const sums = await sumIngredientMovementsAtLocationAsOf(db, locationId, asOf);
  const ingredients = await findIngredientsByIds(db, sums.map((s) => s.ingredientId));
  const costById = new Map(ingredients.map((i) => [i.id, i.lastKnownCostMinor ?? 0]));
  const totalMinor = sums.reduce(
    (sum, s) => sum + s.quantityOnHand * (costById.get(s.ingredientId) ?? 0),
    0,
  );
  return { ok: true, totalMinor };
}

export type IngredientQuantityAtLocationResult =
  | { ok: true; quantities: { ingredientId: string; quantityOnHand: number }[] }
  | { ok: false; reason: "forbidden" };

// Ticket 42: ingredient-side counterpart to getProductQuantityAtLocationAsOf
// — quantity only, per ingredient, at a point in time, for the Store
// ledger's opening/closing columns.
export async function getIngredientQuantityAtLocationAsOf(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  locationId: string,
  asOf: Date,
): Promise<IngredientQuantityAtLocationResult> {
  if (!canAccessLocation(requester.staff.role, requester.staff.locationId, locationId)) {
    return { ok: false, reason: "forbidden" };
  }
  const quantities = await sumIngredientMovementsAtLocationAsOf(db, locationId, asOf);
  return { ok: true, quantities };
}

export type ProductStockValue = {
  productId: string;
  productName: string;
  quantityOnHand: number;
  unitCostMinor: number;
  valueMinor: number;
  isEstimated: boolean;
};

export type ProductStockValueResult =
  | { ok: true; values: ProductStockValue[] }
  | { ok: false; reason: "forbidden" };

// Product-side counterpart to getIngredientStockValueAtLocation — ticket 37.
// Unlike ingredients (a single running-average cost), a product's unit cost
// follows formulas.md §4's full three-tier table via resolveProductCostBasis,
// so each row (not just a total) carries its own cost and estimate flag for
// the UI to label. Quantities come from the same sumMovementsByProductAtLocation
// query getCurrentStockAtLocation uses, so the two reads never drift.
export async function getProductStockValueAtLocation(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  locationId: string,
): Promise<ProductStockValueResult> {
  if (!canAccessLocation(requester.staff.role, requester.staff.locationId, locationId)) {
    return { ok: false, reason: "forbidden" };
  }

  const sums = await sumMovementsByProductAtLocation(db, locationId);
  const products = await findProductsByIds(db, sums.map((s) => s.productId));
  const productById = new Map(products.map((p) => [p.id, p]));

  const values: ProductStockValue[] = [];
  for (const sum of sums) {
    const product = productById.get(sum.productId);
    if (!product) continue;

    const recipe = product.kind === "cooked_food" ? await getCurrentRecipe(db, product.id) : null;
    const basis = resolveProductCostBasis(product, recipe);
    if (!basis) continue;

    values.push({
      productId: product.id,
      productName: product.name,
      quantityOnHand: sum.quantityOnHand,
      unitCostMinor: basis.costBasisMinor,
      valueMinor: sum.quantityOnHand * basis.costBasisMinor,
      isEstimated: basis.isEstimated,
    });
  }

  values.sort((a, b) => a.productName.localeCompare(b.productName));
  return { ok: true, values };
}

export type ProductQuantityAtLocationResult =
  | { ok: true; quantities: { productId: string; quantityOnHand: number }[] }
  | { ok: false; reason: "forbidden" };

// Ticket 39: as-of counterpart to sumMovementsByProductAtLocation — quantity
// only, for every product with a movement by the given date, unfiltered by
// cost basis (unlike getProductStockValueAtLocation, which drops a product
// with no cost basis at all; the Product ledger still needs a row for it,
// with cost/profit shown as unavailable rather than the row disappearing).
export async function getProductQuantityAtLocationAsOf(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  locationId: string,
  asOf: Date,
): Promise<ProductQuantityAtLocationResult> {
  if (!canAccessLocation(requester.staff.role, requester.staff.locationId, locationId)) {
    return { ok: false, reason: "forbidden" };
  }
  const quantities = await sumMovementsByProductAtLocationAsOf(db, locationId, asOf);
  return { ok: true, quantities };
}

export type IngredientsBoughtResult =
  | { ok: true; totalMinor: number }
  | { ok: false; reason: "forbidden" };

// formulas.md §6's "ingredients bought" term — money actually paid on
// deliveries received in the period, not a re-valuation.
export async function getIngredientsBoughtMinor(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  locationId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<IngredientsBoughtResult> {
  if (!canAccessLocation(requester.staff.role, requester.staff.locationId, locationId)) {
    return { ok: false, reason: "forbidden" };
  }
  const totalMinor = await sumIngredientsBoughtMinorAtLocationInPeriod(
    db,
    locationId,
    periodStart,
    periodEnd,
  );
  return { ok: true, totalMinor };
}

export type IngredientsConsumedResult =
  | { ok: true; totalMinor: number }
  | { ok: false; reason: "forbidden" };

// formulas.md §5's transfer rate — "ingredients the kitchen consumed" is
// what was issued to production in the period, valued at each
// ingredient's current running-average cost.
export async function getIngredientsIssuedMinor(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  locationId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<IngredientsConsumedResult> {
  if (!canAccessLocation(requester.staff.role, requester.staff.locationId, locationId)) {
    return { ok: false, reason: "forbidden" };
  }
  const sums = await sumIngredientsIssuedByIngredientAtLocationInPeriod(
    db,
    locationId,
    periodStart,
    periodEnd,
  );
  const ingredients = await findIngredientsByIds(db, sums.map((s) => s.ingredientId));
  const costById = new Map(ingredients.map((i) => [i.id, i.lastKnownCostMinor ?? 0]));
  const totalMinor = sums.reduce(
    (sum, s) => sum + s.quantity * (costById.get(s.ingredientId) ?? 0),
    0,
  );
  return { ok: true, totalMinor };
}

export type IngredientPurchasesByIngredientResult =
  | { ok: true; lines: { ingredientId: string; quantity: number; valueMinor: number }[] }
  | { ok: false; reason: "forbidden" };

// Ticket 42: per-ingredient purchased qty/value at a location in a period,
// for the Store ledger's row — distinct from getIngredientsBoughtMinor's
// single location-wide total.
export async function getIngredientsPurchasedByIngredient(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  locationId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<IngredientPurchasesByIngredientResult> {
  if (!canAccessLocation(requester.staff.role, requester.staff.locationId, locationId)) {
    return { ok: false, reason: "forbidden" };
  }
  const lines = await sumIngredientsPurchasedByIngredientAtLocationInPeriod(
    db,
    locationId,
    periodStart,
    periodEnd,
  );
  return { ok: true, lines };
}

export type IngredientMovementsByReasonResult =
  | { ok: true; lines: { ingredientId: string; reason: StockMovementReason; quantity: number }[] }
  | { ok: false; reason: "forbidden" };

// Ticket 42: batched counterpart to getIngredientsIssuedMinor — the Store
// ledger needs every reason (issued/transferred/wasted) for every
// ingredient in one period at once.
export async function getIngredientMovementsByReasonInPeriod(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  locationId: string,
  reasons: StockMovementReason[],
  periodStart: Date,
  periodEnd: Date,
): Promise<IngredientMovementsByReasonResult> {
  if (!canAccessLocation(requester.staff.role, requester.staff.locationId, locationId)) {
    return { ok: false, reason: "forbidden" };
  }
  const lines = await sumIngredientMovementsByReasonAtLocationInPeriod(
    db,
    locationId,
    reasons,
    periodStart,
    periodEnd,
  );
  return { ok: true, lines };
}

export type ProductMovementByReasonResult =
  | { ok: true; lines: { productId: string; quantity: number }[] }
  | { ok: false; reason: "forbidden" };

// formulas.md §5/§6 — product movements of one reason at a location in a
// period, e.g. `transferred`-in at the canteen (food sent from the
// restaurant) or `wasted` (canteen's counted-daily restaurant food).
export async function getProductMovementByReasonInPeriod(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  locationId: string,
  reason: StockMovementReason,
  periodStart: Date,
  periodEnd: Date,
): Promise<ProductMovementByReasonResult> {
  if (!canAccessLocation(requester.staff.role, requester.staff.locationId, locationId)) {
    return { ok: false, reason: "forbidden" };
  }
  const lines = await sumProductMovementsByReasonAtLocationInPeriod(
    db,
    locationId,
    reason,
    periodStart,
    periodEnd,
  );
  return { ok: true, lines };
}

export type ProductMovementsByReasonResult =
  | { ok: true; lines: { productId: string; reason: StockMovementReason; quantity: number }[] }
  | { ok: false; reason: "forbidden" };

// Ticket 39: batched counterpart to getProductMovementByReasonInPeriod —
// the Product ledger needs every reason for every product in one period at
// once, not one reason at a time.
export async function getProductMovementsByReasonInPeriod(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  locationId: string,
  reasons: StockMovementReason[],
  periodStart: Date,
  periodEnd: Date,
): Promise<ProductMovementsByReasonResult> {
  if (!canAccessLocation(requester.staff.role, requester.staff.locationId, locationId)) {
    return { ok: false, reason: "forbidden" };
  }
  const lines = await sumMovementsByProductReasonAtLocationInPeriod(
    db,
    locationId,
    reasons,
    periodStart,
    periodEnd,
  );
  return { ok: true, lines };
}

export type NonSalesConsumptionValueResult =
  | { ok: true; atCostMinor: number; atPriceMinor: number }
  | { ok: false; reason: "forbidden" };

// Ticket 38: proposal.md §10.5's "stock that was not sold" report —
// wasted/consumed/given-away product movements at a location in a period,
// valued both ways. Not deducted from profit again here; the ledger
// caption saying so is the UI's job, not this function's.
export async function getNonSalesConsumptionValue(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  locationId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<NonSalesConsumptionValueResult> {
  if (!canAccessLocation(requester.staff.role, requester.staff.locationId, locationId)) {
    return { ok: false, reason: "forbidden" };
  }
  const { atCostMinor, atPriceMinor } = await sumNonSalesValueAtLocationInPeriod(
    db,
    locationId,
    periodStart,
    periodEnd,
  );
  return { ok: true, atCostMinor, atPriceMinor };
}

export type NonSalesLedgerLine = {
  itemType: "product" | "ingredient";
  itemId: string;
  itemName: string;
  quantity: number;
  reason: NonSalesCategory;
  costBasisMinor: number | null;
  sellingValueMinor: number | null;
  isEstimated: boolean | null;
  staffMemberId: string;
  staffMemberName: string;
  occurredAt: Date;
};

export type NonSalesLedgerResult =
  | { ok: true; lines: NonSalesLedgerLine[] }
  | { ok: false; reason: "forbidden" };

// Ticket 43: the Non-sales ledger's line-level rows — one per
// wasted/consumed/given-away entry at a location in a period, each valued
// at its own snapshotted costBasisMinor/sellingValueMinor (ticket 15),
// never recomputed. Names are joined here (catalogue for item, people for
// recorded-by) since the ledger reads them together; the underlying query
// stays name-agnostic.
export async function getNonSalesLedger(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  locationId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<NonSalesLedgerResult> {
  if (!canAccessLocation(requester.staff.role, requester.staff.locationId, locationId)) {
    return { ok: false, reason: "forbidden" };
  }

  const movements = await findNonSalesMovementsAtLocationInPeriod(db, locationId, periodStart, periodEnd);

  const productIds = movements.filter((m) => m.itemType === "product").map((m) => m.itemId);
  const ingredientIds = movements.filter((m) => m.itemType === "ingredient").map((m) => m.itemId);
  const staffMemberIds = [...new Set(movements.map((m) => m.staffMemberId))];

  const [products, ingredients, staffMembers] = await Promise.all([
    findProductsByIds(db, productIds),
    findIngredientsByIds(db, ingredientIds),
    findStaffMembersByIds(db, staffMemberIds),
  ]);
  const productNames = new Map(products.map((p) => [p.id, p.name]));
  const ingredientNames = new Map(ingredients.map((i) => [i.id, i.name]));
  const staffNames = new Map(staffMembers.map((s) => [s.id, s.name]));

  const lines: NonSalesLedgerLine[] = movements.map((m) => ({
    itemType: m.itemType,
    itemId: m.itemId,
    itemName: (m.itemType === "product" ? productNames.get(m.itemId) : ingredientNames.get(m.itemId)) ?? "Unknown item",
    quantity: m.quantity,
    reason: m.reason as NonSalesCategory,
    costBasisMinor: m.costBasisMinor,
    sellingValueMinor: m.sellingValueMinor,
    isEstimated: m.isEstimated,
    staffMemberId: m.staffMemberId,
    staffMemberName: staffNames.get(m.staffMemberId) ?? "Unknown",
    occurredAt: m.occurredAt,
  }));

  return { ok: true, lines };
}
