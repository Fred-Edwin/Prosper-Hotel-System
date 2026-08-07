import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { hashPin } from "@/modules/people";
import type { AuthenticatedStaff } from "@/modules/people";
import { getCurrentStockAtLocation } from "@/modules/stock";
import { getCustomerBalance, recordCounterSale } from "../logic";
import { testDb } from "@/shared/test-db";

let restaurantId: string;
let canteenId: string;
let sodaId: string;
let photocopyId: string;

function staffAt(
  role: "owner" | "cashier",
  locationId: string,
  locationCode: "restaurant" | "canteen" = "restaurant",
): AuthenticatedStaff {
  return {
    staff: {
      id: "staff-1",
      name: "Test Staff",
      phone: "+254700111333",
      role,
      locationId,
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
    },
  });

  const soda = await testDb.product.create({
    data: { name: "Soda 500ml", kind: "goods", priceMinor: 80 },
  });
  sodaId = soda.id;

  const photocopy = await testDb.product.create({
    data: { name: "Photocopy per page", kind: "service", priceMinor: 5 },
  });
  photocopyId = photocopy.id;
});

beforeEach(async () => {
  await testDb.paymentLine.deleteMany({});
  await testDb.saleLine.deleteMany({});
  await testDb.sale.deleteMany({});
  await testDb.stockMovement.deleteMany({});
  await testDb.customer.deleteMany({});
});

afterAll(async () => {
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
      data: { name: "Discontinued snack", kind: "goods", priceMinor: 50, active: false },
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
    expect(stock.levels).toEqual([
      expect.objectContaining({ productId: sodaId, quantityOnHand: -3 }),
    ]);
  });

  test("creates no stock movement for a service product", async () => {
    await recordCounterSale(testDb, staffAt("cashier", restaurantId), {
      lines: [{ productId: photocopyId, quantity: 5 }],
      paymentLines: [{ method: "cash", amountMinor: 25 }],
    });

    const stock = await getCurrentStockAtLocation(
      testDb,
      staffAt("cashier", restaurantId),
      restaurantId,
    );
    expect(stock.ok).toBe(true);
    if (!stock.ok) return;
    expect(stock.levels).toEqual([]);
  });

  test("a sale is recorded at the staff member's own session location, ignoring any other location requested", async () => {
    const cashierAtCanteen: AuthenticatedStaff = {
      staff: {
        id: "staff-1",
        name: "Test Cashier",
        phone: "+254700111334",
        role: "cashier",
        locationId: canteenId,
        active: true,
      },
      location: { id: canteenId, code: "canteen", name: "Test Canteen" },
    };

    const result = await recordCounterSale(testDb, cashierAtCanteen, {
      lines: [{ productId: sodaId, quantity: 1 }],
      paymentLines: [{ method: "cash", amountMinor: 80 }],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.sale.locationId).toBe(canteenId);
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
