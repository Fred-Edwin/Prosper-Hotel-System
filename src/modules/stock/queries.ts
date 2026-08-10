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
export async function findReceiptsAtLocation(db: PrismaClient, locationId: string): Promise<Receipt[]> {
  const movements = await db.ingredientMovement.findMany({
    where: { locationId, reason: "received" },
    orderBy: { occurredAt: "desc" },
  });

  const byReceiptId = new Map<string, IngredientMovement[]>();
  for (const movement of movements) {
    const receiptId = movement.receiptId as string;
    const group = byReceiptId.get(receiptId) ?? [];
    group.push(movement);
    byReceiptId.set(receiptId, group);
  }

  return Array.from(byReceiptId.entries()).map(([receiptId, lines]) => ({
    receiptId,
    locationId,
    occurredAt: lines[0].occurredAt,
    totalMinor: lines.reduce((sum, l) => sum + l.quantity * (l.unitCostMinor ?? 0), 0),
    lineCount: lines.length,
  }));
}

export async function findReceiptById(
  db: PrismaClient,
  receiptId: string,
): Promise<{ receiptId: string; locationId: string } | null> {
  const movement = await db.ingredientMovement.findFirst({ where: { receiptId } });
  if (!movement) return null;
  return { receiptId: movement.receiptId as string, locationId: movement.locationId };
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
