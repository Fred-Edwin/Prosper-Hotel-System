import type { PrismaClient } from "@/generated/prisma/client";
import type { Product } from "./schema";

export async function listProducts(db: PrismaClient): Promise<Product[]> {
  return db.product.findMany({ orderBy: { name: "asc" } });
}

export async function findProductsByIds(
  db: PrismaClient,
  ids: string[],
): Promise<Product[]> {
  return db.product.findMany({ where: { id: { in: ids } } });
}
