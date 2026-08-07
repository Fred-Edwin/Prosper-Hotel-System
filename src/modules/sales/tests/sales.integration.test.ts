import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { hashPin } from "@/modules/people";
import type { AuthenticatedStaff } from "@/modules/people";
import { getCurrentStockAtLocation } from "@/modules/stock";
import { getCustomerBalance, listTodaysSalesForStaff, recordCounterSale, voidSale } from "../logic";
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
  return staffMemberAt("staff-1", "Test Staff", role, locationId, locationCode);
}

function staffMemberAt(
  id: string,
  name: string,
  role: "owner" | "cashier",
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

  await testDb.staffMember.create({
    data: {
      id: "staff-2",
      name: "Other Cashier",
      phone: "+254700111335",
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

  test("a different staff member at the same location can also void the sale", async () => {
    const recorded = await recordCounterSale(testDb, staffAt("cashier", restaurantId), {
      lines: [{ productId: sodaId, quantity: 1 }],
      paymentLines: [{ method: "cash", amountMinor: 80 }],
    });
    expect(recorded.ok).toBe(true);
    if (!recorded.ok) return;

    const result = await voidSale(
      testDb,
      staffMemberAt("staff-2", "Other Cashier", "cashier", restaurantId),
      recorded.sale.id,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.sale.voided).toBe(true);
    expect(result.sale.voidedBy).toBe("staff-2");
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
    expect(stock.levels).toEqual([
      expect.objectContaining({ productId: sodaId, quantityOnHand: 0 }),
    ]);
  });

  test("voiding a sale with a service line creates no stock movement for it", async () => {
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
    expect(stock.levels).toEqual([]);
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
