import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { hashPin } from "@/modules/people";
import type { AuthenticatedStaff } from "@/modules/people";
import { getCurrentStockAtLocation } from "@/modules/stock";
import {
  getCustomerBalance,
  getCustomerBalanceForOwner,
  getCustomerCreditHistory,
  getTotalCustomerBalance,
  listTodaysSalesForStaff,
  recordCounterSale,
  recordRepayment,
  recordSaleCorrection,
  voidSale,
} from "../logic";
import { testDb } from "@/shared/test-db";

let restaurantId: string;
let canteenId: string;
let sodaId: string;
let photocopyId: string;
let labourOnlyServiceId: string;

function staffAt(
  role: "owner" | "cashier" | "store_manager",
  locationId: string,
  locationCode: "restaurant" | "canteen" = "restaurant",
): AuthenticatedStaff {
  return staffMemberAt("staff-1", "Test Staff", role, locationId, locationCode);
}

function staffMemberAt(
  id: string,
  name: string,
  role: "owner" | "cashier" | "store_manager",
  locationId: string,
  locationCode: "restaurant" | "canteen" = "restaurant",
): AuthenticatedStaff {
  return {
    staff: {
      id,
      name,
      phone: "+254700111333",
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

  await testDb.staffMember.create({
    data: {
      id: "staff-1",
      name: "Test Cashier",
      phone: "+254700111334",
      pinHash: await hashPin("1234"),
      role: "cashier",
      locationId: restaurant.id,
      dailyRateMinor: 550,
    },
  });

  await testDb.staffMember.create({
    data: {
      id: "staff-2",
      name: "Other Cashier",
      phone: "+254700111335",
      pinHash: await hashPin("1234"),
      role: "cashier",
      locationId: restaurant.id,
      dailyRateMinor: 550,
    },
  });

  const soda = await testDb.product.create({
    data: { name: "Soda 500ml", kind: "goods", priceMinor: 80, locationId: restaurantId },
  });
  sodaId = soda.id;

  const photocopy = await testDb.product.create({
    data: { name: "Photocopy per page", kind: "service", priceMinor: 5, locationId: restaurantId },
  });
  photocopyId = photocopy.id;

  // A service that consumes no stock and is never received — the
  // "Research"/"SHA & Others" shape, permanently at zero on hand. Kept
  // separate from photocopyId (which is now stocked, see beforeEach) so the
  // zero-stock case stays testable.
  const labourOnly = await testDb.product.create({
    data: { name: "Research", kind: "service", priceMinor: 300, locationId: restaurantId },
  });
  labourOnlyServiceId = labourOnly.id;
});

// BUG-15's hard guard now rejects a sale line that exceeds on-hand stock,
// so every test that sells sodaId needs real stock to sell from first —
// generous enough that no individual test (max line quantity used anywhere
// below is 5) runs it out.
const SEEDED_STOCK = 100;

// 2026-08-17: `kind` no longer affects stock movement at all — a service
// decrements, guards against oversell and restores on void exactly like
// goods. So a stock-holding service ("Printing/Papers", photocopying off a
// paper stock) needs seeded stock to sell from, same as sodaId above.
const SEEDED_SERVICE_STOCK = 200;

beforeEach(async () => {
  await testDb.repayment.deleteMany({});
  await testDb.paymentLine.deleteMany({});
  await testDb.saleLine.deleteMany({});
  await testDb.sale.deleteMany({});
  await testDb.stockMovement.deleteMany({});
  await testDb.customer.deleteMany({});

  await testDb.stockMovement.create({
    data: { productId: sodaId, locationId: restaurantId, quantity: SEEDED_STOCK, reason: "received", staffMemberId: "staff-1" },
  });
  await testDb.stockMovement.create({
    data: { productId: sodaId, locationId: canteenId, quantity: SEEDED_STOCK, reason: "received", staffMemberId: "staff-1" },
  });
  await testDb.stockMovement.create({
    data: { productId: photocopyId, locationId: restaurantId, quantity: SEEDED_SERVICE_STOCK, reason: "received", staffMemberId: "staff-1" },
  });
});

afterAll(async () => {
  await testDb.repayment.deleteMany({});
  await testDb.paymentLine.deleteMany({});
  await testDb.saleLine.deleteMany({});
  await testDb.sale.deleteMany({});
  await testDb.stockMovement.deleteMany({});
  await testDb.customer.deleteMany({});
  await testDb.product.deleteMany({});
  await testDb.staffMember.deleteMany({});
  await testDb.location.deleteMany({});
  await testDb.$disconnect();
});

describe("recordCounterSale", () => {
  test("records a counter sale paid entirely in cash", async () => {
    const result = await recordCounterSale(testDb, staffAt("cashier", restaurantId), {
      lines: [{ productId: sodaId, quantity: 2 }],
      paymentLines: [{ method: "cash", amountMinor: 160 }],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.sale.totalMinor).toBe(160);
    expect(result.sale.lines).toEqual([
      expect.objectContaining({ productId: sodaId, quantity: 2, priceMinor: 80 }),
    ]);
  });

  test("splits payment across cash and M-Pesa lines", async () => {
    const result = await recordCounterSale(testDb, staffAt("cashier", restaurantId), {
      lines: [{ productId: sodaId, quantity: 2 }],
      paymentLines: [
        { method: "cash", amountMinor: 100 },
        { method: "mpesa", amountMinor: 60 },
      ],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.sale.paymentLines).toHaveLength(2);
  });

  test("rejects a sale when payment lines don't sum to the total", async () => {
    const result = await recordCounterSale(testDb, staffAt("cashier", restaurantId), {
      lines: [{ productId: sodaId, quantity: 2 }],
      paymentLines: [{ method: "cash", amountMinor: 100 }],
    });

    expect(result).toEqual({ ok: false, reason: "payment_mismatch" });
  });

  test("rejects a line with a non-positive quantity", async () => {
    const result = await recordCounterSale(testDb, staffAt("cashier", restaurantId), {
      lines: [{ productId: sodaId, quantity: 0 }],
      paymentLines: [{ method: "cash", amountMinor: 0 }],
    });

    expect(result).toEqual({ ok: false, reason: "invalid_quantity" });
  });

  test("rejects a sale for an inactive product", async () => {
    const discontinued = await testDb.product.create({
      data: { name: "Discontinued snack", kind: "goods", priceMinor: 50, active: false, locationId: restaurantId },
    });

    const result = await recordCounterSale(testDb, staffAt("cashier", restaurantId), {
      lines: [{ productId: discontinued.id, quantity: 1 }],
      paymentLines: [{ method: "cash", amountMinor: 50 }],
    });

    expect(result).toEqual({ ok: false, reason: "inactive_product" });
  });

  test("decrements stock for a stocked product", async () => {
    await recordCounterSale(testDb, staffAt("cashier", restaurantId), {
      lines: [{ productId: sodaId, quantity: 3 }],
      paymentLines: [{ method: "cash", amountMinor: 240 }],
    });

    const stock = await getCurrentStockAtLocation(
      testDb,
      staffAt("cashier", restaurantId),
      restaurantId,
    );
    expect(stock.ok).toBe(true);
    if (!stock.ok) return;
    expect(stock.levels).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ productId: sodaId, quantityOnHand: SEEDED_STOCK - 3 }),
      ]),
    );
  });

  // Replaces "creates no stock movement for a service product" (in force
  // until 2026-08-17). Client decision that day: a service decrements like
  // anything else, because services such as "Printing/Papers" consume real
  // stock — under the old rule their on-hand only ever climbed, since
  // receiving raised it and selling never lowered it.
  test("decrements stock for a service product, the same as any other kind", async () => {
    const result = await recordCounterSale(testDb, staffAt("cashier", restaurantId), {
      lines: [{ productId: photocopyId, quantity: 5 }],
      paymentLines: [{ method: "cash", amountMinor: 25 }],
    });
    expect(result.ok).toBe(true);

    const stock = await getCurrentStockAtLocation(
      testDb,
      staffAt("cashier", restaurantId),
      restaurantId,
    );
    expect(stock.ok).toBe(true);
    if (!stock.ok) return;
    expect(stock.levels).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          productId: photocopyId,
          quantityOnHand: SEEDED_SERVICE_STOCK - 5,
        }),
        expect.objectContaining({ productId: sodaId, quantityOnHand: SEEDED_STOCK }),
      ]),
    );
  });

  test("a sale is recorded at the staff member's own session location, ignoring any other location requested", async () => {
    // Session location must be the restaurant, not the canteen — since
    // 2026-08-15 recordCounterSale rejects a canteen location outright
    // (see "recordCounterSale — canteen" below), so this test's own
    // concern (session location wins over any location argument) needs a
    // location where the sale can actually succeed.
    const otherRestaurantCashier: AuthenticatedStaff = {
      staff: {
        id: "staff-2",
        name: "Other Cashier",
        phone: "+254700111335",
        role: "cashier",
        locationId: restaurantId,
        dailyRateMinor: 0,
        active: true,
      },
      location: { id: restaurantId, code: "restaurant", name: "Test Restaurant" },
    };

    const result = await recordCounterSale(testDb, otherRestaurantCashier, {
      lines: [{ productId: sodaId, quantity: 1 }],
      paymentLines: [{ method: "cash", amountMinor: 80 }],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.sale.locationId).toBe(restaurantId);
  });
});

