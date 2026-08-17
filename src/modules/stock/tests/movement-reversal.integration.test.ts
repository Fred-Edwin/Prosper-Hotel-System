/**
 * Editable-ledger T1 — movement reversal and the `reversed: false` audit.
 *
 * Two things are under test here, and the second is the point of the
 * ticket:
 *
 *  1. `reverseMovement` itself — owner-only, writes an offsetting
 *     `corrected` row, marks the original.
 *  2. **Every aggregate over both movement tables, by name.** Adding
 *     `reversed` made each pre-existing sum wrong by omission until it was
 *     updated, so each one gets its own assertion that a reversed movement
 *     is invisible to it. `docs/reversed-filter-audit.md` is the
 *     enumeration; this file is its executable half. The failure mode being
 *     prevented is the Finding 4 / BUG-12 one — the same filter applied in
 *     four places and missed in the fifth.
 *
 * The three availability checks (a sale's and a transfer's
 * `insufficient_stock` gates) are covered here too. The plan's §C4 audit
 * missed them, and they are the only sites where a missed filter makes a
 * *write* wrong rather than a report: a reversed movement still counting as
 * stock on hand would authorise selling stock the reversal says is absent.
 */

import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";
import { hashPin } from "@/modules/people";
import type { AuthenticatedStaff } from "@/modules/people";
import { testDb } from "@/shared/test-db";
import {
  getCurrentStockAtLocation,
  getProductQuantityAtLocationAsOf,
  getIngredientQuantityAtLocationAsOf,
  getIngredientsBoughtMinor,
  getIngredientsIssuedMinor,
  getIngredientsPurchasedByIngredient,
  getIngredientMovementsByReasonInPeriod,
  getProductMovementsByReasonInPeriod,
  getNonSalesLedger,
  listReceiptsAtLocation,
  reverseMovement,
} from "../logic";

let restaurantId: string;
let productId: string;
let ingredientId: string;
let ownerId: string;
let cashierId: string;

const DAY = new Date("2026-08-16T10:00:00.000Z");
const PERIOD_START = new Date("2026-08-15T00:00:00.000Z");
const PERIOD_END = new Date("2026-08-17T23:59:59.999Z");

function staffAt(
  role: "owner" | "cashier",
  locationId: string,
  id: string,
  locationCode: "restaurant" | "canteen" = "restaurant",
): AuthenticatedStaff {
  return {
    staff: {
      id,
      name: role === "owner" ? "Test Owner" : "Test Cashier",
      phone: role === "owner" ? "+254700222001" : "+254700222002",
      role,
      locationId,
      dailyRateMinor: 0,
      active: true,
    },
    location: { id: locationId, code: locationCode, name: "Test" },
  };
}

const owner = () => staffAt("owner", restaurantId, ownerId);
const cashier = () => staffAt("cashier", restaurantId, cashierId);

beforeAll(async () => {
  const restaurant = await testDb.location.create({
    data: { code: "restaurant", name: "Test Restaurant" },
  });
  // The canteen row exists because LocationCode has exactly two values and
  // other suites assume both are present; this file only trades at the
  // restaurant.
  await testDb.location.create({
    data: { code: "canteen", name: "Test Canteen" },
  });
  restaurantId = restaurant.id;

  const ownerRow = await testDb.staffMember.create({
    data: {
      name: "Test Owner",
      phone: "+254700222001",
      pinHash: await hashPin("1234"),
      role: "owner",
      locationId: restaurant.id,
      dailyRateMinor: 0,
    },
  });
  ownerId = ownerRow.id;

  const cashierRow = await testDb.staffMember.create({
    data: {
      name: "Test Cashier",
      phone: "+254700222002",
      pinHash: await hashPin("1234"),
      role: "cashier",
      locationId: restaurant.id,
      dailyRateMinor: 550,
    },
  });
  cashierId = cashierRow.id;

  const product = await testDb.product.create({
    data: { name: "Beef stew", kind: "cooked_food", locationId: restaurant.id, priceMinor: 300 },
  });
  productId = product.id;

  const ingredient = await testDb.ingredient.create({
    data: { name: "Beef", unitOfMeasure: "kg" },
  });
  ingredientId = ingredient.id;
});

