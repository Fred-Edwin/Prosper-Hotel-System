import type { PrismaClient } from "@/generated/prisma/client";
import type { AuthenticatedStaff } from "@/modules/people";
import {
  createIngredientRecord,
  createProductRecord,
  createRecipeRecord,
  findIngredientById,
  findIngredientByName,
  findIngredientsByIds,
  findProductById,
  findProductByName,
  findRecipeInForceAt,
  listRecipeVersionsByProduct,
  setIngredientActive,
  setProductActive,
  updateIngredientRecord,
  updateProductRecord,
} from "./queries";
import type { Ingredient, Product, ProductKind, Recipe, RecipeWithCost } from "./schema";

type WriteResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: "forbidden" | "duplicate_name" | "not_found" };

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
  input: { name: string; kind: ProductKind; priceMinor?: number | null },
): Promise<WriteResult<Product>> {
  if (!requireOwner(requester)) return { ok: false, reason: "forbidden" };

  const existing = await findProductByName(db, input.name);
  if (existing) return { ok: false, reason: "duplicate_name" };

  const product = await createProductRecord(db, {
    name: input.name,
    kind: input.kind,
    priceMinor: input.priceMinor ?? null,
  });
  return { ok: true, value: product };
}

export async function updateProduct(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  id: string,
  input: { name: string; kind: ProductKind; priceMinor?: number | null },
): Promise<WriteResult<Product>> {
  if (!requireOwner(requester)) return { ok: false, reason: "forbidden" };

  const current = await findProductById(db, id);
  if (!current) return { ok: false, reason: "not_found" };

  if (input.name !== current.name) {
    const existing = await findProductByName(db, input.name);
    if (existing) return { ok: false, reason: "duplicate_name" };
  }

  const product = await updateProductRecord(db, id, {
    name: input.name,
    kind: input.kind,
    priceMinor: input.priceMinor ?? null,
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
  input: { name: string; unitOfMeasure: string; lastKnownCostMinor?: number | null },
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

  return { ...recipe, perUnitCostMinor: Math.round(totalCostMinor / recipe.yieldQuantity) };
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
