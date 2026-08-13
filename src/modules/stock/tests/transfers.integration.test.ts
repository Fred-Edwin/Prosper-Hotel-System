import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { hashPin } from "@/modules/people";
import type { AuthenticatedStaff } from "@/modules/people";
import {
  cancelPendingTransfer,
  confirmTransfer,
  getConfirmedTransfersSentFromLocation,
  getCurrentStockAtLocation,
  getPendingTransfersAtLocation,
  listTransfersAtLocation,
  recordTransfer,
  recordTransfers,
  reverseTransfer,
} from "../logic";
import { testDb } from "@/shared/test-db";

let restaurantId: string;
let canteenId: string;
let productId: string;
let ingredientId: string;
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
      phone: "+254700112001",
      role,
      locationId,
      dailyRateMinor: 0,
      active: true,
    },
    location: { id: locationId, code: "restaurant", name: "Test" },
  };
}

beforeEach(async () => {
  await testDb.transfer.deleteMany({});
  await testDb.stockMovement.deleteMany({});
  await testDb.ingredientMovement.deleteMany({});
  await testDb.product.deleteMany({});
  await testDb.ingredient.deleteMany({});
  await testDb.staffMember.deleteMany({});
  await testDb.location.deleteMany({});

  const [restaurant, canteen] = await Promise.all([
    testDb.location.create({ data: { code: "restaurant", name: "Test Restaurant" } }),
    testDb.location.create({ data: { code: "canteen", name: "Test Canteen" } }),
  ]);
  restaurantId = restaurant.id;
  canteenId = canteen.id;

  const manager = await testDb.staffMember.create({
    data: {
      name: "Test Store Manager",
      phone: "+254700112002",
      pinHash: await hashPin("1234"),
      role: "store_manager",
      locationId: restaurant.id,
      dailyRateMinor: 0,
    },
  });
  storeManagerId = manager.id;

  const [product, ingredient] = await Promise.all([
    testDb.product.create({ data: { name: "Sodas (500ml)", kind: "goods", priceMinor: 100 } }),
    testDb.ingredient.create({ data: { name: "Flour", unitOfMeasure: "kg" } }),
  ]);
  productId = product.id;
  ingredientId = ingredient.id;

  await testDb.stockMovement.create({
    data: {
      productId,
      locationId: restaurantId,
      quantity: 12,
      reason: "received",
      staffMemberId: storeManagerId,
    },
  });
  await testDb.ingredientMovement.createMany({
    data: [restaurantId, canteenId].map((locationId) => ({
      ingredientId,
      locationId,
      quantity: 9,
      reason: "received" as const,
      unitCostMinor: 8000,
      receiptId: `seed-receipt-${locationId}`,
      staffMemberId: storeManagerId,
    })),
  });
});

afterAll(async () => {
  await testDb.transfer.deleteMany({});
  await testDb.stockMovement.deleteMany({});
  await testDb.ingredientMovement.deleteMany({});
  await testDb.product.deleteMany({});
  await testDb.ingredient.deleteMany({});
  await testDb.staffMember.deleteMany({});
  await testDb.location.deleteMany({});
  await testDb.$disconnect();
});

