import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import type { AuthenticatedStaff } from "@/modules/people";
import { getTodaysTakingsForStaff, recordTakings } from "../logic";
import { testDb } from "@/shared/test-db";

let restaurantId: string;
let canteenId: string;

function staffAt(
  role: "owner" | "attendant",
  locationId: string,
  locationCode: "restaurant" | "canteen" = "canteen",
): AuthenticatedStaff {
  return {
    staff: {
      id: "staff-1",
      name: "Test Attendant",
      phone: "+254700111334",
      role,
      locationId,
      dailyRateMinor: 0,
      active: true,
    },
    location: { id: locationId, code: locationCode, name: "Test" },
  };
}

beforeAll(async () => {
  const restaurant = await testDb.location.create({
    data: { code: "restaurant", name: "Test Restaurant" },
  });
  const canteen = await testDb.location.create({
    data: { code: "canteen", name: "Test Canteen" },
  });
  restaurantId = restaurant.id;
  canteenId = canteen.id;
});

beforeEach(async () => {
  await testDb.takings.deleteMany({});
});

afterAll(async () => {
  await testDb.takings.deleteMany({});
  await testDb.location.deleteMany({});
  await testDb.$disconnect();
});

describe("recordTakings", () => {
  test("creates a takings record for a location and day with separate cash and M-Pesa totals", async () => {
    const result = await recordTakings(testDb, staffAt("attendant", canteenId), {
      cashMinor: 3400,
      mpesaMinor: 2000,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.takings.locationId).toBe(canteenId);
    expect(result.takings.cashMinor).toBe(3400);
    expect(result.takings.mpesaMinor).toBe(2000);
  });

  test("a second call the same day, same location, updates the existing record rather than creating a duplicate", async () => {
    const first = await recordTakings(testDb, staffAt("attendant", canteenId), {
      cashMinor: 1000,
      mpesaMinor: 500,
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const second = await recordTakings(testDb, staffAt("attendant", canteenId), {
      cashMinor: 1200,
      mpesaMinor: 600,
    });

    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.takings.id).toBe(first.takings.id);
    expect(second.takings.cashMinor).toBe(1200);
    expect(second.takings.mpesaMinor).toBe(600);

    const all = await testDb.takings.findMany({ where: { locationId: canteenId } });
    expect(all).toHaveLength(1);
  });

  test("rejects a negative cash amount", async () => {
    const result = await recordTakings(testDb, staffAt("attendant", canteenId), {
      cashMinor: -100,
      mpesaMinor: 0,
    });

    expect(result).toEqual({ ok: false, reason: "invalid_amount" });
  });

  test("rejects a negative M-Pesa amount", async () => {
    const result = await recordTakings(testDb, staffAt("attendant", canteenId), {
      cashMinor: 0,
      mpesaMinor: -50,
    });

    expect(result).toEqual({ ok: false, reason: "invalid_amount" });
  });

  test("recordTakings always scopes to the requester's own location", async () => {
    const result = await recordTakings(testDb, staffAt("attendant", canteenId), {
      cashMinor: 100,
      mpesaMinor: 0,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.takings.locationId).toBe(canteenId);
  });

  test("the owner can record takings at either location", async () => {
    const result = await recordTakings(testDb, staffAt("owner", restaurantId, "restaurant"), {
      cashMinor: 500,
      mpesaMinor: 200,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.takings.locationId).toBe(restaurantId);
  });
});

describe("getTodaysTakingsForStaff", () => {
  test("returns null when nothing has been recorded today", async () => {
    const result = await getTodaysTakingsForStaff(testDb, staffAt("attendant", canteenId));

    expect(result).toEqual({ ok: true, takings: null });
  });

  test("returns today's takings for the requester's location after recording", async () => {
    await recordTakings(testDb, staffAt("attendant", canteenId), {
      cashMinor: 800,
      mpesaMinor: 400,
    });

    const result = await getTodaysTakingsForStaff(testDb, staffAt("attendant", canteenId));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.takings?.cashMinor).toBe(800);
    expect(result.takings?.mpesaMinor).toBe(400);
  });

  test("does not return another location's takings", async () => {
    await recordTakings(testDb, staffAt("owner", restaurantId, "restaurant"), {
      cashMinor: 800,
      mpesaMinor: 400,
    });

    const result = await getTodaysTakingsForStaff(testDb, staffAt("attendant", canteenId));

    expect(result).toEqual({ ok: true, takings: null });
  });
});