// docs/scope.md's 2026-08-15 "Canteen: count-derived sales" entry — the
// canteen no longer records individual sales through any path. A stock
// count infers sales instead (stock/tests/count.integration.test.ts).
describe("recordCounterSale — canteen", () => {
  test("rejects a canteen sale with payment lines", async () => {
    const result = await recordCounterSale(testDb, staffAt("cashier", canteenId, "canteen"), {
      lines: [{ productId: sodaId, quantity: 1 }],
      paymentLines: [{ method: "cash", amountMinor: 80 }],
    });

    expect(result).toEqual({ ok: false, reason: "forbidden" });
  });

  test("rejects a canteen sale with no payment lines (the old canteen shape)", async () => {
    const result = await recordCounterSale(testDb, staffAt("cashier", canteenId, "canteen"), {
      lines: [{ productId: sodaId, quantity: 1 }],
      paymentLines: [],
    });

    expect(result).toEqual({ ok: false, reason: "forbidden" });
  });

  test("rejects a canteen credit sale", async () => {
    const customer = await testDb.customer.create({ data: { name: "Test Customer" } });

    const result = await recordCounterSale(testDb, staffAt("cashier", canteenId, "canteen"), {
      lines: [{ productId: sodaId, quantity: 1 }],
      paymentLines: [{ method: "credit", amountMinor: 80, customerId: customer.id }],
    });

    expect(result).toEqual({ ok: false, reason: "forbidden" });
  });

  test("does not write a Sale or decrement stock when rejected", async () => {
    await recordCounterSale(testDb, staffAt("cashier", canteenId, "canteen"), {
      lines: [{ productId: sodaId, quantity: 1 }],
      paymentLines: [{ method: "cash", amountMinor: 80 }],
    });

    const sales = await testDb.sale.findMany({ where: { locationId: canteenId } });
    expect(sales).toHaveLength(0);

    const stock = await testDb.stockMovement.aggregate({
      where: { productId: sodaId, locationId: canteenId },
      _sum: { quantity: true },
    });
    expect(stock._sum.quantity?.toNumber()).toBe(SEEDED_STOCK);
  });

  test("the restaurant is unaffected by the canteen gate", async () => {
    const result = await recordCounterSale(testDb, staffAt("cashier", restaurantId), {
      lines: [{ productId: sodaId, quantity: 1 }],
      paymentLines: [{ method: "cash", amountMinor: 80 }],
    });

    expect(result.ok).toBe(true);
  });
});

