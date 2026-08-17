import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { hashPin } from "@/modules/people";
import type { AuthenticatedStaff } from "@/modules/people";
import { getStoreLedger } from "../logic";
import { testDb } from "@/shared/test-db";

let restaurantId: string;
let canteenId: string;
let ownerId: string;

function owner(): AuthenticatedStaff {
  return {
    staff: {
      id: ownerId,
      name: "Test Owner",
      phone: "+254700119003",
      role: "owner",
      locationId: restaurantId,
      dailyRateMinor: 0,
      active: true,
    },
    location: { id: restaurantId, code: "restaurant", name: "Test Restaurant" },
  };
}

function attendant(locationId: string): AuthenticatedStaff {
  return {
    staff: {
      id: "attendant-1",
      name: "Test Attendant",
      phone: "+254700119002",
      role: "attendant",
      locationId,
      dailyRateMinor: 0,
      active: true,
    },
    location: { id: locationId, code: "canteen", name: "Test Canteen" },
  };
}

async function resetDb() {
  await testDb.paymentLine.deleteMany({});
  await testDb.saleLine.deleteMany({});
  await testDb.sale.deleteMany({});
  await testDb.stockCountLine.deleteMany({});
  await testDb.stockCount.deleteMany({});
  await testDb.stockMovement.deleteMany({});
  await testDb.ingredientMovement.deleteMany({});
  await testDb.expense.deleteMany({});
  await testDb.recipeLine.deleteMany({});
  await testDb.recipe.deleteMany({});
  await testDb.product.deleteMany({});
  await testDb.category.deleteMany({});
  await testDb.ingredient.deleteMany({});
  await testDb.staffMember.deleteMany({});
  await testDb.location.deleteMany({});
}

beforeEach(async () => {
  await resetDb();

  const [restaurant, canteen] = await Promise.all([
    testDb.location.create({ data: { code: "restaurant", name: "Test Restaurant" } }),
    testDb.location.create({ data: { code: "canteen", name: "Test Canteen" } }),
  ]);
  restaurantId = restaurant.id;
  canteenId = canteen.id;

  const ownerStaff = await testDb.staffMember.create({
    data: {
      name: "Test Owner",
      phone: "+254700119003",
      pinHash: await hashPin("1234"),
      role: "owner",
      locationId: restaurant.id,
      dailyRateMinor: 0,
    },
  });
  ownerId = ownerStaff.id;

  await testDb.staffMember.create({
    data: {
      id: "attendant-1",
      name: "Test Attendant",
      phone: "+254700119002",
      pinHash: await hashPin("1234"),
      role: "attendant",
      locationId: canteen.id,
      dailyRateMinor: 0,
    },
  });
});

afterAll(async () => {
  await resetDb();
  await testDb.$disconnect();
});

