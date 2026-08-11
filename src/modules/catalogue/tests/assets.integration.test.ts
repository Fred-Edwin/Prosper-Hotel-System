import { afterAll, beforeEach, describe, expect, test } from "vitest";
import type { AuthenticatedStaff } from "@/modules/people";
import { createAsset, linkAssetExpense, listAssets, retireAsset, updateAssetQuantity } from "../index";
import { testDb } from "@/shared/test-db";

let restaurantId: string;
let canteenId: string;

function staffAt(role: "owner" | "cashier", locationId: string): AuthenticatedStaff {
  return {
    staff: {
      id: "staff-1",
      name: "Test Staff",
      phone: "+254700111556",
      role,
      locationId,
      dailyRateMinor: 0,
      active: true,
    },
    location: { id: locationId, code: "restaurant", name: "Test" },
  };
}

async function seedExpense(locationId: string, staffMemberId: string) {
  return testDb.expense.create({
    data: {
      locationId,
      staffMemberId,
      category: "asset",
      amountMinor: 500000,
      paymentMethod: "cash",
    },
  });
}

beforeEach(async () => {
  await testDb.asset.deleteMany({});
  await testDb.expense.deleteMany({});
  await testDb.staffMember.deleteMany({});
  await testDb.location.deleteMany({});

  const restaurant = await testDb.location.create({
    data: { code: "restaurant", name: "Test Restaurant" },
  });
  const canteen = await testDb.location.create({
    data: { code: "canteen", name: "Test Canteen" },
  });
  restaurantId = restaurant.id;
  canteenId = canteen.id;
});

afterAll(async () => {
  await testDb.asset.deleteMany({});
  await testDb.expense.deleteMany({});
  await testDb.staffMember.deleteMany({});
  await testDb.location.deleteMany({});
  await testDb.$disconnect();
});

describe("createAsset", () => {
  test("owner can create an asset with a name, location, and quantity", async () => {
    const owner = staffAt("owner", restaurantId);
    const result = await createAsset(testDb, owner, {
      name: "Chest freezer",
      locationId: restaurantId,
      quantity: 1,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.name).toBe("Chest freezer");
    expect(result.value.locationId).toBe(restaurantId);
    expect(result.value.quantity).toBe(1);
    expect(result.value.expenseId).toBeNull();
    expect(result.value.retiredAt).toBeNull();
  });

  test("a non-owner creating an asset is denied", async () => {
    const cashier = staffAt("cashier", restaurantId);
    const result = await createAsset(testDb, cashier, {
      name: "Chest freezer",
      locationId: restaurantId,
      quantity: 1,
    });

    expect(result).toEqual({ ok: false, reason: "forbidden" });
  });

  test("a second purchase of the same-named asset at the same location accumulates quantity rather than duplicating", async () => {
    const owner = staffAt("owner", restaurantId);
    const first = await createAsset(testDb, owner, {
      name: "Spoons",
      locationId: restaurantId,
      quantity: 12,
    });
    if (!first.ok) throw new Error("expected first create to succeed");

    const second = await createAsset(testDb, owner, {
      name: "Spoons",
      locationId: restaurantId,
      quantity: 6,
    });

    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.value.id).toBe(first.value.id);
    expect(second.value.quantity).toBe(18);

    const assets = await listAssets(testDb);
    expect(assets.filter((a) => a.name === "Spoons")).toHaveLength(1);
  });

  test("the same-named asset at a different location creates a separate row", async () => {
    const owner = staffAt("owner", restaurantId);
    const atRestaurant = await createAsset(testDb, owner, {
      name: "Plates",
      locationId: restaurantId,
      quantity: 20,
    });
    const atCanteen = await createAsset(testDb, owner, {
      name: "Plates",
      locationId: canteenId,
      quantity: 15,
    });

    expect(atRestaurant.ok && atCanteen.ok).toBe(true);
    if (!atRestaurant.ok || !atCanteen.ok) return;
    expect(atRestaurant.value.id).not.toBe(atCanteen.value.id);
  });

  test("an asset can be linked to an existing expense at creation", async () => {
    const owner = staffAt("owner", restaurantId);
    const staff = await testDb.staffMember.create({
      data: {
        name: "Owner Staff",
        phone: "+254700111557",
        pinHash: "x",
        role: "owner",
        locationId: restaurantId,
        dailyRateMinor: 0,
      },
    });
    const expense = await seedExpense(restaurantId, staff.id);

    const result = await createAsset(testDb, owner, {
      name: "Deep fryer",
      locationId: restaurantId,
      quantity: 1,
      expenseId: expense.id,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.expenseId).toBe(expense.id);
  });
});

describe("updateAssetQuantity", () => {
  test("owner can set an asset's quantity directly, not additively", async () => {
    const owner = staffAt("owner", restaurantId);
    const created = await createAsset(testDb, owner, {
      name: "Bar stools",
      locationId: restaurantId,
      quantity: 4,
    });
    if (!created.ok) throw new Error("expected create to succeed");

    const result = await updateAssetQuantity(testDb, owner, created.value.id, 10);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.quantity).toBe(10);
  });

  test("a non-owner updating an asset's quantity is denied", async () => {
    const owner = staffAt("owner", restaurantId);
    const cashier = staffAt("cashier", restaurantId);
    const created = await createAsset(testDb, owner, {
      name: "Bar stools",
      locationId: restaurantId,
      quantity: 4,
    });
    if (!created.ok) throw new Error("expected create to succeed");

    const result = await updateAssetQuantity(testDb, cashier, created.value.id, 10);

    expect(result).toEqual({ ok: false, reason: "forbidden" });
  });
});

