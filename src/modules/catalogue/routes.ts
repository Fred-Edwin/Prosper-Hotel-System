import { db } from "@/shared/db";
import { getSession, listLocations } from "@/modules/people";
import {
  createAsset,
  createCategory,
  createIngredient,
  createProduct,
  createRecipe,
  deactivateCategory,
  deactivateIngredient,
  deactivateProduct,
  getCurrentRecipe,
  linkAssetExpense,
  listRecipeVersions,
  reactivateCategory,
  reactivateIngredient,
  reactivateProduct,
  retireAsset,
  updateAssetQuantity,
  updateCategory,
  updateIngredient,
  updateProduct,
} from "./logic";
import { listActiveAssets, listCategories, listIngredients, listProducts } from "./queries";
import type { Ingredient, Product } from "./schema";

function writeStatus(reason: string): number {
  if (reason === "forbidden") return 403;
  if (reason === "not_found") return 404;
  return 400;
}

export async function catalogueRoute(): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: "unauthenticated" }, { status: 401 });
  if (session.staff.role !== "owner") {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const [products, ingredients, categories, assets, locations] = await Promise.all([
    listProducts(db),
    listIngredients(db),
    listCategories(db),
    listActiveAssets(db),
    listLocations(db),
  ]);

  const cookedFood = products.filter((p: Product) => p.kind === "cooked_food");
  const recipes = await Promise.all(
    cookedFood.map(async (product: Product) => ({
      productId: product.id,
      recipe: await getCurrentRecipe(db, product.id),
    })),
  );

  return Response.json({ products, ingredients, categories, recipes, assets, locations });
}

// Every staff member needs to pick a product and its price when recording a
// sale — unlike catalogueRoute above, this is not owner-only. Trimmed to
// active products only: an inactive product cannot appear on a new sale.
export async function activeProductsRoute(): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: "unauthenticated" }, { status: 401 });

  const products = await listProducts(db);
  return Response.json({ products: products.filter((p: Product) => p.active) });
}

export async function createProductRoute(request: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: "unauthenticated" }, { status: 401 });

  const body = await request.json();
  const result = await createProduct(db, session, {
    name: body.name,
    kind: body.kind,
    priceMinor: body.priceMinor ?? null,
    categoryId: body.categoryId ?? null,
  });
  if (!result.ok) return Response.json({ error: result.reason }, { status: writeStatus(result.reason) });
  return Response.json({ product: result.value });
}

export async function updateProductRoute(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: "unauthenticated" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const result = await updateProduct(db, session, id, {
    name: body.name,
    kind: body.kind,
    priceMinor: body.priceMinor ?? null,
    categoryId: body.categoryId ?? null,
    lowStockLevel: body.lowStockLevel ?? null,
  });
  if (!result.ok) return Response.json({ error: result.reason }, { status: writeStatus(result.reason) });
  return Response.json({ product: result.value });
}

export async function setProductActiveRoute(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: "unauthenticated" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const result = body.active
    ? await reactivateProduct(db, session, id)
    : await deactivateProduct(db, session, id);
  if (!result.ok) return Response.json({ error: result.reason }, { status: writeStatus(result.reason) });
  return Response.json({ product: result.value });
}

// Every store manager/attendant needs to pick an ingredient when recording
// a receipt — same reasoning as activeProductsRoute above, not owner-only.
export async function activeIngredientsRoute(): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: "unauthenticated" }, { status: 401 });

  const ingredients = await listIngredients(db);
  return Response.json({ ingredients: ingredients.filter((i: Ingredient) => i.active) });
}

export async function createIngredientRoute(request: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: "unauthenticated" }, { status: 401 });

  const body = await request.json();
  const result = await createIngredient(db, session, {
    name: body.name,
    unitOfMeasure: body.unitOfMeasure,
    lastKnownCostMinor: body.lastKnownCostMinor ?? null,
  });
  if (!result.ok) return Response.json({ error: result.reason }, { status: writeStatus(result.reason) });
  return Response.json({ ingredient: result.value });
}

