import type { PrismaClient } from "@/generated/prisma/client";
import type { Ingredient, Product, ProductKind, Recipe } from "./schema";

export async function listProducts(db: PrismaClient): Promise<Product[]> {
  return db.product.findMany({ orderBy: { name: "asc" } });
}

export async function findProductsByIds(
  db: PrismaClient,
  ids: string[],
): Promise<Product[]> {
  return db.product.findMany({ where: { id: { in: ids } } });
}

export async function findProductByName(
  db: PrismaClient,
  name: string,
): Promise<Product | null> {
  return db.product.findUnique({ where: { name } });
}

export async function findProductById(
  db: PrismaClient,
  id: string,
): Promise<Product | null> {
  return db.product.findUnique({ where: { id } });
}

export async function createProductRecord(
  db: PrismaClient,
  data: { name: string; kind: ProductKind; priceMinor: number | null },
): Promise<Product> {
  return db.product.create({ data });
}

export async function updateProductRecord(
  db: PrismaClient,
  id: string,
  data: { name: string; kind: ProductKind; priceMinor: number | null },
): Promise<Product> {
  return db.product.update({ where: { id }, data });
}

export async function setProductActive(
  db: PrismaClient,
  id: string,
  active: boolean,
): Promise<Product> {
  return db.product.update({ where: { id }, data: { active } });
}

export async function listIngredients(db: PrismaClient): Promise<Ingredient[]> {
  return db.ingredient.findMany({ orderBy: { name: "asc" } });
}

export async function findIngredientByName(
  db: PrismaClient,
  name: string,
): Promise<Ingredient | null> {
  return db.ingredient.findUnique({ where: { name } });
}

export async function findIngredientById(
  db: PrismaClient,
  id: string,
): Promise<Ingredient | null> {
  return db.ingredient.findUnique({ where: { id } });
}

export async function createIngredientRecord(
  db: PrismaClient,
  data: { name: string; unitOfMeasure: string; lastKnownCostMinor: number | null },
): Promise<Ingredient> {
  return db.ingredient.create({ data });
}

export async function updateIngredientRecord(
  db: PrismaClient,
  id: string,
  data: { name: string; unitOfMeasure: string; lastKnownCostMinor: number | null },
): Promise<Ingredient> {
  return db.ingredient.update({ where: { id }, data });
}

export async function setIngredientActive(
  db: PrismaClient,
  id: string,
  active: boolean,
): Promise<Ingredient> {
  return db.ingredient.update({ where: { id }, data: { active } });
}

export async function createRecipeRecord(
  db: PrismaClient,
  data: {
    productId: string;
    yieldQuantity: number;
    effectiveFrom: Date;
    lines: { ingredientId: string; quantity: number }[];
  },
): Promise<Recipe> {
  return db.recipe.create({
    data: {
      productId: data.productId,
      yieldQuantity: data.yieldQuantity,
      effectiveFrom: data.effectiveFrom,
      lines: { create: data.lines },
    },
    include: { lines: true },
  });
}

export async function listRecipeVersionsByProduct(
  db: PrismaClient,
  productId: string,
): Promise<Recipe[]> {
  return db.recipe.findMany({
    where: { productId },
    include: { lines: true },
    orderBy: { effectiveFrom: "desc" },
  });
}

export async function findRecipeInForceAt(
  db: PrismaClient,
  productId: string,
  at: Date,
): Promise<Recipe | null> {
  return db.recipe.findFirst({
    where: { productId, effectiveFrom: { lte: at } },
    include: { lines: true },
    orderBy: { effectiveFrom: "desc" },
  });
}
