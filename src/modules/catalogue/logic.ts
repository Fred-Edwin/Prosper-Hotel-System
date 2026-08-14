import type { PrismaClient } from "@/generated/prisma/client";
import type { AuthenticatedStaff } from "@/modules/people";
import { findExpenseById } from "@/modules/cash";
import { findLocationById } from "@/modules/people";
import {
  createAssetRecord,
  createCategoryRecord,
  createIngredientRecord,
  createProductRecord,
  createRecipeRecord,
  findAssetById,
  findAssetByNameAndLocation,
  findCategoryById,
  findCategoryByName,
  findIngredientById,
  findIngredientByName,
  findIngredientsByIds,
  findProductById,
  findProductByName,
  findRecipeInForceAt,
  incrementAssetQuantity,
  listRecipeVersionsByProduct,
  setAssetExpenseId,
  setAssetQuantity,
  setAssetRetired,
  setCategoryActive,
  setIngredientActive,
  setIngredientLastKnownCost,
  setProductActive,
  setProductLastKnownCost,
  updateCategoryRecord,
  updateIngredientRecord,
  updateProductRecord,
} from "./queries";
import type { Asset, Category, Ingredient, Product, ProductKind, Recipe, RecipeWithCost } from "./schema";

type WriteResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: "forbidden" | "duplicate_name" | "not_found" };

type ProductWriteResult<T> =
  | { ok: true; value: T }
  | {
      ok: false;
      reason: "forbidden" | "duplicate_name" | "not_found" | "invalid_category" | "invalid_location";
    };

type RecipeWriteResult<T> =
  | { ok: true; value: T }
  | {
      ok: false;
      reason: "forbidden" | "not_found" | "invalid_ingredients" | "invalid_recipe";
    };

function requireOwner(requester: AuthenticatedStaff): boolean {
  return requester.staff.role === "owner";
}

export async function createProduct(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  input: {
    name: string;
    kind: ProductKind;
    priceMinor?: number | null;
    categoryId?: string | null;
    locationId: string;
  },
): Promise<ProductWriteResult<Product>> {
  if (!requireOwner(requester)) return { ok: false, reason: "forbidden" };

  const existing = await findProductByName(db, input.name);
  if (existing) return { ok: false, reason: "duplicate_name" };

  if (input.categoryId) {
    const category = await findCategoryById(db, input.categoryId);
    if (!category) return { ok: false, reason: "invalid_category" };
  }

  const location = await findLocationById(db, input.locationId);
  if (!location) return { ok: false, reason: "invalid_location" };

  const product = await createProductRecord(db, {
    name: input.name,
    kind: input.kind,
    priceMinor: input.priceMinor ?? null,
    categoryId: input.categoryId ?? null,
    locationId: input.locationId,
  });
  return { ok: true, value: product };
}

export async function updateProduct(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  id: string,
  input: {
    name: string;
    kind: ProductKind;
    priceMinor?: number | null;
    categoryId?: string | null;
    lowStockLevel?: number | null;
    locationId: string;
  },
): Promise<ProductWriteResult<Product>> {
  if (!requireOwner(requester)) return { ok: false, reason: "forbidden" };

  const current = await findProductById(db, id);
  if (!current) return { ok: false, reason: "not_found" };

  if (input.name !== current.name) {
    const existing = await findProductByName(db, input.name);
    if (existing) return { ok: false, reason: "duplicate_name" };
  }

  if (input.categoryId) {
    const category = await findCategoryById(db, input.categoryId);
    if (!category) return { ok: false, reason: "invalid_category" };
  }

  const location = await findLocationById(db, input.locationId);
  if (!location) return { ok: false, reason: "invalid_location" };

  const product = await updateProductRecord(db, id, {
    name: input.name,
    kind: input.kind,
    priceMinor: input.priceMinor ?? null,
    categoryId: input.categoryId ?? null,
    lowStockLevel: input.lowStockLevel ?? null,
    locationId: input.locationId,
  });
  return { ok: true, value: product };
}

export async function deactivateProduct(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  id: string,
): Promise<WriteResult<Product>> {
  if (!requireOwner(requester)) return { ok: false, reason: "forbidden" };

  const current = await findProductById(db, id);
  if (!current) return { ok: false, reason: "not_found" };

  return { ok: true, value: await setProductActive(db, id, false) };
}

