import type { PrismaClient } from "@/generated/prisma/client";
import type { IngredientMovement, Receipt, StockMovement, StockMovementReason } from "./schema";

export async function createStockMovement(
  db: PrismaClient,
  data: {
    productId: string;
    locationId: string;
    quantity: number;
    reason: StockMovementReason;
    staffMemberId: string;
  },
): Promise<StockMovement> {
  return db.stockMovement.create({ data });
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

export async function findReceiptsAtLocation(db: PrismaClient, locationId: string): Promise<Receipt[]> {
  const movements = await db.ingredientMovement.findMany({
    where: { locationId, reason: "received" },
    orderBy: { occurredAt: "desc" },
  });

  const byReceiptId = new Map<string, IngredientMovement[]>();
  for (const movement of movements) {
    const group = byReceiptId.get(movement.receiptId) ?? [];
    group.push(movement);
    byReceiptId.set(movement.receiptId, group);
  }

  return Array.from(byReceiptId.entries()).map(([receiptId, lines]) => ({
    receiptId,
    locationId,
    occurredAt: lines[0].occurredAt,
    totalMinor: lines.reduce((sum, l) => sum + l.quantity * l.unitCostMinor, 0),
    lineCount: lines.length,
  }));
}

export async function findReceiptById(
  db: PrismaClient,
  receiptId: string,
): Promise<{ receiptId: string; locationId: string } | null> {
  const movement = await db.ingredientMovement.findFirst({ where: { receiptId } });
  if (!movement) return null;
  return { receiptId: movement.receiptId, locationId: movement.locationId };
}
