import type {
  Prisma,
  PrismaClient,
  StockMovement as PrismaStockMovement,
  IngredientMovement as PrismaIngredientMovement,
  StockCount as PrismaStockCount,
  StockCountLine as PrismaStockCountLine,
  Transfer as PrismaTransfer,
} from "@/generated/prisma/client";
import type {
  IngredientMovement,
  PendingTransferForReader,
  Receipt,
  StockCount,
  StockCountItemType,
  StockMovementReason,
  StockMovement,
  Transfer,
  TransferItemType,
} from "./schema";

// recordStockMovement (logic.ts) is called from inside a db.$transaction
// for BUG-15's overselling guard, so this needs to accept a transaction
// client, not just the top-level PrismaClient.
type Db = PrismaClient | Prisma.TransactionClient;

// Prisma returns Decimal fields as Decimal.js objects, not plain numbers —
// converted here so the rest of the app (logic.ts, routes.ts, UI) keeps
// working with plain numbers exactly as before the Int -> Decimal(10,2)
// migrations.
export function toStockMovement(row: PrismaStockMovement): StockMovement {
  return {
    ...row,
    quantity: row.quantity.toNumber(),
    costBasisMinor: row.costBasisMinor?.toNumber() ?? null,
    sellingValueMinor: row.sellingValueMinor?.toNumber() ?? null,
  };
}

export function toIngredientMovement(row: PrismaIngredientMovement): IngredientMovement {
  return {
    ...row,
    quantity: row.quantity.toNumber(),
    unitCostMinor: row.unitCostMinor?.toNumber() ?? null,
    costBasisMinor: row.costBasisMinor?.toNumber() ?? null,
    sellingValueMinor: row.sellingValueMinor?.toNumber() ?? null,
  };
}

function toStockCount(row: PrismaStockCount & { lines: PrismaStockCountLine[] }): StockCount {
  return {
    ...row,
    lines: row.lines.map((line) => ({
      ...line,
      countedQuantity: line.countedQuantity.toNumber(),
      expectedQuantity: line.expectedQuantity.toNumber(),
    })),
  } as StockCount;
}

export function toTransfer(row: PrismaTransfer): Transfer {
  return {
    ...row,
    sentQuantity: row.sentQuantity.toNumber(),
    confirmedQuantity: row.confirmedQuantity?.toNumber() ?? null,
  };
}

export async function createStockMovement(
  db: Db,
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
    // A count-derived canteen sale (recordStockCount) is stamped with the
    // triggering count's own occurredAt rather than a fresh now(), so it
    // books on the count date even when written a moment after the count
    // row itself — matching the "all booked on the count date" rule
    // (docs/formulas.md §1/§6), not spread across the days since the last
    // count.
    occurredAt?: Date;
  },
): Promise<StockMovement> {
  const row = await db.stockMovement.create({ data });
  return toStockMovement(row);
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
  const row = await db.stockMovement.create({
    data: { ...data, reason: "produced", isEstimated: false },
  });
  return toStockMovement(row);
}

export async function sumMovementsByProductAtLocation(
  db: PrismaClient,
  locationId: string,
): Promise<{ productId: string; quantityOnHand: number }[]> {
  const grouped = await db.stockMovement.groupBy({
    by: ["productId"],
    where: { locationId, reversed: false },
    _sum: { quantity: true },
  });

  return grouped.map((g) => ({
    productId: g.productId,
    quantityOnHand: g._sum.quantity?.toNumber() ?? 0,
  }));
}

