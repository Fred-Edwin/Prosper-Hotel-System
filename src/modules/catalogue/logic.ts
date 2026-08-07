import type { PrismaClient } from "@/generated/prisma/client";
import type { AuthenticatedStaff } from "@/modules/people";
import {
  createIngredientRecord,
  createProductRecord,
  findIngredientById,
  findIngredientByName,
  findProductById,
  findProductByName,
  setIngredientActive,
  setProductActive,
  updateIngredientRecord,
  updateProductRecord,
} from "./queries";
import type { Ingredient, Product, ProductKind } from "./schema";

type WriteResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: "forbidden" | "duplicate_name" | "not_found" };

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
