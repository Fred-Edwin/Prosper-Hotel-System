/**
 * Latest-price-wins costing — replaces formulas.md §3's running average.
 *
 * The bug that prompted this: the owner's ledger showed cost of goods sold
 * of −72.6 on a day nothing was sold.
 *
 * §6 values stock at a period's two boundaries using each item's cost, and
 * purchases enter at the price actually paid. Averaging made those two
 * figures disagree — a delivery's own units were valued at the blend, not
 * at what was paid for them. Potatoes had 3.5 units on hand from an
 * unpriced stock count (a count records how many, never what they cost)
 * carrying the owner's own 326.79; 12 arrived at 300; the average became
 * 306.05. The 12 new units cost 300 each and were valued at 306.05:
 *
 *   12 × (306.05 − 300) = 72.60
 *
 * Two rules replace the average:
 *
 *   1. A delivery *sets* the cost to the price paid. No blending — the
 *      price the owner types is the price the system uses.
 *   2. Stock already on hand keeps the cost it already had. A new price
 *      applies from its own delivery forward, never backwards.
 *
 * Both rules are required, and neither works alone. Rule 1 makes purchases
 * and valuation agree, closing the −72.6. Rule 2 (T8's historical
 * valuation) keeps the older units at their own cost — without it, rule 1
 * stamps the new price on stock already on hand and turns the −72.60 into
 * a +93.77, which is the retroactive repricing the owner explicitly asked
 * us to prevent.
 */

import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";
import { hashPin } from "@/modules/people";
import type { AuthenticatedStaff } from "@/modules/people";
import { testDb } from "@/shared/test-db";
import { recordIngredientCost } from "@/modules/catalogue";
import { getIngredientStockValueAtLocation } from "../logic";

let restaurantId: string;
let ingredientId: string;
let ownerId: string;

const at = (iso: string, time = "12:00:00.000") => new Date(`${iso}T${time}Z`);

function owner(): AuthenticatedStaff {
  return {
    staff: {
      id: ownerId,
      name: "Costing Owner",
      phone: "+254700555002",
      role: "owner",
      locationId: restaurantId,
      dailyRateMinor: 0,
      active: true,
    },
    location: { id: restaurantId, code: "restaurant", name: "Test" },
  };
}

beforeAll(async () => {
  await testDb.ingredientMovement.deleteMany({});
  await testDb.ingredient.deleteMany({});
  await testDb.staffMember.deleteMany({});
  await testDb.location.deleteMany({});

  const restaurant = await testDb.location.create({
    data: { code: "restaurant", name: "Costing Restaurant" },
  });
  restaurantId = restaurant.id;

  const ownerRow = await testDb.staffMember.create({
    data: {
      name: "Costing Owner",
      phone: "+254700555002",
      pinHash: await hashPin("1234"),
      role: "owner",
      locationId: restaurant.id,
      dailyRateMinor: 0,
    },
  });
  ownerId = ownerRow.id;
});

afterEach(async () => {
  await testDb.ingredientMovement.deleteMany({});
  await testDb.ingredient.deleteMany({});
});

afterAll(async () => {
  await testDb.ingredientMovement.deleteMany({});
  await testDb.ingredient.deleteMany({});
  await testDb.staffMember.deleteMany({});
  await testDb.location.deleteMany({});
  await testDb.$disconnect();
});

async function ingredient(lastKnownCostMinor: number | null, name = "Potatoes") {
  const row = await testDb.ingredient.create({
    data: { name, unitOfMeasure: "kg", lastKnownCostMinor },
  });
  ingredientId = row.id;
  return row;
}

async function delivery(quantity: number, unitCostMinor: number, occurredAt: Date) {
  return testDb.ingredientMovement.create({
    data: {
      ingredientId,
      locationId: restaurantId,
      quantity,
      reason: "received",
      unitCostMinor,
      staffMemberId: ownerId,
      occurredAt,
      receiptId: `receipt-${occurredAt.toISOString()}`,
    },
  });
}

/**
 * A stock count correction: quantity only, no unit cost. This is the shape
 * that seeded the production bug — the owner says what is on the shelf, and
 * the system has no purchase price to attach to it.
 */
async function correction(quantity: number, occurredAt: Date) {
  return testDb.ingredientMovement.create({
    data: {
      ingredientId,
      locationId: restaurantId,
      quantity,
      reason: "corrected",
      staffMemberId: ownerId,
      occurredAt,
    },
  });
}

async function issue(quantity: number, occurredAt: Date) {
  return testDb.ingredientMovement.create({
    data: {
      ingredientId,
      locationId: restaurantId,
      quantity: -quantity,
      reason: "issued",
      staffMemberId: ownerId,
      occurredAt,
    },
  });
}

async function valueAt(asOf: Date) {
  const result = await getIngredientStockValueAtLocation(testDb, owner(), restaurantId, asOf);
  if (!result.ok) throw new Error(`valuation failed: ${result.reason}`);
  return result.totalMinor;
}

async function costAfterDelivery(unitCostMinor: number) {
  const result = await recordIngredientCost(testDb, owner(), ingredientId, { unitCostMinor });
  if (!result.ok) throw new Error(`recordIngredientCost failed: ${result.reason}`);
  return result.value.lastKnownCostMinor;
}

