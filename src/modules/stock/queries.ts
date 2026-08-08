import type { PrismaClient } from "@/generated/prisma/client";
import type { IngredientMovement, StockMovement, StockMovementReason } from "./schema";

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
  },
): Promise<IngredientMovement> {
  return db.ingredientMovement.create({ data });
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