// 2026-08-13 — REQ-02 Part A: a transfer is now two steps. recordTransfer(s)
// only writes the outgoing side and creates a pending Transfer; the
// receiver's stock does not move until confirmTransfer.
describe("recordTransfer(s) — sending, pending", () => {
  test("records all draft lines as separate pending transfers, sender's stock leaves immediately", async () => {
    const result = await recordTransfers(testDb, staffAt("store_manager", restaurantId), {
      fromLocationId: restaurantId,
      toLocationId: canteenId,
      lines: [
        { itemType: "product", itemId: productId, quantity: 4 },
        { itemType: "ingredient", itemId: ingredientId, quantity: 3 },
      ],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.transfers).toHaveLength(2);
    expect(result.transfers.every((t) => t.status === "pending")).toBe(true);

    const restaurantStock = await getCurrentStockAtLocation(
      testDb,
      staffAt("store_manager", restaurantId),
      restaurantId,
    );
    expect(restaurantStock).toMatchObject({ ok: true, levels: [{ productId, quantityOnHand: 8 }] });
  });

  test("sender's stock leaves but receiver's does not increase until confirmed", async () => {
    const result = await recordTransfer(testDb, staffAt("store_manager", restaurantId), {
      fromLocationId: restaurantId,
      toLocationId: canteenId,
      itemType: "product",
      itemId: productId,
      quantity: 4,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.transfers[0]).toMatchObject({
      fromLocationId: restaurantId,
      toLocationId: canteenId,
      itemType: "product",
      itemId: productId,
      sentQuantity: 4,
      status: "pending",
    });

    const [restaurantStock, canteenStock] = await Promise.all([
      getCurrentStockAtLocation(testDb, staffAt("store_manager", restaurantId), restaurantId),
      getCurrentStockAtLocation(testDb, staffAt("owner", restaurantId), canteenId),
    ]);
    expect(restaurantStock).toMatchObject({ ok: true, levels: [{ productId, quantityOnHand: 8 }] });
    expect(canteenStock).toMatchObject({ ok: true, levels: [] });
  });

  test.each([
    [0, "invalid_quantity"],
    [-1, "invalid_quantity"],
  ])("rejects a non-positive quantity", async (quantity, reason) => {
    await expect(
      recordTransfer(testDb, staffAt("store_manager", restaurantId), {
        fromLocationId: restaurantId,
        toLocationId: canteenId,
        itemType: "product",
        itemId: productId,
        quantity,
      }),
    ).resolves.toEqual({ ok: false, reason });
  });

  test("rejects transfers to the same location and stock the source does not hold", async () => {
    await expect(
      recordTransfer(testDb, staffAt("store_manager", restaurantId), {
        fromLocationId: restaurantId,
        toLocationId: restaurantId,
        itemType: "product",
        itemId: productId,
        quantity: 1,
      }),
    ).resolves.toEqual({ ok: false, reason: "same_location" });

    await expect(
      recordTransfer(testDb, staffAt("store_manager", restaurantId), {
        fromLocationId: restaurantId,
        toLocationId: canteenId,
        itemType: "product",
        itemId: productId,
        quantity: 13,
      }),
    ).resolves.toEqual({ ok: false, reason: "insufficient_stock" });
  });

  test("rejects inactive items and cashier transfers", async () => {
    await testDb.product.update({ where: { id: productId }, data: { active: false } });
    await expect(
      recordTransfer(testDb, staffAt("store_manager", restaurantId), {
        fromLocationId: restaurantId,
        toLocationId: canteenId,
        itemType: "product",
        itemId: productId,
        quantity: 1,
      }),
    ).resolves.toEqual({ ok: false, reason: "inactive_item" });

    await expect(
      recordTransfer(testDb, staffAt("cashier", restaurantId), {
        fromLocationId: restaurantId,
        toLocationId: canteenId,
        itemType: "ingredient",
        itemId: ingredientId,
        quantity: 1,
      }),
    ).resolves.toEqual({ ok: false, reason: "forbidden" });
  });

  test("transfers an ingredient in the opposite direction (canteen to restaurant)", async () => {
    const attendant = await testDb.staffMember.create({
      data: {
        name: "Test Attendant",
        phone: "+254700112003",
        pinHash: await hashPin("1234"),
        role: "attendant",
        locationId: canteenId,
        dailyRateMinor: 0,
      },
    });

    const result = await recordTransfer(testDb, staffAt("attendant", canteenId, attendant.id), {
      fromLocationId: canteenId,
      toLocationId: restaurantId,
      itemType: "ingredient",
      itemId: ingredientId,
      quantity: 3,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.transfers[0]).toMatchObject({
      fromLocationId: canteenId,
      toLocationId: restaurantId,
      itemType: "ingredient",
      itemId: ingredientId,
      sentQuantity: 3,
      status: "pending",
    });
  });
});

describe("confirmTransfer — receiving", () => {
  test("confirming the sent quantity moves stock to the receiver", async () => {
    const sent = await recordTransfer(testDb, staffAt("store_manager", restaurantId), {
      fromLocationId: restaurantId,
      toLocationId: canteenId,
      itemType: "product",
      itemId: productId,
      quantity: 4,
    });
    if (!sent.ok) throw new Error("expected transfer");

    const attendant = staffAt("attendant", canteenId);
    const confirmed = await confirmTransfer(testDb, attendant, {
      transferId: sent.transfers[0].id,
      confirmedQuantity: 4,
    });
    expect(confirmed.ok).toBe(true);
    if (!confirmed.ok) return;
    expect(confirmed.transfer.status).toBe("confirmed");
    expect(confirmed.transfer.confirmedQuantity).toBe(4);

    const canteenStock = await getCurrentStockAtLocation(testDb, staffAt("owner", restaurantId), canteenId);
    expect(canteenStock).toMatchObject({ ok: true, levels: [{ productId, quantityOnHand: 4 }] });
  });

  test("confirming less than sent writes a transfer_shortfall movement for the gap", async () => {
    const sent = await recordTransfer(testDb, staffAt("store_manager", restaurantId), {
      fromLocationId: restaurantId,
      toLocationId: canteenId,
      itemType: "product",
      itemId: productId,
      quantity: 4,
    });
    if (!sent.ok) throw new Error("expected transfer");

    const attendant = staffAt("attendant", canteenId);
    const confirmed = await confirmTransfer(testDb, attendant, {
      transferId: sent.transfers[0].id,
      confirmedQuantity: 3,
    });
    expect(confirmed.ok).toBe(true);

    // The 1 lost in transit is already reflected by only 3 arriving
    // (the sender's -4 already happened at send time) — the shortfall
    // marker below carries quantity 0, so it doesn't double-deduct.
    const canteenStock = await getCurrentStockAtLocation(testDb, staffAt("owner", restaurantId), canteenId);
    expect(canteenStock).toMatchObject({ ok: true, levels: [{ productId, quantityOnHand: 3 }] });

    const shortfallMovement = await testDb.stockMovement.findFirst({
      where: { productId, locationId: canteenId, reason: "transfer_shortfall" },
    });
    expect(shortfallMovement).toMatchObject({ quantity: 0 });
  });

  test("rejects confirming from the sending location, twice, or above what was sent", async () => {
    const sent = await recordTransfer(testDb, staffAt("store_manager", restaurantId), {
      fromLocationId: restaurantId,
      toLocationId: canteenId,
      itemType: "product",
      itemId: productId,
      quantity: 4,
    });
    if (!sent.ok) throw new Error("expected transfer");

    await expect(
      confirmTransfer(testDb, staffAt("store_manager", restaurantId), {
        transferId: sent.transfers[0].id,
        confirmedQuantity: 4,
      }),
    ).resolves.toEqual({ ok: false, reason: "forbidden" });

    await expect(
      confirmTransfer(testDb, staffAt("attendant", canteenId), {
        transferId: sent.transfers[0].id,
        confirmedQuantity: 5,
      }),
    ).resolves.toEqual({ ok: false, reason: "invalid_quantity" });

    const confirmed = await confirmTransfer(testDb, staffAt("attendant", canteenId), {
      transferId: sent.transfers[0].id,
      confirmedQuantity: 4,
    });
    expect(confirmed.ok).toBe(true);

    await expect(
      confirmTransfer(testDb, staffAt("attendant", canteenId), {
        transferId: sent.transfers[0].id,
        confirmedQuantity: 4,
      }),
    ).resolves.toEqual({ ok: false, reason: "already_confirmed" });
  });
});

describe("getPendingTransfersAtLocation", () => {
  test("shows an unconfirmed transfer at the receiving location only", async () => {
    const sent = await recordTransfer(testDb, staffAt("store_manager", restaurantId), {
      fromLocationId: restaurantId,
      toLocationId: canteenId,
      itemType: "product",
      itemId: productId,
      quantity: 4,
    });
    if (!sent.ok) throw new Error("expected transfer");

    const atCanteen = await getPendingTransfersAtLocation(testDb, staffAt("attendant", canteenId), canteenId);
    expect(atCanteen).toMatchObject({
      ok: true,
      transfers: [{ id: sent.transfers[0].id, itemName: "Sodas (500ml)", sentQuantity: 4 }],
    });

    const atRestaurant = await getPendingTransfersAtLocation(
      testDb,
      staffAt("store_manager", restaurantId),
      restaurantId,
    );
    expect(atRestaurant).toMatchObject({ ok: true, transfers: [] });

    await confirmTransfer(testDb, staffAt("attendant", canteenId), {
      transferId: sent.transfers[0].id,
      confirmedQuantity: 4,
    });
    const afterConfirm = await getPendingTransfersAtLocation(testDb, staffAt("attendant", canteenId), canteenId);
    expect(afterConfirm).toMatchObject({ ok: true, transfers: [] });
  });
});

describe("getConfirmedTransfersSentFromLocation", () => {
  test("shows a confirmed transfer at the sending location with its confirmed quantity", async () => {
    const sent = await recordTransfer(testDb, staffAt("store_manager", restaurantId), {
      fromLocationId: restaurantId,
      toLocationId: canteenId,
      itemType: "product",
      itemId: productId,
      quantity: 4,
    });
    if (!sent.ok) throw new Error("expected transfer");

    const beforeConfirm = await getConfirmedTransfersSentFromLocation(
      testDb,
      staffAt("store_manager", restaurantId),
      restaurantId,
    );
    expect(beforeConfirm).toMatchObject({ ok: true, transfers: [] });

    await confirmTransfer(testDb, staffAt("attendant", canteenId), {
      transferId: sent.transfers[0].id,
      confirmedQuantity: 3,
    });

    const afterConfirm = await getConfirmedTransfersSentFromLocation(
      testDb,
      staffAt("store_manager", restaurantId),
      restaurantId,
    );
    expect(afterConfirm).toMatchObject({
      ok: true,
      transfers: [
        { id: sent.transfers[0].id, itemName: "Sodas (500ml)", sentQuantity: 4, confirmedQuantity: 3 },
      ],
    });
  });

  test("does not show a confirmed transfer at the receiving location", async () => {
    const sent = await recordTransfer(testDb, staffAt("store_manager", restaurantId), {
      fromLocationId: restaurantId,
      toLocationId: canteenId,
      itemType: "product",
      itemId: productId,
      quantity: 4,
    });
    if (!sent.ok) throw new Error("expected transfer");
    await confirmTransfer(testDb, staffAt("attendant", canteenId), {
      transferId: sent.transfers[0].id,
      confirmedQuantity: 4,
    });

    const atCanteen = await getConfirmedTransfersSentFromLocation(
      testDb,
      staffAt("attendant", canteenId),
      canteenId,
    );
    expect(atCanteen).toMatchObject({ ok: true, transfers: [] });
  });
});

describe("cancelPendingTransfer", () => {
  test("the sender can undo their own still-pending send, restoring their stock", async () => {
    const sent = await recordTransfer(testDb, staffAt("store_manager", restaurantId), {
      fromLocationId: restaurantId,
      toLocationId: canteenId,
      itemType: "product",
      itemId: productId,
      quantity: 4,
    });
    if (!sent.ok) throw new Error("expected transfer");

    const cancelled = await cancelPendingTransfer(
      testDb,
      staffAt("store_manager", restaurantId),
      sent.transfers[0].id,
    );
    expect(cancelled.ok).toBe(true);
    if (!cancelled.ok) return;
    expect(cancelled.transfer.status).toBe("cancelled");

    const restaurantStock = await getCurrentStockAtLocation(
      testDb,
      staffAt("store_manager", restaurantId),
      restaurantId,
    );
    expect(restaurantStock).toMatchObject({ ok: true, levels: [{ productId, quantityOnHand: 12 }] });
  });

  test("rejects cancelling someone else's transfer, or an already-confirmed one", async () => {
    const attendantStaff = await testDb.staffMember.create({
      data: {
        name: "Test Attendant Canceller",
        phone: "+254700112004",
        pinHash: await hashPin("1234"),
        role: "attendant",
        locationId: canteenId,
        dailyRateMinor: 0,
      },
    });

    const sent = await recordTransfer(testDb, staffAt("store_manager", restaurantId), {
      fromLocationId: restaurantId,
      toLocationId: canteenId,
      itemType: "product",
      itemId: productId,
      quantity: 4,
    });
    if (!sent.ok) throw new Error("expected transfer");

    // A different person (the receiving attendant, not the sender) may
    // not cancel someone else's pending send.
    await expect(
      cancelPendingTransfer(
        testDb,
        staffAt("attendant", canteenId, attendantStaff.id),
        sent.transfers[0].id,
      ),
    ).resolves.toEqual({ ok: false, reason: "forbidden" });

    await confirmTransfer(testDb, staffAt("attendant", canteenId, attendantStaff.id), {
      transferId: sent.transfers[0].id,
      confirmedQuantity: 4,
    });

    await expect(
      cancelPendingTransfer(testDb, staffAt("store_manager", restaurantId), sent.transfers[0].id),
    ).resolves.toEqual({ ok: false, reason: "already_confirmed" });
  });
});

describe("reverseTransfer — undoing an already-confirmed transfer", () => {
  test("moves the confirmed quantity back to the sender", async () => {
    const sent = await recordTransfer(testDb, staffAt("store_manager", restaurantId), {
      fromLocationId: restaurantId,
      toLocationId: canteenId,
      itemType: "product",
      itemId: productId,
      quantity: 4,
    });
    if (!sent.ok) throw new Error("expected transfer");
    await confirmTransfer(testDb, staffAt("attendant", canteenId), {
      transferId: sent.transfers[0].id,
      confirmedQuantity: 4,
    });

    const reversed = await reverseTransfer(testDb, staffAt("store_manager", restaurantId), sent.transfers[0].id);
    expect(reversed.ok).toBe(true);

    const stock = await getCurrentStockAtLocation(testDb, staffAt("store_manager", restaurantId), restaurantId);
    expect(stock).toMatchObject({ ok: true, levels: [{ productId, quantityOnHand: 12 }] });
  });

  test("rejects reversing a still-pending transfer, and reversing twice", async () => {
    const sent = await recordTransfer(testDb, staffAt("store_manager", restaurantId), {
      fromLocationId: restaurantId,
      toLocationId: canteenId,
      itemType: "product",
      itemId: productId,
      quantity: 4,
    });
    if (!sent.ok) throw new Error("expected transfer");

    await expect(
      reverseTransfer(testDb, staffAt("store_manager", restaurantId), sent.transfers[0].id),
    ).resolves.toEqual({ ok: false, reason: "not_found" });

    await confirmTransfer(testDb, staffAt("attendant", canteenId), {
      transferId: sent.transfers[0].id,
      confirmedQuantity: 4,
    });
    const firstReversal = await reverseTransfer(testDb, staffAt("store_manager", restaurantId), sent.transfers[0].id);
    expect(firstReversal.ok).toBe(true);

    const secondReversal = await reverseTransfer(testDb, staffAt("store_manager", restaurantId), sent.transfers[0].id);
    expect(secondReversal).toEqual({ ok: false, reason: "already_reversed" });
  });
});

describe("listTransfersAtLocation", () => {
  test("shows the sender's outgoing leg once sent, before confirmation", async () => {
    await recordTransfer(testDb, staffAt("store_manager", restaurantId), {
      fromLocationId: restaurantId,
      toLocationId: canteenId,
      itemType: "product",
      itemId: productId,
      quantity: 4,
    });

    const sender = await listTransfersAtLocation(testDb, staffAt("store_manager", restaurantId));
    expect(sender.ok).toBe(true);
    if (!sender.ok) return;
    expect(sender.transfers).toHaveLength(1);
    expect(sender.transfers[0]).toMatchObject({ direction: "sent", reversed: false });
  });
});