describe("getStoreLedger", () => {
  test("forbidden for non-owner roles", async () => {
    const result = await getStoreLedger(testDb, attendant(canteenId), {
      periodStart: new Date("2026-08-06T00:00:00Z"),
      periodEnd: new Date("2026-08-06T23:59:59Z"),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("forbidden");
  });

  test("reconciles opening + purchased − out = closing across purchases, kitchen issues, transfers, wastage", async () => {
    const potatoes = await testDb.ingredient.create({
      data: { name: "Potatoes", unitOfMeasure: "kg", lastKnownCostMinor: 65 },
    });

    // Opening balance at the restaurant, before the period, from an
    // earlier delivery — establishes a non-zero opening quantity.
    await testDb.ingredientMovement.create({
      data: {
        ingredientId: potatoes.id,
        locationId: restaurantId,
        quantity: 34,
        reason: "received",
        unitCostMinor: 61,
        staffMemberId: ownerId,
        occurredAt: new Date("2026-08-05T12:00:00Z"),
      },
    });

    const periodStart = new Date("2026-08-06T00:00:00Z");
    const periodEnd = new Date("2026-08-06T23:59:59Z");

    // Purchased: 120kg during the period.
    await testDb.ingredientMovement.create({
      data: {
        ingredientId: potatoes.id,
        locationId: restaurantId,
        quantity: 120,
        reason: "received",
        unitCostMinor: 65,
        staffMemberId: ownerId,
        occurredAt: new Date("2026-08-06T08:00:00Z"),
      },
    });

    // Out: issued to kitchen 104, transferred out 0 (none), spoilage 2.
    await testDb.ingredientMovement.create({
      data: {
        ingredientId: potatoes.id,
        locationId: restaurantId,
        quantity: -104,
        reason: "issued",
        staffMemberId: ownerId,
        occurredAt: new Date("2026-08-06T09:00:00Z"),
      },
    });
    await testDb.ingredientMovement.create({
      data: {
        ingredientId: potatoes.id,
        locationId: restaurantId,
        quantity: -2,
        reason: "wasted",
        costBasisMinor: 130,
        staffMemberId: ownerId,
        occurredAt: new Date("2026-08-06T10:00:00Z"),
      },
    });

    const result = await getStoreLedger(testDb, owner(), { periodStart, periodEnd });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const row = result.rows.find((r) => r.ingredientId === potatoes.id && r.locationId === restaurantId);
    expect(row).toBeDefined();
    expect(row).toMatchObject({
      openingQty: 34,
      purchasedQty: 120,
      purchasedValueMinor: 120 * 65,
      issuedToKitchen: 104,
      transferredOut: 0,
      spoilage: 2,
      closingQty: 34 + 120 - 104 - 2,
    });
    expect(row!.openingQty + row!.purchasedQty - (row!.issuedToKitchen + row!.transferredOut + row!.spoilage)).toBe(
      row!.closingQty,
    );
  });

  test("shows the cost move when a purchase changes the unit cost within the period", async () => {
    const flour = await testDb.ingredient.create({
      data: { name: "Maize flour", unitOfMeasure: "kg", lastKnownCostMinor: 79 },
    });

    const periodStart = new Date("2026-08-06T00:00:00Z");
    const periodEnd = new Date("2026-08-06T23:59:59Z");

    // Opening stock at the old cost, before the period.
    await testDb.ingredientMovement.create({
      data: {
        ingredientId: flour.id,
        locationId: restaurantId,
        quantity: 28,
        reason: "received",
        unitCostMinor: 74,
        staffMemberId: ownerId,
        occurredAt: new Date("2026-08-05T12:00:00Z"),
      },
    });

    // A purchase within the period at a higher unit cost. The previous
    // cost is the 74 actually paid on the delivery before the period —
    // read off that delivery (formulas.md §3, 2026-08-17), not
    // reconstructed by un-averaging, which used to yield 73.64 and never
    // matched any price really paid.
    await testDb.ingredientMovement.create({
      data: {
        ingredientId: flour.id,
        locationId: restaurantId,
        quantity: 50,
        reason: "received",
        unitCostMinor: 82,
        staffMemberId: ownerId,
        occurredAt: new Date("2026-08-06T08:00:00Z"),
      },
    });

    const result = await getStoreLedger(testDb, owner(), { periodStart, periodEnd });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const row = result.rows.find((r) => r.ingredientId === flour.id && r.locationId === restaurantId);
    expect(row).toBeDefined();
    expect(row!.unitCostMinor).toBe(79);
    expect(row!.previousUnitCostMinor).toBe(74);
  });

  test("an ingredient with no purchases or movements this period, and no prior cost, shows no cost-move indicator", async () => {
    const rice = await testDb.ingredient.create({
      data: { name: "Rice", unitOfMeasure: "kg", lastKnownCostMinor: 165 },
    });
    await testDb.ingredientMovement.create({
      data: {
        ingredientId: rice.id,
        locationId: restaurantId,
        quantity: 22,
        reason: "received",
        unitCostMinor: 165,
        staffMemberId: ownerId,
        occurredAt: new Date("2026-08-05T12:00:00Z"),
      },
    });

    const result = await getStoreLedger(testDb, owner(), {
      periodStart: new Date("2026-08-06T00:00:00Z"),
      periodEnd: new Date("2026-08-06T23:59:59Z"),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const row = result.rows.find((r) => r.ingredientId === rice.id && r.locationId === restaurantId);
    expect(row).toBeDefined();
    expect(row!.unitCostMinor).toBe(165);
    expect(row!.previousUnitCostMinor).toBe(165);
  });

  test("filtering by location shows only that location's rows", async () => {
    const oil = await testDb.ingredient.create({
      data: { name: "Cooking oil", unitOfMeasure: "L", lastKnownCostMinor: 320 },
    });
    await testDb.ingredientMovement.create({
      data: {
        ingredientId: oil.id,
        locationId: restaurantId,
        quantity: 18,
        reason: "received",
        unitCostMinor: 320,
        staffMemberId: ownerId,
        occurredAt: new Date("2026-08-05T12:00:00Z"),
      },
    });
    await testDb.ingredientMovement.create({
      data: {
        ingredientId: oil.id,
        locationId: canteenId,
        quantity: 6,
        reason: "transferred",
        staffMemberId: ownerId,
        occurredAt: new Date("2026-08-05T13:00:00Z"),
      },
    });

    const result = await getStoreLedger(testDb, owner(), {
      periodStart: new Date("2026-08-06T00:00:00Z"),
      periodEnd: new Date("2026-08-06T23:59:59Z"),
      locationId: restaurantId,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows.every((r) => r.locationId === restaurantId)).toBe(true);
    expect(result.rows.some((r) => r.locationId === canteenId)).toBe(false);
  });

  test("searching by name narrows correctly", async () => {
    await testDb.ingredient.create({
      data: { name: "Beef", unitOfMeasure: "kg", lastKnownCostMinor: 580 },
    });
    const flour = await testDb.ingredient.create({
      data: { name: "Wheat flour", unitOfMeasure: "kg", lastKnownCostMinor: 92 },
    });
    await testDb.ingredientMovement.create({
      data: {
        ingredientId: flour.id,
        locationId: restaurantId,
        quantity: 20,
        reason: "received",
        unitCostMinor: 92,
        staffMemberId: ownerId,
        occurredAt: new Date("2026-08-05T12:00:00Z"),
      },
    });
    const beef = await testDb.ingredient.findFirstOrThrow({ where: { name: "Beef" } });
    await testDb.ingredientMovement.create({
      data: {
        ingredientId: beef.id,
        locationId: restaurantId,
        quantity: 6,
        reason: "received",
        unitCostMinor: 580,
        staffMemberId: ownerId,
        occurredAt: new Date("2026-08-05T12:00:00Z"),
      },
    });

    const result = await getStoreLedger(testDb, owner(), {
      periodStart: new Date("2026-08-06T00:00:00Z"),
      periodEnd: new Date("2026-08-06T23:59:59Z"),
      search: "flour",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows.length).toBeGreaterThan(0);
    expect(result.rows.every((r) => r.ingredientName.toLowerCase().includes("flour"))).toBe(true);
  });
});

/**
 * Editable-ledger T6 — day expansion on the Store tab.
 *
 * The owner chose day expansion over period-level-only editing
 * (2026-08-17), which closes the companion plan's open question 2. Editing
 * needs a day to stamp an amendment against: a month's `purchased` total
 * spread over eleven deliveries offers no honest date, and Kind B's
 * opening/closing corrections are defined entirely by their timestamp.
 *
 * Two things are being established here, and the second is the one that
 * bites:
 *
 *  1. days[] chains — each day's opening is the previous day's closing,
 *     and the first day's opening is the period's.
 *  2. the `corrected` column exists. Before T6 the Store ledger fetched
 *     ["issued", "transferred", "wasted"] only, while opening/closing come
 *     from getIngredientQuantityAtLocationAsOf, which sums *every*
 *     movement regardless of reason. So a `corrected` row moved closing
 *     without appearing in any column explaining why — exactly the break
 *     T3 found on the Product side. It was unreachable on the Store tab
 *     until amendDerivedPosition could be called with
 *     itemType: "ingredient", which is what T6 enables.
 *
 * Boundary semantics, per amend-ledger.integration.test.ts's header: a
 * ledger day D is (D 00:00, D+1 00:00] (gt/lte), while opening at D is
 * <= D 00:00 (lte). So a Kind B opening correction at D lands at exactly
 * D 00:00:00.000 — inside D's opening, outside D's own movement columns,
 * and inside D−1's window, which is why D−1's closing moves with it.
 */
describe("getStoreLedger — day expansion (T6)", () => {
  const PERIOD_START = new Date("2026-08-14T00:00:00.000Z");
  const PERIOD_END = new Date("2026-08-18T23:59:59.999Z");

  const at = (iso: string, time: string) => new Date(`${iso}T${time}Z`);

  async function ingredient(name = "Potatoes") {
    return testDb.ingredient.create({
      data: { name, unitOfMeasure: "kg", lastKnownCostMinor: 65 },
    });
  }

  async function move(
    ingredientId: string,
    quantity: number,
    reason: string,
    occurredAt: Date,
    unitCostMinor?: number,
  ) {
    return testDb.ingredientMovement.create({
      data: {
        ingredientId,
        locationId: restaurantId,
        quantity,
        reason: reason as never,
        ...(unitCostMinor === undefined ? {} : { unitCostMinor }),
        staffMemberId: ownerId,
        occurredAt,
      },
    });
  }

  async function storeRow(ingredientId: string) {
    const result = await getStoreLedger(testDb, owner(), {
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return undefined;
    return result.rows.find((r) => r.ingredientId === ingredientId && r.locationId === restaurantId);
  }

  test("returns one day entry per calendar day in the period, labelled by date", async () => {
    const potatoes = await ingredient();
    await move(potatoes.id, 20, "received", at("2026-08-14", "09:00:00.000"), 65);

    const row = await storeRow(potatoes.id);
    expect(row).toBeDefined();
    expect(row!.days.map((d) => d.date)).toEqual([
      "2026-08-14",
      "2026-08-15",
      "2026-08-16",
      "2026-08-17",
      "2026-08-18",
    ]);
  });

  test("each day's opening is the previous day's closing, and the chain spans the period", async () => {
    const potatoes = await ingredient();
    // Opening stock before the period.
    await move(potatoes.id, 30, "received", at("2026-08-13", "12:00:00.000"), 60);
    await move(potatoes.id, 12, "received", at("2026-08-15", "08:00:00.000"), 65);
    await move(potatoes.id, -7, "issued", at("2026-08-16", "10:00:00.000"));
    await move(potatoes.id, -1, "wasted", at("2026-08-17", "11:00:00.000"));

    const row = await storeRow(potatoes.id);
    expect(row).toBeDefined();

    expect(row!.days[0]!.openingQty).toBe(30);
    let expectedOpening = row!.openingQty;
    for (const day of row!.days) {
      expect(day.openingQty).toBeCloseTo(expectedOpening, 6);
      expectedOpening = day.closingQty;
    }
    // The last day's closing is the period's closing — the two derivations
    // must agree, since they come from separate reads.
    expect(expectedOpening).toBeCloseTo(row!.closingQty, 6);
    expect(row!.closingQty).toBe(30 + 12 - 7 - 1);
  });

  test("attributes each movement to its own day, not to the period as a whole", async () => {
    const potatoes = await ingredient();
    await move(potatoes.id, 10, "received", at("2026-08-15", "08:00:00.000"), 65);
    await move(potatoes.id, -4, "issued", at("2026-08-16", "10:00:00.000"));
    await move(potatoes.id, -2, "wasted", at("2026-08-17", "11:00:00.000"));

    const row = await storeRow(potatoes.id);
    expect(row).toBeDefined();
    const byDate = new Map(row!.days.map((d) => [d.date, d]));

    expect(byDate.get("2026-08-15")).toMatchObject({ purchasedQty: 10, issuedToKitchen: 0, spoilage: 0 });
    expect(byDate.get("2026-08-16")).toMatchObject({ purchasedQty: 0, issuedToKitchen: 4, spoilage: 0 });
    expect(byDate.get("2026-08-17")).toMatchObject({ purchasedQty: 0, issuedToKitchen: 0, spoilage: 2 });
    expect(byDate.get("2026-08-14")).toMatchObject({ purchasedQty: 0, issuedToKitchen: 0, spoilage: 0 });
  });

  test("carries purchased value per day, at the cost actually paid that day", async () => {
    const potatoes = await ingredient();
    await move(potatoes.id, 10, "received", at("2026-08-15", "08:00:00.000"), 65);
    await move(potatoes.id, 20, "received", at("2026-08-17", "08:00:00.000"), 70);

    const row = await storeRow(potatoes.id);
    expect(row).toBeDefined();
    const byDate = new Map(row!.days.map((d) => [d.date, d]));

    expect(byDate.get("2026-08-15")!.purchasedValueMinor).toBe(10 * 65);
    expect(byDate.get("2026-08-17")!.purchasedValueMinor).toBe(20 * 70);
    // The period total is the sum of the days, not a re-valuation at the
    // current cost — this is the T8/costing-change promise.
    expect(row!.purchasedValueMinor).toBe(10 * 65 + 20 * 70);
  });

  test("splits transferred in and out by sign, on the right days", async () => {
    const potatoes = await ingredient();
    await move(potatoes.id, 8, "transferred", at("2026-08-15", "09:00:00.000"));
    await move(potatoes.id, -3, "transferred", at("2026-08-16", "09:00:00.000"));

    const row = await storeRow(potatoes.id);
    expect(row).toBeDefined();
    const byDate = new Map(row!.days.map((d) => [d.date, d]));

    expect(byDate.get("2026-08-15")).toMatchObject({ transferredIn: 8, transferredOut: 0 });
    expect(byDate.get("2026-08-16")).toMatchObject({ transferredIn: 0, transferredOut: 3 });
    expect(row!.transferredIn).toBe(8);
    expect(row!.transferredOut).toBe(3);
  });

  /**
   * The gap described in this describe block's header. A `corrected` row
   * must appear in a column of its own, signed, or closing moves with
   * nothing on screen to explain it.
   */
  test("surfaces a corrected movement in its own signed column rather than silently moving closing", async () => {
    const potatoes = await ingredient();
    await move(potatoes.id, 10, "received", at("2026-08-14", "09:00:00.000"), 65);
    await move(potatoes.id, 4, "corrected", at("2026-08-16", "10:00:00.000"));

    const row = await storeRow(potatoes.id);
    expect(row).toBeDefined();
    const byDate = new Map(row!.days.map((d) => [d.date, d]));

    expect(byDate.get("2026-08-16")!.corrected).toBe(4);
    expect(row!.corrected).toBe(4);
    // And it must not be misfiled as a purchase or a transfer.
    expect(byDate.get("2026-08-16")).toMatchObject({ purchasedQty: 0, transferredIn: 0 });
    expect(row!.closingQty).toBe(14);
  });

  test("a negative correction lowers the position and reads as a negative in the same column", async () => {
    const potatoes = await ingredient();
    await move(potatoes.id, 10, "received", at("2026-08-14", "09:00:00.000"), 65);
    await move(potatoes.id, -3, "corrected", at("2026-08-16", "10:00:00.000"));

    const row = await storeRow(potatoes.id);
    expect(row).toBeDefined();
    expect(row!.corrected).toBe(-3);
    // Not folded into spoilage or issues — a correction is neither.
    expect(row!.spoilage).toBe(0);
    expect(row!.issuedToKitchen).toBe(0);
    expect(row!.closingQty).toBe(7);
  });

  test("excludes reversed movements from every day column", async () => {
    const potatoes = await ingredient();
    await move(potatoes.id, 10, "received", at("2026-08-15", "08:00:00.000"), 65);
    const doomed = await move(potatoes.id, 5, "received", at("2026-08-15", "09:00:00.000"), 65);
    await testDb.ingredientMovement.update({
      where: { id: doomed.id },
      data: { reversed: true },
    });

    const row = await storeRow(potatoes.id);
    expect(row).toBeDefined();
    const byDate = new Map(row!.days.map((d) => [d.date, d]));
    expect(byDate.get("2026-08-15")!.purchasedQty).toBe(10);
    expect(row!.purchasedQty).toBe(10);
  });

  test("reconciles per day: closing == opening + purchased + in + corrected − issued − out − spoilage", async () => {
    const potatoes = await ingredient();
    await move(potatoes.id, 40, "received", at("2026-08-13", "12:00:00.000"), 60);
    await move(potatoes.id, 15, "received", at("2026-08-14", "08:00:00.000"), 65);
    await move(potatoes.id, -9, "issued", at("2026-08-14", "10:00:00.000"));
    await move(potatoes.id, 6, "transferred", at("2026-08-15", "09:00:00.000"));
    await move(potatoes.id, -2, "transferred", at("2026-08-16", "09:00:00.000"));
    await move(potatoes.id, -1, "wasted", at("2026-08-16", "15:00:00.000"));
    await move(potatoes.id, 3, "corrected", at("2026-08-17", "00:00:00.000"));
    await move(potatoes.id, -5, "issued", at("2026-08-18", "10:00:00.000"));

    const row = await storeRow(potatoes.id);
    expect(row).toBeDefined();

    for (const day of row!.days) {
      const closing =
        day.openingQty +
        day.purchasedQty +
        day.transferredIn +
        day.corrected -
        day.issuedToKitchen -
        day.transferredOut -
        day.spoilage;
      expect(day.closingQty).toBeCloseTo(closing, 6);
    }

    const periodClosing =
      row!.openingQty +
      row!.purchasedQty +
      row!.transferredIn +
      row!.corrected -
      row!.issuedToKitchen -
      row!.transferredOut -
      row!.spoilage;
    expect(periodClosing).toBeCloseTo(row!.closingQty, 6);
  });

  test("a day with no movement carries its opening straight through to its closing", async () => {
    const potatoes = await ingredient();
    await move(potatoes.id, 12, "received", at("2026-08-14", "09:00:00.000"), 65);

    const row = await storeRow(potatoes.id);
    expect(row).toBeDefined();
    const quiet = row!.days.filter((d) => d.date !== "2026-08-14");
    for (const day of quiet) {
      expect(day.closingQty).toBe(day.openingQty);
      expect(day.closingQty).toBe(12);
    }
  });
});
