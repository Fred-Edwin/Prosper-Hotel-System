import { afterAll, beforeEach, describe, expect, test } from "vitest";
import type { AuthenticatedStaff } from "@/modules/people";
import {
  createIngredient,
  createProduct,
  deactivateIngredient,
  deactivateProduct,
  listIngredients,
  listProducts,
  reactivateIngredient,
  reactivateProduct,
  updateIngredient,
  updateProduct,
} from "../index";
import { testDb } from "@/shared/test-db";

function staffAt(role: "owner" | "cashier"): AuthenticatedStaff {
  return {
    staff: {
      id: "staff-1",
      name: "Test Staff",
      phone: "+254700111555",
      role,
      locationId: "location-1",
      active: true,
    },
    location: { id: "location-1", code: "restaurant", name: "Test" },
  };
}

const owner = staffAt("owner");
const cashier = staffAt("cashier");

afterAll(async () => {
  await testDb.ingredient.deleteMany({});
  await testDb.product.deleteMany({});
  await testDb.$disconnect();
});

beforeEach(async () => {
  await testDb.ingredient.deleteMany({});
  await testDb.product.deleteMany({});
});

describe("products", () => {
  test("owner can create a product with a name and kind, price optional", async () => {
    const result = await createProduct(testDb, owner, {
      name: "Sodas (500ml)",
      kind: "goods",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.name).toBe("Sodas (500ml)");
    expect(result.value.priceMinor).toBeNull();
    expect(result.value.active).toBe(true);
  });

  test("a non-owner creating a product is denied", async () => {
    const result = await createProduct(testDb, cashier, {
      name: "Sodas (500ml)",
      kind: "goods",
    });

    expect(result).toEqual({ ok: false, reason: "forbidden" });
  });

  test("product name must be unique", async () => {
    await createProduct(testDb, owner, { name: "Chips", kind: "cooked_food" });
    const result = await createProduct(testDb, owner, { name: "Chips", kind: "cooked_food" });

    expect(result).toEqual({ ok: false, reason: "duplicate_name" });
  });

  test("owner can edit a product's name, kind, and price", async () => {
    const created = await createProduct(testDb, owner, { name: "Chips", kind: "cooked_food" });
    if (!created.ok) throw new Error("expected create to succeed");

    const result = await updateProduct(testDb, owner, created.value.id, {
      name: "Chips (large)",
      kind: "cooked_food",
      priceMinor: 20000,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.name).toBe("Chips (large)");
    expect(result.value.priceMinor).toBe(20000);
  });

  test("owner can deactivate and reactivate a product", async () => {
    const created = await createProduct(testDb, owner, { name: "Chips", kind: "cooked_food" });
    if (!created.ok) throw new Error("expected create to succeed");

    const deactivated = await deactivateProduct(testDb, owner, created.value.id);
    expect(deactivated.ok).toBe(true);
    if (deactivated.ok) expect(deactivated.value.active).toBe(false);

    const reactivated = await reactivateProduct(testDb, owner, created.value.id);
    expect(reactivated.ok).toBe(true);
    if (reactivated.ok) expect(reactivated.value.active).toBe(true);
  });

  test("a deactivated product remains visible to the owner via listProducts", async () => {
    const created = await createProduct(testDb, owner, { name: "Chips", kind: "cooked_food" });
    if (!created.ok) throw new Error("expected create to succeed");
    await deactivateProduct(testDb, owner, created.value.id);

    const products = await listProducts(testDb);

    expect(products.map((p) => p.id)).toContain(created.value.id);
    expect(products.find((p) => p.id === created.value.id)?.active).toBe(false);
  });

  test("a non-owner deactivating a product is denied", async () => {
    const created = await createProduct(testDb, owner, { name: "Chips", kind: "cooked_food" });
    if (!created.ok) throw new Error("expected create to succeed");

    const result = await deactivateProduct(testDb, cashier, created.value.id);

    expect(result).toEqual({ ok: false, reason: "forbidden" });
  });
});

describe("ingredients", () => {
  test("owner can create an ingredient with a name and unit of measure, cost optional", async () => {
    const result = await createIngredient(testDb, owner, {
      name: "Flour",
      unitOfMeasure: "kg",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.name).toBe("Flour");
    expect(result.value.unitOfMeasure).toBe("kg");
    expect(result.value.lastKnownCostMinor).toBeNull();
  });

  test("a non-owner creating an ingredient is denied", async () => {
    const result = await createIngredient(testDb, cashier, {
      name: "Flour",
      unitOfMeasure: "kg",
    });

    expect(result).toEqual({ ok: false, reason: "forbidden" });
  });

  test("ingredient name must be unique", async () => {
    await createIngredient(testDb, owner, { name: "Flour", unitOfMeasure: "kg" });
    const result = await createIngredient(testDb, owner, { name: "Flour", unitOfMeasure: "kg" });

    expect(result).toEqual({ ok: false, reason: "duplicate_name" });
  });

  test("owner can edit an ingredient's name, unit, and last-known cost", async () => {
    const created = await createIngredient(testDb, owner, { name: "Flour", unitOfMeasure: "kg" });
    if (!created.ok) throw new Error("expected create to succeed");

    const result = await updateIngredient(testDb, owner, created.value.id, {
      name: "Flour (white)",
      unitOfMeasure: "kg",
      lastKnownCostMinor: 15000,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.name).toBe("Flour (white)");
    expect(result.value.lastKnownCostMinor).toBe(15000);
  });

  test("owner can list, deactivate, and reactivate ingredients", async () => {
    const created = await createIngredient(testDb, owner, { name: "Flour", unitOfMeasure: "kg" });
    if (!created.ok) throw new Error("expected create to succeed");

    expect((await listIngredients(testDb)).map((i) => i.id)).toContain(created.value.id);

    const deactivated = await deactivateIngredient(testDb, owner, created.value.id);
    expect(deactivated.ok).toBe(true);
    if (deactivated.ok) expect(deactivated.value.active).toBe(false);

    const reactivated = await reactivateIngredient(testDb, owner, created.value.id);
    expect(reactivated.ok).toBe(true);
    if (reactivated.ok) expect(reactivated.value.active).toBe(true);
  });

  test("a non-owner deactivating an ingredient is denied", async () => {
    const created = await createIngredient(testDb, owner, { name: "Flour", unitOfMeasure: "kg" });
    if (!created.ok) throw new Error("expected create to succeed");

    const result = await deactivateIngredient(testDb, cashier, created.value.id);

    expect(result).toEqual({ ok: false, reason: "forbidden" });
  });
});