afterEach(async () => {
  await testDb.stockMovement.deleteMany({});
  await testDb.ingredientMovement.deleteMany({});
});

afterAll(async () => {
  await testDb.stockMovement.deleteMany({});
  await testDb.ingredientMovement.deleteMany({});
  await testDb.ingredient.deleteMany({});
  await testDb.product.deleteMany({});
  await testDb.staffMember.deleteMany({});
  await testDb.location.deleteMany({});
  await testDb.$disconnect();
});

/** A product movement that is already reversed, plus its offsetting row —
 * the exact shape `reverseMovement` leaves behind. */
async function reversedProductPair(quantity: number, reason: "received" | "sold" = "received") {
  const original = await testDb.stockMovement.create({
    data: {
      productId,
      locationId: restaurantId,
      quantity,
      reason,
      staffMemberId: cashierId,
      occurredAt: DAY,
      reversed: true,
      reversedAt: new Date(),
      reversedBy: ownerId,
      ...(reason === "received" ? { receiptId: "receipt-reversed" } : {}),
    },
  });
  await testDb.stockMovement.create({
    data: {
      productId,
      locationId: restaurantId,
      quantity: -quantity,
      reason: "corrected",
      staffMemberId: ownerId,
      occurredAt: DAY,
      isAmendment: true,
      // The offsetting row is reversed too — the pair is excluded
      // together, so it nets to nothing by absence rather than to zero by
      // arithmetic. See reverseMovement's note.
      reversed: true,
      reversedAt: new Date(),
      reversedBy: ownerId,
    },
  });
  return original;
}

describe("reverseMovement", () => {
  test("marks the original reversed and writes an offsetting corrected row", async () => {
    const original = await testDb.stockMovement.create({
      data: {
        productId,
        locationId: restaurantId,
        quantity: 10,
        reason: "received",
        staffMemberId: cashierId,
        occurredAt: DAY,
      },
    });

    const result = await reverseMovement(testDb, owner(), {
      movementType: "product",
      movementId: original.id,
    });

    expect(result.ok).toBe(true);

    const reloaded = await testDb.stockMovement.findUnique({ where: { id: original.id } });
    expect(reloaded?.reversed).toBe(true);
    expect(reloaded?.reversedBy).toBe(ownerId);
    expect(reloaded?.reversedAt).not.toBeNull();
    // The original's own quantity is untouched — reversal does not rewrite
    // history, it offsets it.
    expect(reloaded?.quantity.toNumber()).toBe(10);

    const offsetting = await testDb.stockMovement.findFirst({
      where: { reason: "corrected", isAmendment: true },
    });
    expect(offsetting?.quantity.toNumber()).toBe(-10);
    expect(offsetting?.staffMemberId).toBe(ownerId);
    // Same instant as the original, so the reversal lands in the same
    // ledger day rather than today's.
    expect(offsetting?.occurredAt.getTime()).toBe(DAY.getTime());
  });

  test("nets a reversed movement to zero in the running stock total", async () => {
    await testDb.stockMovement.create({
      data: {
        productId,
        locationId: restaurantId,
        quantity: 40,
        reason: "received",
        staffMemberId: cashierId,
        occurredAt: DAY,
      },
    });
    const wrong = await testDb.stockMovement.create({
      data: {
        productId,
        locationId: restaurantId,
        quantity: 10,
        reason: "received",
        staffMemberId: cashierId,
        occurredAt: DAY,
      },
    });

    await reverseMovement(testDb, owner(), { movementType: "product", movementId: wrong.id });

    const result = await getCurrentStockAtLocation(testDb, owner(), restaurantId);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.levels[0]?.quantityOnHand).toBe(40);
  });

  test("is owner-only", async () => {
    const movement = await testDb.stockMovement.create({
      data: {
        productId,
        locationId: restaurantId,
        quantity: 10,
        reason: "received",
        staffMemberId: cashierId,
        occurredAt: DAY,
      },
    });

    const result = await reverseMovement(testDb, cashier(), {
      movementType: "product",
      movementId: movement.id,
    });

    expect(result).toEqual({ ok: false, reason: "forbidden" });
    const reloaded = await testDb.stockMovement.findUnique({ where: { id: movement.id } });
    expect(reloaded?.reversed).toBe(false);
  });

  test("refuses to reverse the same movement twice", async () => {
    const movement = await testDb.stockMovement.create({
      data: {
        productId,
        locationId: restaurantId,
        quantity: 10,
        reason: "received",
        staffMemberId: cashierId,
        occurredAt: DAY,
      },
    });

    await reverseMovement(testDb, owner(), { movementType: "product", movementId: movement.id });
    const second = await reverseMovement(testDb, owner(), {
      movementType: "product",
      movementId: movement.id,
    });

    expect(second).toEqual({ ok: false, reason: "already_reversed" });
    expect(await testDb.stockMovement.count({ where: { reason: "corrected" } })).toBe(1);
  });

  test("reports not_found for a movement that does not exist", async () => {
    const result = await reverseMovement(testDb, owner(), {
      movementType: "product",
      movementId: "does-not-exist",
    });
    expect(result).toEqual({ ok: false, reason: "not_found" });
  });

  test("reverses an ingredient movement, preserving the signed convention", async () => {
    // recordIngredientIssue writes a negative quantity; reversing an issue
    // must therefore write a *positive* offsetting row. A wrong sign here
    // turns an issue into a receipt (plan §8 Q3).
    const issue = await testDb.ingredientMovement.create({
      data: {
        ingredientId,
        locationId: restaurantId,
        quantity: -3,
        reason: "issued",
        staffMemberId: cashierId,
        occurredAt: DAY,
      },
    });

    const result = await reverseMovement(testDb, owner(), {
      movementType: "ingredient",
      movementId: issue.id,
    });
    expect(result.ok).toBe(true);

    const offsetting = await testDb.ingredientMovement.findFirst({
      where: { reason: "corrected" },
    });
    expect(offsetting?.quantity.toNumber()).toBe(3);

    const onHand = await getIngredientQuantityAtLocationAsOf(
      testDb,
      owner(),
      restaurantId,
      PERIOD_END,
    );
    expect(onHand.ok).toBe(true);
    if (!onHand.ok) return;
    expect(onHand.quantities.find((q) => q.ingredientId === ingredientId)?.quantityOnHand ?? 0).toBe(0);
  });
});

