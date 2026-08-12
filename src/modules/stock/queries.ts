import type { PrismaClient } from "@/generated/prisma/client";
import type {
  IngredientMovement,
  Receipt,
  StockCount,
  StockCountItemType,
  StockMovement,
  StockMovementReason,
} from "./schema";

export async function createStockMovement(
  db: PrismaClient,
  data: {
    productId: string;
    locationId: string;
    quantity: number;
    reason: StockMovementReason;
    staffMemberId: string;
    costBasisMinor?: number;
    sellingValueMinor?: number | null;
    isEstimated?: boolean;
    transferId?: string;
    receiptId?: string;
    // Ticket 24: sold_derived rows are stamped with the triggering count's
    // own occurredAt rather than a fresh now(), so the owner's review
    // screen can look them back up by (location, reason, occurredAt) —
    // the same value written here — without a stored count-id link.
    occurredAt?: Date;
  },
): Promise<StockMovement> {
  return db.stockMovement.create({ data });
}

export async function createProductionMovement(
  db: PrismaClient,
  data: {
    productId: string;
    locationId: string;
    quantity: number;
    staffMemberId: string;
    costBasisMinor: number;
    sellingValueMinor: number | null;
  },
): Promise<StockMovement> {
  return db.stockMovement.create({ data: { ...data, reason: "produced", isEstimated: false } });
}

export async function sumMovementsByProductAtLocation(
  db: PrismaClient,
  locationId: string,
): Promise<{ productId: string; quantityOnHand: number }[]> {
  const grouped = await db.stockMovement.groupBy({
    by: ["productId"],
    where: { locationId },
    _sum: { quantity: true },
  });

  return grouped.map((g) => ({
    productId: g.productId,
    quantityOnHand: g._sum.quantity ?? 0,
  }));
}

// Ticket 39: product-side counterpart to sumIngredientMovementsAtLocationAsOf
// — quantity on hand at a point in time, not the running total, for the
// ledger's opening/closing figures.
export async function sumMovementsByProductAtLocationAsOf(
  db: PrismaClient,
  locationId: string,
  asOf: Date,
): Promise<{ productId: string; quantityOnHand: number }[]> {
  const grouped = await db.stockMovement.groupBy({
    by: ["productId"],
    where: { locationId, occurredAt: { lte: asOf } },
    _sum: { quantity: true },
  });

  return grouped.map((g) => ({
    productId: g.productId,
    quantityOnHand: g._sum.quantity ?? 0,
  }));
}

export async function createIngredientMovement(
  db: PrismaClient,
  data: {
    ingredientId: string;
    locationId: string;
    quantity: number;
    reason: StockMovementReason;
    unitCostMinor: number;
    staffMemberId: string;
    receiptId: string;
    transferId?: string;
  },
): Promise<IngredientMovement> {
  return db.ingredientMovement.create({ data });
}

export async function createIngredientIssueMovement(
  db: PrismaClient,
  data: {
    ingredientId: string;
    locationId: string;
    quantity: number;
    staffMemberId: string;
  },
): Promise<IngredientMovement> {
  return db.ingredientMovement.create({ data: { ...data, reason: "issued" } });
}

export async function createIngredientCorrectionMovement(
  db: PrismaClient,
  data: {
    ingredientId: string;
    locationId: string;
    quantity: number;
    staffMemberId: string;
    costBasisMinor: number;
  },
): Promise<IngredientMovement> {
  return db.ingredientMovement.create({
    data: { ...data, reason: "corrected", isEstimated: false },
  });
}

export async function createIngredientConsumptionMovement(
  db: PrismaClient,
  data: {
    ingredientId: string;
    locationId: string;
    quantity: number;
    reason: StockMovementReason;
    staffMemberId: string;
    costBasisMinor: number;
    isEstimated: boolean;
  },
): Promise<IngredientMovement> {
  return db.ingredientMovement.create({ data });
}

