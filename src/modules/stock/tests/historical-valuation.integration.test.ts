/**
 * Editable-ledger T8 — historical valuation.
 *
 * `getIngredientStockValueAtLocation` values stock *as of a past date* at
 * the ingredient's **current** `lastKnownCostMinor`. So the moment a price
 * moves — by a new delivery, or by the owner editing it — last month's
 * reported cost of goods sold silently changes with it.
 *
 * That is wrong today, independently of the editable ledger: formulas.md
 * §6's restaurant formula reads this figure at both period boundaries, so
 * the whole cost-of-goods-sold line moves. The editable ledger only makes
 * it obvious, because the owner will edit a price and watch a closed
 * month's profit shift underneath her. Plan §3.4 promises "price and cost
 * edits are not retroactive"; this is what makes the promise true, and it
 * has to land before T5/T6 expose price editing.
 *
 * The fix reads the cost **in force at the time** from the movement
 * history — `IngredientMovement.unitCostMinor` is snapshotted per delivery
 * and never rewritten, so the running average as at any date can be
 * rebuilt from the deliveries up to that date. Where no delivery precedes
 * the date, there is genuinely no cost in force, and the ingredient
 * contributes nothing rather than borrowing today's figure.
 */

import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";
import { hashPin } from "@/modules/people";
import type { AuthenticatedStaff } from "@/modules/people";
import { testDb } from "@/shared/test-db";
import { getIngredientStockValueAtLocation, recordStockMovement } from "../logic";
import { getProductLedger } from "@/modules/reporting";

let restaurantId: string;
let ingredientId: string;
let ownerId: string;

const at = (iso: string, time = "12:00:00.000") => new Date(`${iso}T${time}Z`);