// Ticket 39: product-side counterpart to sumIngredientMovementsAtLocationAsOf
// — quantity on hand at a point in time, not the running total, for the
// ledger's opening/closing figures.
export async function sumMovementsByProductAtLocationAsOf(
  db: Db,
  locationId: string,
  asOf: Date,
): Promise<{ productId: string; quantityOnHand: number }[]> {
  const grouped = await db.stockMovement.groupBy({
    by: ["productId"],
    where: { locationId, occurredAt: { lte: asOf }, reversed: false },
    _sum: { quantity: true },
  });

  return grouped.map((g) => ({
    productId: g.productId,
    quantityOnHand: g._sum.quantity?.toNumber() ?? 0,
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
  const row = await db.ingredientMovement.create({ data });
  return toIngredientMovement(row);
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
  const row = await db.ingredientMovement.create({ data: { ...data, reason: "issued" } });
  return toIngredientMovement(row);
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
  const row = await db.ingredientMovement.create({
    data: { ...data, reason: "corrected", isEstimated: false },
  });
  return toIngredientMovement(row);
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
  const row = await db.ingredientMovement.create({ data });
  return toIngredientMovement(row);
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
      where: { locationId, reason: "received", reversed: false },
      orderBy: { occurredAt: "desc" },
    }),
    db.stockMovement.findMany({
      where: { locationId, reason: "received", reversed: false },
      orderBy: { occurredAt: "desc" },
    }),
  ]);

  const productIds = [...new Set(stockMovements.map((m) => m.productId))];
  const products =
    productIds.length > 0
      ? await db.product.findMany({ where: { id: { in: productIds } } })
      : [];
  const productCostById = new Map(products.map((p) => [p.id, p.lastKnownCostMinor?.toNumber() ?? 0]));

  const byReceiptId = new Map<
    string,
    { occurredAt: Date; totalMinor: number; lineCount: number }
  >();
  for (const movement of ingredientMovements) {
    const receiptId = movement.receiptId as string;
    const group = byReceiptId.get(receiptId) ?? { occurredAt: movement.occurredAt, totalMinor: 0, lineCount: 0 };
    group.totalMinor += movement.quantity.toNumber() * (movement.unitCostMinor?.toNumber() ?? 0);
    group.lineCount += 1;
    byReceiptId.set(receiptId, group);
  }
  for (const movement of stockMovements) {
    const receiptId = movement.receiptId as string;
    const group = byReceiptId.get(receiptId) ?? { occurredAt: movement.occurredAt, totalMinor: 0, lineCount: 0 };
    group.totalMinor += movement.quantity.toNumber() * (productCostById.get(movement.productId) ?? 0);
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
  const ingredientMovement = await db.ingredientMovement.findFirst({
    where: { receiptId, reversed: false },
  });
  if (ingredientMovement) {
    return { receiptId: ingredientMovement.receiptId as string, locationId: ingredientMovement.locationId };
  }
  const stockMovement = await db.stockMovement.findFirst({
    where: { receiptId, reversed: false },
  });
  if (!stockMovement) return null;
  return { receiptId: stockMovement.receiptId as string, locationId: stockMovement.locationId };
}

export async function sumMovementsByIngredientAtLocation(
  db: PrismaClient,
  locationId: string,
): Promise<{ ingredientId: string; quantityOnHand: number }[]> {
  const grouped = await db.ingredientMovement.groupBy({
    by: ["ingredientId"],
    where: { locationId, reversed: false },
    _sum: { quantity: true },
  });

  return grouped.map((g) => ({
    ingredientId: g.ingredientId,
    quantityOnHand: g._sum.quantity?.toNumber() ?? 0,
  }));
}

// Ticket 24: the count-derived-sales formula reads each reason's movements
// for the period between two counts, one reason at a time (rather than one
// query per product) — grouped by product and reason so the caller sums
// whichever reasons the formula needs per item.
export async function sumMovementsByProductReasonAtLocationInPeriod(
  db: Db,
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
      reversed: false,
    },
    _sum: { quantity: true },
  });

  return grouped.map((g) => ({
    productId: g.productId,
    reason: g.reason,
    quantity: g._sum.quantity?.toNumber() ?? 0,
  }));
}

// Ticket 25: formulas.md §6's restaurant formula needs ingredient stock
// *as of a point in time* (opening/closing), not the running total —
// distinct from sumMovementsByIngredientAtLocation, which sums forever.
export async function sumIngredientMovementsAtLocationAsOf(
  db: Db,
  locationId: string,
  asOf: Date,
): Promise<{ ingredientId: string; quantityOnHand: number }[]> {
  const grouped = await db.ingredientMovement.groupBy({
    by: ["ingredientId"],
    where: { locationId, occurredAt: { lte: asOf }, reversed: false },
    _sum: { quantity: true },
  });

  return grouped.map((g) => ({
    ingredientId: g.ingredientId,
    quantityOnHand: g._sum.quantity?.toNumber() ?? 0,
  }));
}

// Ticket 25: formulas.md §6's "ingredients bought" term is the money
// actually paid on each delivery (unitCostMinor at the time), not a
// re-valuation at today's cost.
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
      reversed: false,
    },
    select: { quantity: true, unitCostMinor: true },
  });
  return received.reduce((sum, r) => sum + r.quantity.toNumber() * (r.unitCostMinor?.toNumber() ?? 0), 0);
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
      reversed: false,
    },
    _sum: { quantity: true },
  });
  return grouped.map((g) => ({
    ingredientId: g.ingredientId,
    quantity: -(g._sum.quantity?.toNumber() ?? 0),
  }));
}