// BUG-15: nothing prevented overselling — no backend check compared a sale
// line's quantity to on-hand stock. Mirrors recordTransfer's existing
// insufficient_stock guard (stock/tests) — sum first, reject before writing
// anything, wrapped in the same transaction as the sale + stock decrement.
describe("recordCounterSale — insufficient stock", () => {
  test("rejects a line that exceeds on-hand stock, naming the product and quantity available", async () => {
    const result = await recordCounterSale(testDb, staffAt("cashier", restaurantId), {
      lines: [{ productId: sodaId, quantity: SEEDED_STOCK + 1 }],
      paymentLines: [{ method: "cash", amountMinor: (SEEDED_STOCK + 1) * 80 }],
    });

    expect(result).toEqual({
      ok: false,
      reason: "insufficient_stock",
      productId: sodaId,
      available: SEEDED_STOCK,
    });
  });

  test("rejects overselling a product already at zero stock", async () => {
    const outOfStock = await testDb.product.create({
      data: { name: "Discontinued cake", kind: "goods", priceMinor: 200, locationId: restaurantId },
    });

    const result = await recordCounterSale(testDb, staffAt("cashier", restaurantId), {
      lines: [{ productId: outOfStock.id, quantity: 1 }],
      paymentLines: [{ method: "cash", amountMinor: 200 }],
    });

    expect(result).toEqual({
      ok: false,
      reason: "insufficient_stock",
      productId: outOfStock.id,
      available: 0,
    });
  });

  test("writes nothing — no Sale and no stock movement — when a line is rejected for insufficient stock", async () => {
    await recordCounterSale(testDb, staffAt("cashier", restaurantId), {
      lines: [{ productId: sodaId, quantity: SEEDED_STOCK + 1 }],
      paymentLines: [{ method: "cash", amountMinor: (SEEDED_STOCK + 1) * 80 }],
    });

    const salesToday = await listTodaysSalesForStaff(testDb, staffAt("cashier", restaurantId));
    expect(salesToday.ok).toBe(true);
    if (!salesToday.ok) return;
    expect(salesToday.sales).toEqual([]);

    const stock = await getCurrentStockAtLocation(testDb, staffAt("cashier", restaurantId), restaurantId);
    expect(stock.ok).toBe(true);
    if (!stock.ok) return;
    expect(stock.levels).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ productId: sodaId, quantityOnHand: SEEDED_STOCK }),
      ]),
    );
  });

  test("a sale within stock succeeds even when another line in the same sale would have failed alone", async () => {
    // Sanity check that the guard checks each line independently against
    // its own product's stock, not some combined/aggregate figure. The
    // service line's 150 exceeds sodaId's 100 but sits inside the service's
    // own 200 — so a combined or cross-product check would wrongly reject.
    const result = await recordCounterSale(testDb, staffAt("cashier", restaurantId), {
      lines: [
        { productId: sodaId, quantity: 2 },
        { productId: photocopyId, quantity: 150 },
      ],
      paymentLines: [{ method: "cash", amountMinor: 2 * 80 + 150 * 5 }],
    });

    expect(result.ok).toBe(true);
  });
});

// 2026-08-17: `kind` no longer affects stock movement. A service is guarded,
// decremented and restored exactly like goods — see the client decision
// recorded on the sale/void tests above.
describe("recordCounterSale — services and stock", () => {
  test("rejects a service line that would oversell, naming the product and quantity available", async () => {
    const result = await recordCounterSale(testDb, staffAt("cashier", restaurantId), {
      lines: [{ productId: photocopyId, quantity: SEEDED_SERVICE_STOCK + 1 }],
      paymentLines: [{ method: "cash", amountMinor: (SEEDED_SERVICE_STOCK + 1) * 5 }],
    });

    expect(result).toEqual({
      ok: false,
      reason: "insufficient_stock",
      productId: photocopyId,
      available: SEEDED_SERVICE_STOCK,
    });
  });

  test("writes nothing when a service line is rejected for insufficient stock", async () => {
    await recordCounterSale(testDb, staffAt("cashier", restaurantId), {
      lines: [{ productId: photocopyId, quantity: SEEDED_SERVICE_STOCK + 1 }],
      paymentLines: [{ method: "cash", amountMinor: (SEEDED_SERVICE_STOCK + 1) * 5 }],
    });

    expect(await testDb.sale.count()).toBe(0);
    const stock = await getCurrentStockAtLocation(
      testDb,
      staffAt("cashier", restaurantId),
      restaurantId,
    );
    expect(stock.ok).toBe(true);
    if (!stock.ok) return;
    expect(stock.levels).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          productId: photocopyId,
          quantityOnHand: SEEDED_SERVICE_STOCK,
        }),
      ]),
    );
  });

  test("a service line may take the stock down to exactly zero", async () => {
    const result = await recordCounterSale(testDb, staffAt("cashier", restaurantId), {
      lines: [{ productId: photocopyId, quantity: SEEDED_SERVICE_STOCK }],
      paymentLines: [{ method: "cash", amountMinor: SEEDED_SERVICE_STOCK * 5 }],
    });

    expect(result.ok).toBe(true);
    const stock = await getCurrentStockAtLocation(
      testDb,
      staffAt("cashier", restaurantId),
      restaurantId,
    );
    expect(stock.ok).toBe(true);
    if (!stock.ok) return;
    expect(stock.levels).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ productId: photocopyId, quantityOnHand: 0 }),
      ]),
    );
  });

  // The known, accepted consequence of dropping the kind guard: a
  // pure-labour service (Research, SHA & Others) is never received, so it
  // sits at zero on hand forever and can no longer be sold through this
  // path. The till still offers it — stockStatus() in ui/new-sale.tsx
  // deliberately keeps returning "ok" for services so its tile isn't
  // disabled — so the rejection surfaces at submit, not before. Tracked as
  // a follow-up; fixing it needs the schema to distinguish a stock-holding
  // service from a labour-only one, which `kind` alone cannot express.
  test("a labour-only service at zero stock is rejected rather than silently sold", async () => {
    const result = await recordCounterSale(testDb, staffAt("cashier", restaurantId), {
      lines: [{ productId: labourOnlyServiceId, quantity: 1 }],
      paymentLines: [{ method: "cash", amountMinor: 300 }],
    });

    expect(result).toEqual({
      ok: false,
      reason: "insufficient_stock",
      productId: labourOnlyServiceId,
      available: 0,
    });
  });
});