// receiptId is only nullable for wasted/consumed/given_away rows (ticket
// 15) — the "received" filter below means every row here always has one.
// Ticket 22: a receipt may also include product lines (StockMovement),
// which carry no unitCostMinor of their own — their per-line value comes
// from the product's lastKnownCostMinor as of the receipt (queried once
// per receipt set, not per line, since the average may have moved since).
export async function findReceiptsAtLocation(db: PrismaClient, locationId: string): Promise<Receipt[]> {
  const [ingredientMovements, stockMovements] = await Promise.all([
    db.ingredientMovement.findMany({
      where: { locationId, reason: "received" },
      orderBy: { occurredAt: "desc" },
    }),
    db.stockMovement.findMany({
      where: { locationId, reason: "received" },
      orderBy: { occurredAt: "desc" },
    }),
  ]);

  const productIds = [...new Set(stockMovements.map((m) => m.productId))];
  const products =
    productIds.length > 0
      ? await db.product.findMany({ where: { id: { in: productIds } } })
      : [];
  const productCostById = new Map(products.map((p) => [p.id, p.lastKnownCostMinor ?? 0]));

  const byReceiptId = new Map<
    string,
    { occurredAt: Date; totalMinor: number; lineCount: number }
  >();
  for (const movement of ingredientMovements) {
    const receiptId = movement.receiptId as string;
    const group = byReceiptId.get(receiptId) ?? { occurredAt: movement.occurredAt, totalMinor: 0, lineCount: 0 };
    group.totalMinor += movement.quantity * (movement.unitCostMinor ?? 0);
    group.lineCount += 1;
    byReceiptId.set(receiptId, group);
  }
  for (const movement of stockMovements) {
    const receiptId = movement.receiptId as string;
    const group = byReceiptId.get(receiptId) ?? { occurredAt: movement.occurredAt, totalMinor: 0, lineCount: 0 };
    group.totalMinor += movement.quantity * (productCostById.get(movement.productId) ?? 0);
    group.lineCount += 1;
    byReceiptId.set(receiptId, group);
  }

  return Array.from(byReceiptId.entries()).map(([receiptId, group]) => ({
    receiptId,
    locationId,
    occurredAt: group.occurredAt,
    totalMinor: group.totalMinor,
    lineCount: group.lineCount,
  }));
}

export async function findReceiptById(
  db: PrismaClient,
  receiptId: string,
): Promise<{ receiptId: string; locationId: string } | null> {
  const ingredientMovement = await db.ingredientMovement.findFirst({ where: { receiptId } });
  if (ingredientMovement) {
    return { receiptId: ingredientMovement.receiptId as string, locationId: ingredientMovement.locationId };
  }
  const stockMovement = await db.stockMovement.findFirst({ where: { receiptId } });
  if (!stockMovement) return null;
  return { receiptId: stockMovement.receiptId as string, locationId: stockMovement.locationId };
}

export async function sumMovementsByIngredientAtLocation(
  db: PrismaClient,
  locationId: string,
): Promise<{ ingredientId: string; quantityOnHand: number }[]> {
  const grouped = await db.ingredientMovement.groupBy({
    by: ["ingredientId"],
    where: { locationId },
    _sum: { quantity: true },
  });

  return grouped.map((g) => ({
    ingredientId: g.ingredientId,
    quantityOnHand: g._sum.quantity ?? 0,
  }));
}

// Ticket 24: the count-derived-sales formula reads each reason's movements
// for the period between two counts, one reason at a time (rather than one
// query per product) — grouped by product and reason so the caller sums
// whichever reasons the formula needs per item.
export async function sumMovementsByProductReasonAtLocationInPeriod(
  db: PrismaClient,
  locationId: string,
  reasons: StockMovementReason[],
  periodStart: Date,
  periodEnd: Date,
): Promise<{ productId: string; reason: StockMovementReason; quantity: number }[]> {
  const grouped = await db.stockMovement.groupBy({
    by: ["productId", "reason"],
    where: {
      locationId,
      reason: { in: reasons },
      occurredAt: { gt: periodStart, lte: periodEnd },
    },
    _sum: { quantity: true },
  });

  return grouped.map((g) => ({
    productId: g.productId,
    reason: g.reason,
    quantity: g._sum.quantity ?? 0,
  }));
}

