import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { hashPin } from "@/modules/people";
import type { AuthenticatedStaff } from "@/modules/people";
import { createIngredient, updateIngredient } from "@/modules/catalogue";
import { getIngredientStockValuesAtLocation } from "../logic";
import { testDb } from "@/shared/test-db";

let restaurantId: string;
let ownerId: string;

function staffAt(role: "owner" | "cashier", locationId: string): AuthenticatedStaff {
  return {
    staff: {
      id: ownerId,
      name: "Test Staff",
      phone: "+254700111700",
      role,
      locationId,
      active: true,
      dailyRateMinor: 0,
    },
    location: { id: locationId, code: "restaurant", name: "Test" },
  };
}

beforeEach(async () => {
  await testDb.ingredientMovement.deleteMany({});
  await testDb.ingredient.deleteMany({});
  await testDb.staffMember.deleteMany({});
  await testDb.location.deleteMany({});

  const restaurant = await testDb.location.create({
    data: { code: "restaurant", name: "Test Restaurant" },
  });
  restaurantId = restaurant.id;

  const owner = await testDb.staffMember.create({
    data: {
      name: "Test Owner",
      phone: "+254700111701",
      pinHash: await hashPin("1234"),
      role: "owner",
      locationId: restaurant.id,
      dailyRateMinor: 0,
    },
  });
  ownerId = owner.id;
});

afterAll(async () => {
  await testDb.ingredientMovement.deleteMany({});
  await testDb.ingredient.deleteMany({});
  await testDb.staffMember.deleteMany({});
  await testDb.location.deleteMany({});
  await testDb.$disconnect();
});

describe("getIngredientStockValuesAtLocation", () => {
  test("values an ingredient at its last-known cost, quantity times unit cost", async () => {
    const owner = staffAt("owner", restaurantId);
    const flour = await createIngredient(testDb, owner, { name: "Flour", unitOfMeasure: "kg" });
    if (!flour.ok) throw new Error("expected create to succeed");
    await updateIngredient(testDb, owner, flour.value.id, {
      name: "Flour",
      unitOfMeasure: "kg",
      lastKnownCostMinor: 150,
    });
    await testDb.ingredientMovement.create({
      data: { ingredientId: flour.value.id, locationId: restaurantId, quantity: 20, reason: "received", staffMemberId: ownerId },
    });

    const result = await getIngredientStockValuesAtLocation(testDb, owner, restaurantId);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.values).toEqual([
      {
        ingredientId: flour.value.id,
        ingredientName: "Flour",
        quantityOnHand: 20,
        unitCostMinor: 150,
        valueMinor: 3000,
        isEstimated: false,
      },
    ]);
  });

  test("an ingredient with no known cost is excluded, not shown as zero value", async () => {
    const owner = staffAt("owner", restaurantId);
    const salt = await createIngredient(testDb, owner, { name: "Salt", unitOfMeasure: "kg" });
    if (!salt.ok) throw new Error("expected create to succeed");
    await testDb.ingredientMovement.create({
      data: { ingredientId: salt.value.id, locationId: restaurantId, quantity: 5, reason: "received", staffMemberId: ownerId },
    });

    const result = await getIngredientStockValuesAtLocation(testDb, owner, restaurantId);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.values).toEqual([]);
  });
});