export async function updateIngredientRoute(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: "unauthenticated" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const result = await updateIngredient(db, session, id, {
    name: body.name,
    unitOfMeasure: body.unitOfMeasure,
    lastKnownCostMinor: body.lastKnownCostMinor ?? null,
    lowStockLevel: body.lowStockLevel ?? null,
  });
  if (!result.ok) return Response.json({ error: result.reason }, { status: writeStatus(result.reason) });
  return Response.json({ ingredient: result.value });
}

export async function setIngredientActiveRoute(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: "unauthenticated" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const result = body.active
    ? await reactivateIngredient(db, session, id)
    : await deactivateIngredient(db, session, id);
  if (!result.ok) return Response.json({ error: result.reason }, { status: writeStatus(result.reason) });
  return Response.json({ ingredient: result.value });
}

export async function createCategoryRoute(request: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: "unauthenticated" }, { status: 401 });

  const body = await request.json();
  const result = await createCategory(db, session, { name: body.name });
  if (!result.ok) return Response.json({ error: result.reason }, { status: writeStatus(result.reason) });
  return Response.json({ category: result.value });
}

export async function updateCategoryRoute(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: "unauthenticated" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const result = await updateCategory(db, session, id, { name: body.name });
  if (!result.ok) return Response.json({ error: result.reason }, { status: writeStatus(result.reason) });
  return Response.json({ category: result.value });
}

export async function setCategoryActiveRoute(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: "unauthenticated" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const result = body.active
    ? await reactivateCategory(db, session, id)
    : await deactivateCategory(db, session, id);
  if (!result.ok) return Response.json({ error: result.reason }, { status: writeStatus(result.reason) });
  return Response.json({ category: result.value });
}

export async function createRecipeRoute(request: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: "unauthenticated" }, { status: 401 });

  const body = await request.json();
  const result = await createRecipe(db, session, {
    productId: body.productId,
    yieldQuantity: body.yieldQuantity,
    lines: body.lines,
    effectiveFrom: body.effectiveFrom ? new Date(body.effectiveFrom) : undefined,
  });
  if (!result.ok) return Response.json({ error: result.reason }, { status: writeStatus(result.reason) });
  return Response.json({ recipe: result.value });
}

export async function recipeVersionsRoute(
  _request: Request,
  { params }: { params: Promise<{ productId: string }> },
): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: "unauthenticated" }, { status: 401 });
  if (session.staff.role !== "owner") {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const { productId } = await params;
  const versions = await listRecipeVersions(db, productId);
  return Response.json({ versions });
}

export async function createAssetRoute(request: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: "unauthenticated" }, { status: 401 });

  const body = await request.json();
  const result = await createAsset(db, session, {
    name: body.name,
    locationId: body.locationId,
    quantity: body.quantity,
    expenseId: body.expenseId ?? null,
  });
  if (!result.ok) return Response.json({ error: result.reason }, { status: writeStatus(result.reason) });
  return Response.json({ asset: result.value });
}

export async function updateAssetQuantityRoute(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: "unauthenticated" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const result = await updateAssetQuantity(db, session, id, body.quantity);
  if (!result.ok) return Response.json({ error: result.reason }, { status: writeStatus(result.reason) });
  return Response.json({ asset: result.value });
}

export async function linkAssetExpenseRoute(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: "unauthenticated" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const result = await linkAssetExpense(db, session, id, body.expenseId);
  if (!result.ok) return Response.json({ error: result.reason }, { status: writeStatus(result.reason) });
  return Response.json({ asset: result.value });
}

export async function retireAssetRoute(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: "unauthenticated" }, { status: 401 });

  const { id } = await params;
  const result = await retireAsset(db, session, id);
  if (!result.ok) return Response.json({ error: result.reason }, { status: writeStatus(result.reason) });
  return Response.json({ asset: result.value });
}
