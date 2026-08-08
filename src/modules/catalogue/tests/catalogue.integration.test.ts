import { afterAll, beforeEach, describe, expect, test } from "vitest";
import type { AuthenticatedStaff } from "@/modules/people";
import {
  createIngredient,
  createProduct,
  createRecipe,
  deactivateIngredient,
  deactivateProduct,
  getCurrentRecipe,
  getRecipeAt,
  listIngredients,
  listProducts,
  listRecipeVersions,
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
      dailyRateMinor: 0,
      active: true,
    },
    location: { id: "location-1", code: "restaurant", name: "Test" },
  };
}

const owner = staffAt("owner");
const cashier = staffAt("cashier");

afterAll(async () => {
  await testDb.recipeLine.deleteMany({});
  await testDb.recipe.deleteMany({});
  await testDb.ingredient.deleteMany({});
  await testDb.product.deleteMany({});
  await testDb.$disconnect();
});

beforeEach(async () => {
  await testDb.recipeLine.deleteMany({});
  await testDb.recipe.deleteMany({});
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

describe("recipes", () => {
  async function chipsAndFlour() {
    const product = await createProduct(testDb, owner, { name: "Chips", kind: "cooked_food" });
    if (!product.ok) throw new Error("expected product create to succeed");
    const flour = await createIngredient(testDb, owner, {
      name: "Flour",
      unitOfMeasure: "kg",
      lastKnownCostMinor: 10000,
    });
    if (!flour.ok) throw new Error("expected ingredient create to succeed");
    return { product: product.value, flour: flour.value };
  }

  test("owner can create a recipe for a cooked-food product with none", async () => {
    const { product, flour } = await chipsAndFlour();

    const result = await createRecipe(testDb, owner, {
      productId: product.id,
      yieldQuantity: 10,
      lines: [{ ingredientId: flour.id, quantity: 2 }],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.productId).toBe(product.id);
    expect(result.value.yieldQuantity).toBe(10);
    expect(result.value.lines).toEqual([
      expect.objectContaining({ ingredientId: flour.id, quantity: 2 }),
    ]);
  });

  test("current recipe's per-unit cost is ingredient cost x quantity, divided by yield", async () => {
    const { product, flour } = await chipsAndFlour();
    // flour cost 10000/kg, 2kg per batch, yield 10 units -> 20000/10 = 2000/unit
    await createRecipe(testDb, owner, {
      productId: product.id,
      yieldQuantity: 10,
      lines: [{ ingredientId: flour.id, quantity: 2 }],
    });

    const current = await getCurrentRecipe(testDb, product.id);

    expect(current?.perUnitCostMinor).toBe(2000);
  });

  test("creating a new version leaves the previous version's stored values unchanged", async () => {
    const { product, flour } = await chipsAndFlour();
    const v1 = await createRecipe(testDb, owner, {
      productId: product.id,
      yieldQuantity: 10,
      lines: [{ ingredientId: flour.id, quantity: 2 }],
      effectiveFrom: new Date("2026-01-01"),
    });
    if (!v1.ok) throw new Error("expected v1 create to succeed");

    const v2 = await createRecipe(testDb, owner, {
      productId: product.id,
      yieldQuantity: 8,
      lines: [{ ingredientId: flour.id, quantity: 3 }],
      effectiveFrom: new Date("2026-02-01"),
    });
    expect(v2.ok).toBe(true);

    const versions = await listRecipeVersions(testDb, product.id);
    const storedV1 = versions.find((v) => v.id === v1.value.id);
    expect(storedV1?.yieldQuantity).toBe(10);
    expect(storedV1?.lines).toEqual([
      expect.objectContaining({ ingredientId: flour.id, quantity: 2 }),
    ]);
    expect(versions).toHaveLength(2);
  });

  test("the recipe in force on date X is the version covering that date, not the latest", async () => {
    const { product, flour } = await chipsAndFlour();
    const v1 = await createRecipe(testDb, owner, {
      productId: product.id,
      yieldQuantity: 10,
      lines: [{ ingredientId: flour.id, quantity: 2 }],
      effectiveFrom: new Date("2026-01-01"),
    });
    if (!v1.ok) throw new Error("expected v1 create to succeed");
    const v2 = await createRecipe(testDb, owner, {
      productId: product.id,
      yieldQuantity: 8,
      lines: [{ ingredientId: flour.id, quantity: 3 }],
      effectiveFrom: new Date("2026-02-01"),
    });
    if (!v2.ok) throw new Error("expected v2 create to succeed");

    const inJanuary = await getRecipeAt(testDb, product.id, new Date("2026-01-15"));
    const inMarch = await getRecipeAt(testDb, product.id, new Date("2026-03-01"));

    expect(inJanuary?.id).toBe(v1.value.id);
    expect(inMarch?.id).toBe(v2.value.id);
  });

  test("a cooked-food product with no recipe has no current recipe", async () => {
    const product = await createProduct(testDb, owner, { name: "Chips", kind: "cooked_food" });
    if (!product.ok) throw new Error("expected product create to succeed");

    const current = await getCurrentRecipe(testDb, product.value.id);

    expect(current).toBeNull();
  });

  test("a non-owner creating or versioning a recipe is denied", async () => {
    const { product, flour } = await chipsAndFlour();

    const result = await createRecipe(testDb, cashier, {
      productId: product.id,
      yieldQuantity: 10,
      lines: [{ ingredientId: flour.id, quantity: 2 }],
    });

    expect(result).toEqual({ ok: false, reason: "forbidden" });
  });

  test("a recipe cannot reference a deactivated ingredient", async () => {
    const { product, flour } = await chipsAndFlour();
    await deactivateIngredient(testDb, owner, flour.id);

    const result = await createRecipe(testDb, owner, {
      productId: product.id,
      yieldQuantity: 10,
      lines: [{ ingredientId: flour.id, quantity: 2 }],
    });

    expect(result).toEqual({ ok: false, reason: "invalid_ingredients" });
  });

  test("a recipe cannot reference a deactivated product", async () => {
    const { product, flour } = await chipsAndFlour();
    await deactivateProduct(testDb, owner, product.id);

    const result = await createRecipe(testDb, owner, {
      productId: product.id,
      yieldQuantity: 10,
      lines: [{ ingredientId: flour.id, quantity: 2 }],
    });

    expect(result).toEqual({ ok: false, reason: "not_found" });
  });

  test("a recipe cannot reference a non-cooked-food product", async () => {
    const soda = await createProduct(testDb, owner, { name: "Soda", kind: "goods" });
    if (!soda.ok) throw new Error("expected product create to succeed");
    const flour = await createIngredient(testDb, owner, { name: "Flour", unitOfMeasure: "kg" });
    if (!flour.ok) throw new Error("expected ingredient create to succeed");

    const result = await createRecipe(testDb, owner, {
      productId: soda.value.id,
      yieldQuantity: 10,
      lines: [{ ingredientId: flour.value.id, quantity: 2 }],
    });

    expect(result).toEqual({ ok: false, reason: "not_found" });
  });

  test("a recipe must have at least one ingredient line", async () => {
    const { product } = await chipsAndFlour();

    const result = await createRecipe(testDb, owner, {
      productId: product.id,
      yieldQuantity: 10,
      lines: [],
    });

    expect(result).toEqual({ ok: false, reason: "invalid_recipe" });
  });

  test("a recipe's yield quantity must be positive", async () => {
    const { product, flour } = await chipsAndFlour();

    const result = await createRecipe(testDb, owner, {
      productId: product.id,
      yieldQuantity: 0,
      lines: [{ ingredientId: flour.id, quantity: 2 }],
    });

    expect(result).toEqual({ ok: false, reason: "invalid_recipe" });
  });

  // Deactivation-time is deliberately permissive, unlike creation-time
  // validation above: an existing recipe is a past-and-present fact and
  // must stay readable exactly as it was, per "records that must not
  // move silently." Blocking deactivation would force the owner into an
  // artificial recipe-retirement step that ticket 02 explicitly defers.
  test("deactivating an ingredient already used in a recipe is allowed, and cost derivation still uses its last-known cost", async () => {
    const { product, flour } = await chipsAndFlour();
    await createRecipe(testDb, owner, {
      productId: product.id,
      yieldQuantity: 10,
      lines: [{ ingredientId: flour.id, quantity: 2 }],
    });

    const deactivated = await deactivateIngredient(testDb, owner, flour.id);
    expect(deactivated.ok).toBe(true);

    const current = await getCurrentRecipe(testDb, product.id);
    expect(current?.perUnitCostMinor).toBe(2000);
  });

  test("deactivating a product with a current recipe is allowed, and the recipe remains readable", async () => {
    const { product, flour } = await chipsAndFlour();
    const created = await createRecipe(testDb, owner, {
      productId: product.id,
      yieldQuantity: 10,
      lines: [{ ingredientId: flour.id, quantity: 2 }],
    });
    if (!created.ok) throw new Error("expected create to succeed");

    const deactivated = await deactivateProduct(testDb, owner, product.id);
    expect(deactivated.ok).toBe(true);

    const current = await getCurrentRecipe(testDb, product.id);
    expect(current?.id).toBe(created.value.id);
  });
});
