import type { PrismaClient } from "@/generated/prisma/client";
import type { Asset, Category, Ingredient, Product, ProductKind, Recipe } from "./schema";

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
  data: { name: string; kind: ProductKind; priceMinor: number | null; categoryId: string | null },
): Promise<Product> {
  return db.product.create({ data });
}

export async function updateProductRecord(
  db: PrismaClient,
  id: string,
  data: { name: string; kind: ProductKind; priceMinor: number | null; categoryId: string | null },
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

export async function findIngredientsByIds(
  db: PrismaClient,
  ids: string[],
): Promise<Ingredient[]> {
  return db.ingredient.findMany({ where: { id: { in: ids } } });
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

export async function setIngredientLastKnownCost(
  db: PrismaClient,
  id: string,
  lastKnownCostMinor: number,
): Promise<Ingredient> {
  return db.ingredient.update({ where: { id }, data: { lastKnownCostMinor } });
}

export async function listCategories(db: PrismaClient): Promise<Category[]> {
  return db.category.findMany({ orderBy: { name: "asc" } });
}

export async function findCategoryByName(
  db: PrismaClient,
  name: string,
): Promise<Category | null> {
  return db.category.findUnique({ where: { name } });
}

export async function findCategoryById(db: PrismaClient, id: string): Promise<Category | null> {
  return db.category.findUnique({ where: { id } });
}

export async function createCategoryRecord(db: PrismaClient, data: { name: string }): Promise<Category> {
  return db.category.create({ data });
}

export async function updateCategoryRecord(
  db: PrismaClient,
  id: string,
  data: { name: string },
): Promise<Category> {
  return db.category.update({ where: { id }, data });
}

export async function setCategoryActive(
  db: PrismaClient,
  id: string,
  active: boolean,
): Promise<Category> {
  return db.category.update({ where: { id }, data: { active } });
}

export async function setProductLastKnownCost(
  db: PrismaClient,
  id: string,
  lastKnownCostMinor: number,
): Promise<Product> {
  return db.product.update({ where: { id }, data: { lastKnownCostMinor } });
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

// Excludes retired assets — the ticket's filter-only soft delete, applied
// at the query layer so no caller can accidentally see a retired row.
export async function listActiveAssets(db: PrismaClient): Promise<Asset[]> {
  return db.asset.findMany({ where: { retiredAt: null }, orderBy: { name: "asc" } });
}

export async function findAssetById(db: PrismaClient, id: string): Promise<Asset | null> {
  return db.asset.findUnique({ where: { id } });
}

export async function findAssetByNameAndLocation(
  db: PrismaClient,
  name: string,
  locationId: string,
): Promise<Asset | null> {
  return db.asset.findUnique({ where: { name_locationId: { name, locationId } } });
}

export async function createAssetRecord(
  db: PrismaClient,
  data: { name: string; locationId: string; quantity: number; expenseId: string | null },
): Promise<Asset> {
  return db.asset.create({ data });
}

export async function incrementAssetQuantity(
  db: PrismaClient,
  id: string,
  by: number,
): Promise<Asset> {
  return db.asset.update({ where: { id }, data: { quantity: { increment: by } } });
}

export async function setAssetQuantity(
  db: PrismaClient,
  id: string,
  quantity: number,
): Promise<Asset> {
  return db.asset.update({ where: { id }, data: { quantity } });
}

export async function setAssetExpenseId(
  db: PrismaClient,
  id: string,
  expenseId: string,
): Promise<Asset> {
  return db.asset.update({ where: { id }, data: { expenseId } });
}

export async function setAssetRetired(db: PrismaClient, id: string): Promise<Asset> {
  return db.asset.update({ where: { id }, data: { retiredAt: new Date() } });
}
