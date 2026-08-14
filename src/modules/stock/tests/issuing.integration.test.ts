import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { hashPin } from "@/modules/people";
import type { AuthenticatedStaff } from "@/modules/people";
import { recordIngredientIssue } from "../logic";
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
      dailyRateMinor: 0,
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
      dailyRateMinor: 700,
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

describe("recordIngredientIssue", () => {
  test("records an issued movement per line and reduces current stock", async () => {
    await testDb.ingredientMovement.create({
      data: {
        ingredientId: flourId,
        locationId: restaurantId,
        quantity: 50,
        reason: "received",
        unitCostMinor: 8000,
        staffMemberId: storeManagerId,
        receiptId: crypto.randomUUID(),
      },
    });

    const requester = staffAt("store_manager", restaurantId, storeManagerId);

    const result = await recordIngredientIssue(testDb, requester, {
      locationId: restaurantId,
      lines: [{ ingredientId: flourId, quantity: 20 }],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.movements).toEqual([
      expect.objectContaining({
        ingredientId: flourId,
        locationId: restaurantId,
        quantity: -20,
        reason: "issued",
      }),
    ]);

    const movements = await testDb.ingredientMovement.findMany({
      where: { ingredientId: flourId, locationId: restaurantId },
    });
    const quantityOnHand = movements.reduce((sum, m) => sum + m.quantity.toNumber(), 0);
    expect(quantityOnHand).toBe(30);
  });

  test("denies a staff member recording at a location they can't access", async () => {
    const canteen = await testDb.location.create({
      data: { code: "canteen", name: "Test Canteen" },
    });
    const requester = staffAt("store_manager", restaurantId, storeManagerId);

    const result = await recordIngredientIssue(testDb, requester, {
      locationId: canteen.id,
      lines: [{ ingredientId: flourId, quantity: 5 }],
    });

    expect(result).toEqual({ ok: false, reason: "forbidden" });
  });

  test("denies a cashier from recording an issue", async () => {
    const cashier = await testDb.staffMember.create({
      data: {
        name: "Test Cashier",
        phone: "+254700111446",
        pinHash: await hashPin("1234"),
        role: "cashier",
        locationId: restaurantId,
        dailyRateMinor: 550,
      },
    });
    const requester = staffAt("cashier", restaurantId, cashier.id);

    const result = await recordIngredientIssue(testDb, requester, {
      locationId: restaurantId,
      lines: [{ ingredientId: flourId, quantity: 5 }],
    });

    expect(result).toEqual({ ok: false, reason: "forbidden" });
  });

  test("denies an attendant from recording an issue", async () => {
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
        dailyRateMinor: 600,
      },
    });
    const requester = staffAt("attendant", canteen.id, attendant.id);

    const result = await recordIngredientIssue(testDb, requester, {
      locationId: canteen.id,
      lines: [{ ingredientId: flourId, quantity: 5 }],
    });

    expect(result).toEqual({ ok: false, reason: "forbidden" });
  });

  test("allows the owner to record an issue at any location", async () => {
    const owner = await testDb.staffMember.create({
      data: {
        name: "Test Owner",
        phone: "+254700111448",
        pinHash: await hashPin("1234"),
        role: "owner",
        locationId: restaurantId,
        dailyRateMinor: 0,
      },
    });
    const requester = staffAt("owner", restaurantId, owner.id);

    const result = await recordIngredientIssue(testDb, requester, {
      locationId: restaurantId,
      lines: [{ ingredientId: flourId, quantity: 5 }],
    });

    expect(result.ok).toBe(true);
  });

  test("rejects a non-positive quantity", async () => {
    const requester = staffAt("store_manager", restaurantId, storeManagerId);

    const result = await recordIngredientIssue(testDb, requester, {
      locationId: restaurantId,
      lines: [{ ingredientId: flourId, quantity: 0 }],
    });

    expect(result).toEqual({ ok: false, reason: "invalid_quantity" });
  });

  test("rejects a line for an inactive ingredient", async () => {
    const inactive = await testDb.ingredient.create({
      data: { name: "Discontinued spice", unitOfMeasure: "kg", active: false },
    });
    const requester = staffAt("store_manager", restaurantId, storeManagerId);

    const result = await recordIngredientIssue(testDb, requester, {
      locationId: restaurantId,
      lines: [{ ingredientId: inactive.id, quantity: 5 }],
    });

    expect(result).toEqual({ ok: false, reason: "inactive_ingredient" });
  });
});
