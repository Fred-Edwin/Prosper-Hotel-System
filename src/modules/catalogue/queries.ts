import type {
  Prisma,
  PrismaClient,
  Product as PrismaProduct,
  Ingredient as PrismaIngredient,
  Recipe as PrismaRecipe,
  RecipeLine as PrismaRecipeLine,
  Asset as PrismaAsset,
} from "@/generated/prisma/client";
import type { Asset, Category, Ingredient, Product, ProductKind, Recipe } from "./schema";

// Read paths called from inside a db.$transaction — stock's
// recordStockMovement snapshots a sale's cost basis mid-transaction.
// Prisma's transaction client is a distinct, near-identical type; same
// convention as stock/queries.ts.
type Db = PrismaClient | Prisma.TransactionClient;

// Prisma returns Decimal fields as Decimal.js objects, not plain numbers.
// Every quantity/threshold/money field is converted to a number at this
// boundary so the rest of the app (logic.ts, routes.ts, UI) keeps working
// with plain numbers exactly as before the Int -> Decimal(10,2) migrations.
function toProduct(row: PrismaProduct): Product {
  return {
    ...row,
    priceMinor: row.priceMinor?.toNumber() ?? null,
    lastKnownCostMinor: row.lastKnownCostMinor?.toNumber() ?? null,
    lowStockLevel: row.lowStockLevel?.toNumber() ?? null,
  };
}

function toIngredient(row: PrismaIngredient): Ingredient {
  return {
    ...row,
    lastKnownCostMinor: row.lastKnownCostMinor?.toNumber() ?? null,
    lowStockLevel: row.lowStockLevel?.toNumber() ?? null,
  };
}

function toRecipeLine(row: PrismaRecipeLine): { ingredientId: string; quantity: number } {
  return { ingredientId: row.ingredientId, quantity: row.quantity.toNumber() };
}

function toRecipe(row: PrismaRecipe & { lines: PrismaRecipeLine[] }): Recipe {
  return {
    ...row,
    yieldQuantity: row.yieldQuantity.toNumber(),
    lines: row.lines.map(toRecipeLine),
  };
}

function toAsset(row: PrismaAsset): Asset {
  return { ...row, quantity: row.quantity.toNumber() };
}

export async function listProducts(db: PrismaClient): Promise<Product[]> {
  const rows = await db.product.findMany({ orderBy: { name: "asc" } });
  return rows.map(toProduct);
}

export async function findProductsByIds(
  db: Db,
  ids: string[],
): Promise<Product[]> {
  const rows = await db.product.findMany({ where: { id: { in: ids } } });
  return rows.map(toProduct);
}

export async function findProductsAtLocation(
  db: PrismaClient,
  locationId: string,
): Promise<Product[]> {
  const rows = await db.product.findMany({ where: { locationId } });
  return rows.map(toProduct);
}

export async function findProductByName(
  db: PrismaClient,
  name: string,
): Promise<Product | null> {
  const row = await db.product.findUnique({ where: { name } });
  return row && toProduct(row);
}

export async function findProductById(
  db: PrismaClient,
  id: string,
): Promise<Product | null> {
  const row = await db.product.findUnique({ where: { id } });
  return row && toProduct(row);
}

export async function createProductRecord(
  db: PrismaClient,
  data: {
    name: string;
    kind: ProductKind;
    priceMinor: number | null;
    lastKnownCostMinor: number | null;
    categoryId: string | null;
    locationId: string;
  },
): Promise<Product> {
  const row = await db.product.create({ data });
  return toProduct(row);
}

export async function updateProductRecord(
  db: PrismaClient,
  id: string,
  data: {
    name: string;
    kind: ProductKind;
    priceMinor: number | null;
    lastKnownCostMinor: number | null;
    categoryId: string | null;
    lowStockLevel: number | null;
    locationId: string;
  },
): Promise<Product> {
  const row = await db.product.update({ where: { id }, data });
  return toProduct(row);
}

export async function setProductActive(
  db: PrismaClient,
  id: string,
  active: boolean,
): Promise<Product> {
  const row = await db.product.update({ where: { id }, data: { active } });
  return toProduct(row);
}

export async function listIngredients(db: PrismaClient): Promise<Ingredient[]> {
  const rows = await db.ingredient.findMany({ orderBy: { name: "asc" } });
  return rows.map(toIngredient);
}

export async function findIngredientByName(
  db: PrismaClient,
  name: string,
): Promise<Ingredient | null> {
  const row = await db.ingredient.findUnique({ where: { name } });
  return row && toIngredient(row);
}