export async function reactivateProduct(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  id: string,
): Promise<WriteResult<Product>> {
  if (!requireOwner(requester)) return { ok: false, reason: "forbidden" };

  const current = await findProductById(db, id);
  if (!current) return { ok: false, reason: "not_found" };

  return { ok: true, value: await setProductActive(db, id, true) };
}

export async function createIngredient(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  input: { name: string; unitOfMeasure: string; lastKnownCostMinor?: number | null },
): Promise<WriteResult<Ingredient>> {
  if (!requireOwner(requester)) return { ok: false, reason: "forbidden" };

  const existing = await findIngredientByName(db, input.name);
  if (existing) return { ok: false, reason: "duplicate_name" };

  const ingredient = await createIngredientRecord(db, {
    name: input.name,
    unitOfMeasure: input.unitOfMeasure,
    lastKnownCostMinor: input.lastKnownCostMinor ?? null,
  });
  return { ok: true, value: ingredient };
}

export async function updateIngredient(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  id: string,
  input: {
    name: string;
    unitOfMeasure: string;
    lastKnownCostMinor?: number | null;
    lowStockLevel?: number | null;
  },
): Promise<WriteResult<Ingredient>> {
  if (!requireOwner(requester)) return { ok: false, reason: "forbidden" };

  const current = await findIngredientById(db, id);
  if (!current) return { ok: false, reason: "not_found" };

  if (input.name !== current.name) {
    const existing = await findIngredientByName(db, input.name);
    if (existing) return { ok: false, reason: "duplicate_name" };
  }

  const ingredient = await updateIngredientRecord(db, id, {
    name: input.name,
    lowStockLevel: input.lowStockLevel ?? null,
    unitOfMeasure: input.unitOfMeasure,
    lastKnownCostMinor: input.lastKnownCostMinor ?? null,
  });
  return { ok: true, value: ingredient };
}

export async function deactivateIngredient(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  id: string,
): Promise<WriteResult<Ingredient>> {
  if (!requireOwner(requester)) return { ok: false, reason: "forbidden" };

  const current = await findIngredientById(db, id);
  if (!current) return { ok: false, reason: "not_found" };

  return { ok: true, value: await setIngredientActive(db, id, false) };
}

export async function reactivateIngredient(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  id: string,
): Promise<WriteResult<Ingredient>> {
  if (!requireOwner(requester)) return { ok: false, reason: "forbidden" };

  const current = await findIngredientById(db, id);
  if (!current) return { ok: false, reason: "not_found" };

  return { ok: true, value: await setIngredientActive(db, id, true) };
}

export async function createCategory(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  input: { name: string },
): Promise<WriteResult<Category>> {
  if (!requireOwner(requester)) return { ok: false, reason: "forbidden" };

  const existing = await findCategoryByName(db, input.name);
  if (existing) return { ok: false, reason: "duplicate_name" };

  const category = await createCategoryRecord(db, { name: input.name });
  return { ok: true, value: category };
}

export async function updateCategory(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  id: string,
  input: { name: string },
): Promise<WriteResult<Category>> {
  if (!requireOwner(requester)) return { ok: false, reason: "forbidden" };

  const current = await findCategoryById(db, id);
  if (!current) return { ok: false, reason: "not_found" };

  if (input.name !== current.name) {
    const existing = await findCategoryByName(db, input.name);
    if (existing) return { ok: false, reason: "duplicate_name" };
  }

  const category = await updateCategoryRecord(db, id, { name: input.name });
  return { ok: true, value: category };
}

export async function deactivateCategory(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  id: string,
): Promise<WriteResult<Category>> {
  if (!requireOwner(requester)) return { ok: false, reason: "forbidden" };

  const current = await findCategoryById(db, id);
  if (!current) return { ok: false, reason: "not_found" };

  return { ok: true, value: await setCategoryActive(db, id, false) };
}

export async function reactivateCategory(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  id: string,
): Promise<WriteResult<Category>> {
  if (!requireOwner(requester)) return { ok: false, reason: "forbidden" };

  const current = await findCategoryById(db, id);
  if (!current) return { ok: false, reason: "not_found" };

  return { ok: true, value: await setCategoryActive(db, id, true) };
}