describe("recordCounterSale — credit", () => {
  test("rejects a credit payment line with no customer", async () => {
    const result = await recordCounterSale(testDb, staffAt("cashier", restaurantId), {
      lines: [{ productId: sodaId, quantity: 1 }],
      paymentLines: [{ method: "credit", amountMinor: 80 }],
    });

    expect(result).toEqual({ ok: false, reason: "credit_requires_customer" });
  });

  test("records a credit payment line against a named customer", async () => {
    const customer = await testDb.customer.create({ data: { name: "Jane Wanjiru" } });

    const result = await recordCounterSale(testDb, staffAt("cashier", restaurantId), {
      lines: [{ productId: sodaId, quantity: 1 }],
      paymentLines: [{ method: "credit", amountMinor: 80, customerId: customer.id }],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.sale.paymentLines).toEqual([
      expect.objectContaining({ method: "credit", amountMinor: 80, customerId: customer.id }),
    ]);
  });

  test("rejects a credit payment line against an unknown customer", async () => {
    const result = await recordCounterSale(testDb, staffAt("cashier", restaurantId), {
      lines: [{ productId: sodaId, quantity: 1 }],
      paymentLines: [{ method: "credit", amountMinor: 80, customerId: "nonexistent" }],
    });

    expect(result).toEqual({ ok: false, reason: "customer_not_found" });
  });

  test("a sale may split payment across cash and a credit line for a named customer", async () => {
    const customer = await testDb.customer.create({ data: { name: "Brian Otieno" } });

    const result = await recordCounterSale(testDb, staffAt("cashier", restaurantId), {
      lines: [{ productId: sodaId, quantity: 2 }],
      paymentLines: [
        { method: "cash", amountMinor: 100 },
        { method: "credit", amountMinor: 60, customerId: customer.id },
      ],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.sale.paymentLines).toHaveLength(2);
  });

  test("a customer's balance is the sum of their credit payment lines across sales", async () => {
    const customer = await testDb.customer.create({ data: { name: "Amani" } });

    await recordCounterSale(testDb, staffAt("cashier", restaurantId), {
      lines: [{ productId: sodaId, quantity: 1 }],
      paymentLines: [{ method: "credit", amountMinor: 80, customerId: customer.id }],
    });
    await recordCounterSale(testDb, staffAt("cashier", restaurantId), {
      lines: [{ productId: sodaId, quantity: 2 }],
      paymentLines: [{ method: "credit", amountMinor: 160, customerId: customer.id }],
    });

    expect(await getCustomerBalance(testDb, customer.id)).toBe(240);
  });

  test("a customer with no credit sales has a zero balance", async () => {
    const customer = await testDb.customer.create({ data: { name: "Zawadi" } });

    expect(await getCustomerBalance(testDb, customer.id)).toBe(0);
  });
});

describe("recordCounterSale — store manager", () => {
  test("a store manager cannot record a counter sale", async () => {
    const result = await recordCounterSale(testDb, staffAt("store_manager", restaurantId), {
      lines: [{ productId: sodaId, quantity: 1 }],
      paymentLines: [{ method: "cash", amountMinor: 80 }],
    });

    expect(result).toEqual({ ok: false, reason: "forbidden" });
  });

  test("a store manager can record a delivery sale", async () => {
    const customer = await testDb.customer.create({ data: { name: "Njeri" } });

    const result = await recordCounterSale(testDb, staffAt("store_manager", restaurantId), {
      fulfilment: "delivery",
      customerId: customer.id,
      lines: [{ productId: sodaId, quantity: 1 }],
      paymentLines: [{ method: "cash", amountMinor: 80 }],
    });

    expect(result.ok).toBe(true);
  });
});

describe("recordCounterSale — delivery", () => {
  test("rejects a delivery sale with no customer, even paid in cash", async () => {
    const result = await recordCounterSale(testDb, staffAt("cashier", restaurantId), {
      fulfilment: "delivery",
      lines: [{ productId: sodaId, quantity: 1 }],
      paymentLines: [{ method: "cash", amountMinor: 80 }],
    });

    expect(result).toEqual({ ok: false, reason: "delivery_requires_customer" });
  });

  test("records a delivery sale with a customer and no fee", async () => {
    const customer = await testDb.customer.create({ data: { name: "Wanjiru" } });

    const result = await recordCounterSale(testDb, staffAt("cashier", restaurantId), {
      fulfilment: "delivery",
      customerId: customer.id,
      lines: [{ productId: sodaId, quantity: 1 }],
      paymentLines: [{ method: "cash", amountMinor: 80 }],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.sale.fulfilment).toBe("delivery");
    expect(result.sale.customerId).toBe(customer.id);
    expect(result.sale.deliveryFeeMinor).toBeNull();
    expect(result.sale.totalMinor).toBe(80);
  });

  test("adds an optional delivery fee on top of the product lines' value", async () => {
    const customer = await testDb.customer.create({ data: { name: "Otieno" } });

    const result = await recordCounterSale(testDb, staffAt("cashier", restaurantId), {
      fulfilment: "delivery",
      customerId: customer.id,
      deliveryFeeMinor: 50,
      lines: [{ productId: sodaId, quantity: 1 }],
      paymentLines: [{ method: "cash", amountMinor: 130 }],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.sale.deliveryFeeMinor).toBe(50);
    expect(result.sale.totalMinor).toBe(130);
  });

  test("rejects a delivery sale whose payment lines don't cover the fee", async () => {
    const customer = await testDb.customer.create({ data: { name: "Achieng" } });

    const result = await recordCounterSale(testDb, staffAt("cashier", restaurantId), {
      fulfilment: "delivery",
      customerId: customer.id,
      deliveryFeeMinor: 50,
      lines: [{ productId: sodaId, quantity: 1 }],
      paymentLines: [{ method: "cash", amountMinor: 80 }],
    });

    expect(result).toEqual({ ok: false, reason: "payment_mismatch" });
  });

  test("rejects a delivery sale against an unknown customer", async () => {
    const result = await recordCounterSale(testDb, staffAt("cashier", restaurantId), {
      fulfilment: "delivery",
      customerId: "nonexistent",
      lines: [{ productId: sodaId, quantity: 1 }],
      paymentLines: [{ method: "cash", amountMinor: 80 }],
    });

    expect(result).toEqual({ ok: false, reason: "customer_not_found" });
  });

  test("a delivery sale paid by credit needs only one customer, shared by both requirements", async () => {
    const customer = await testDb.customer.create({ data: { name: "Kimani" } });

    const result = await recordCounterSale(testDb, staffAt("cashier", restaurantId), {
      fulfilment: "delivery",
      customerId: customer.id,
      deliveryFeeMinor: 50,
      lines: [{ productId: sodaId, quantity: 1 }],
      paymentLines: [{ method: "credit", amountMinor: 130, customerId: customer.id }],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.sale.customerId).toBe(customer.id);
    expect(result.sale.paymentLines).toEqual([
      expect.objectContaining({ method: "credit", amountMinor: 130, customerId: customer.id }),
    ]);
  });

  test("a counter sale is unaffected — no customer requirement, no fee field", async () => {
    const result = await recordCounterSale(testDb, staffAt("cashier", restaurantId), {
      lines: [{ productId: sodaId, quantity: 1 }],
      paymentLines: [{ method: "cash", amountMinor: 80 }],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.sale.fulfilment).toBe("counter");
    expect(result.sale.customerId).toBeNull();
    expect(result.sale.deliveryFeeMinor).toBeNull();
  });

  test("a delivery sale decrements stock the same way a counter sale does", async () => {
    const customer = await testDb.customer.create({ data: { name: "Njeri" } });

    await recordCounterSale(testDb, staffAt("cashier", restaurantId), {
      fulfilment: "delivery",
      customerId: customer.id,
      lines: [{ productId: sodaId, quantity: 2 }],
      paymentLines: [{ method: "cash", amountMinor: 160 }],
    });

    const stock = await getCurrentStockAtLocation(
      testDb,
      staffAt("cashier", restaurantId),
      restaurantId,
    );
    expect(stock.ok).toBe(true);
    if (!stock.ok) return;
    expect(stock.levels).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ productId: sodaId, quantityOnHand: SEEDED_STOCK - 2 }),
      ]),
    );
  });
});

describe("listTodaysSalesForStaff", () => {
  test("lists sales this staff member recorded today, newest first", async () => {
    await recordCounterSale(testDb, staffAt("cashier", restaurantId), {
      lines: [{ productId: sodaId, quantity: 1 }],
      paymentLines: [{ method: "cash", amountMinor: 80 }],
    });
    await recordCounterSale(testDb, staffAt("cashier", restaurantId), {
      lines: [{ productId: sodaId, quantity: 2 }],
      paymentLines: [{ method: "cash", amountMinor: 160 }],
    });

    const result = await listTodaysSalesForStaff(testDb, staffAt("cashier", restaurantId));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.sales).toHaveLength(2);
    expect(result.sales[0].totalMinor).toBe(160);
    expect(result.sales[1].totalMinor).toBe(80);
  });

  test("never includes another staff member's sales", async () => {
    await recordCounterSale(
      testDb,
      staffMemberAt("staff-2", "Other Cashier", "cashier", restaurantId),
      {
        lines: [{ productId: sodaId, quantity: 1 }],
        paymentLines: [{ method: "cash", amountMinor: 80 }],
      },
    );

    const result = await listTodaysSalesForStaff(testDb, staffAt("cashier", restaurantId));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.sales).toEqual([]);
  });

  test("never includes another location's sales, even for the same staff id", async () => {
    await recordCounterSale(testDb, staffAt("cashier", restaurantId), {
      lines: [{ productId: sodaId, quantity: 1 }],
      paymentLines: [{ method: "cash", amountMinor: 80 }],
    });

    const result = await listTodaysSalesForStaff(
      testDb,
      staffAt("cashier", canteenId, "canteen"),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.sales).toEqual([]);
  });

  test("an empty day returns an empty list, not an error", async () => {
    const result = await listTodaysSalesForStaff(testDb, staffAt("cashier", restaurantId));

    expect(result).toEqual({ ok: true, sales: [] });
  });

  test("a sale carries its lines and payment breakdown, including a credit customer", async () => {
    const customer = await testDb.customer.create({ data: { name: "Jane Wanjiru" } });
    await recordCounterSale(testDb, staffAt("cashier", restaurantId), {
      lines: [{ productId: sodaId, quantity: 2 }],
      paymentLines: [{ method: "credit", amountMinor: 160, customerId: customer.id }],
    });

    const result = await listTodaysSalesForStaff(testDb, staffAt("cashier", restaurantId));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.sales[0].lines).toEqual([
      expect.objectContaining({ productId: sodaId, quantity: 2, priceMinor: 80 }),
    ]);
    expect(result.sales[0].paymentLines).toEqual([
      expect.objectContaining({ method: "credit", amountMinor: 160, customerId: customer.id }),
    ]);
  });

  test("a newly recorded sale is not voided", async () => {
    await recordCounterSale(testDb, staffAt("cashier", restaurantId), {
      lines: [{ productId: sodaId, quantity: 1 }],
      paymentLines: [{ method: "cash", amountMinor: 80 }],
    });

    const result = await listTodaysSalesForStaff(testDb, staffAt("cashier", restaurantId));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.sales[0].voided).toBe(false);
  });
});

