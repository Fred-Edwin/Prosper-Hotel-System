import type {
  Prisma,
  PrismaClient,
  StockMovement as PrismaStockMovement,
  IngredientMovement as PrismaIngredientMovement,
} from "@/generated/prisma/client";

// recordStockMovement is called both with the ordinary db handle and, from
// sales/logic.ts's BUG-15 fix, from inside a db.$transaction callback —
// Prisma's transaction client is a distinct (near-identical) type.
type Db = PrismaClient | Prisma.TransactionClient;
import {
  canAccessLocation,
  findLocationById,
  findStaffMembersByIds,
  listLocations,
  recordAmendment,
  type AuthenticatedStaff,
} from "@/modules/people";
import {
  findIngredientsByIds,
  findProductsByIds,
  findProductsAtLocation,
  listIngredients,
  getCurrentRecipe,
  recordIngredientCost,
  recordProductCost,
  type Product,
} from "@/modules/catalogue";
// Module rule: stock depends on sales here, never the reverse (sales
// already depends on stock, for recordStockMovement — see sales/logic.ts).
// recordCountDerivedSale writes only the Sale/SaleLine bookkeeping for a
// canteen count's inferred sale; the StockMovement itself is written
// directly below via createStockMovement, same as every other reason this
// module writes.
import { recordCountDerivedSale, listSalesInPeriod } from "@/modules/sales";
import {
  createIngredientConsumptionMovement,
  createIngredientCorrectionMovement,
  createIngredientIssueMovement,
  createIngredientMovement,
  createProductionMovement,
  createStockCount,
  createStockMovement,
  findLatestStockCountAtLocation,
  findConfirmedTransfersSentFromLocation,
  findPendingTransfersAtLocation,
  findPreviousStockCountAtLocation,
  findReceiptById,
  findReceiptsAtLocation,
  findStockCountById,
  findTransferById,
  findTransfersInvolvingLocation,
  markStockCountLineCorrected,
  sumIngredientMovementsAtLocationAsOf,
  findIngredientMovementsAtLocationAsOf,
  findPreviousDeliveryCostByIngredientAtLocation,
  sumSoldCostBasisByProductAtLocationInPeriod,
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
  findAllNonSalesMovementsInPeriod,
  listStockCountsInPeriod,
  toTransfer,
  toStockMovement,
  toIngredientMovement,
  type NonSalesMovementLineWithLocation,
} from "./queries";
import type {
  IngredientMovement,
  LowStockItem,
  NonSalesCategory,
  PendingTransferForReader,
  Receipt,
  StockCount,
  StockCountItemType,
  StockCountForReader,
  StockLevel,
  StockMovement,
  StockMovementReason,
  Transfer,
  TransferStatus,
} from "./schema";

// CONTEXT.md's Non-sales Stock Consumption: where no per-unit cost is
// known, cost is estimated at 60% of selling price, per the owner's own
// discovery figure. See docs/formulas.md §4.
const ESTIMATED_COST_RATE = 0.6;

export type ProductCostBasis = { costBasisMinor: number; isEstimated: boolean } | null;