function owner(): AuthenticatedStaff {
  return {
    staff: {
      id: ownerId,
      name: "Valuation Owner",
      phone: "+254700555001",
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
    data: { code: "restaurant", name: "Valuation Restaurant" },
  });
  restaurantId = restaurant.id;

  const ownerRow = await testDb.staffMember.create({
    data: {
      name: "Valuation Owner",
      phone: "+254700555001",
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

async function ingredient(lastKnownCostMinor: number | null) {
  const row = await testDb.ingredient.create({
    data: { name: "Beef", unitOfMeasure: "kg", lastKnownCostMinor },
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

describe("getIngredientStockValueAtLocation — values at the cost in force at the time", () => {
  test("a later price rise does not reshape an earlier valuation", async () => {
    // The bug, stated as a test. 10 kg bought at 100 on the 14th; the
    // ingredient's current cost is 300 because of a later delivery.
    await ingredient(300);
    await delivery(10, 100, at("2026-08-14"));
    await delivery(10, 500, at("2026-08-18"));

    // On the 15th only the first delivery had happened, so stock is 10 kg
    // at 100 = 1000. Valuing it at today's 300 would give 3000.
    expect(await valueAt(at("2026-08-15"))).toBe(1000);
  });

  test("each delivery keeps its own price as at a date", async () => {
    await ingredient(999);
    await delivery(10, 100, at("2026-08-14"));
    await delivery(10, 200, at("2026-08-16"));

    // Latest-price-wins (formulas.md §3, 2026-08-17): the two deliveries
    // stay separate layers, so the pile is worth 10*100 + 10*200. Averaging
    // gave 20 * 150 — the same total here only because nothing was issued
    // between them; it diverges the moment stock moves.
    expect(await valueAt(at("2026-08-17"))).toBe(10 * 100 + 10 * 200);
    // Before the second: 10 kg at 100.
    expect(await valueAt(at("2026-08-15"))).toBe(10 * 100);
  });

  test("issues draw down the oldest delivery first", async () => {
    await ingredient(999);
    await delivery(10, 100, at("2026-08-14"));
    await issue(4, at("2026-08-15"));

    // 6 kg left, still bought at 100.
    expect(await valueAt(at("2026-08-16"))).toBe(600);
  });

  test("a price rise leaves earlier stock at its own cost once some is issued", async () => {
    // Where averaging and layers actually part company. 10 @ 100, then
    // 10 @ 300, then 10 issued. Oldest-first leaves 10 @ 300 = 3000;
    // averaging would have left 10 @ 200 = 2000, having quietly moved
    // value from the new delivery onto the old stock.
    await ingredient(999);
    await delivery(10, 100, at("2026-08-14"));
    await delivery(10, 300, at("2026-08-16"));
    await issue(10, at("2026-08-17"));

    expect(await valueAt(at("2026-08-18"))).toBe(3000);
  });

  test("editing the ingredient's current cost leaves past valuations alone", async () => {
    // Plan §3.4's promise, directly: this is what the owner will do, and
    // what she must not see move.
    await ingredient(100);
    await delivery(10, 100, at("2026-08-14"));

    const before = await valueAt(at("2026-08-15"));

    await testDb.ingredient.update({
      where: { id: ingredientId },
      data: { lastKnownCostMinor: 900 },
    });

    expect(await valueAt(at("2026-08-15"))).toBe(before);
  });

  test("stock with no delivery falls back to the owner's own recorded cost", async () => {
    // Revised 2026-08-17. T8 originally withheld this figure entirely, on
    // the grounds that no delivery meant no cost was ever in force. But a
    // hand-entered lastKnownCostMinor is real data — the owner typed what
    // she paid — and 30 of the 38 production ingredients have exactly that
    // and no delivery yet. Excluding them understated stock she can see on
    // the shelf. It is used at both period boundaries, so it cannot invent
    // a cost-of-goods-sold movement either way.
    await ingredient(500);
    await testDb.ingredientMovement.create({
      data: {
        ingredientId,
        locationId: restaurantId,
        quantity: 5,
        reason: "corrected",
        staffMemberId: ownerId,
        occurredAt: at("2026-08-14"),
        isAmendment: true,
      },
    });

    expect(await valueAt(at("2026-08-15"))).toBe(5 * 500);
  });

  test("stock with no delivery and no recorded cost still contributes nothing", async () => {
    // The genuine "not zero, not a guess" case survives: with no price
    // anywhere, there is no honest figure to state. The quantity is still
    // visible on the Store ledger; only its valuation is withheld.
    await ingredient(null);
    await testDb.ingredientMovement.create({
      data: {
        ingredientId,
        locationId: restaurantId,
        quantity: 5,
        reason: "corrected",
        staffMemberId: ownerId,
        occurredAt: at("2026-08-14"),
        isAmendment: true,
      },
    });

    expect(await valueAt(at("2026-08-15"))).toBe(0);
  });

  test("a reversed delivery does not set the cost in force", async () => {
    await ingredient(999);
    await delivery(10, 100, at("2026-08-14"));
    const wrong = await delivery(10, 5000, at("2026-08-15"));
    await testDb.ingredientMovement.update({
      where: { id: wrong.id },
      data: { reversed: true, reversedAt: new Date(), reversedBy: ownerId },
    });
    await testDb.ingredientMovement.create({
      data: {
        ingredientId,
        locationId: restaurantId,
        quantity: -10,
        reason: "corrected",
        staffMemberId: ownerId,
        occurredAt: at("2026-08-15"),
        isAmendment: true,
        reversed: true,
        reversedAt: new Date(),
        reversedBy: ownerId,
      },
    });

    // The mistaken 5000 delivery is invisible, so the average stays 100.
    expect(await valueAt(at("2026-08-16"))).toBe(10 * 100);
  });

  test("values nothing when the date precedes every movement", async () => {
    await ingredient(300);
    await delivery(10, 100, at("2026-08-14"));

    expect(await valueAt(at("2026-08-10"))).toBe(0);
  });
});

/**
 * The product half of plan §3.4. Before T8 there was no historical product
 * cost anywhere in the schema — `sold` movements carried no
 * `costBasisMinor` — so the ledger valued *past* sales at the product's
 * *current* cost. Editing a price today therefore moved a closed month's
 * cost of goods sold and profit, which is exactly the trust the editable
 * ledger cannot afford to lose.
 */
describe("product cost of sales — snapshotted at the moment of sale", () => {
  let productId: string;

  async function product(costMinor: number, priceMinor = 300) {
    const row = await testDb.product.create({
      data: {
        name: "Sodas (500ml)",
        kind: "goods",
        locationId: restaurantId,
        priceMinor,
        lastKnownCostMinor: costMinor,
      },
    });
    productId = row.id;
    return row;
  }

  afterEach(async () => {
    await testDb.stockMovement.deleteMany({});
    await testDb.product.deleteMany({});
  });

  test("a sold movement records what it cost at the time", async () => {
    await product(180);
    await recordStockMovement(testDb, owner(), {
      productId,
      locationId: restaurantId,
      quantity: -4,
      reason: "sold",
    });

    const movement = await testDb.stockMovement.findFirst({ where: { reason: "sold" } });
    // The whole line's value, matching recordNonSalesConsumption's
    // convention rather than a per-unit figure.
    expect(movement?.costBasisMinor?.toNumber()).toBe(720);
    expect(movement?.isEstimated).toBe(false);
  });

  test("editing the product's cost afterwards leaves the past sale's cost alone", async () => {
    await product(180);
    await recordStockMovement(testDb, owner(), {
      productId,
      locationId: restaurantId,
      quantity: -4,
      reason: "sold",
    });

    await testDb.product.update({
      where: { id: productId },
      data: { lastKnownCostMinor: 900 },
    });

    const ledger = await getProductLedger(testDb, owner(), {
      periodStart: at("2026-08-01", "00:00:00.000"),
      periodEnd: new Date(Date.now() + 60_000),
    });
    expect(ledger.ok).toBe(true);
    if (!ledger.ok) return;
    const row = ledger.rows.find((r) => r.productId === productId);
    // 4 sold at the 180 in force then = 720, not 4 × 900 = 3600.
    expect(row?.costOfSalesMinor).toBe(720);
  });

  test("a transfer does not snapshot a cost — nothing is consumed", async () => {
    await product(180);
    await recordStockMovement(testDb, owner(), {
      productId,
      locationId: restaurantId,
      quantity: -2,
      reason: "transferred",
    });

    const movement = await testDb.stockMovement.findFirst({ where: { reason: "transferred" } });
    expect(movement?.costBasisMinor).toBeNull();
  });
});
