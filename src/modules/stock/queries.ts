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