// Ticket 42: per-ingredient counterpart to sumIngredientsBoughtMinorAtLocationInPeriod
// (which only returns a location-wide total) — the Store ledger needs each
// ingredient's own purchased qty/value for its row, not one summed figure.
export async function sumIngredientsPurchasedByIngredientAtLocationInPeriod(
  db: Db,
  locationId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<{ ingredientId: string; quantity: number; valueMinor: number }[]> {
  const received = await db.ingredientMovement.findMany({
    where: {
      locationId,
      reason: "received",
      occurredAt: { gt: periodStart, lte: periodEnd },
      reversed: false,
    },
    select: { ingredientId: true, quantity: true, unitCostMinor: true },
  });
  const byIngredient = new Map<string, { quantity: number; valueMinor: number }>();
  for (const r of received) {
    const quantity = r.quantity.toNumber();
    const existing = byIngredient.get(r.ingredientId) ?? { quantity: 0, valueMinor: 0 };
    existing.quantity += quantity;
    existing.valueMinor += quantity * (r.unitCostMinor?.toNumber() ?? 0);
    byIngredient.set(r.ingredientId, existing);
  }
  return Array.from(byIngredient.entries()).map(([ingredientId, v]) => ({ ingredientId, ...v }));
}

// Ticket 42: ingredient-side counterpart to
// sumMovementsByProductReasonAtLocationInPeriod — the Store ledger needs
// every reason (received/issued/transferred/wasted) for every ingredient
// in one period at once, grouped the same way the Product ledger groups
// StockMovement.
// Grouped by direction as well as reason, and that matters for exactly one
// reason: `transferred` carries both legs (this location can be either end
// of a transfer). Netting them into a single row per reason — which this
// query did until editable-ledger T6 — makes +8 in and -3 out arrive as a
// single +5, so the caller books transferredIn: 5, transferredOut: 0 and
// the outbound leg disappears from the ledger entirely. Under-reported
// both columns for any period where an ingredient moved both ways.
//
// Splitting on sign keeps the legs distinct; every single-direction reason
// is unaffected, since all its rows share one sign.
export async function sumIngredientMovementsByReasonAtLocationInPeriod(
  db: Db,
  locationId: string,
  reasons: StockMovementReason[],
  periodStart: Date,
  periodEnd: Date,
): Promise<{ ingredientId: string; reason: StockMovementReason; quantity: number }[]> {
  const rows = await db.ingredientMovement.findMany({
    where: {
      locationId,
      reason: { in: reasons },
      occurredAt: { gt: periodStart, lte: periodEnd },
      reversed: false,
    },
    select: { ingredientId: true, reason: true, quantity: true },
  });

  const byKey = new Map<string, { ingredientId: string; reason: StockMovementReason; quantity: number }>();
  for (const row of rows) {
    const quantity = row.quantity.toNumber();
    const direction = quantity < 0 ? "out" : "in";
    const key = `${row.ingredientId}:${row.reason}:${direction}`;
    const existing = byKey.get(key);
    if (existing) existing.quantity += quantity;
    else byKey.set(key, { ingredientId: row.ingredientId, reason: row.reason, quantity });
  }
  return Array.from(byKey.values());
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
    where: { locationId, reason, occurredAt: { gt: periodStart, lte: periodEnd }, reversed: false },
    _sum: { quantity: true },
  });
  return grouped.map((g) => ({ productId: g.productId, quantity: g._sum.quantity?.toNumber() ?? 0 }));
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
  // The movement row's own id. Editable-ledger T7.4 needs it: unlike every
  // other ledger tab, a non-sales row *is* one movement, and its cost and
  // selling value are snapshotted money figures edited in place on that
  // record rather than through a day total.
  movementId: string;
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
  db: Db,
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
        reversed: false,
      },
      select: {
        id: true,
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
        reversed: false,
      },
      select: {
        id: true,
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
      movementId: m.id,
      itemId: m.productId,
      quantity: m.quantity.toNumber(),
      reason: m.reason,
      costBasisMinor: m.costBasisMinor?.toNumber() ?? null,
      sellingValueMinor: m.sellingValueMinor?.toNumber() ?? null,
      isEstimated: m.isEstimated,
      staffMemberId: m.staffMemberId,
      occurredAt: m.occurredAt,
    })),
    ...ingredientMovements.map((m) => ({
      itemType: "ingredient" as const,
      movementId: m.id,
      itemId: m.ingredientId,
      quantity: m.quantity.toNumber(),
      reason: m.reason,
      costBasisMinor: m.costBasisMinor?.toNumber() ?? null,
      sellingValueMinor: m.sellingValueMinor?.toNumber() ?? null,
      isEstimated: m.isEstimated,
      staffMemberId: m.staffMemberId,
      occurredAt: m.occurredAt,
    })),
  ];
}

