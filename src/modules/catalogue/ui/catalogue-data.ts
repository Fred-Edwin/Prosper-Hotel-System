"use client";

/**
 * Fetch layer for the Catalogue destination. One GET populates all four
 * tabs — products, ingredients, every cooked-food product's current
 * recipe, and assets (plus the locations an asset can belong to) — because
 * they are read together on landing and a single owner-gated round trip is
 * cheaper than four.
 */

import type { Asset, Category, Ingredient, Product, Recipe, RecipeWithCost } from "../schema";
import type { Location } from "@/modules/people";

export type RecipeRow = { productId: string; recipe: RecipeWithCost | null };

export type CatalogueState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "denied" }
  | {
      status: "ready";
      products: Product[];
      ingredients: Ingredient[];
      categories: Category[];
      recipes: RecipeRow[];
      assets: Asset[];
      locations: Location[];
    };

// JSON has no Date type — fetch().json() leaves effectiveFrom/createdAt as
// strings, but every caller (VersionHistory, RecipeBuilder) expects a real
// Date. Coerced once here, at the boundary, rather than everywhere a
// Recipe is read.
function parseRecipe<T extends { effectiveFrom: string | Date; createdAt: string | Date }>(
  recipe: T,
): T {
  return { ...recipe, effectiveFrom: new Date(recipe.effectiveFrom), createdAt: new Date(recipe.createdAt) };
}

export function parseRecipeVersions(versions: unknown): Recipe[] {
  if (!Array.isArray(versions)) return [];
  return versions.map(parseRecipe);
}

export async function fetchCatalogue(): Promise<CatalogueState> {
  try {
    const response = await fetch("/api/catalogue");
    if (response.status === 403) return { status: "denied" };
    if (!response.ok) return { status: "error" };
    const body = await response.json();
    if (
      !Array.isArray(body?.products) ||
      !Array.isArray(body?.ingredients) ||
      !Array.isArray(body?.categories) ||
      !Array.isArray(body?.assets) ||
      !Array.isArray(body?.locations)
    ) {
      return { status: "error" };
    }
    const recipes: RecipeRow[] = (body.recipes ?? []).map(
      (row: { productId: string; recipe: RecipeWithCost | null }) => ({
        productId: row.productId,
        recipe: row.recipe ? parseRecipe(row.recipe) : null,
      }),
    );
    return {
      status: "ready",
      products: body.products,
      ingredients: body.ingredients,
      categories: body.categories,
      recipes,
      assets: body.assets,
      locations: body.locations,
    };
  } catch {
    return { status: "error" };
  }
}