// Ticket 25: formulas.md §6's restaurant formula needs ingredient stock
// *as of a point in time* (opening/closing), not the running total —
// distinct from sumMovementsByIngredientAtLocation, which sums forever.
export async function sumIngredientMovementsAtLocationAsOf(
  db: PrismaClient,
  locationId: string,
  asOf: Date,
): Promise<{ ingredientId: string; quantityOnHand: number }[]> {
  const grouped = await db.ingredientMovement.groupBy({
    by: ["ingredientId"],
    where: { locationId, occurredAt: { lte: asOf } },
    _sum: { quantity: true },
  });

  return grouped.map((g) => ({
    ingredientId: g.ingredientId,
    quantityOnHand: g._sum.quantity ?? 0,
  }));
}

// Ticket 25: formulas.md §6's "ingredients bought" term is the money
// actually paid on each delivery (unitCostMinor at the time), not a
// re-valuation at today's running average.
export async function sumIngredientsBoughtMinorAtLocationInPeriod(
  db: PrismaClient,
  locationId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<number> {
  const received = await db.ingredientMovement.findMany({
    where: {
      locationId,
      reason: "received",
      occurredAt: { gt: periodStart, lte: periodEnd },
    },
    select: { quantity: true, unitCostMinor: true },
  });
  return received.reduce((sum, r) => sum + r.quantity * (r.unitCostMinor ?? 0), 0);
}

// Ticket 25: formulas.md §5's transfer rate needs "ingredients the
// kitchen consumed" — issued-to-production ingredient movements at a
// location in a period, valued at each ingredient's current running
// average (formulas.md §3 — no batch/historical cost tracking).
export async function sumIngredientsIssuedByIngredientAtLocationInPeriod(
  db: PrismaClient,
  locationId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<{ ingredientId: string; quantity: number }[]> {
  const grouped = await db.ingredientMovement.groupBy({
    by: ["ingredientId"],
    where: {
      locationId,
      reason: "issued",
      occurredAt: { gt: periodStart, lte: periodEnd },
    },
    _sum: { quantity: true },
  });
  return grouped.map((g) => ({ ingredientId: g.ingredientId, quantity: -(g._sum.quantity ?? 0) }));
}

// Ticket 42: per-ingredient counterpart to sumIngredientsBoughtMinorAtLocationInPeriod
// (which only returns a location-wide total) — the Store ledger needs each
// ingredient's own purchased qty/value for its row, not one summed figure.
export async function sumIngredientsPurchasedByIngredientAtLocationInPeriod(
  db: PrismaClient,
  locationId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<{ ingredientId: string; quantity: number; valueMinor: number }[]> {
  const received = await db.ingredientMovement.findMany({
    where: {
      locationId,
      reason: "received",
      occurredAt: { gt: periodStart, lte: periodEnd },
    },
    select: { ingredientId: true, quantity: true, unitCostMinor: true },
  });
  const byIngredient = new Map<string, { quantity: number; valueMinor: number }>();
  for (const r of received) {
    const existing = byIngredient.get(r.ingredientId) ?? { quantity: 0, valueMinor: 0 };
    existing.quantity += r.quantity;
    existing.valueMinor += r.quantity * (r.unitCostMinor ?? 0);
    byIngredient.set(r.ingredientId, existing);
  }
  return Array.from(byIngredient.entries()).map(([ingredientId, v]) => ({ ingredientId, ...v }));
}

// Ticket 42: ingredient-side counterpart to
// sumMovementsByProductReasonAtLocationInPeriod — the Store ledger needs
// every reason (received/issued/transferred/wasted) for every ingredient
// in one period at once, grouped the same way the Product ledger groups
// StockMovement.
export async function sumIngredientMovementsByReasonAtLocationInPeriod(
  db: PrismaClient,
  locationId: string,
  reasons: StockMovementReason[],
  periodStart: Date,
  periodEnd: Date,
): Promise<{ ingredientId: string; reason: StockMovementReason; quantity: number }[]> {
  const grouped = await db.ingredientMovement.groupBy({
    by: ["ingredientId", "reason"],
    where: { locationId, reason: { in: reasons }, occurredAt: { gt: periodStart, lte: periodEnd } },
    _sum: { quantity: true },
  });
  return grouped.map((g) => ({
    ingredientId: g.ingredientId,
    reason: g.reason,
    quantity: g._sum.quantity ?? 0,
  }));
}

// Ticket 25: formulas.md §6's canteen restaurant-food half and §5's
// transfer valuation both need product `transferred`-in movements at a
// location in a period, per product — reusing the existing
// reason-grouped-by-product-and-reason primitive is overkill for a single
// reason, so this is a narrower, single-reason query.
export async function sumProductMovementsByReasonAtLocationInPeriod(
  db: PrismaClient,
  locationId: string,
  reason: StockMovementReason,
  periodStart: Date,
  periodEnd: Date,
): Promise<{ productId: string; quantity: number }[]> {
  const grouped = await db.stockMovement.groupBy({
    by: ["productId"],
    where: { locationId, reason, occurredAt: { gt: periodStart, lte: periodEnd } },
    _sum: { quantity: true },
  });
  return grouped.map((g) => ({ productId: g.productId, quantity: g._sum.quantity ?? 0 }));
}

// Ticket 38: proposal.md §10.5's non-sales consumption report — wasted,
// consumed and given-away product movements at a location in a period,
// valued both at cost and at selling price. Both figures were stamped on
// the movement itself at recordNonSalesConsumption time (formulas.md §4's
// cost basis, including the 60%-of-price estimate where no recipe/recorded
// cost exists), so this sums those stored fields rather than re-deriving
// cost. Quantity is negative on these movements (stock leaving), so the
// stored costBasisMinor/sellingValueMinor — already the positive value of
// the whole line, not a per-unit figure — are summed directly.
export async function sumNonSalesValueAtLocationInPeriod(
  db: PrismaClient,
  locationId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<{ atCostMinor: number; atPriceMinor: number }> {
  const movements = await findNonSalesMovementsAtLocationInPeriod(db, locationId, periodStart, periodEnd);
  return movements.reduce(
    (sum, m) => ({
      atCostMinor: sum.atCostMinor + (m.costBasisMinor ?? 0),
      atPriceMinor: sum.atPriceMinor + (m.sellingValueMinor ?? 0),
    }),
    { atCostMinor: 0, atPriceMinor: 0 },
  );
}

// Ticket 43's Non-sales ledger — one row per wasted/consumed/given-away
// entry (product and ingredient) at a location in a period, for the
// line-level report. sumNonSalesValueAtLocationInPeriod's aggregate is
// derived from this same query (see stock/logic.ts) so the two can never
// disagree.
export type NonSalesMovementLine = {
  itemType: "product" | "ingredient";
  itemId: string;
  quantity: number;
  reason: StockMovementReason;
  costBasisMinor: number | null;
  sellingValueMinor: number | null;
  isEstimated: boolean | null;
  staffMemberId: string;
  occurredAt: Date;
};

export async function findNonSalesMovementsAtLocationInPeriod(
  db: PrismaClient,
  locationId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<NonSalesMovementLine[]> {
  const [productMovements, ingredientMovements] = await Promise.all([
    db.stockMovement.findMany({
      where: {
        locationId,
        reason: { in: ["wasted", "consumed", "given_away"] },
        occurredAt: { gt: periodStart, lte: periodEnd },
      },
      select: {
        productId: true,
        quantity: true,
        reason: true,
        costBasisMinor: true,
        sellingValueMinor: true,
        isEstimated: true,
        staffMemberId: true,
        occurredAt: true,
      },
    }),
    db.ingredientMovement.findMany({
      where: {
        locationId,
        reason: { in: ["wasted", "consumed", "given_away"] },
        occurredAt: { gt: periodStart, lte: periodEnd },
      },
      select: {
        ingredientId: true,
        quantity: true,
        reason: true,
        costBasisMinor: true,
        sellingValueMinor: true,
        isEstimated: true,
        staffMemberId: true,
        occurredAt: true,
      },
    }),
  ]);

  return [
    ...productMovements.map((m) => ({
      itemType: "product" as const,
      itemId: m.productId,
      quantity: m.quantity,
      reason: m.reason,
      costBasisMinor: m.costBasisMinor,
      sellingValueMinor: m.sellingValueMinor,
      isEstimated: m.isEstimated,
      staffMemberId: m.staffMemberId,
      occurredAt: m.occurredAt,
    })),
    ...ingredientMovements.map((m) => ({
      itemType: "ingredient" as const,
      itemId: m.ingredientId,
      quantity: m.quantity,
      reason: m.reason,
      costBasisMinor: m.costBasisMinor,
      sellingValueMinor: m.sellingValueMinor,
      isEstimated: m.isEstimated,
      staffMemberId: m.staffMemberId,
      occurredAt: m.occurredAt,
    })),
  ];
}

// The count immediately before a given one at the same location — the
// "previous count" formulas.md's derived-sales formula reads from. None
// for the first-ever count at a location.
export async function findPreviousStockCountAtLocation(
  db: PrismaClient,
  locationId: string,
  beforeOccurredAt: Date,
): Promise<StockCount | null> {
  const count = await db.stockCount.findFirst({
    where: { locationId, occurredAt: { lt: beforeOccurredAt } },
    orderBy: { occurredAt: "desc" },
    include: { lines: true },
  });
  return count as StockCount | null;
}

export async function createStockCount(
  db: PrismaClient,
  data: {
    locationId: string;
    staffMemberId: string;
    lines: {
      itemType: StockCountItemType;
      itemId: string;
      countedQuantity: number;
      expectedQuantity: number;
    }[];
  },
): Promise<StockCount> {
  const count = await db.stockCount.create({
    data: {
      locationId: data.locationId,
      staffMemberId: data.staffMemberId,
      lines: { create: data.lines },
    },
    include: { lines: true },
  });
  return count as StockCount;
}

export async function findStockCountById(
  db: PrismaClient,
  stockCountId: string,
): Promise<StockCount | null> {
  const count = await db.stockCount.findUnique({
    where: { id: stockCountId },
    include: { lines: true },
  });
  return count as StockCount | null;
}

// The owner's review screen shows the current/most recent count, not a
// full history (out of scope per the ticket) — one query, most recent
// first.
export async function findLatestStockCountAtLocation(
  db: PrismaClient,
  locationId: string,
): Promise<StockCount | null> {
  const count = await db.stockCount.findFirst({
    where: { locationId },
    orderBy: { occurredAt: "desc" },
    include: { lines: true },
  });
  return count as StockCount | null;
}

// Ticket 24: the "since last count" detail on the owner's review screen —
// sold_derived movements are attributed to the count that produced them by
// occurring at the same instant (createStockMovement is called
// immediately after createStockCount within recordCountDerivedSales, no
// other write happens at that location in between), so the read side finds
// them by product + location + reason in the same narrow window rather
// than a stored count-id link on the movement.
export async function findDerivedSalesAtOccurredAt(
  db: PrismaClient,
  locationId: string,
  occurredAt: Date,
): Promise<{ productId: string; quantity: number; sellingValueMinor: number | null }[]> {
  const movements = await db.stockMovement.findMany({
    where: { locationId, reason: "sold_derived", occurredAt },
  });
  return movements.map((m) => ({
    productId: m.productId,
    quantity: -m.quantity,
    sellingValueMinor: m.sellingValueMinor,
  }));
}

export async function markStockCountLineCorrected(
  db: PrismaClient,
  lineId: string,
  correctedBy: string,
): Promise<void> {
  await db.stockCountLine.update({
    where: { id: lineId },
    data: { correctedAt: new Date(), correctedBy },
  });
}
