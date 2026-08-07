import { db } from "@/shared/db";
import { getSession } from "@/modules/people";
import {
  createIngredient,
  createProduct,
  createRecipe,
  deactivateIngredient,
  deactivateProduct,
  getCurrentRecipe,
  listRecipeVersions,
  reactivateIngredient,
  reactivateProduct,
  updateIngredient,
  updateProduct,
} from "./logic";
import { listIngredients, listProducts } from "./queries";
import type { Product } from "./schema";

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

  const [products, ingredients] = await Promise.all([
    listProducts(db),
    listIngredients(db),
  ]);

  const cookedFood = products.filter((p: Product) => p.kind === "cooked_food");
  const recipes = await Promise.all(
    cookedFood.map(async (product: Product) => ({
      productId: product.id,
      recipe: await getCurrentRecipe(db, product.id),
    })),
  );

  return Response.json({ products, ingredients, recipes });
}

export async function createProductRoute(request: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: "unauthenticated" }, { status: 401 });

  const body = await request.json();
  const result = await createProduct(db, session, {
    name: body.name,
    kind: body.kind,
    priceMinor: body.priceMinor ?? null,
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