describe("linkAssetExpense", () => {
  test("owner can link an expense to an asset after creation", async () => {
    const owner = staffAt("owner", restaurantId);
    const staff = await testDb.staffMember.create({
      data: {
        name: "Owner Staff",
        phone: "+254700111558",
        pinHash: "x",
        role: "owner",
        locationId: restaurantId,
        dailyRateMinor: 0,
      },
    });
    const created = await createAsset(testDb, owner, {
      name: "Freezer",
      locationId: restaurantId,
      quantity: 1,
    });
    if (!created.ok) throw new Error("expected create to succeed");
    const expense = await seedExpense(restaurantId, staff.id);

    const result = await linkAssetExpense(testDb, owner, created.value.id, expense.id);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.expenseId).toBe(expense.id);
  });

  test("a non-owner linking an expense is denied", async () => {
    const owner = staffAt("owner", restaurantId);
    const cashier = staffAt("cashier", restaurantId);
    const staff = await testDb.staffMember.create({
      data: {
        name: "Owner Staff",
        phone: "+254700111559",
        pinHash: "x",
        role: "owner",
        locationId: restaurantId,
        dailyRateMinor: 0,
      },
    });
    const created = await createAsset(testDb, owner, {
      name: "Freezer",
      locationId: restaurantId,
      quantity: 1,
    });
    if (!created.ok) throw new Error("expected create to succeed");
    const expense = await seedExpense(restaurantId, staff.id);

    const result = await linkAssetExpense(testDb, cashier, created.value.id, expense.id);

    expect(result).toEqual({ ok: false, reason: "forbidden" });
  });
});

describe("retireAsset", () => {
  test("listAssets never returns a retired asset", async () => {
    const owner = staffAt("owner", restaurantId);
    const created = await createAsset(testDb, owner, {
      name: "Old fridge",
      locationId: restaurantId,
      quantity: 1,
    });
    if (!created.ok) throw new Error("expected create to succeed");

    const retired = await retireAsset(testDb, owner, created.value.id);
    expect(retired.ok).toBe(true);

    const assets = await listAssets(testDb);
    expect(assets.map((a) => a.id)).not.toContain(created.value.id);
  });

  test("the underlying database row still exists after retirement", async () => {
    const owner = staffAt("owner", restaurantId);
    const created = await createAsset(testDb, owner, {
      name: "Old fridge",
      locationId: restaurantId,
      quantity: 1,
    });
    if (!created.ok) throw new Error("expected create to succeed");

    await retireAsset(testDb, owner, created.value.id);

    const row = await testDb.asset.findUnique({ where: { id: created.value.id } });
    expect(row).not.toBeNull();
    expect(row?.retiredAt).not.toBeNull();
  });

  test("a non-owner retiring an asset is denied", async () => {
    const owner = staffAt("owner", restaurantId);
    const cashier = staffAt("cashier", restaurantId);
    const created = await createAsset(testDb, owner, {
      name: "Old fridge",
      locationId: restaurantId,
      quantity: 1,
    });
    if (!created.ok) throw new Error("expected create to succeed");

    const result = await retireAsset(testDb, cashier, created.value.id);

    expect(result).toEqual({ ok: false, reason: "forbidden" });
  });
});