// formulas.md §3: "flour was bought three times at three prices — what is
// it worth now?" — a running average recalculated on every delivery:
//   new average = (qty on hand × current average + qty bought × price paid)
//                 ÷ (qty on hand + qty bought)
// Where nothing is on hand yet (or no average is known), the new average is
// simply the price just paid. Rounded to cents (2dp), matching storage
// precision (Decimal(10,2)) — not whole shillings, which would silently
// discard the cent-level precision real delivery prices carry.
function runningAverageMinor(input: {
  quantityOnHand: number;
  currentAverageMinor: number | null;
  quantityBought: number;
  unitCostMinor: number;
}): number {
  const { quantityOnHand, currentAverageMinor, quantityBought, unitCostMinor } = input;
  if (quantityOnHand <= 0 || currentAverageMinor == null) return unitCostMinor;

  const totalValue = quantityOnHand * currentAverageMinor + quantityBought * unitCostMinor;
  return Math.round((totalValue / (quantityOnHand + quantityBought)) * 100) / 100;
}

// Deliberately not owner-gated, unlike updateIngredient: this only records
// the price paid on a delivery (a frequent store-manager/attendant action,
// like createCustomer), never the ingredient's name or unit of measure —
// those stay an admin edit through updateIngredient.
export async function recordIngredientCost(
  db: PrismaClient,
  _requester: AuthenticatedStaff,
  id: string,
  input: { quantityOnHand: number; quantityBought: number; unitCostMinor: number },
): Promise<WriteResult<Ingredient>> {
  const current = await findIngredientById(db, id);
  if (!current) return { ok: false, reason: "not_found" };

  const newAverage = runningAverageMinor({
    quantityOnHand: input.quantityOnHand,
    currentAverageMinor: current.lastKnownCostMinor,
    quantityBought: input.quantityBought,
    unitCostMinor: input.unitCostMinor,
  });

  return { ok: true, value: await setIngredientLastKnownCost(db, id, newAverage) };
}

// Mirrors recordIngredientCost — same running average (formulas.md §3),
// same not-owner-gated reasoning, applied to purchased goods (Product)
// instead of Ingredient. Cooked food's cost still comes from Recipe, never
// this path.
export async function recordProductCost(
  db: PrismaClient,
  _requester: AuthenticatedStaff,
  id: string,
  input: { quantityOnHand: number; quantityBought: number; unitCostMinor: number },
): Promise<WriteResult<Product>> {
  const current = await findProductById(db, id);
  if (!current) return { ok: false, reason: "not_found" };

  const newAverage = runningAverageMinor({
    quantityOnHand: input.quantityOnHand,
    currentAverageMinor: current.lastKnownCostMinor,
    quantityBought: input.quantityBought,
    unitCostMinor: input.unitCostMinor,
  });

  return { ok: true, value: await setProductLastKnownCost(db, id, newAverage) };
}

export async function createRecipe(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  input: {
    productId: string;
    yieldQuantity: number;
    lines: { ingredientId: string; quantity: number }[];
    effectiveFrom?: Date;
  },
): Promise<RecipeWriteResult<Recipe>> {
  if (!requireOwner(requester)) return { ok: false, reason: "forbidden" };

  if (input.lines.length === 0 || input.yieldQuantity <= 0) {
    return { ok: false, reason: "invalid_recipe" };
  }

  const product = await findProductById(db, input.productId);
  if (!product || product.kind !== "cooked_food" || !product.active) {
    return { ok: false, reason: "not_found" };
  }

  const ingredients = await findIngredientsByIds(
    db,
    input.lines.map((line) => line.ingredientId),
  );
  const allActive = input.lines.every((line) =>
    ingredients.some((ingredient) => ingredient.id === line.ingredientId && ingredient.active),
  );
  if (!allActive) return { ok: false, reason: "invalid_ingredients" };

  const recipe = await createRecipeRecord(db, {
    productId: input.productId,
    yieldQuantity: input.yieldQuantity,
    effectiveFrom: input.effectiveFrom ?? new Date(),
    lines: input.lines,
  });
  return { ok: true, value: recipe };
}

