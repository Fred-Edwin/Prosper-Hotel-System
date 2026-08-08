import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { hashPin } from "@/modules/people";
import type { AuthenticatedStaff } from "@/modules/people";
import { recordIngredientReceipt } from "../logic";
import { testDb } from "@/shared/test-db";

let restaurantId: string;
let flourId: string;
let storeManagerId: string;

function staffAt(
  role: "owner" | "store_manager" | "attendant" | "cashier",
  locationId: string,
  staffId: string = storeManagerId,
): AuthenticatedStaff {
  return {
    staff: {
      id: staffId,
      name: "Test Staff",
      phone: "+254700111444",
      role,
      locationId,
      active: true,
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

  const storeManager = await testDb.staffMember.create({
    data: {
      name: "Test Store Manager",
      phone: "+254700111445",
      pinHash: await hashPin("1234"),
      role: "store_manager",
      locationId: restaurant.id,
    },
  });
  storeManagerId = storeManager.id;

  const flour = await testDb.ingredient.create({
    data: { name: "Flour", unitOfMeasure: "kg" },
  });
  flourId = flour.id;
});

afterAll(async () => {
  await testDb.ingredientMovement.deleteMany({});
  await testDb.ingredient.deleteMany({});
  await testDb.staffMember.deleteMany({});
  await testDb.location.deleteMany({});
  await testDb.$disconnect();
});

describe("recordIngredientReceipt", () => {
  test("records a received movement per line and updates the ingredient's last known cost", async () => {
    const requester = staffAt("store_manager", restaurantId, storeManagerId);

    const result = await recordIngredientReceipt(testDb, requester, {
      locationId: restaurantId,
      lines: [{ ingredientId: flourId, quantity: 50, unitCostMinor: 8000 }],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.movements).toEqual([
      expect.objectContaining({
        ingredientId: flourId,
        locationId: restaurantId,
        quantity: 50,
        reason: "received",
        unitCostMinor: 8000,
      }),
    ]);

    const ingredient = await testDb.ingredient.findUnique({ where: { id: flourId } });
    expect(ingredient?.lastKnownCostMinor).toBe(8000);
  });

  test("denies a staff member recording at a location they can't access", async () => {
    const canteen = await testDb.location.create({
      data: { code: "canteen", name: "Test Canteen" },
    });
    const requester = staffAt("store_manager", restaurantId, storeManagerId);

    const result = await recordIngredientReceipt(testDb, requester, {
      locationId: canteen.id,
      lines: [{ ingredientId: flourId, quantity: 50, unitCostMinor: 8000 }],
    });

    expect(result).toEqual({ ok: false, reason: "forbidden" });
  });

  test("denies a cashier from recording a receipt", async () => {
    const cashier = await testDb.staffMember.create({
      data: {
        name: "Test Cashier",
        phone: "+254700111446",
        pinHash: await hashPin("1234"),
        role: "cashier",
        locationId: restaurantId,
      },
    });
    const requester = staffAt("cashier", restaurantId, cashier.id);

    const result = await recordIngredientReceipt(testDb, requester, {
      locationId: restaurantId,
      lines: [{ ingredientId: flourId, quantity: 50, unitCostMinor: 8000 }],
    });

    expect(result).toEqual({ ok: false, reason: "forbidden" });
  });

  test("allows an attendant to record a receipt at their own location", async () => {
    const canteen = await testDb.location.create({
      data: { code: "canteen", name: "Test Canteen" },
    });
    const attendant = await testDb.staffMember.create({
      data: {
        name: "Test Attendant",
        phone: "+254700111447",
        pinHash: await hashPin("1234"),
        role: "attendant",
        locationId: canteen.id,
      },
    });
    const requester = staffAt("attendant", canteen.id, attendant.id);

    const result = await recordIngredientReceipt(testDb, requester, {
      locationId: canteen.id,
      lines: [{ ingredientId: flourId, quantity: 10, unitCostMinor: 8500 }],
    });

    expect(result.ok).toBe(true);
  });

  test("rejects a non-positive quantity", async () => {
    const requester = staffAt("store_manager", restaurantId, storeManagerId);

    const result = await recordIngredientReceipt(testDb, requester, {
      locationId: restaurantId,
      lines: [{ ingredientId: flourId, quantity: 0, unitCostMinor: 8000 }],
    });

    expect(result).toEqual({ ok: false, reason: "invalid_quantity" });
  });

  test("rejects a negative price", async () => {
    const requester = staffAt("store_manager", restaurantId, storeManagerId);

    const result = await recordIngredientReceipt(testDb, requester, {
      locationId: restaurantId,
      lines: [{ ingredientId: flourId, quantity: 50, unitCostMinor: -1 }],
    });

    expect(result).toEqual({ ok: false, reason: "invalid_cost" });
  });

  test("rejects a line for an inactive ingredient", async () => {
    const inactive = await testDb.ingredient.create({
      data: { name: "Discontinued spice", unitOfMeasure: "kg", active: false },
    });
    const requester = staffAt("store_manager", restaurantId, storeManagerId);

    const result = await recordIngredientReceipt(testDb, requester, {
      locationId: restaurantId,
      lines: [{ ingredientId: inactive.id, quantity: 50, unitCostMinor: 8000 }],
    });

    expect(result).toEqual({ ok: false, reason: "inactive_ingredient" });
  });
});