describe("a delivery sets the cost to the price paid", () => {
  test("1,000 then 1,500 reads 1,500 — not the 1,250 average", async () => {
    // The client's own worked example. Averaging gives 1,250; the rule she
    // asked for gives the price she actually typed.
    await ingredient(1000);
    expect(await costAfterDelivery(1500)).toBe(1500);
  });

  test("a price fall is taken just as literally as a price rise", async () => {
    await ingredient(1500);
    expect(await costAfterDelivery(1000)).toBe(1000);
  });

  test("the owner's hand-entered cost stands until a real delivery replaces it", async () => {
    // 30 of the 38 production ingredients have a cost the admin typed but
    // no delivery on record. That figure is real data, not a placeholder —
    // it survives untouched until an actual purchase supersedes it.
    const row = await ingredient(326.79);
    expect(row.lastKnownCostMinor?.toNumber()).toBe(326.79);

    expect(await costAfterDelivery(300)).toBe(300);
  });

  test("quantity on hand has no bearing on the resulting cost", async () => {
    // Under averaging, the pile size decided how far the new price moved
    // the figure. Now it is irrelevant — the same delivery price yields the
    // same cost whether there were 3 units on hand or 300.
    await ingredient(1000);
    await correction(3, at("2026-08-14"));
    const small = await costAfterDelivery(1500);

    await ingredient(1000, "Onions");
    await correction(300, at("2026-08-14"));
    const large = await costAfterDelivery(1500);

    expect(small).toBe(large);
  });
});

describe("a new price never reaches backwards", () => {
  test("an earlier valuation is byte-identical before and after a later delivery", async () => {
    // The non-retroactivity rule, stated as a test: take a reading, let a
    // price change land after it, take the same reading again.
    await ingredient(100);
    await delivery(10, 100, at("2026-08-14"));

    const before = await valueAt(at("2026-08-15"));

    await delivery(10, 300, at("2026-08-16"));

    expect(await valueAt(at("2026-08-15"))).toBe(before);
  });

  test("stock bought at the old price keeps the old price", async () => {
    // 10 kg at 100 on the 14th, 10 kg at 300 on the 16th. The closing pile
    // is worth 1,000 + 3,000 — not 20 × 300, which would re-price the first
    // delivery, and not 20 × 200, which would average it away.
    await ingredient(100);
    await delivery(10, 100, at("2026-08-14"));
    await delivery(10, 300, at("2026-08-16"));

    expect(await valueAt(at("2026-08-17"))).toBe(4000);
  });

  test("stock is drawn down oldest first", async () => {
    // 10 @ 100, then 10 @ 300, then 10 issued. The 100-cost layer goes
    // first, leaving 10 @ 300.
    await ingredient(100);
    await delivery(10, 100, at("2026-08-14"));
    await delivery(10, 300, at("2026-08-16"));
    await issue(10, at("2026-08-17"));

    expect(await valueAt(at("2026-08-18"))).toBe(3000);
  });
});

describe("the −72.6 case", () => {
  test("unpriced count stock plus a cheaper delivery no longer invents a loss", async () => {
    // Production's exact shape, to the cent: 3.5 units from an unpriced
    // correction carrying the owner's hand-entered 326.79, then 12 received
    // at 300 the next day.
    await ingredient(326.79);
    await correction(3.5, at("2026-08-16", "20:59:00.000"));

    const opening = await valueAt(at("2026-08-17", "00:00:00.000"));
    expect(opening).toBeCloseTo(3.5 * 326.79, 2);

    await delivery(12, 300, at("2026-08-17", "13:12:00.928"));

    // The 3.5 units keep 326.79; the 12 new ones are worth 300 each.
    // Averaging produced 15.5 × 306.05 = 4,743.78 and a 72.59 shortfall.
    const closing = await valueAt(at("2026-08-17", "23:59:59.999"));
    expect(closing).toBeCloseTo(3.5 * 326.79 + 12 * 300, 2);

    // formulas.md §6 with nothing sold: opening + purchases − closing.
    const purchases = 12 * 300;
    expect(closing - opening - purchases).toBeCloseTo(0, 2);
  });

  test("nothing bought and nothing sold leaves the valuation flat", async () => {
    // The invariant that would have caught this the day it shipped.
    await ingredient(326.79);
    await correction(3.5, at("2026-08-16"));

    const opening = await valueAt(at("2026-08-17", "00:00:00.000"));
    const closing = await valueAt(at("2026-08-17", "23:59:59.999"));

    expect(closing - opening).toBe(0);
  });

  test("unpriced correction stock falls back to the ingredient's own cost", async () => {
    // A correction carries no price of its own, so the layer borrows the
    // ingredient's recorded cost — the owner's figure, the best there is.
    // Excluding it would understate stock she can see on the shelf.
    await ingredient(140);
    await correction(6, at("2026-08-16"));

    expect(await valueAt(at("2026-08-17"))).toBeCloseTo(6 * 140, 2);
  });

  test("stock with no cost anywhere contributes nothing rather than guessing", async () => {
    // No delivery, no hand-entered cost: there is genuinely no honest
    // figure to state. formulas.md's "not zero, not a guess" — the quantity
    // still shows on the Store ledger, only the valuation is withheld.
    await ingredient(null);
    await correction(6, at("2026-08-16"));

    expect(await valueAt(at("2026-08-17"))).toBe(0);
  });
});