describe("voidSale", () => {
  test("the staff member who recorded a sale can void it the same day", async () => {
    const recorded = await recordCounterSale(testDb, staffAt("cashier", restaurantId), {
      lines: [{ productId: sodaId, quantity: 2 }],
      paymentLines: [{ method: "cash", amountMinor: 160 }],
    });
    expect(recorded.ok).toBe(true);
    if (!recorded.ok) return;

    const result = await voidSale(testDb, staffAt("cashier", restaurantId), recorded.sale.id);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.sale.voided).toBe(true);
    expect(result.sale.voidedBy).toBe("staff-1");
    expect(result.sale.voidedAt).not.toBeNull();
  });

  test("voiding a sale returns every stocked line's quantity to its pre-sale level", async () => {
    const recorded = await recordCounterSale(testDb, staffAt("cashier", restaurantId), {
      lines: [{ productId: sodaId, quantity: 3 }],
      paymentLines: [{ method: "cash", amountMinor: 240 }],
    });
    expect(recorded.ok).toBe(true);
    if (!recorded.ok) return;

    await voidSale(testDb, staffAt("cashier", restaurantId), recorded.sale.id);

    const stock = await getCurrentStockAtLocation(
      testDb,
      staffAt("cashier", restaurantId),
      restaurantId,
    );
    expect(stock.ok).toBe(true);
    if (!stock.ok) return;
    expect(stock.levels).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ productId: sodaId, quantityOnHand: SEEDED_STOCK }),
      ]),
    );
  });

  test("voiding a delivery sale reverses stock the same as a counter sale, fee included", async () => {
    const customer = await testDb.customer.create({ data: { name: "Wambui" } });
    const recorded = await recordCounterSale(testDb, staffAt("cashier", restaurantId), {
      fulfilment: "delivery",
      customerId: customer.id,
      deliveryFeeMinor: 50,
      lines: [{ productId: sodaId, quantity: 3 }],
      paymentLines: [{ method: "cash", amountMinor: 290 }],
    });
    expect(recorded.ok).toBe(true);
    if (!recorded.ok) return;

    const result = await voidSale(testDb, staffAt("cashier", restaurantId), recorded.sale.id);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.sale.voided).toBe(true);
    expect(result.sale.totalMinor).toBe(290);

    const stock = await getCurrentStockAtLocation(
      testDb,
      staffAt("cashier", restaurantId),
      restaurantId,
    );
    expect(stock.ok).toBe(true);
    if (!stock.ok) return;
    expect(stock.levels).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ productId: sodaId, quantityOnHand: SEEDED_STOCK }),
      ]),
    );
  });

  // Replaces "voiding a sale with a service line creates no stock movement
  // for it" (in force until 2026-08-17). This is the dangerous half of the
  // 2026-08-17 change: selling now decrements a service, so voiding MUST
  // restore it. If it didn't, every voided sale would destroy that stock
  // permanently — a worse bug than the one the change fixes.
  test("voiding a sale with a service line restores the service's stock", async () => {
    const recorded = await recordCounterSale(testDb, staffAt("cashier", restaurantId), {
      lines: [{ productId: photocopyId, quantity: 5 }],
      paymentLines: [{ method: "cash", amountMinor: 25 }],
    });
    expect(recorded.ok).toBe(true);
    if (!recorded.ok) return;

    const result = await voidSale(testDb, staffAt("cashier", restaurantId), recorded.sale.id);

    expect(result.ok).toBe(true);
    const stock = await getCurrentStockAtLocation(
      testDb,
      staffAt("cashier", restaurantId),
      restaurantId,
    );
    expect(stock.ok).toBe(true);
    if (!stock.ok) return;
    expect(stock.levels).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          productId: photocopyId,
          quantityOnHand: SEEDED_SERVICE_STOCK,
        }),
        expect.objectContaining({ productId: sodaId, quantityOnHand: SEEDED_STOCK }),
      ]),
    );
  });

  test("voiding an already-void sale is rejected", async () => {
    const recorded = await recordCounterSale(testDb, staffAt("cashier", restaurantId), {
      lines: [{ productId: sodaId, quantity: 1 }],
      paymentLines: [{ method: "cash", amountMinor: 80 }],
    });
    expect(recorded.ok).toBe(true);
    if (!recorded.ok) return;

    await voidSale(testDb, staffAt("cashier", restaurantId), recorded.sale.id);
    const result = await voidSale(testDb, staffAt("cashier", restaurantId), recorded.sale.id);

    expect(result).toEqual({ ok: false, reason: "already_voided" });
  });

  test("voiding an unknown sale is rejected", async () => {
    const result = await voidSale(testDb, staffAt("cashier", restaurantId), "nonexistent");

    expect(result).toEqual({ ok: false, reason: "not_found" });
  });

  test("voiding a sale from a previous day is rejected", async () => {
    const recorded = await recordCounterSale(testDb, staffAt("cashier", restaurantId), {
      lines: [{ productId: sodaId, quantity: 1 }],
      paymentLines: [{ method: "cash", amountMinor: 80 }],
    });
    expect(recorded.ok).toBe(true);
    if (!recorded.ok) return;

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    await testDb.sale.update({ where: { id: recorded.sale.id }, data: { occurredAt: yesterday } });

    const result = await voidSale(testDb, staffAt("cashier", restaurantId), recorded.sale.id);

    expect(result).toEqual({ ok: false, reason: "not_same_day" });
  });

  test("the owner can void a sale from a previous day", async () => {
    const recorded = await recordCounterSale(testDb, staffAt("cashier", restaurantId), {
      lines: [{ productId: sodaId, quantity: 1 }],
      paymentLines: [{ method: "cash", amountMinor: 80 }],
    });
    expect(recorded.ok).toBe(true);
    if (!recorded.ok) return;

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    await testDb.sale.update({ where: { id: recorded.sale.id }, data: { occurredAt: yesterday } });

    const result = await voidSale(testDb, staffAt("owner", restaurantId), recorded.sale.id);

    expect(result.ok).toBe(true);
  });

  test("a cashier cannot void a colleague's sale, only their own", async () => {
    const recorded = await recordCounterSale(testDb, staffAt("cashier", restaurantId), {
      lines: [{ productId: sodaId, quantity: 1 }],
      paymentLines: [{ method: "cash", amountMinor: 80 }],
    });
    expect(recorded.ok).toBe(true);
    if (!recorded.ok) return;

    const colleague = staffMemberAt("staff-2", "Colleague", "cashier", restaurantId);
    const result = await voidSale(testDb, colleague, recorded.sale.id);

    expect(result).toEqual({ ok: false, reason: "forbidden" });
  });

  test("a cashier at a different location cannot void a sale there", async () => {
    const recorded = await recordCounterSale(testDb, staffAt("cashier", restaurantId), {
      lines: [{ productId: sodaId, quantity: 1 }],
      paymentLines: [{ method: "cash", amountMinor: 80 }],
    });
    expect(recorded.ok).toBe(true);
    if (!recorded.ok) return;

    const result = await voidSale(
      testDb,
      staffAt("cashier", canteenId, "canteen"),
      recorded.sale.id,
    );

    expect(result).toEqual({ ok: false, reason: "forbidden" });
  });
});