// formulas.md §4's cost-per-unit table, in priority order: a recipe's
// ingredients-used ÷ yield first (cooked food only), then the product's
// own recorded cost, the price paid on its last delivery (bought-in
// goods/packaging — recordProductCost's
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
    return {
      costBasisMinor: Math.round(product.priceMinor * ESTIMATED_COST_RATE * 100) / 100,
      isEstimated: true,
    };
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
  db: Db,
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

  // T8: a `sold` movement snapshots the cost basis in force at the moment
  // of sale, the same way production and non-sales movements already do.
  //
  // Without this there is no historical product cost anywhere in the
  // schema, so the ledger had to value *past* sales at the product's
  // *current* cost — meaning a price edit today silently moved last
  // month's cost of goods sold and profit. Plan §3.4 calls that fix
  // non-optional before price editing is exposed, and this is the half of
  // it the data model was missing.
  //
  // Snapshotting only on `sold` (rather than every reason) keeps the
  // change to the figure that was actually unrecoverable: transfers and
  // receipts do not consume stock, so no cost of goods is derived from
  // them.
  let costBasisMinor: number | undefined;
  let isEstimated: boolean | undefined;
  if (input.reason === "sold") {
    const [product] = await findProductsByIds(db, [input.productId]);
    if (product) {
      const recipe = product.kind === "cooked_food" ? await getCurrentRecipe(db, product.id) : null;
      const basis = resolveProductCostBasis(product, recipe);
      if (basis) {
        // Stored as the whole line's value, matching the convention
        // recordNonSalesConsumption uses, not a per-unit figure.
        costBasisMinor = basis.costBasisMinor * Math.abs(input.quantity);
        isEstimated = basis.isEstimated;
      }
    }
  }

  const movement = await createStockMovement(db, {
    productId: input.productId,
    locationId: input.locationId,
    quantity: input.quantity,
    reason: input.reason,
    staffMemberId: requester.staff.id,
    ...(costBasisMinor !== undefined ? { costBasisMinor, isEstimated } : {}),
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
  const productById = new Map(products.map((p) => [p.id, p]));

  const levels: StockLevel[] = sums
    .map((s) => ({
      productId: s.productId,
      productName: productById.get(s.productId)?.name ?? "Unknown product",
      quantityOnHand: s.quantityOnHand,
      isOwn: productById.get(s.productId)?.locationId === locationId,
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
// has a single recorded cost (lastKnownCostMinor), never an
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

/** A picker row: the item, plus how much of it is actually here. */
export type PickableItem = TransferableItem;

export type PickableItemsOptions = {
  /**
   * Transfer filters to quantityOnHand > 0 — you cannot send what you do not
   * hold. Every other picker must show the zero instead of dropping the row:
   * on Receiving, being out of something is precisely the reason to receive
   * it, and on Issue/Wastage a vanished row reads as a missing item rather
   * than an empty one.
   *
   * Including zeroes also widens the candidate set beyond the ledger: an item
   * catalogued but never received has no movement rows at all, so it has no
   * sum to join against and would otherwise never appear.
   */
  includeZeroStock: boolean;
  /**
   * The caller's write-time role rule, so a picker never offers an item the
   * user's subsequent write would refuse (issuing bars cashiers, receiving
   * admits attendants, transferring bars cashiers). Omitted means any role
   * that can reach the location may read it.
   */
  permit?: (role: string) => boolean;
};

/**
 * The shared picker reader behind Receiving, Issue to Kitchen, Wastage and
 * Transfer — the fix for blind picking, where those screens read the
 * catalogue (what exists) and so could not show how much was here.
 *
 * Products are scoped to the location the same way getSellableProductsAtLocation
 * scopes them (home location here, or positive stock here per the ledger);
 * ingredients are location-agnostic in the catalogue, so all active ones are
 * candidates and the ledger supplies each one's quantity at this location.
 */
export async function getPickableItemsAtLocation(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  locationId: string,
  options: PickableItemsOptions,
): Promise<{ ok: true; items: PickableItem[] } | { ok: false; reason: "forbidden" }> {
  const { includeZeroStock, permit } = options;
  if (
    (permit && !permit(requester.staff.role)) ||
    !canAccessLocation(requester.staff.role, requester.staff.locationId, locationId)
  ) {
    return { ok: false, reason: "forbidden" };
  }

  const [productSums, ingredientSums] = await Promise.all([
    sumMovementsByProductAtLocation(db, locationId),
    sumMovementsByIngredientAtLocation(db, locationId),
  ]);
  const productQuantity = new Map(productSums.map((sum) => [sum.productId, sum.quantityOnHand]));
  const ingredientQuantity = new Map(ingredientSums.map((sum) => [sum.ingredientId, sum.quantityOnHand]));

  const [products, ingredients] = await Promise.all([
    includeZeroStock
      ? // Union of both sources, as in getSellableProductsAtLocation: home
        // location here (even with no movements yet), or stock moved in.
        Promise.all([
          findProductsAtLocation(db, locationId),
          findProductsByIds(db, productSums.map((sum) => sum.productId)),
        ]).then(([home, moved]) => {
          const byId = new Map<string, Product>();
          for (const product of [...home, ...moved]) byId.set(product.id, product);
          return [...byId.values()];
        })
      : findProductsByIds(db, productSums.filter((sum) => sum.quantityOnHand > 0).map((sum) => sum.productId)),
    includeZeroStock
      ? listIngredients(db)
      : findIngredientsByIds(db, ingredientSums.filter((sum) => sum.quantityOnHand > 0).map((sum) => sum.ingredientId)),
  ]);

  return {
    ok: true,
    items: [
      ...products.filter((product) => product.active).map((product) => ({ itemType: "product" as const, itemId: product.id, name: product.name, quantityOnHand: productQuantity.get(product.id) ?? 0, unit: "units" })),
      ...ingredients.filter((ingredient) => ingredient.active).map((ingredient) => ({ itemType: "ingredient" as const, itemId: ingredient.id, name: ingredient.name, quantityOnHand: ingredientQuantity.get(ingredient.id) ?? 0, unit: ingredient.unitOfMeasure })),
    ].sort((a, b) => a.name.localeCompare(b.name)),
  };
}

export async function getTransferableItems(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  locationId: string,
): Promise<{ ok: true; items: TransferableItem[] } | { ok: false; reason: "forbidden" }> {
  return getPickableItemsAtLocation(db, requester, locationId, {
    includeZeroStock: false,
    permit: (role) => role !== "cashier",
  });
}

export type SellableProduct = Product & { onHand: number };

export type SellableProductsResult =
  | { ok: true; products: SellableProduct[] }
  | { ok: false; reason: "forbidden" | "not_found" };

// docs/architecture.md's "Product home location" note: sellable-at-a-location
// is the union of both sources, not either alone — product.locationId ===
// here OR positive current stock here per the movement ledger (transferred
// in and reflected). Mirrors getTransferableItems' shape above, but keyed
// off Product.locationId instead of a location-agnostic active-item list.
//
// BUG-15's soft guardrail: each product carries onHand so New Sale can show
// it per tile and cap the basket stepper, without a second round-trip.
export async function getSellableProductsAtLocation(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  locationId: string,
): Promise<SellableProductsResult> {
  if (!canAccessLocation(requester.staff.role, requester.staff.locationId, locationId)) {
    return { ok: false, reason: "forbidden" };
  }

  const location = await findLocationById(db, locationId);
  if (!location) return { ok: false, reason: "not_found" };

  const sums = await sumMovementsByProductAtLocation(db, locationId);
  const onHandByProductId = new Map(sums.map((sum) => [sum.productId, sum.quantityOnHand]));
  const productIdsWithStock = sums.filter((sum) => sum.quantityOnHand > 0).map((sum) => sum.productId);

  const [homeProducts, stockedProducts] = await Promise.all([
    findProductsAtLocation(db, locationId),
    findProductsByIds(db, productIdsWithStock),
  ]);

  const byId = new Map<string, Product>();
  for (const product of [...homeProducts, ...stockedProducts]) {
    if (product.active) byId.set(product.id, product);
  }

  return {
    ok: true,
    products: [...byId.values()]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((product) => ({ ...product, onHand: onHandByProductId.get(product.id) ?? 0 })),
  };
}

export type RecordTransferResult =
  | { ok: true; transfers: [Transfer] }
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
  | { ok: true; transfers: Transfer[] }
  | Exclude<RecordTransferResult, { ok: true }>;

// Added 2026-08-13 — REQ-02 Part A / docs/scope.md's canteen redesign.
// A transfer is now two steps: the sender's stock leaves immediately
// (the outgoing movement, written here), but the receiver's stock does
// not increase until they separately confirm — see confirmTransfer
// below. While pending, the sent quantity has already left the sender
// and has not yet reached the receiver; neither location's stock count
// includes it (getCurrentStockAtLocation only ever sums written
// movements, and no incoming movement exists yet).
//
// Applies in both directions, restaurant→canteen and canteen→restaurant
// — one consistent mechanic, not special-cased to either location, per
// REQ-02's explicit framing in docs/feature-requests.md.
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
  return { ok: true, transfers: [result.transfers[0]] };
}

export async function recordTransfers(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  input: {
    fromLocationId: string;
    toLocationId: string;
    lines: { itemType: "product" | "ingredient"; itemId: string; quantity: number }[];
  },
): Promise<RecordTransfersResult> {
  if (
    requester.staff.role === "cashier" ||
    !canAccessLocation(requester.staff.role, requester.staff.locationId, input.fromLocationId)
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
    const transfers: Transfer[] = [];

    for (const line of input.lines) {
      if (line.itemType === "product") {
        const product = await tx.product.findUnique({ where: { id: line.itemId } });
        if (!product) return { ok: false, reason: "not_found" } as const;
        if (!product.active) return { ok: false, reason: "inactive_item" } as const;

        // `reversed: false` — see docs/reversed-filter-audit.md's
        // availability-gate note.
        const stock = await tx.stockMovement.aggregate({
          where: { productId: product.id, locationId: input.fromLocationId, reversed: false },
          _sum: { quantity: true },
        });
        if ((stock._sum.quantity?.toNumber() ?? 0) < line.quantity) {
          return { ok: false, reason: "insufficient_stock" } as const;
        }

        const transfer = await tx.transfer.create({
          data: {
            fromLocationId: input.fromLocationId,
            toLocationId: input.toLocationId,
            itemType: "product",
            itemId: product.id,
            sentQuantity: line.quantity,
            sentByStaffMemberId: requester.staff.id,
          },
        });
        await tx.stockMovement.create({
          data: {
            productId: product.id,
            locationId: input.fromLocationId,
            quantity: -line.quantity,
            reason: "transferred",
            staffMemberId: requester.staff.id,
            transferId: transfer.id,
          },
        });
        transfers.push(toTransfer(transfer));
        continue;
      }

      const ingredient = await tx.ingredient.findUnique({ where: { id: line.itemId } });
      if (!ingredient) return { ok: false, reason: "not_found" } as const;
      if (!ingredient.active) return { ok: false, reason: "inactive_item" } as const;

      // `reversed: false` — see docs/reversed-filter-audit.md's
      // availability-gate note.
      const stock = await tx.ingredientMovement.aggregate({
        where: { ingredientId: ingredient.id, locationId: input.fromLocationId, reversed: false },
        _sum: { quantity: true },
      });
      if ((stock._sum.quantity?.toNumber() ?? 0) < line.quantity) {
        return { ok: false, reason: "insufficient_stock" } as const;
      }

      const transfer = await tx.transfer.create({
        data: {
          fromLocationId: input.fromLocationId,
          toLocationId: input.toLocationId,
          itemType: "ingredient",
          itemId: ingredient.id,
          sentQuantity: line.quantity,
          sentByStaffMemberId: requester.staff.id,
        },
      });
      await tx.ingredientMovement.create({
        data: {
          ingredientId: ingredient.id,
          locationId: input.fromLocationId,
          quantity: -line.quantity,
          reason: "transferred",
          staffMemberId: requester.staff.id,
          transferId: transfer.id,
        },
      });
      transfers.push(toTransfer(transfer));
    }

    return { ok: true, transfers } as const;
  });
}

export type PendingTransfersResult =
  | { ok: true; transfers: PendingTransferForReader[] }
  | { ok: false; reason: "forbidden" };

// Added 2026-08-13 — REQ-02 Part A's unmissable notification: what a
// location's staff should see the moment they land on a task screen,
// surfaced from the home screen per docs/scope.md's definition of done
// ("visible on the attendant's home screen without her navigating to
// find it"). Applies at both locations, not canteen-only.
export async function getPendingTransfersAtLocation(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  locationId: string,
): Promise<PendingTransfersResult> {
  if (!canAccessLocation(requester.staff.role, requester.staff.locationId, locationId)) {
    return { ok: false, reason: "forbidden" };
  }
  const transfers = await findPendingTransfersAtLocation(db, locationId);
  return { ok: true, transfers };
}

// 2026-08-13 canteen redesign, item 4: reconciliation visibility for the
// sender — confirmed transfers she sent, with sent-vs-confirmed quantity,
// so she can see whether the receiving end's count matched without
// re-deriving it herself. Own location only, like getPendingTransfersAtLocation.
export async function getConfirmedTransfersSentFromLocation(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  locationId: string,
): Promise<PendingTransfersResult> {
  if (!canAccessLocation(requester.staff.role, requester.staff.locationId, locationId)) {
    return { ok: false, reason: "forbidden" };
  }
  const transfers = await findConfirmedTransfersSentFromLocation(db, locationId);
  return { ok: true, transfers };
}

export type ConfirmTransferResult =
  | { ok: true; transfer: Transfer }
  | {
      ok: false;
      reason: "forbidden" | "not_found" | "already_confirmed" | "invalid_quantity";
    };

// Added 2026-08-13. The receiving half of recordTransfers: only the
// receiver, at the receiving location, may confirm — never the sender,
// and never from the other location, since confirmation is a claim about
// what physically arrived. A confirmed quantity less than what was sent
// writes a transfer_shortfall movement for the gap (docs/proposal.md §4's
// "auto-recorded as its own discrepancy movement"), distinct from
// wastage or a stock-count correction. That movement carries quantity 0
// — the loss is already fully reflected by the incoming movement being
// only +confirmedQuantity (the sender's own -sentQuantity already
// happened at send time), so a second deduction here would double-count
// the same missing unit. The shortfall row exists purely as an
// attributable, reportable marker ("N lost in transit on this
// transfer") for the ledger/activity feed, not as a further stock
// change. A confirmed quantity greater than what was sent is rejected
// outright — there is nothing to attribute an excess to; that scenario
// is a miscount to fix at the next physical count, not something this
// action can absorb.
export async function confirmTransfer(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  input: { transferId: string; confirmedQuantity: number },
): Promise<ConfirmTransferResult> {
  const transfer = await findTransferById(db, input.transferId);
  if (!transfer) return { ok: false, reason: "not_found" };
  if (!canAccessLocation(requester.staff.role, requester.staff.locationId, transfer.toLocationId)) {
    return { ok: false, reason: "forbidden" };
  }
  if (transfer.status !== "pending") return { ok: false, reason: "already_confirmed" };
  if (input.confirmedQuantity < 0 || input.confirmedQuantity > transfer.sentQuantity) {
    return { ok: false, reason: "invalid_quantity" };
  }

  const shortfall = transfer.sentQuantity - input.confirmedQuantity;

  return db.$transaction(async (tx) => {
    const updated = await tx.transfer.update({
      where: { id: transfer.id },
      data: {
        status: "confirmed",
        confirmedQuantity: input.confirmedQuantity,
        confirmedByStaffMemberId: requester.staff.id,
        confirmedAt: new Date(),
      },
    });

    if (transfer.itemType === "product") {
      if (input.confirmedQuantity > 0) {
        await tx.stockMovement.create({
          data: {
            productId: transfer.itemId,
            locationId: transfer.toLocationId,
            quantity: input.confirmedQuantity,
            reason: "transferred",
            staffMemberId: requester.staff.id,
            transferId: transfer.id,
          },
        });
      }
      if (shortfall > 0) {
        // Quantity 0 — see this function's comment. shortfallQuantity is
        // stored on the Transfer row itself (sentQuantity − confirmedQuantity)
        // and is what "N lost in transit" actually reads.
        await tx.stockMovement.create({
          data: {
            productId: transfer.itemId,
            locationId: transfer.toLocationId,
            quantity: 0,
            reason: "transfer_shortfall",
            staffMemberId: requester.staff.id,
            transferId: transfer.id,
          },
        });
      }
    } else {
      if (input.confirmedQuantity > 0) {
        await tx.ingredientMovement.create({
          data: {
            ingredientId: transfer.itemId,
            locationId: transfer.toLocationId,
            quantity: input.confirmedQuantity,
            reason: "transferred",
            staffMemberId: requester.staff.id,
            transferId: transfer.id,
          },
        });
      }
      if (shortfall > 0) {
        // Quantity 0 — see this function's comment above.
        await tx.ingredientMovement.create({
          data: {
            ingredientId: transfer.itemId,
            locationId: transfer.toLocationId,
            quantity: 0,
            reason: "transfer_shortfall",
            staffMemberId: requester.staff.id,
            transferId: transfer.id,
          },
        });
      }
    }

    return { ok: true, transfer: toTransfer(updated) } as const;
  });
}

export type CancelPendingTransferResult =
  | { ok: true; transfer: Transfer }
  | { ok: false; reason: "forbidden" | "not_found" | "already_confirmed" };

// Added 2026-08-13. The sender's own undo of a still-pending send —
// architecture.md's "void your own entry, same day, no permission
// needed." Restores the outgoing movement via its own reversing entry
// (architecture.md's reversal-not-deletion rule — the original stays
// readable) and marks the Transfer cancelled. Distinct from
// reverseTransfer below, which undoes an already-confirmed transfer and
// needs a real opposite transfer, since stock already moved on both
// sides by then.
export async function cancelPendingTransfer(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  transferId: string,
): Promise<CancelPendingTransferResult> {
  const transfer = await findTransferById(db, transferId);
  if (!transfer) return { ok: false, reason: "not_found" };
  if (
    transfer.sentByStaffMemberId !== requester.staff.id &&
    requester.staff.role !== "owner"
  ) {
    return { ok: false, reason: "forbidden" };
  }
  if (transfer.status !== "pending") return { ok: false, reason: "already_confirmed" };

  return db.$transaction(async (tx) => {
    const updated = await tx.transfer.update({
      where: { id: transfer.id },
      data: { status: "cancelled", cancelledByStaffMemberId: requester.staff.id, cancelledAt: new Date() },
    });

    if (transfer.itemType === "product") {
      await tx.stockMovement.create({
        data: {
          productId: transfer.itemId,
          locationId: transfer.fromLocationId,
          quantity: transfer.sentQuantity,
          reason: "transferred",
          staffMemberId: requester.staff.id,
          transferId: transfer.id,
          reversedTransferId: transfer.id,
        },
      });
    } else {
      await tx.ingredientMovement.create({
        data: {
          ingredientId: transfer.itemId,
          locationId: transfer.fromLocationId,
          quantity: transfer.sentQuantity,
          reason: "transferred",
          staffMemberId: requester.staff.id,
          transferId: transfer.id,
          reversedTransferId: transfer.id,
        },
      });
    }

    return { ok: true, transfer: toTransfer(updated) } as const;
  });
}

// Undoes an already-confirmed transfer by recording a new transfer in the
// opposite direction — stock genuinely moved on both sides by the time a
// transfer is confirmed, so undoing it is itself a real (immediate,
// atomic) transfer back, not a reversing entry on the original. This is
// the sender or owner correcting a completed transfer, same-role rule as
// cancelPendingTransfer, but the mechanics differ because there is real
// stock at the destination to move back rather than a pending send to
// simply not happen.
export async function reverseTransfer(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  transferId: string,
): Promise<{ ok: true; movements: TransferMovement[] } | Exclude<RecordTransfersResult, { ok: true }>> {
  const transfer = await findTransferById(db, transferId);
  if (!transfer) return { ok: false, reason: "not_found" };
  if (transfer.status !== "confirmed") return { ok: false, reason: "not_found" };

  const existingReversal =
    transfer.itemType === "product"
      ? await db.stockMovement.findFirst({ where: { reversedTransferId: transferId } })
      : await db.ingredientMovement.findFirst({ where: { reversedTransferId: transferId } });
  if (existingReversal) return { ok: false, reason: "already_reversed" };

  if (transfer.sentByStaffMemberId !== requester.staff.id && requester.staff.role !== "owner") {
    return { ok: false, reason: "forbidden" };
  }

  const quantity = transfer.confirmedQuantity ?? transfer.sentQuantity;
  if (quantity <= 0) return { ok: false, reason: "not_found" };

  return db.$transaction(async (tx) => {
    const outgoing =
      transfer.itemType === "product"
        ? await tx.stockMovement.create({
            data: {
              productId: transfer.itemId,
              locationId: transfer.toLocationId,
              quantity: -quantity,
              reason: "transferred",
              staffMemberId: requester.staff.id,
              transferId: transfer.id,
              reversedTransferId: transfer.id,
            },
          })
        : await tx.ingredientMovement.create({
            data: {
              ingredientId: transfer.itemId,
              locationId: transfer.toLocationId,
              quantity: -quantity,
              reason: "transferred",
              staffMemberId: requester.staff.id,
              transferId: transfer.id,
              reversedTransferId: transfer.id,
            },
          });
    const incoming =
      transfer.itemType === "product"
        ? await tx.stockMovement.create({
            data: {
              productId: transfer.itemId,
              locationId: transfer.fromLocationId,
              quantity,
              reason: "transferred",
              staffMemberId: requester.staff.id,
              transferId: transfer.id,
              reversedTransferId: transfer.id,
            },
          })
        : await tx.ingredientMovement.create({
            data: {
              ingredientId: transfer.itemId,
              locationId: transfer.fromLocationId,
              quantity,
              reason: "transferred",
              staffMemberId: requester.staff.id,
              transferId: transfer.id,
              reversedTransferId: transfer.id,
            },
          });
    const movements: TransferMovement[] =
      transfer.itemType === "product"
        ? [toStockMovement(outgoing as PrismaStockMovement), toStockMovement(incoming as PrismaStockMovement)]
        : [
            toIngredientMovement(outgoing as PrismaIngredientMovement),
            toIngredientMovement(incoming as PrismaIngredientMovement),
          ];
    return { ok: true, movements } as const;
  });
}

export type ReverseMovementResult =
  | { ok: true }
  | { ok: false; reason: "forbidden" | "not_found" | "already_reversed" };

/**
 * Editable-ledger T1 — undo a single wrong movement.
 *
 * Movements were the only money-touching model in the schema with no way
 * to undo one: a delivery recorded at the wrong quantity, or against the
 * wrong item, could not be taken back. Every other model has an equivalent
 * (Sale.voided, Expense.reversed, Repayment.reversed,
 * Transfer.cancelledAt).
 *
 * Two rows, never one. The original keeps its quantity and is *marked*
 * reversed; an offsetting `corrected` row carries the opposite quantity.
 * Reversal does not rewrite history, it offsets it — which is why the
 * offsetting row is stamped with the **original's** `occurredAt` rather
 * than now(). A reversal of a 16 Aug delivery belongs to 16 Aug's figures;
 * stamping it today would leave 16 Aug still showing the wrong delivery
 * and dump the correction into an unrelated day, which is precisely the
 * bug that made the old `effectiveAt` mechanism useless (plan D5).
 *
 * **Both rows carry `reversed: true`, and that is deliberate.** Marking
 * only the original would leave the offsetting −10 visible to every sum
 * while the +10 it cancels was filtered out — subtracting the reversal a
 * second time and driving stock negative. The pair is excluded together,
 * so it nets to nothing by *absence* rather than to zero by arithmetic.
 * The audit tests assert this directly: after reversing a lone +10
 * delivery, stock is 0 because neither row is counted, not because they
 * happen to cancel.
 *
 * The rows stay visible to reads that ask "was this reversed" and are
 * invisible to every read that asks "how much is there" — see
 * docs/reversed-filter-audit.md.
 *
 * Owner-only at the logic layer, per the existing convention
 * (`correctStockCount`) — routes are not the security boundary.
 */
export async function reverseMovement(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  input: { movementType: "product" | "ingredient"; movementId: string },
): Promise<ReverseMovementResult> {
  if (requester.staff.role !== "owner") return { ok: false, reason: "forbidden" };

  const existing =
    input.movementType === "product"
      ? await db.stockMovement.findUnique({ where: { id: input.movementId } })
      : await db.ingredientMovement.findUnique({ where: { id: input.movementId } });
  if (!existing) return { ok: false, reason: "not_found" };
  if (existing.reversed) return { ok: false, reason: "already_reversed" };

  if (!canAccessLocation(requester.staff.role, requester.staff.locationId, existing.locationId)) {
    return { ok: false, reason: "forbidden" };
  }

  const offsettingQuantity = existing.quantity.negated();
  const reversedAt = new Date();

  // C2: the mark and its offsetting row commit together or not at all. A
  // half-applied reversal would double-count or vanish stock.
  await db.$transaction(async (tx) => {
    if (input.movementType === "product") {
      const row = existing as PrismaStockMovement;
      await tx.stockMovement.update({
        where: { id: row.id },
        data: { reversed: true, reversedAt, reversedBy: requester.staff.id },
      });
      await tx.stockMovement.create({
        data: {
          productId: row.productId,
          locationId: row.locationId,
          quantity: offsettingQuantity,
          reason: "corrected",
          staffMemberId: requester.staff.id,
          occurredAt: row.occurredAt,
          isAmendment: true,
          // Excluded from sums alongside the row it cancels — see the
          // note above on why marking only the original is wrong.
          reversed: true,
          reversedAt,
          reversedBy: requester.staff.id,
        },
      });
      return;
    }
    const row = existing as PrismaIngredientMovement;
    await tx.ingredientMovement.update({
      where: { id: row.id },
      data: { reversed: true, reversedAt, reversedBy: requester.staff.id },
    });
    await tx.ingredientMovement.create({
      data: {
        ingredientId: row.ingredientId,
        locationId: row.locationId,
        quantity: offsettingQuantity,
        reason: "corrected",
        staffMemberId: requester.staff.id,
        occurredAt: row.occurredAt,
        isAmendment: true,
        // See the product branch above.
        reversed: true,
        reversedAt,
        reversedBy: requester.staff.id,
      },
    });
  });

  return { ok: true };
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
  status: TransferStatus;
  counterpartLocationName: string;
  occurredAt: Date;
  confirmedQuantity: number | null;
  reversed: boolean;
  isReversal: boolean;
  lines: TransferHistoryLine[];
};

// 2026-08-13 — rewritten to read the Transfer model directly rather than
// reconstructing from movement pairs. A pending transfer only ever writes
// the sender's outgoing movement (see recordTransfers), so the movement
// reconstruction this replaced could not represent "pending" — a still-
// pending send showed as one-sided or missing. Transfer.status/
// confirmedQuantity are the source of truth for all three states now.
// See gotchas.md's 2026-08-13 entry.
export async function listTransfersAtLocation(
  db: PrismaClient,
  requester: AuthenticatedStaff,
): Promise<{ ok: true; transfers: TransferHistoryEntry[] } | { ok: false; reason: "forbidden" }> {
  if (requester.staff.role === "cashier") return { ok: false, reason: "forbidden" };
  const locationId = requester.staff.locationId;
  const [rows, locations] = await Promise.all([
    findTransfersInvolvingLocation(db, locationId),
    listLocations(db),
  ]);
  const transferIds = rows.map((row) => row.id);

  const locationNameById = new Map(locations.map((location) => [location.id, location.name]));
  // reverseTransfer (undoing an already-confirmed transfer) writes plain
  // movements against the original transfer's id rather than a new
  // Transfer row — Transfer.reversedTransferId itself is never set by any
  // code path, so "reversed" has to be read off movements, not the
  // Transfer model, even after this rewrite.
  const [reversingProductMovements, reversingIngredientMovements] = await Promise.all([
    transferIds.length > 0
      ? db.stockMovement.findMany({ where: { reversedTransferId: { in: transferIds } } })
      : Promise.resolve([]),
    transferIds.length > 0
      ? db.ingredientMovement.findMany({ where: { reversedTransferId: { in: transferIds } } })
      : Promise.resolve([]),
  ]);
  const reversedTransferIds = new Set(
    [...reversingProductMovements, ...reversingIngredientMovements]
      .map((movement) => movement.reversedTransferId)
      .filter((id): id is string => id !== null),
  );

  const productIds = rows.filter((row) => row.itemType === "product").map((row) => row.itemId);
  const ingredientIds = rows.filter((row) => row.itemType === "ingredient").map((row) => row.itemId);
  const [products, ingredients] = await Promise.all([
    findProductsByIds(db, productIds),
    findIngredientsByIds(db, ingredientIds),
  ]);
  const productNameById = new Map(products.map((product) => [product.id, product.name]));
  const ingredientById = new Map(ingredients.map((ingredient) => [ingredient.id, ingredient]));

  const transfers: TransferHistoryEntry[] = rows.map((row) => {
    const direction: "sent" | "received" = row.fromLocationId === locationId ? "sent" : "received";
    const counterpartLocationId = direction === "sent" ? row.toLocationId : row.fromLocationId;
    const name = row.itemType === "product" ? (productNameById.get(row.itemId) ?? "Unknown product") : (ingredientById.get(row.itemId)?.name ?? "Unknown ingredient");
    const unit = row.itemType === "product" ? "units" : (ingredientById.get(row.itemId)?.unitOfMeasure ?? "");
    return {
      transferId: row.id,
      direction,
      status: row.status,
      counterpartLocationName: locationNameById.get(counterpartLocationId) ?? "Unknown location",
      occurredAt: row.sentAt,
      confirmedQuantity: row.confirmedQuantity,
      // No code path creates a new Transfer row to represent a reversal
      // (reverseTransfer posts movements against the original transfer's
      // id instead) — isReversal is always false until that changes.
      reversed: reversedTransferIds.has(row.id),
      isReversal: false,
      lines: [{ itemType: row.itemType, itemId: row.itemId, name, quantity: row.sentQuantity, unit }],
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
      await recordProductCost(db, requester, line.itemId, {
        unitCostMinor: line.unitCostMinor,
      });
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
    await recordIngredientCost(db, requester, line.itemId, {
      unitCostMinor: line.unitCostMinor,
    });
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
  | { ok: true; movements: StockMovement[] }
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
//
// Lines validated upfront and committed together, same shape as
// recordIngredientIssue — one invalid line fails the whole batch rather
// than leaving some products produced and others not (BUG-05).
export async function recordProduction(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  input: {
    locationId: string;
    lines: { productId: string; quantity: number }[];
  },
): Promise<RecordProductionResult> {
  if (
    !canProduce(requester.staff.role) ||
    !canAccessLocation(requester.staff.role, requester.staff.locationId, input.locationId)
  ) {
    return { ok: false, reason: "forbidden" };
  }

  if (input.lines.some((line) => line.quantity <= 0)) {
    return { ok: false, reason: "invalid_quantity" };
  }

  const products = await findProductsByIds(
    db,
    input.lines.map((line) => line.productId),
  );
  const productById = new Map(products.map((p) => [p.id, p]));
  if (input.lines.some((line) => !productById.has(line.productId))) {
    return { ok: false, reason: "not_found" };
  }
  if (input.lines.some((line) => !productById.get(line.productId)!.active)) {
    return { ok: false, reason: "inactive_product" };
  }

  const recipes = await Promise.all(
    input.lines.map((line) => getCurrentRecipe(db, line.productId)),
  );
  if (recipes.some((recipe) => !recipe || recipe.perUnitCostMinor == null)) {
    return { ok: false, reason: "no_recipe" };
  }

  const movements: StockMovement[] = [];
  for (let i = 0; i < input.lines.length; i++) {
    const line = input.lines[i];
    const product = productById.get(line.productId)!;
    const recipe = recipes[i]!;

    for (const recipeLine of recipe.lines) {
      await createIngredientIssueMovement(db, {
        ingredientId: recipeLine.ingredientId,
        locationId: input.locationId,
        quantity: -(recipeLine.quantity * line.quantity),
        staffMemberId: requester.staff.id,
      });
    }

    const movement = await createProductionMovement(db, {
      productId: product.id,
      locationId: input.locationId,
      quantity: line.quantity,
      staffMemberId: requester.staff.id,
      costBasisMinor: recipe.perUnitCostMinor! * line.quantity,
      sellingValueMinor: product.priceMinor != null ? product.priceMinor * line.quantity : null,
    });
    movements.push(movement);
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

// Same blind-count shape as StockCountForReader, minus the itemName field
// that only the named (post-withItemNames) read path adds — recordStockCount
// returns createStockCount's raw result, which never had item names.
export type RecordedStockCountForNonOwner = Omit<StockCount, "lines"> & {
  lines: (Omit<StockCount["lines"][number], "expectedQuantity"> & { expectedQuantity?: number })[];
};

export type RecordStockCountResult =
  | { ok: true; count: StockCount | RecordedStockCountForNonOwner }
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

  // Revised 2026-08-15: the canteen no longer records individual cash/M-Pesa
  // sales (docs/scope.md's "Canteen: count-derived sales" entry) — a count
  // is how the system learns what sold, same mechanism as before BUG-10,
  // this time with no per-item entry to double-count against, since the
  // canteen dropped credit sales and individual entry for exactly this
  // reason. Restaurant counts stay a pure shrinkage check (formulas.md §2)
  // — sales there are still individually recorded and untouched here.
  const location = await findLocationById(db, input.locationId);
  if (location?.code === "canteen") {
    const shortfalls = input.lines
      .filter((line) => line.itemType === "product")
      .map((line) => ({
        productId: line.itemId,
        soldQuantity: (expectedByProduct.get(line.itemId) ?? 0) - line.countedQuantity,
      }))
      .filter((line) => line.soldQuantity > 0);

    if (shortfalls.length > 0) {
      const soldProducts = await findProductsByIds(db, shortfalls.map((s) => s.productId));
      const soldProductById = new Map(soldProducts.map((p) => [p.id, p]));

      // The StockMovement is the actual stock decrement (what the rest of
      // the system reads for on-hand quantity and cost of goods sold —
      // formulas.md §6 works unchanged because it queries "sold" movements
      // regardless of what wrote them). The Sale, written after, exists
      // only so revenue reporting (getSalesRevenueAtLocation reads the
      // Sale table, not StockMovement — see sales/queries.ts) and "today's
      // summary" see this the same as any other canteen sale. Two writes,
      // not `db.$transaction`-wrapped together: acceptable here because,
      // unlike a counter sale, there is no oversell risk to guard against
      // (the count already fixed what's on hand) and a failure between the
      // two leaves the StockMovement — the figure everything else reads —
      // still correct; only the Sale-derived revenue figure would lag,
      // recoverable by re-running the count's numbers rather than corrupt.
      for (const { productId, soldQuantity } of shortfalls) {
        const product = soldProductById.get(productId);
        await createStockMovement(db, {
          productId,
          locationId: input.locationId,
          quantity: -soldQuantity,
          reason: "sold",
          staffMemberId: requester.staff.id,
          occurredAt: count.occurredAt,
          sellingValueMinor:
            product?.priceMinor != null ? product.priceMinor * soldQuantity : null,
        });
      }

      await recordCountDerivedSale(db, {
        locationId: input.locationId,
        staffMemberId: requester.staff.id,
        occurredAt: count.occurredAt,
        lines: shortfalls.map(({ productId, soldQuantity }) => ({
          productId,
          quantity: soldQuantity,
          priceMinor: soldProductById.get(productId)?.priceMinor ?? 0,
        })),
      });
    }
  }

  // Same blind-count filter as getStockCount: the restaurant's count stays
  // an independent shrinkage check, so a non-owner submitter there doesn't
  // get expectedQuantity back in the confirmation either. The canteen
  // attendant does, since she's shown what the count implied before she
  // leaves the screen — see record-stock-count.tsx's review step.
  if (requester.staff.role === "owner" || location?.code === "canteen") {
    return { ok: true, count };
  }
  return {
    ok: true,
    count: {
      ...count,
      lines: count.lines.map((line) => {
        const { expectedQuantity: _expectedQuantity, ...rest } = line;
        return rest;
      }),
    },
  };
}

async function withItemNames(
  db: PrismaClient,
  count: StockCount,
  isCanteen: boolean,
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
  const priceById = new Map(products.map((p) => [p.id, p.priceMinor] as const));

  // A count-derived Sale carries no FK back to the StockCount that produced
  // it (StockCount predates Sale needing one) — recordCountDerivedSale
  // stamps it with the count's own locationId + occurredAt instead (§2's
  // "booked on the count's own date"), so that pair is how a short line's
  // implied sale is found again here. voidedByProductId is undefined (not
  // false) for a product with no matching sale line at all, so a line with
  // no shortfall — and therefore no sale to check — renders no badge below.
  let voidedByProductId = new Map<string, boolean>();
  if (isCanteen && productIds.length > 0) {
    const sales = await listSalesInPeriod(
      db,
      new Date(count.occurredAt.getTime() - 1),
      count.occurredAt,
    );
    const sameSale = sales.filter(
      (s) => s.locationId === count.locationId && s.occurredAt.getTime() === count.occurredAt.getTime(),
    );
    voidedByProductId = new Map(
      sameSale.flatMap((s) => s.lines.map((l) => [l.productId, s.voided] as const)),
    );
  }

  return {
    ...count,
    lines: count.lines.map((line) => ({
      ...line,
      itemName: nameById.get(line.itemId) ?? "Unknown item",
      ...(line.itemType === "product" ? { priceMinor: priceById.get(line.itemId) ?? null } : {}),
      ...(voidedByProductId.has(line.itemId)
        ? { saleVoided: voidedByProductId.get(line.itemId) }
        : {}),
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

  // Revised 2026-08-15: the blind-count protection (hiding expectedQuantity
  // from whoever isn't the owner, so her count stays an independent check
  // rather than typing back what the system already believes) stays for the
  // restaurant, where a count is still a pure shrinkage check against her
  // own individually-recorded sales. At the canteen a count IS how the
  // sold figure gets produced — the attendant is the one who needs to see
  // what it implied, not just the owner reviewing it later — so she gets
  // the same expected/counted/derived-sold detail the owner does.
  const location = await findLocationById(db, count.locationId);
  const isCanteen = location?.code === "canteen";
  const named = await withItemNames(db, count, isCanteen);

  if (requester.staff.role === "owner" || isCanteen) {
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

export type LatestStockCountDateResult =
  | { ok: true; occurredAt: Date | null }
  | { ok: false; reason: "forbidden" };

// docs/formulas.md §10's "no count yet today" gap — the canteen handover
// screen needs to know whether today has a covering count, without the
// owner-only expected/counted comparison getLatestStockCount carries. Just
// the date, so any staff member who can access the location may call it
// (unlike getLatestStockCount, which is owner-only) — this isn't the
// blind-count comparison, only "has a count happened," the same kind of
// fact stock-list.tsx already shows staff elsewhere.
export async function getLatestStockCountDate(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  locationId: string,
): Promise<LatestStockCountDateResult> {
  if (!canAccessLocation(requester.staff.role, requester.staff.locationId, locationId)) {
    return { ok: false, reason: "forbidden" };
  }

  const count = await findLatestStockCountAtLocation(db, locationId);
  return { ok: true, occurredAt: count?.occurredAt ?? null };
}

// Ticket 24: "since last count" is only ever meaningful at the canteen
// (the restaurant records every sale directly, per CONTEXT.md) and only
// once a previous count exists to derive against — formulas.md's "the
export type LatestStockCountResult =
  | { ok: true; count: StockCountForReader | null }
  | { ok: false; reason: "forbidden" };

// The owner's review/correct table under the admin Stock destination —
// shows the current/most recent count at a location, not a full history
// (out of scope per the ticket). Owner-only: this is the comparison view,
// same restriction as getStockCount's expected/difference fields.
//
// 2026-08-13: no longer returns a derivedSales detail — the count is a
// pure shrinkage check now (docs/formulas.md §2/§6), not a source of
// item-level revenue, so there is nothing derived from it to report.
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
  if (!count) return { ok: true, count: null };

  const location = await findLocationById(db, locationId);
  return { ok: true, count: await withItemNames(db, count, location?.code === "canteen") };
}

// Same shape as getLatestStockCount, parameterised by "before this count"
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
  if (!count) return { ok: true, count: null };

  const location = await findLocationById(db, locationId);
  return { ok: true, count: await withItemNames(db, count, location?.code === "canteen") };
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

  // At the canteen, recordStockCount already wrote a `sold` movement for a
  // product-line shortfall (expectedQuantity − countedQuantity) — so
  // current stock already reflects countedQuantity, not expectedQuantity,
  // for that specific line. Basing the correction's delta on
  // expectedQuantity there would net out that sale a second time. A
  // surplus line, by contrast, triggered no sale write at all — stock is
  // still exactly expectedQuantity, same as any restaurant line — so it
  // must keep comparing against expectedQuantity like every other case.
  // Only "canteen product line with a shortfall already booked" swaps the
  // base; everything else (restaurant, ingredients, canteen surpluses)
  // is unchanged.
  const location = await findLocationById(db, count.locationId);
  const canteenShortfallAlreadyBooked =
    line.itemType === "product" &&
    location?.code === "canteen" &&
    line.countedQuantity < line.expectedQuantity;
  const deltaBase = canteenShortfallAlreadyBooked ? line.countedQuantity : line.expectedQuantity;
  const delta = input.correctedQuantity - deltaBase;

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
// terms. Valued at each ingredient's cost layers as they stood then
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
  // T8: valued at the cost **in force at `asOf`**, rebuilt from the
  // delivery history, not at the ingredient's current lastKnownCostMinor.
  //
  // The old behaviour read today's figure for every date, so any price
  // move — a new delivery, or the owner editing a cost — silently
  // reshaped every past valuation, and with it formulas.md §6's whole
  // cost-of-goods-sold line for closed periods. Plan §3.4 promises price
  // edits are not retroactive; this is what makes that true.
  const movements = await findIngredientMovementsAtLocationAsOf(db, locationId, asOf);
  const layersByIngredient = costLayersByIngredientAsOf(movements);

  // Stock that entered without a price of its own (a count correction says
  // how many, never what they cost) falls back to the ingredient's recorded
  // cost — the owner's own hand-entered figure, which is real data and the
  // best basis available. 30 of the 38 production ingredients are in
  // exactly this position.
  const ingredientIds = [...layersByIngredient.keys()];
  const ingredients = await findIngredientsByIds(db, ingredientIds);
  const fallbackCost = new Map(ingredients.map((i) => [i.id, i.lastKnownCostMinor]));

  let totalMinor = 0;
  for (const [ingredientId, layers] of layersByIngredient) {
    for (const layer of layers) {
      const cost = layer.unitCostMinor ?? fallbackCost.get(ingredientId) ?? null;
      // No delivery price and no recorded cost means no cost was ever in
      // force, so there is no honest figure to state — formulas.md's "not
      // zero, not a guess" applied to the cost. The quantity is still
      // visible on the Store ledger; only its valuation is withheld.
      if (cost == null) continue;
      totalMinor += layer.quantity * cost;
    }
  }
  return { ok: true, totalMinor };
}

type CostLayer = { quantity: number; unitCostMinor: number | null };

/**
 * Replays each ingredient's movement history into the cost layers still on
 * hand at `asOf` — formulas.md §3's latest-price-wins rule seen from the
 * valuation side.
 *
 * Each delivery adds a layer at the price actually paid, snapshotted on the
 * movement and never rewritten. Stock leaving draws down oldest-first, so
 * what survives is valued at what those particular units cost. This is what
 * keeps a price rise off yesterday's books: a new delivery adds a layer, it
 * does not touch the ones already there.
 *
 * Order matters — the caller supplies movements oldest-first.
 */
function costLayersByIngredientAsOf(
  movements: { ingredientId: string; quantity: number; reason: string; unitCostMinor: number | null }[],
): Map<string, CostLayer[]> {
  const layersByIngredient = new Map<string, CostLayer[]>();

  for (const m of movements) {
    let layers = layersByIngredient.get(m.ingredientId);
    if (!layers) {
      layers = [];
      layersByIngredient.set(m.ingredientId, layers);
    }

    if (m.quantity >= 0) {
      // A delivery carries its own price; a correction carries none, and is
      // resolved against the ingredient's recorded cost by the caller.
      layers.push({ quantity: m.quantity, unitCostMinor: m.unitCostMinor });
      continue;
    }

    // Stock leaving: consume oldest layers first. Deliveries are received
    // mid-service on a phone (formulas.md §3's original objection to batch
    // costing), so nobody is asked which sack was used — the order the
    // stock arrived in decides it.
    let remaining = -m.quantity;
    while (remaining > 0 && layers.length > 0) {
      const oldest = layers[0];
      if (oldest.quantity > remaining) {
        oldest.quantity -= remaining;
        remaining = 0;
      } else {
        remaining -= oldest.quantity;
        layers.shift();
      }
    }
  }

  return layersByIngredient;
}

export type PreviousDeliveryCostResult =
  | { ok: true; costs: Map<string, number> }
  | { ok: false; reason: "forbidden" };

// The Store ledger's "previous unit cost" column — the price paid on the
// last delivery before the period, per ingredient. Under formulas.md §3's
// latest-price-wins rule this is read straight off that delivery, rather
// than reconstructed by un-averaging the current figure.
export async function getPreviousDeliveryCostAtLocation(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  locationId: string,
  before: Date,
): Promise<PreviousDeliveryCostResult> {
  if (!canAccessLocation(requester.staff.role, requester.staff.locationId, locationId)) {
    return { ok: false, reason: "forbidden" };
  }
  return { ok: true, costs: await findPreviousDeliveryCostByIngredientAtLocation(db, locationId, before) };
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
// Unlike ingredients (a single recorded cost), a product's unit cost
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
// ingredient's current recorded cost.
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

export type ActivityMovementsResult =
  | { ok: true; lines: NonSalesMovementLineWithLocation[] }
  | { ok: false; reason: "forbidden" };

// Ticket 45 — Activity's movement rows: wastage/consumption/
// complimentary, business-wide (both locations) in a period. Owner-only,
// same gate as every other business-wide read (getCashLedgerTransactions,
// getTotalCustomerBalance).
export async function getMovementsForActivity(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  periodStart: Date,
  periodEnd: Date,
): Promise<ActivityMovementsResult> {
  if (requester.staff.role !== "owner") {
    return { ok: false, reason: "forbidden" };
  }
  const lines = await findAllNonSalesMovementsInPeriod(db, periodStart, periodEnd);
  return { ok: true, lines };
}

export type ActivityStockCountsResult =
  | { ok: true; counts: StockCount[] }
  | { ok: false; reason: "forbidden" };

// Ticket 45 — Activity's count rows, business-wide in a period.
export async function getStockCountsForActivity(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  periodStart: Date,
  periodEnd: Date,
): Promise<ActivityStockCountsResult> {
  if (requester.staff.role !== "owner") {
    return { ok: false, reason: "forbidden" };
  }
  const counts = await listStockCountsInPeriod(db, periodStart, periodEnd);
  return { ok: true, counts };
}

// ---------------------------------------------------------------------------
// Editable-ledger T3 — the three write functions.
//
// Every editable ledger cell routes to exactly one of these (plan C1), so
// a new editable figure declares its kind and inherits the semantics
// rather than growing a fifteenth bespoke edit handler. That is the
// failure mode BUG-10 came from: two code paths for one figure.
//
// All three are owner-gated *here*, in logic.ts, not at the route — the
// existing convention (correctStockCount). All three write their trail row
// inside the same transaction as the data change (C2): an untrailed edit
// is worse than no edit.
//
// ## The two boundary instants, and why they are what they are
//
// A ledger day D is the half-open interval `(D 00:00, D+1 00:00]`
// (reporting's `daysInPeriod`, plus every period query's
// `occurredAt: { gt: periodStart, lte: periodEnd }`), while *opening* at D
// is `occurredAt <= D 00:00` (the `...AsOf` reads, which use `lte`). The
// two conventions disagree about which side of midnight a row falls on, so
// a Kind B correction has exactly one correct instant:
//
//   opening on D  -> D 00:00:00.000     (inside opening's lte, outside the
//                                        day's own gt, so it shifts the
//                                        position without appearing as one
//                                        of D's movements)
//   closing on D  -> D+1 00:00:00.000   (the lte end of D, so it is inside D)
//
// A millisecond either way breaks one of the two. The property-based
// reconciliation test in amend-ledger.integration.test.ts is what holds
// this honest.
// ---------------------------------------------------------------------------

/** Ledger reasons whose movement quantity is stored negative (stock leaving). */
const OUT_REASONS: readonly StockMovementReason[] = [
  "sold",
  "wasted",
  "consumed",
  "given_away",
  "issued",
];

function isOutReason(reason: StockMovementReason): boolean {
  return OUT_REASONS.includes(reason);
}

/** Midnight UTC at the start of the day containing `date`. */
function dayStart(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function nextDayStart(date: Date): Date {
  const d = dayStart(date);
  d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

export type AmendResult =
  | { ok: true }
  | { ok: false; reason: "forbidden" | "not_found" | "field_not_editable" | "invalid_value" };

type AmendItemType = "product" | "ingredient";

async function itemNameFor(
  db: PrismaClient,
  itemType: AmendItemType,
  itemId: string,
): Promise<string | null> {
  if (itemType === "product") {
    const [product] = await findProductsByIds(db, [itemId]);
    return product?.name ?? null;
  }
  const [ingredient] = await findIngredientsByIds(db, [itemId]);
  return ingredient?.name ?? null;
}

/**
 * Kind A — "the day's total for this reason should be N".
 *
 * She edits the day's total; the app makes the total equal what she typed.
 * She is never asked which underlying row was wrong (plan §3.1), so this
 * takes item + location + date + reason + new total, never a movement id.
 * Row selection lives here rather than in the UI so it is one tested
 * decision instead of something each ledger tab re-derives.
 *
 *   exactly one row  -> edit it in place (the common case; one delivery is
 *                       what happened, so the list must keep showing one)
 *   several rows     -> the most recent absorbs the difference,
 *                       deterministically, never a prompt
 *   zero rows        -> write one new movement, flagged isAmendment
 *
 * The accepted cost of the several-rows case is that one row now carries a
 * quantity that wasn't what that particular delivery brought. That is
 * deliberate: the day total is correct, the trail is truthful about what
 * she changed, and the alternative was a prompt she explicitly rejected.
 * Nothing reads a single `received` row as authoritative about one
 * delivery — receipts are grouped by receiptId and read as a group.
 */
export async function amendDayTotal(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  input: {
    itemType: AmendItemType;
    itemId: string;
    locationId: string;
    date: Date;
    reason: StockMovementReason;
    newTotal: number;
    /**
     * §3.3 — only meaningful when `reason` is "sold", and only asked once,
     * on that cell.
     *
     * `sold` is the one figure that is simultaneously a stock movement and
     * a financial record, so reducing it has no neutral option: either
     * revenue stays and disagrees with stock, or it drops and the app
     * erases money a customer physically handed over. The owner names
     * which happened; the app never guesses.
     *
     *   "stock"      -> the units never left the shelf (miscount,
     *                   breakage). Revenue is untouched.
     *   "stockAndMoney" -> they were never sold. The day's sale value drops
     *                   by the implied amount, most-recent-sale-first.
     *
     * Defaults to "stock", the conservative choice: it never destroys a
     * revenue record without being told to.
     */
    revenueTreatment?: "stock" | "stockAndMoney";
  },
): Promise<AmendResult> {
  if (requester.staff.role !== "owner") return { ok: false, reason: "forbidden" };
  if (!canAccessLocation(requester.staff.role, requester.staff.locationId, input.locationId)) {
    return { ok: false, reason: "forbidden" };
  }
  if (!Number.isFinite(input.newTotal) || input.newTotal < 0) {
    return { ok: false, reason: "invalid_value" };
  }

  const start = dayStart(input.date);
  const end = nextDayStart(input.date);
  const out = isOutReason(input.reason);

  const where =
    input.itemType === "product"
      ? { productId: input.itemId, locationId: input.locationId, reason: input.reason,
          occurredAt: { gt: start, lte: end }, reversed: false }
      : { ingredientId: input.itemId, locationId: input.locationId, reason: input.reason,
          occurredAt: { gt: start, lte: end }, reversed: false };

  const existing =
    input.itemType === "product"
      ? await db.stockMovement.findMany({ where, orderBy: { occurredAt: "desc" } })
      : await db.ingredientMovement.findMany({ where, orderBy: { occurredAt: "desc" } });

  // The ledger states out-reasons as positive "out" figures while the rows
  // are stored negative, so compare in the ledger's terms and convert once
  // at the write.
  const currentSigned = existing.reduce((sum, m) => sum + m.quantity.toNumber(), 0);
  const currentTotal = out ? -currentSigned : currentSigned;
  if (currentTotal === input.newTotal) return { ok: true };

  const itemName = await itemNameFor(db, input.itemType, input.itemId);
  const location = await findLocationById(db, input.locationId);
  const ledgerContext = `${input.reason} · ${itemName ?? "item"} · ${location?.code ?? "location"}`;

  const delta = input.newTotal - currentTotal;
  const target = existing[0];

  await db.$transaction(async (tx) => {
    if (target) {
      // Edit in place. With several rows the most recent absorbs the whole
      // difference; with one row this simply sets it.
      const newSigned = target.quantity.toNumber() + (out ? -delta : delta);
      if (input.itemType === "product") {
        await tx.stockMovement.update({ where: { id: target.id }, data: { quantity: newSigned } });
      } else {
        await tx.ingredientMovement.update({
          where: { id: target.id },
          data: { quantity: newSigned },
        });
      }
    } else {
      // Nothing to edit, so a row is added — and flagged, so the UI labels
      // it a correction rather than dressing it as an ordinary delivery.
      const quantity = out ? -input.newTotal : input.newTotal;
      // Mid-day, so it sits inside the day's (start, end] window on any
      // reading. The day is the fact she stated; the time within it is not.
      const occurredAt = new Date(start.getTime() + 12 * 60 * 60 * 1000);
      if (input.itemType === "product") {
        await tx.stockMovement.create({
          data: {
            productId: input.itemId,
            locationId: input.locationId,
            quantity,
            reason: input.reason,
            staffMemberId: requester.staff.id,
            occurredAt,
            isAmendment: true,
          },
        });
      } else {
        await tx.ingredientMovement.create({
          data: {
            ingredientId: input.itemId,
            locationId: input.locationId,
            quantity,
            reason: input.reason,
            staffMemberId: requester.staff.id,
            occurredAt,
            isAmendment: true,
          },
        });
      }
    }

    // §3.3's money half. Stock has already moved above; this reduces the
    // recorded revenue to match, most-recent-sale-first — the same
    // determinism as the several-rows rule, so the outcome never depends
    // on which sale the database happens to return first.
    //
    // Only ever reduces. Raising a `sold` figure cannot invent a sale: we
    // would have to fabricate a customer, a payment method and a time, none
    // of which she stated. The stock rises, and the revenue she actually
    // took stands.
    if (input.reason === "sold" && input.revenueTreatment === "stockAndMoney" && delta < 0) {
      let unitsToRemove = -delta;
      const lines = await tx.saleLine.findMany({
        where: {
          productId: input.itemId,
          sale: { locationId: input.locationId, voided: false, occurredAt: { gt: start, lte: end } },
        },
        orderBy: { sale: { occurredAt: "desc" } },
        include: { sale: true },
      });

      for (const line of lines) {
        if (unitsToRemove <= 0) break;
        const quantity = line.quantity.toNumber();
        const removed = Math.min(quantity, unitsToRemove);
        const priceMinor = line.priceMinor.toNumber();

        if (removed >= quantity) {
          await tx.saleLine.delete({ where: { id: line.id } });
        } else {
          await tx.saleLine.update({
            where: { id: line.id },
            data: { quantity: quantity - removed },
          });
        }
        // The sale's own total is a stored figure, so it moves with its
        // lines or the two disagree.
        await tx.sale.update({
          where: { id: line.saleId },
          data: { totalMinor: { decrement: removed * priceMinor } },
        });
        unitsToRemove -= removed;
      }
    }

    // The trail is day-level, because the day's total is the fact she
    // stated. "movement abc123.quantity changed" would be a true statement
    // about a row and a useless one about her business.
    await recordAmendment(tx, {
      recordType: input.itemType === "product" ? "StockMovement" : "IngredientMovement",
      recordId: target?.id ?? input.itemId,
      field: input.reason,
      previousValue: String(currentTotal),
      newValue: String(input.newTotal),
      // §3.3: the choice is recorded on the amendment, so the trail states
      // her *intent* rather than a bare arithmetic delta — worth more six
      // weeks later than the number alone.
      ledgerContext:
        input.reason === "sold" && input.revenueTreatment
          ? `${ledgerContext} · ${input.revenueTreatment === "stockAndMoney" ? "stock and money" : "stock only"}`
          : ledgerContext,
      effectiveDate: start,
      locationId: input.locationId,
      staffMemberId: requester.staff.id,
    });
  });

  return { ok: true };
}

/**
 * Kind B — "opening/closing on this date should be N".
 *
 * Neither figure is stored: opening is the sum of everything before the
 * date, closing is opening plus the day's movements. There is no row to
 * edit, so this is the one case where a row is *added* — and it is
 * labelled `corrected`, never dressed as a delivery or a production.
 *
 * That labelling is what makes the row truthful rather than a fiction: the
 * correction is itself a real, datable fact about the owner's knowledge of
 * the shelf. The UI requirement in T5/T6 to render it as a correction is
 * part of this design, not a nicety.
 */
export async function amendDerivedPosition(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  input: {
    itemType: AmendItemType;
    itemId: string;
    locationId: string;
    date: Date;
    position: "opening" | "closing";
    newValue: number;
  },
): Promise<AmendResult> {
  if (requester.staff.role !== "owner") return { ok: false, reason: "forbidden" };
  if (!canAccessLocation(requester.staff.role, requester.staff.locationId, input.locationId)) {
    return { ok: false, reason: "forbidden" };
  }
  if (!Number.isFinite(input.newValue)) return { ok: false, reason: "invalid_value" };

  // See the header note: opening lands on D 00:00:00.000, closing on
  // D+1 00:00:00.000. Both are the `lte` boundary of the window whose
  // position they set.
  const asOf = input.position === "opening" ? dayStart(input.date) : nextDayStart(input.date);

  const where =
    input.itemType === "product"
      ? { productId: input.itemId, locationId: input.locationId, occurredAt: { lte: asOf }, reversed: false }
      : { ingredientId: input.itemId, locationId: input.locationId, occurredAt: { lte: asOf }, reversed: false };

  const aggregate =
    input.itemType === "product"
      ? await db.stockMovement.aggregate({ where, _sum: { quantity: true } })
      : await db.ingredientMovement.aggregate({ where, _sum: { quantity: true } });

  const current = aggregate._sum.quantity?.toNumber() ?? 0;
  const delta = input.newValue - current;
  if (delta === 0) return { ok: true };

  const itemName = await itemNameFor(db, input.itemType, input.itemId);
  const location = await findLocationById(db, input.locationId);
  const ledgerContext = `${input.position} · ${itemName ?? "item"} · ${location?.code ?? "location"}`;

  await db.$transaction(async (tx) => {
    const data = {
      locationId: input.locationId,
      quantity: delta,
      reason: "corrected" as StockMovementReason,
      staffMemberId: requester.staff.id,
      occurredAt: asOf,
      isAmendment: true,
    };
    if (input.itemType === "product") {
      await tx.stockMovement.create({ data: { ...data, productId: input.itemId } });
    } else {
      await tx.ingredientMovement.create({ data: { ...data, ingredientId: input.itemId } });
    }

    await recordAmendment(tx, {
      recordType: input.itemType === "product" ? "StockMovement" : "IngredientMovement",
      recordId: input.itemId,
      field: input.position,
      previousValue: String(current),
      newValue: String(input.newValue),
      ledgerContext,
      effectiveDate: dayStart(input.date),
      locationId: input.locationId,
      staffMemberId: requester.staff.id,
    });
  });

  return { ok: true };
}

/**
 * Kind C — a scalar on a single record.
 *
 * Prices, costs, expense amounts, handover actuals, days worked. These are
 * genuinely single stored values, so the column is edited in place; an
 * offsetting row would be a fiction (a "balancing +200 gas payment"
 * invents a purchase that never happened).
 *
 * The allow-list is the security boundary. Without it a ledger cell id
 * becomes an arbitrary column write, which is a much larger hole than the
 * feature needs.
 */
const EDITABLE_SCALARS: Record<string, readonly string[]> = {
  Product: ["priceMinor", "lastKnownCostMinor", "lowStockLevel"],
  Ingredient: ["lastKnownCostMinor", "lowStockLevel"],
};

export async function amendScalar(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  input: {
    recordType: keyof typeof EDITABLE_SCALARS | string;
    recordId: string;
    field: string;
    newValue: number;
    locationId?: string;
    ledgerContext?: string;
  },
): Promise<AmendResult> {
  if (requester.staff.role !== "owner") return { ok: false, reason: "forbidden" };

  const allowed = EDITABLE_SCALARS[input.recordType];
  if (!allowed || !allowed.includes(input.field)) {
    return { ok: false, reason: "field_not_editable" };
  }
  if (!Number.isFinite(input.newValue)) return { ok: false, reason: "invalid_value" };

  const current =
    input.recordType === "Product"
      ? await db.product.findUnique({ where: { id: input.recordId } })
      : await db.ingredient.findUnique({ where: { id: input.recordId } });
  if (!current) return { ok: false, reason: "not_found" };

  const previous = (current as Record<string, unknown>)[input.field];
  const previousNumber =
    previous && typeof previous === "object" && "toNumber" in previous
      ? (previous as { toNumber: () => number }).toNumber()
      : previous === null || previous === undefined
        ? null
        : Number(previous);
  if (previousNumber === input.newValue) return { ok: true };

  await db.$transaction(async (tx) => {
    if (input.recordType === "Product") {
      await tx.product.update({
        where: { id: input.recordId },
        data: { [input.field]: input.newValue },
      });
    } else {
      await tx.ingredient.update({
        where: { id: input.recordId },
        data: { [input.field]: input.newValue },
      });
    }

    await recordAmendment(tx, {
      recordType: input.recordType,
      recordId: input.recordId,
      field: input.field,
      previousValue: previousNumber === null ? "" : String(previousNumber),
      newValue: String(input.newValue),
      ledgerContext: input.ledgerContext ?? null,
      locationId: input.locationId ?? null,
      staffMemberId: requester.staff.id,
    });
  });

  return { ok: true };
}


export type SoldCostBasisResult =
  | { ok: true; lines: { productId: string; costBasisMinor: number; snapshottedQuantity: number }[] }
  | { ok: false; reason: "forbidden" };

/**
 * Editable-ledger T8 — cost of goods sold in a period from the snapshots
 * on each `sold` movement, rather than from the product's current cost.
 *
 * See sumSoldCostBasisByProductAtLocationInPeriod for why this exists: it
 * is what stops a price edit today from moving a closed month's profit.
 */
export async function getSoldCostBasisInPeriod(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  locationId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<SoldCostBasisResult> {
  if (!canAccessLocation(requester.staff.role, requester.staff.locationId, locationId)) {
    return { ok: false, reason: "forbidden" };
  }
  const lines = await sumSoldCostBasisByProductAtLocationInPeriod(
    db,
    locationId,
    periodStart,
    periodEnd,
  );
  return { ok: true, lines };
}