export type NonSalesMovementLineWithLocation = NonSalesMovementLine & { locationId: string };

// Ticket 45 — Activity's movement rows: wastage/consumption/complimentary,
// across both locations in a period. Deliberately excludes reason
// "corrected" — that reason is shared by two unrelated origins (an
// owner's stock-count correction, and voidSale's own stock reversal,
// which already gets its own "void" Activity row) with nothing on the
// StockMovement itself to tell them apart. A genuine count correction is
// read from StockCountLine.correctedAt/correctedBy instead (see
// getActivity), which unambiguously means "the owner corrected a count."
export async function findAllNonSalesMovementsInPeriod(
  db: PrismaClient,
  periodStart: Date,
  periodEnd: Date,
): Promise<NonSalesMovementLineWithLocation[]> {
  const reasons: StockMovementReason[] = ["wasted", "consumed", "given_away"];

  const [productMovements, ingredientMovements] = await Promise.all([
    db.stockMovement.findMany({
      where: { reason: { in: reasons }, occurredAt: { gt: periodStart, lte: periodEnd }, reversed: false },
      select: {
        id: true,
        productId: true,
        locationId: true,
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
      where: { reason: { in: reasons }, occurredAt: { gt: periodStart, lte: periodEnd }, reversed: false },
      select: {
        id: true,
        ingredientId: true,
        locationId: true,
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
      movementId: m.id,
      itemId: m.productId,
      locationId: m.locationId,
      quantity: m.quantity.toNumber(),
      reason: m.reason,
      costBasisMinor: m.costBasisMinor?.toNumber() ?? null,
      sellingValueMinor: m.sellingValueMinor?.toNumber() ?? null,
      isEstimated: m.isEstimated,
      staffMemberId: m.staffMemberId,
      occurredAt: m.occurredAt,
    })),
    ...ingredientMovements.map((m) => ({
      itemType: "ingredient" as const,
      movementId: m.id,
      itemId: m.ingredientId,
      locationId: m.locationId,
      quantity: m.quantity.toNumber(),
      reason: m.reason,
      costBasisMinor: m.costBasisMinor?.toNumber() ?? null,
      sellingValueMinor: m.sellingValueMinor?.toNumber() ?? null,
      isEstimated: m.isEstimated,
      staffMemberId: m.staffMemberId,
      occurredAt: m.occurredAt,
    })),
  ];
}

// Ticket 45 — Activity's count rows, across both locations in a period.
export async function listStockCountsInPeriod(
  db: PrismaClient,
  periodStart: Date,
  periodEnd: Date,
): Promise<StockCount[]> {
  const counts = await db.stockCount.findMany({
    where: { occurredAt: { gt: periodStart, lte: periodEnd } },
    include: { lines: true },
    orderBy: { occurredAt: "asc" },
  });
  return counts.map(toStockCount);
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
  return count && toStockCount(count);
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
  return toStockCount(count);
}

export async function findStockCountById(
  db: PrismaClient,
  stockCountId: string,
): Promise<StockCount | null> {
  const count = await db.stockCount.findUnique({
    where: { id: stockCountId },
    include: { lines: true },
  });
  return count && toStockCount(count);
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
  return count && toStockCount(count);
}

// Added 2026-08-13 — REQ-02 Part A. A transfer starts life here, pending,
// with no incoming movement written yet — see prisma/schema.prisma's
// Transfer model comment for why the receiving side's stock must not
// move until confirmed.
export async function createPendingTransfer(
  db: PrismaClient,
  data: {
    fromLocationId: string;
    toLocationId: string;
    itemType: TransferItemType;
    itemId: string;
    sentQuantity: number;
    sentByStaffMemberId: string;
    reversedTransferId?: string;
  },
): Promise<Transfer> {
  const row = await db.transfer.create({ data });
  return toTransfer(row);
}

export async function findTransferById(db: PrismaClient, id: string): Promise<Transfer | null> {
  const row = await db.transfer.findUnique({ where: { id } });
  return row && toTransfer(row);
}

// The receiving screen's queue — every transfer sent to this location
// that hasn't been confirmed yet, oldest first (the one waiting longest
// is the one most worth surfacing).
export async function findPendingTransfersAtLocation(
  db: PrismaClient,
  toLocationId: string,
): Promise<PendingTransferForReader[]> {
  const transfers = await db.transfer.findMany({
    where: { toLocationId, status: "pending" },
    orderBy: { sentAt: "asc" },
  });
  if (transfers.length === 0) return [];

  const productIds = transfers.filter((t) => t.itemType === "product").map((t) => t.itemId);
  const ingredientIds = transfers.filter((t) => t.itemType === "ingredient").map((t) => t.itemId);
  const [products, ingredients] = await Promise.all([
    productIds.length > 0
      ? db.product.findMany({ where: { id: { in: productIds } } })
      : Promise.resolve([]),
    ingredientIds.length > 0
      ? db.ingredient.findMany({ where: { id: { in: ingredientIds } } })
      : Promise.resolve([]),
  ]);
  const nameById = new Map([
    ...products.map((p) => [p.id, p.name] as const),
    ...ingredients.map((i) => [i.id, i.name] as const),
  ]);

  return transfers.map((t) => ({ ...toTransfer(t), itemName: nameById.get(t.itemId) ?? "Unknown item" }));
}

// 2026-08-13 canteen redesign, item 4: the sender's reconciliation view —
// transfers they sent that have since been confirmed, so a store manager
// can see whether the canteen's receipt matched what she sent without
// digging through transfer-history.tsx (which still reconstructs from
// movements, not the Transfer model — see item 5's note). Most recently
// confirmed first, since a fresh shortfall is the one worth noticing.
export async function findConfirmedTransfersSentFromLocation(
  db: PrismaClient,
  fromLocationId: string,
): Promise<PendingTransferForReader[]> {
  const transfers = await db.transfer.findMany({
    where: { fromLocationId, status: "confirmed" },
    orderBy: { confirmedAt: "desc" },
    take: 20,
  });
  if (transfers.length === 0) return [];

  const productIds = transfers.filter((t) => t.itemType === "product").map((t) => t.itemId);
  const ingredientIds = transfers.filter((t) => t.itemType === "ingredient").map((t) => t.itemId);
  const [products, ingredients] = await Promise.all([
    productIds.length > 0
      ? db.product.findMany({ where: { id: { in: productIds } } })
      : Promise.resolve([]),
    ingredientIds.length > 0
      ? db.ingredient.findMany({ where: { id: { in: ingredientIds } } })
      : Promise.resolve([]),
  ]);
  const nameById = new Map([
    ...products.map((p) => [p.id, p.name] as const),
    ...ingredients.map((i) => [i.id, i.name] as const),
  ]);

  return transfers.map((t) => ({ ...toTransfer(t), itemName: nameById.get(t.itemId) ?? "Unknown item" }));
}

// 2026-08-13 — history view's source of truth. Reads the Transfer model
// directly (status, sentQuantity, confirmedQuantity) rather than
// reconstructing from movement pairs, since a pending transfer only ever
// writes the sender's outgoing movement — see gotchas.md.
export async function findTransfersInvolvingLocation(db: PrismaClient, locationId: string): Promise<Transfer[]> {
  const rows = await db.transfer.findMany({
    where: { OR: [{ fromLocationId: locationId }, { toLocationId: locationId }] },
    orderBy: { sentAt: "desc" },
  });
  return rows.map(toTransfer);
}

// Confirmation writes the incoming movement (at the confirmed quantity,
// which may be less than what was sent) and marks the transfer confirmed,
// atomically. The caller (stock/logic.ts's confirmTransfer) is
// responsible for the transfer_shortfall movement on a short receipt —
// kept as a separate createStockMovement/createIngredientMovement call
// rather than folded in here, since not every confirmation has a
// shortfall to write.
export async function markTransferConfirmed(
  db: PrismaClient,
  id: string,
  data: { confirmedQuantity: number; confirmedByStaffMemberId: string },
): Promise<Transfer> {
  const row = await db.transfer.update({
    where: { id },
    data: {
      status: "confirmed",
      confirmedQuantity: data.confirmedQuantity,
      confirmedByStaffMemberId: data.confirmedByStaffMemberId,
      confirmedAt: new Date(),
    },
  });
  return toTransfer(row);
}

export async function markTransferCancelled(
  db: PrismaClient,
  id: string,
  cancelledByStaffMemberId: string,
): Promise<Transfer> {
  const row = await db.transfer.update({
    where: { id },
    data: { status: "cancelled", cancelledByStaffMemberId, cancelledAt: new Date() },
  });
  return toTransfer(row);
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

/**
 * Editable-ledger T8 — every ingredient movement at a location up to a
 * date, in order, for rebuilding the cost layers as they stood then.
 *
 * `unitCostMinor` is snapshotted per delivery and never rewritten, so the
 * cost in force at any past instant is derivable from the deliveries up to
 * that instant. That is the whole reason historical valuation is possible
 * without storing a cost history table.
 *
 * Ordered oldest-first because the replay is order-dependent: stock leaving
 * draws down the oldest delivery first (formulas.md §3).
 */
export async function findIngredientMovementsAtLocationAsOf(
  db: Db,
  locationId: string,
  asOf: Date,
): Promise<{ ingredientId: string; quantity: number; reason: string; unitCostMinor: number | null }[]> {
  const rows = await db.ingredientMovement.findMany({
    where: { locationId, occurredAt: { lte: asOf }, reversed: false },
    orderBy: { occurredAt: "asc" },
    select: { ingredientId: true, quantity: true, reason: true, unitCostMinor: true },
  });
  return rows.map((r) => ({
    ingredientId: r.ingredientId,
    quantity: r.quantity.toNumber(),
    reason: r.reason,
    unitCostMinor: r.unitCostMinor?.toNumber() ?? null,
  }));
}

/**
 * The price paid on the last delivery *before* `before`, per ingredient —
 * the Store ledger's "previous unit cost" column.
 *
 * Under formulas.md §3's latest-price-wins rule this is a real recorded
 * figure, read straight off the delivery that set it. It used to be
 * reconstructed algebraically by un-averaging the current cost, which only
 * worked because a weighted average is linear and kept no history.
 */
export async function findPreviousDeliveryCostByIngredientAtLocation(
  db: Db,
  locationId: string,
  before: Date,
): Promise<Map<string, number>> {
  const rows = await db.ingredientMovement.findMany({
    where: {
      locationId,
      reason: "received",
      occurredAt: { lte: before },
      reversed: false,
      unitCostMinor: { not: null },
    },
    orderBy: { occurredAt: "asc" },
    select: { ingredientId: true, unitCostMinor: true },
  });
  // Oldest-first, so the last write per ingredient is the most recent.
  const byIngredient = new Map<string, number>();
  for (const r of rows) {
    if (r.unitCostMinor != null) byIngredient.set(r.ingredientId, r.unitCostMinor.toNumber());
  }
  return byIngredient;
}

/**
 * Editable-ledger T8 — the cost of goods actually sold in a period, per
 * product, taken from each `sold` movement's snapshotted costBasisMinor.
 *
 * This is the historical figure: the cost that was in force at the moment
 * of each sale, frozen then and never rewritten. The ledger prefers it
 * over `resolveProductCostBasis`'s *current* cost precisely so that
 * editing a price today cannot reshape a closed period's cost of goods
 * sold (plan §3.4).
 *
 * `snapshotted` reports how many of the period's sold units carry a
 * snapshot, so the caller can tell "no sales" from "sales predating the
 * snapshot" — movements written before T8 have no costBasisMinor, and
 * silently valuing those at zero would understate cost of goods sold.
 */
export async function sumSoldCostBasisByProductAtLocationInPeriod(
  db: Db,
  locationId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<{ productId: string; costBasisMinor: number; snapshottedQuantity: number }[]> {
  const rows = await db.stockMovement.findMany({
    where: {
      locationId,
      reason: "sold",
      occurredAt: { gt: periodStart, lte: periodEnd },
      reversed: false,
    },
    select: { productId: true, quantity: true, costBasisMinor: true },
  });

  const byProduct = new Map<string, { costBasisMinor: number; snapshottedQuantity: number }>();
  for (const row of rows) {
    if (row.costBasisMinor == null) continue;
    const existing = byProduct.get(row.productId) ?? { costBasisMinor: 0, snapshottedQuantity: 0 };
    existing.costBasisMinor += row.costBasisMinor.toNumber();
    existing.snapshottedQuantity += Math.abs(row.quantity.toNumber());
    byProduct.set(row.productId, existing);
  }
  return Array.from(byProduct.entries()).map(([productId, v]) => ({ productId, ...v }));
}