describe("recordRepayment", () => {
  test("reduces a customer's balance by the repaid amount", async () => {
    const customer = await testDb.customer.create({ data: { name: "Amani" } });
    await recordCounterSale(testDb, staffAt("cashier", restaurantId), {
      lines: [{ productId: sodaId, quantity: 3 }],
      paymentLines: [{ method: "credit", amountMinor: 240, customerId: customer.id }],
    });

    const result = await recordRepayment(testDb, staffAt("cashier", restaurantId), {
      customerId: customer.id,
      amountMinor: 100,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.repayment.amountMinor).toBe(100);
    expect(await getCustomerBalance(testDb, customer.id)).toBe(140);
  });

  test("any staff member at the customer's location may record a repayment, not owner-only", async () => {
    const customer = await testDb.customer.create({ data: { name: "Brian" } });
    await recordCounterSale(testDb, staffAt("cashier", restaurantId), {
      lines: [{ productId: sodaId, quantity: 1 }],
      paymentLines: [{ method: "credit", amountMinor: 80, customerId: customer.id }],
    });

    const result = await recordRepayment(testDb, staffAt("cashier", restaurantId), {
      customerId: customer.id,
      amountMinor: 80,
    });

    expect(result.ok).toBe(true);
  });

  test("a repayment is recorded at the staff member's own session location, regardless of the customer's other activity", async () => {
    const customer = await testDb.customer.create({ data: { name: "Otieno" } });
    await recordCounterSale(testDb, staffAt("cashier", restaurantId), {
      lines: [{ productId: sodaId, quantity: 1 }],
      paymentLines: [{ method: "credit", amountMinor: 80, customerId: customer.id }],
    });

    const result = await recordRepayment(testDb, staffAt("cashier", canteenId, "canteen"), {
      customerId: customer.id,
      amountMinor: 80,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.repayment.locationId).toBe(canteenId);
  });

  test("rejects a non-positive amount", async () => {
    const customer = await testDb.customer.create({ data: { name: "Njeri" } });
    await recordCounterSale(testDb, staffAt("cashier", restaurantId), {
      lines: [{ productId: sodaId, quantity: 1 }],
      paymentLines: [{ method: "credit", amountMinor: 80, customerId: customer.id }],
    });

    const result = await recordRepayment(testDb, staffAt("cashier", restaurantId), {
      customerId: customer.id,
      amountMinor: 0,
    });

    expect(result).toEqual({ ok: false, reason: "invalid_amount" });
  });

  test("rejects an amount larger than the current balance", async () => {
    const customer = await testDb.customer.create({ data: { name: "Wambui" } });
    await recordCounterSale(testDb, staffAt("cashier", restaurantId), {
      lines: [{ productId: sodaId, quantity: 1 }],
      paymentLines: [{ method: "credit", amountMinor: 80, customerId: customer.id }],
    });

    const result = await recordRepayment(testDb, staffAt("cashier", restaurantId), {
      customerId: customer.id,
      amountMinor: 81,
    });

    expect(result).toEqual({ ok: false, reason: "exceeds_balance" });
  });

  // BUG-11 regression: the UI once sent amount * 100, so a repayment of the
  // exact balance owed (unscaled) was rejected as exceeding it. Both halves
  // matter — exact balance must succeed, balance + 1 must still be rejected.
  test("a repayment of exactly the balance owed succeeds and zeroes the balance", async () => {
    const customer = await testDb.customer.create({ data: { name: "Kioko" } });
    await recordCounterSale(testDb, staffAt("cashier", restaurantId), {
      lines: [{ productId: sodaId, quantity: 1 }],
      paymentLines: [{ method: "credit", amountMinor: 80, customerId: customer.id }],
    });

    const result = await recordRepayment(testDb, staffAt("cashier", restaurantId), {
      customerId: customer.id,
      amountMinor: 80,
    });

    expect(result.ok).toBe(true);
    expect(await getCustomerBalance(testDb, customer.id)).toBe(0);
  });

  test("rejects a repayment against an unknown customer", async () => {
    const result = await recordRepayment(testDb, staffAt("cashier", restaurantId), {
      customerId: "nonexistent",
      amountMinor: 10,
    });

    expect(result).toEqual({ ok: false, reason: "customer_not_found" });
  });

  test("a repayment recorded twice for the same customer both reduce the running balance", async () => {
    const customer = await testDb.customer.create({ data: { name: "Kimani" } });
    await recordCounterSale(testDb, staffAt("cashier", restaurantId), {
      lines: [{ productId: sodaId, quantity: 5 }],
      paymentLines: [{ method: "credit", amountMinor: 400, customerId: customer.id }],
    });

    await recordRepayment(testDb, staffAt("cashier", restaurantId), {
      customerId: customer.id,
      amountMinor: 100,
    });
    await recordRepayment(testDb, staffAt("cashier", restaurantId), {
      customerId: customer.id,
      amountMinor: 100,
    });

    expect(await getCustomerBalance(testDb, customer.id)).toBe(200);
  });
});

describe("getCustomerBalance — repayments", () => {
  test("a customer's balance is credit given minus repayments", async () => {
    const customer = await testDb.customer.create({ data: { name: "Achieng" } });
    await recordCounterSale(testDb, staffAt("cashier", restaurantId), {
      lines: [{ productId: sodaId, quantity: 3 }],
      paymentLines: [{ method: "credit", amountMinor: 240, customerId: customer.id }],
    });
    await recordRepayment(testDb, staffAt("cashier", restaurantId), {
      customerId: customer.id,
      amountMinor: 90,
    });

    expect(await getCustomerBalance(testDb, customer.id)).toBe(150);
  });

  test("a fully repaid customer has a zero balance", async () => {
    const customer = await testDb.customer.create({ data: { name: "Kariuki" } });
    await recordCounterSale(testDb, staffAt("cashier", restaurantId), {
      lines: [{ productId: sodaId, quantity: 1 }],
      paymentLines: [{ method: "credit", amountMinor: 80, customerId: customer.id }],
    });
    await recordRepayment(testDb, staffAt("cashier", restaurantId), {
      customerId: customer.id,
      amountMinor: 80,
    });

    expect(await getCustomerBalance(testDb, customer.id)).toBe(0);
  });
});

describe("getCustomerBalanceForOwner", () => {
  test("matches getCustomerBalance exactly", async () => {
    const customer = await testDb.customer.create({ data: { name: "Fatuma" } });
    await recordCounterSale(testDb, staffAt("cashier", restaurantId), {
      lines: [{ productId: sodaId, quantity: 2 }],
      paymentLines: [{ method: "credit", amountMinor: 160, customerId: customer.id }],
    });

    const result = await getCustomerBalanceForOwner(testDb, staffAt("owner", restaurantId), customer.id);

    expect(result).toEqual({ ok: true, balanceMinor: 160 });
    expect(result.ok && result.balanceMinor).toBe(await getCustomerBalance(testDb, customer.id));
  });

  test("is forbidden for a non-owner", async () => {
    const customer = await testDb.customer.create({ data: { name: "Juma" } });

    const result = await getCustomerBalanceForOwner(testDb, staffAt("cashier", restaurantId), customer.id);

    expect(result).toEqual({ ok: false, reason: "forbidden" });
  });
});

describe("getTotalCustomerBalance — repayments", () => {
  test("the total owed is credit given minus repayments, summed across all customers", async () => {
    const customerA = await testDb.customer.create({ data: { name: "Aisha" } });
    const customerB = await testDb.customer.create({ data: { name: "Bakari" } });

    await recordCounterSale(testDb, staffAt("cashier", restaurantId), {
      lines: [{ productId: sodaId, quantity: 3 }],
      paymentLines: [{ method: "credit", amountMinor: 240, customerId: customerA.id }],
    });
    await recordCounterSale(testDb, staffAt("cashier", restaurantId), {
      lines: [{ productId: sodaId, quantity: 1 }],
      paymentLines: [{ method: "credit", amountMinor: 80, customerId: customerB.id }],
    });
    await recordRepayment(testDb, staffAt("cashier", restaurantId), {
      customerId: customerA.id,
      amountMinor: 90,
    });

    const result = await getTotalCustomerBalance(testDb, staffAt("owner", restaurantId));

    expect(result).toEqual({ ok: true, totalMinor: 230 });
  });

  // BUG-12 regression: sumCreditForCustomer/sumCreditAcrossAllCustomers
  // aggregated PaymentLine with no exclusion for voided sales, so a voided
  // credit sale counted as debt forever.
  test("a voided credit sale drops the customer's balance and the business-wide total to zero", async () => {
    const customer = await testDb.customer.create({ data: { name: "Fatuma" } });
    const recorded = await recordCounterSale(testDb, staffAt("cashier", restaurantId), {
      lines: [{ productId: sodaId, quantity: 3 }],
      paymentLines: [{ method: "credit", amountMinor: 240, customerId: customer.id }],
    });
    expect(recorded.ok).toBe(true);
    if (!recorded.ok) return;

    expect(await getCustomerBalance(testDb, customer.id)).toBe(240);

    const voided = await voidSale(testDb, staffAt("cashier", restaurantId), recorded.sale.id);
    expect(voided.ok).toBe(true);

    expect(await getCustomerBalance(testDb, customer.id)).toBe(0);

    const total = await getTotalCustomerBalance(testDb, staffAt("owner", restaurantId));
    expect(total).toEqual({ ok: true, totalMinor: 0 });
  });
});

describe("getCustomerCreditHistory", () => {
  test("returns credit lines and repayments together for the customer, owner-only", async () => {
    const customer = await testDb.customer.create({ data: { name: "Chebet" } });
    await recordCounterSale(testDb, staffAt("cashier", restaurantId), {
      lines: [{ productId: sodaId, quantity: 2 }],
      paymentLines: [{ method: "credit", amountMinor: 160, customerId: customer.id }],
    });
    await recordRepayment(testDb, staffAt("cashier", restaurantId), {
      customerId: customer.id,
      amountMinor: 60,
    });

    const result = await getCustomerCreditHistory(testDb, staffAt("owner", restaurantId), customer.id);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.entries).toEqual([
      expect.objectContaining({ kind: "repayment", amountMinor: 60 }),
      expect.objectContaining({ kind: "credit", amountMinor: 160 }),
    ]);
  });

  test("is forbidden for a non-owner", async () => {
    const customer = await testDb.customer.create({ data: { name: "Mwangi" } });

    const result = await getCustomerCreditHistory(testDb, staffAt("cashier", restaurantId), customer.id);

    expect(result).toEqual({ ok: false, reason: "forbidden" });
  });
});

describe("recordSaleCorrection", () => {
  function threeDaysAgo(): Date {
    const d = new Date();
    d.setDate(d.getDate() - 3);
    d.setHours(12, 0, 0, 0);
    return d;
  }

  test("records a backdated correction: today's occurredAt, the given effectiveAt, reason, and stock decremented as an ordinary sale", async () => {
    const effectiveDate = threeDaysAgo();
    const before = new Date();

    const result = await recordSaleCorrection(testDb, staffAt("owner", restaurantId), {
      staffMemberId: "staff-1",
      locationId: restaurantId,
      effectiveDate,
      reason: "M-Pesa message arrived late",
      lines: [{ productId: sodaId, quantity: 2 }],
      paymentLines: [{ method: "cash", amountMinor: 160 }],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.sale.isCorrection).toBe(true);
    expect(result.sale.correctionReason).toBe("M-Pesa message arrived late");
    expect(result.sale.effectiveAt.getTime()).toBe(effectiveDate.getTime());
    expect(result.sale.occurredAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(result.sale.voided).toBe(false);

    const stock = await getCurrentStockAtLocation(testDb, staffAt("owner", restaurantId), restaurantId);
    expect(stock.ok).toBe(true);
    if (!stock.ok) return;
    expect(stock.levels).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ productId: sodaId, quantityOnHand: SEEDED_STOCK - 2 }),
      ]),
    );
  });

  test("the corrected day's original sale is unchanged", async () => {
    const original = await recordCounterSale(testDb, staffAt("cashier", restaurantId), {
      lines: [{ productId: sodaId, quantity: 1 }],
      paymentLines: [{ method: "cash", amountMinor: 80 }],
    });
    expect(original.ok).toBe(true);
    if (!original.ok) return;
    const originalOccurredAt = original.sale.occurredAt.getTime();
    const originalEffectiveAt = original.sale.effectiveAt.getTime();

    await recordSaleCorrection(testDb, staffAt("owner", restaurantId), {
      staffMemberId: "staff-1",
      locationId: restaurantId,
      effectiveDate: threeDaysAgo(),
      reason: "omitted sale found",
      lines: [{ productId: sodaId, quantity: 5 }],
      paymentLines: [{ method: "cash", amountMinor: 400 }],
    });

    const untouched = await testDb.sale.findUnique({ where: { id: original.sale.id } });
    expect(untouched?.occurredAt.getTime()).toBe(originalOccurredAt);
    expect(untouched?.effectiveAt.getTime()).toBe(originalEffectiveAt);
    expect(untouched?.totalMinor.toNumber()).toBe(80);
    expect(untouched?.isCorrection).toBe(false);
  });

  test("a required reason is enforced", async () => {
    const result = await recordSaleCorrection(testDb, staffAt("owner", restaurantId), {
      staffMemberId: "staff-1",
      locationId: restaurantId,
      effectiveDate: threeDaysAgo(),
      reason: "   ",
      lines: [{ productId: sodaId, quantity: 1 }],
      paymentLines: [{ method: "cash", amountMinor: 80 }],
    });

    expect(result).toEqual({ ok: false, reason: "reason_required" });
  });

  test("a non-owner cannot record a correction", async () => {
    const result = await recordSaleCorrection(testDb, staffAt("cashier", restaurantId), {
      staffMemberId: "staff-1",
      locationId: restaurantId,
      effectiveDate: threeDaysAgo(),
      reason: "omitted sale found",
      lines: [{ productId: sodaId, quantity: 1 }],
      paymentLines: [{ method: "cash", amountMinor: 80 }],
    });

    expect(result).toEqual({ ok: false, reason: "forbidden" });
  });

  test("payment lines that don't sum to the total are rejected, same as an ordinary sale", async () => {
    const result = await recordSaleCorrection(testDb, staffAt("owner", restaurantId), {
      staffMemberId: "staff-1",
      locationId: restaurantId,
      effectiveDate: threeDaysAgo(),
      reason: "omitted sale found",
      lines: [{ productId: sodaId, quantity: 2 }],
      paymentLines: [{ method: "cash", amountMinor: 80 }],
    });

    expect(result).toEqual({ ok: false, reason: "payment_mismatch" });
  });
});