// ADR 0005: computed on read, never stored — recipes are a cost/yield
// source only and must never become a stored COGS figure.
async function withPerUnitCost(
  db: PrismaClient,
  recipe: Recipe,
): Promise<RecipeWithCost> {
  const ingredients = await findIngredientsByIds(
    db,
    recipe.lines.map((line) => line.ingredientId),
  );

  let totalCostMinor = 0;
  for (const line of recipe.lines) {
    const cost = ingredients.find((i) => i.id === line.ingredientId)?.lastKnownCostMinor;
    if (cost == null) return { ...recipe, perUnitCostMinor: null };
    totalCostMinor += cost * line.quantity;
  }

  return {
    ...recipe,
    perUnitCostMinor: Math.round((totalCostMinor / recipe.yieldQuantity) * 100) / 100,
  };
}

export async function getCurrentRecipe(
  db: PrismaClient,
  productId: string,
): Promise<RecipeWithCost | null> {
  const recipe = await findRecipeInForceAt(db, productId, new Date());
  if (!recipe) return null;
  return withPerUnitCost(db, recipe);
}

export async function getRecipeAt(
  db: PrismaClient,
  productId: string,
  at: Date,
): Promise<RecipeWithCost | null> {
  const recipe = await findRecipeInForceAt(db, productId, at);
  if (!recipe) return null;
  return withPerUnitCost(db, recipe);
}

export async function listRecipeVersions(
  db: PrismaClient,
  productId: string,
): Promise<Recipe[]> {
  return listRecipeVersionsByProduct(db, productId);
}

type AssetWriteResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: "forbidden" | "not_found" | "invalid_expense" };

// docs/scope.md "Asset register": one register row per asset type per
// location — a repeat purchase accumulates into the existing row's
// quantity rather than creating a duplicate.
export async function createAsset(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  input: { name: string; locationId: string; quantity: number; expenseId?: string | null },
): Promise<AssetWriteResult<Asset>> {
  if (!requireOwner(requester)) return { ok: false, reason: "forbidden" };

  if (input.expenseId) {
    const expense = await findExpenseById(db, input.expenseId);
    if (!expense || expense.category !== "asset") {
      return { ok: false, reason: "invalid_expense" };
    }
  }

  const existing = await findAssetByNameAndLocation(db, input.name, input.locationId);
  if (existing) {
    return { ok: true, value: await incrementAssetQuantity(db, existing.id, input.quantity) };
  }

  const asset = await createAssetRecord(db, {
    name: input.name,
    locationId: input.locationId,
    quantity: input.quantity,
    expenseId: input.expenseId ?? null,
  });
  return { ok: true, value: asset };
}

// Sets quantity to the given value directly — distinct from createAsset's
// accumulate-on-repeat-purchase behavior, which only applies when
// recording a new purchase, not when correcting the figure on an edit.
export async function updateAssetQuantity(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  id: string,
  quantity: number,
): Promise<AssetWriteResult<Asset>> {
  if (!requireOwner(requester)) return { ok: false, reason: "forbidden" };

  const current = await findAssetById(db, id);
  if (!current) return { ok: false, reason: "not_found" };

  return { ok: true, value: await setAssetQuantity(db, id, quantity) };
}

export async function linkAssetExpense(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  id: string,
  expenseId: string,
): Promise<AssetWriteResult<Asset>> {
  if (!requireOwner(requester)) return { ok: false, reason: "forbidden" };

  const current = await findAssetById(db, id);
  if (!current) return { ok: false, reason: "not_found" };

  const expense = await findExpenseById(db, expenseId);
  if (!expense || expense.category !== "asset") {
    return { ok: false, reason: "invalid_expense" };
  }

  return { ok: true, value: await setAssetExpenseId(db, id, expenseId) };
}

// Filter-only soft delete — deliberately not the visible active/dimmed
// pattern deactivateIngredient/deactivateProduct use. The row is kept, but
// listAssets excludes it and there is no reactivation path (not asked for).
export async function retireAsset(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  id: string,
): Promise<AssetWriteResult<Asset>> {
  if (!requireOwner(requester)) return { ok: false, reason: "forbidden" };

  const current = await findAssetById(db, id);
  if (!current) return { ok: false, reason: "not_found" };

  return { ok: true, value: await setAssetRetired(db, id) };
}