export async function findIngredientById(
  db: PrismaClient,
  id: string,
): Promise<Ingredient | null> {
  const row = await db.ingredient.findUnique({ where: { id } });
  return row && toIngredient(row);
}

export async function findIngredientsByIds(
  db: Db,
  ids: string[],
): Promise<Ingredient[]> {
  const rows = await db.ingredient.findMany({ where: { id: { in: ids } } });
  return rows.map(toIngredient);
}

export async function createIngredientRecord(
  db: PrismaClient,
  data: { name: string; unitOfMeasure: string; lastKnownCostMinor: number | null },
): Promise<Ingredient> {
  const row = await db.ingredient.create({ data });
  return toIngredient(row);
}

export async function updateIngredientRecord(
  db: PrismaClient,
  id: string,
  data: {
    name: string;
    unitOfMeasure: string;
    lastKnownCostMinor: number | null;
    lowStockLevel: number | null;
  },
): Promise<Ingredient> {
  const row = await db.ingredient.update({ where: { id }, data });
  return toIngredient(row);
}

export async function setIngredientActive(
  db: PrismaClient,
  id: string,
  active: boolean,
): Promise<Ingredient> {
  const row = await db.ingredient.update({ where: { id }, data: { active } });
  return toIngredient(row);
}

export async function setIngredientLastKnownCost(
  db: PrismaClient,
  id: string,
  lastKnownCostMinor: number,
): Promise<Ingredient> {
  const row = await db.ingredient.update({ where: { id }, data: { lastKnownCostMinor } });
  return toIngredient(row);
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
  const row = await db.product.update({ where: { id }, data: { lastKnownCostMinor } });
  return toProduct(row);
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
  const row = await db.recipe.create({
    data: {
      productId: data.productId,
      yieldQuantity: data.yieldQuantity,
      effectiveFrom: data.effectiveFrom,
      lines: { create: data.lines },
    },
    include: { lines: true },
  });
  return toRecipe(row);
}

export async function listRecipeVersionsByProduct(
  db: PrismaClient,
  productId: string,
): Promise<Recipe[]> {
  const rows = await db.recipe.findMany({
    where: { productId },
    include: { lines: true },
    orderBy: { effectiveFrom: "desc" },
  });
  return rows.map(toRecipe);
}

export async function findRecipeInForceAt(
  db: Db,
  productId: string,
  at: Date,
): Promise<Recipe | null> {
  const row = await db.recipe.findFirst({
    where: { productId, effectiveFrom: { lte: at } },
    include: { lines: true },
    orderBy: { effectiveFrom: "desc" },
  });
  return row && toRecipe(row);
}

// Excludes retired assets — the ticket's filter-only soft delete, applied
// at the query layer so no caller can accidentally see a retired row.
export async function listActiveAssets(db: PrismaClient): Promise<Asset[]> {
  const rows = await db.asset.findMany({ where: { retiredAt: null }, orderBy: { name: "asc" } });
  return rows.map(toAsset);
}

export async function findAssetById(db: PrismaClient, id: string): Promise<Asset | null> {
  const row = await db.asset.findUnique({ where: { id } });
  return row && toAsset(row);
}

export async function findAssetByNameAndLocation(
  db: PrismaClient,
  name: string,
  locationId: string,
): Promise<Asset | null> {
  const row = await db.asset.findUnique({ where: { name_locationId: { name, locationId } } });
  return row && toAsset(row);
}

export async function createAssetRecord(
  db: PrismaClient,
  data: { name: string; locationId: string; quantity: number; expenseId: string | null },
): Promise<Asset> {
  const row = await db.asset.create({ data });
  return toAsset(row);
}

export async function incrementAssetQuantity(
  db: PrismaClient,
  id: string,
  by: number,
): Promise<Asset> {
  const row = await db.asset.update({ where: { id }, data: { quantity: { increment: by } } });
  return toAsset(row);
}

export async function setAssetQuantity(
  db: PrismaClient,
  id: string,
  quantity: number,
): Promise<Asset> {
  const row = await db.asset.update({ where: { id }, data: { quantity } });
  return toAsset(row);
}

export async function setAssetExpenseId(
  db: PrismaClient,
  id: string,
  expenseId: string,
): Promise<Asset> {
  const row = await db.asset.update({ where: { id }, data: { expenseId } });
  return toAsset(row);
}

export async function setAssetRetired(db: PrismaClient, id: string): Promise<Asset> {
  const row = await db.asset.update({ where: { id }, data: { retiredAt: new Date() } });
  return toAsset(row);
}