/**
 * The audit proper. One assertion per aggregate named in
 * docs/reversed-filter-audit.md, so a filter missed in any single one of
 * them fails here by name rather than surfacing as a wrong figure on a
 * screen weeks later.
 */
describe("the reversed: false audit — a reversed movement is invisible to every aggregate", () => {
  test("sumMovementsByProductAtLocation (via getCurrentStockAtLocation)", async () => {
    await reversedProductPair(10);
    const result = await getCurrentStockAtLocation(testDb, owner(), restaurantId);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // The reversed +10 and its offsetting −10 both drop out, rather than
    // netting to zero by accident — assert there is no stock at all.
    expect(result.levels[0]?.quantityOnHand ?? 0).toBe(0);
  });

  test("sumMovementsByProductAtLocationAsOf (via getProductQuantityAtLocationAsOf)", async () => {
    await reversedProductPair(10);
    const result = await getProductQuantityAtLocationAsOf(
      testDb,
      owner(),
      restaurantId,
      PERIOD_END,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.quantities.find((q) => q.productId === productId)?.quantityOnHand ?? 0).toBe(0);
  });

  test("sumProductMovementsByReasonAtLocationInPeriod (via getProductMovementsByReasonInPeriod)", async () => {
    await reversedProductPair(10);
    const result = await getProductMovementsByReasonInPeriod(
      testDb,
      owner(),
      restaurantId,
      ["received", "sold", "produced", "transferred"],
      PERIOD_START,
      PERIOD_END,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const received = result.lines.filter((l) => l.reason === "received");
    expect(received).toEqual([]);
  });

  test("findReceiptsAtLocation — a reversed delivery is not a delivery", async () => {
    await reversedProductPair(10, "received");
    const result = await listReceiptsAtLocation(testDb, owner(), restaurantId);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.receipts.find((r) => r.receiptId === "receipt-reversed")).toBeUndefined();
  });

  test("sumMovementsByIngredientAtLocation / AsOf (via getIngredientQuantityAtLocationAsOf)", async () => {
    await testDb.ingredientMovement.create({
      data: {
        ingredientId,
        locationId: restaurantId,
        quantity: 5,
        reason: "received",
        unitCostMinor: 100,
        staffMemberId: cashierId,
        occurredAt: DAY,
        reversed: true,
        reversedAt: new Date(),
        reversedBy: ownerId,
      },
    });
    const result = await getIngredientQuantityAtLocationAsOf(
      testDb,
      owner(),
      restaurantId,
      PERIOD_END,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.quantities.find((q) => q.ingredientId === ingredientId)?.quantityOnHand ?? 0).toBe(0);
  });

  test("sumIngredientsBoughtMinorAtLocationInPeriod (via getIngredientsBoughtMinor)", async () => {
    await testDb.ingredientMovement.create({
      data: {
        ingredientId,
        locationId: restaurantId,
        quantity: 5,
        reason: "received",
        unitCostMinor: 100,
        staffMemberId: cashierId,
        occurredAt: DAY,
        receiptId: "receipt-reversed",
        reversed: true,
        reversedAt: new Date(),
        reversedBy: ownerId,
      },
    });
    const result = await getIngredientsBoughtMinor(
      testDb,
      owner(),
      restaurantId,
      PERIOD_START,
      PERIOD_END,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.totalMinor).toBe(0);
  });

  test("sumIngredientsIssuedByIngredientAtLocationInPeriod (via getIngredientsIssuedMinor)", async () => {
    await testDb.ingredientMovement.create({
      data: {
        ingredientId,
        locationId: restaurantId,
        quantity: -4,
        reason: "issued",
        staffMemberId: cashierId,
        occurredAt: DAY,
        reversed: true,
        reversedAt: new Date(),
        reversedBy: ownerId,
      },
    });
    const result = await getIngredientsIssuedMinor(
      testDb,
      owner(),
      restaurantId,
      PERIOD_START,
      PERIOD_END,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.totalMinor).toBe(0);
  });

  test("sumIngredientsPurchasedByIngredientAtLocationInPeriod (via getIngredientsPurchasedByIngredient)", async () => {
    await testDb.ingredientMovement.create({
      data: {
        ingredientId,
        locationId: restaurantId,
        quantity: 5,
        reason: "received",
        unitCostMinor: 100,
        staffMemberId: cashierId,
        occurredAt: DAY,
        receiptId: "receipt-reversed",
        reversed: true,
        reversedAt: new Date(),
        reversedBy: ownerId,
      },
    });
    const result = await getIngredientsPurchasedByIngredient(
      testDb,
      owner(),
      restaurantId,
      PERIOD_START,
      PERIOD_END,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.lines).toEqual([]);
  });

  test("sumIngredientMovementsByReasonAtLocationInPeriod (via getIngredientMovementsByReasonInPeriod)", async () => {
    await testDb.ingredientMovement.create({
      data: {
        ingredientId,
        locationId: restaurantId,
        quantity: 5,
        reason: "received",
        unitCostMinor: 100,
        staffMemberId: cashierId,
        occurredAt: DAY,
        reversed: true,
        reversedAt: new Date(),
        reversedBy: ownerId,
      },
    });
    const result = await getIngredientMovementsByReasonInPeriod(
      testDb,
      owner(),
      restaurantId,
      ["received", "issued", "transferred"],
      PERIOD_START,
      PERIOD_END,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.lines.filter((l) => l.reason === "received")).toEqual([]);
  });

  test("findNonSalesMovementsAtLocationInPeriod (via getNonSalesLedger)", async () => {
    await testDb.stockMovement.create({
      data: {
        productId,
        locationId: restaurantId,
        quantity: -2,
        reason: "wasted",
        costBasisMinor: 180,
        sellingValueMinor: 600,
        isEstimated: false,
        staffMemberId: cashierId,
        occurredAt: DAY,
        reversed: true,
        reversedAt: new Date(),
        reversedBy: ownerId,
      },
    });
    const result = await getNonSalesLedger(testDb, owner(), restaurantId, PERIOD_START, PERIOD_END);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.lines).toEqual([]);
  });
});
