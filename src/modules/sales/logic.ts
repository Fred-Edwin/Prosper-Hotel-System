import type { PrismaClient } from "@/generated/prisma/client";
import { canAccessLocation, findCustomerById, type AuthenticatedStaff } from "@/modules/people";
import { findProductsByIds } from "@/modules/catalogue";
import { recordStockMovement } from "@/modules/stock";
import { isDayClosedFor } from "@/modules/cash";
import {
  createSaleRecord,
  findSaleById,
  findSalesForStaffToday,
  markSaleVoided,
  sumCreditAcrossAllCustomers,
  sumCreditForCustomer,
  sumCreditSaleQuantityByProductAtLocation,
  sumSalesRevenueMinorAtLocationInPeriod,
} from "./queries";
import type { PaymentMethod, Sale, SaleFulfilment } from "./schema";

export type RecordSaleResult =
  | { ok: true; sale: Sale }
  | {
      ok: false;
      reason:
        | "forbidden"
        | "invalid_quantity"
        | "inactive_product"
        | "payment_mismatch"
        | "credit_requires_customer"
        | "delivery_requires_customer"
        | "customer_not_found";
    };

export async function recordCounterSale(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  input: {
    fulfilment?: SaleFulfilment;
    customerId?: string | null;
    deliveryFeeMinor?: number | null;
    lines: { productId: string; quantity: number }[];
    paymentLines: { method: PaymentMethod; amountMinor: number; customerId?: string | null }[];
  },
): Promise<RecordSaleResult> {
  const locationId = requester.staff.locationId;
  if (!canAccessLocation(requester.staff.role, requester.staff.locationId, locationId)) {
    return { ok: false, reason: "forbidden" };
  }

  const fulfilment = input.fulfilment ?? "counter";

  if (input.lines.some((line) => line.quantity <= 0)) {
    return { ok: false, reason: "invalid_quantity" };
  }

  if (fulfilment === "delivery" && !input.customerId) {
    return { ok: false, reason: "delivery_requires_customer" };
  }

  const creditLines = input.paymentLines.filter((p) => p.method === "credit");
  if (creditLines.some((p) => !p.customerId)) {
    return { ok: false, reason: "credit_requires_customer" };
  }

  const customerIdsToCheck = new Set(creditLines.map((p) => p.customerId!));
  if (input.customerId) customerIdsToCheck.add(input.customerId);
  for (const id of customerIdsToCheck) {
    const customer = await findCustomerById(db, id);
    if (!customer) return { ok: false, reason: "customer_not_found" };
  }

  const products = await findProductsByIds(
    db,
    input.lines.map((line) => line.productId),
  );
  const productById = new Map(products.map((p) => [p.id, p]));

  const priced = input.lines.map((line) => {
    const product = productById.get(line.productId);
    return { line, product };
  });
  if (priced.some(({ product }) => !product || !product.active)) {
    return { ok: false, reason: "inactive_product" };
  }

  const saleLines = priced.map(({ line, product }) => ({
    productId: line.productId,
    quantity: line.quantity,
    priceMinor: product!.priceMinor ?? 0,
  }));

  const deliveryFeeMinor = fulfilment === "delivery" ? (input.deliveryFeeMinor ?? null) : null;
  const totalMinor =
    saleLines.reduce((sum, l) => sum + l.quantity * l.priceMinor, 0) + (deliveryFeeMinor ?? 0);
  const paidMinor = input.paymentLines.reduce((sum, p) => sum + p.amountMinor, 0);
  if (paidMinor !== totalMinor) {
    return { ok: false, reason: "payment_mismatch" };
  }

  const sale = await createSaleRecord(db, {
    locationId,
    staffMemberId: requester.staff.id,
    fulfilment,
    customerId: input.customerId ?? null,
    totalMinor,
    deliveryFeeMinor,
    lines: saleLines,
    paymentLines: input.paymentLines,
  });

  for (const { line, product } of priced) {
    if (product!.kind === "service") continue;
    await recordStockMovement(db, requester, {
      productId: line.productId,
      locationId,
      quantity: -line.quantity,
      reason: "sold",
    });
  }

  return { ok: true, sale };
}

// CONTEXT.md: a customer's balance is derived from unsettled credit
// payment lines, never a stored figure.
export async function getCustomerBalance(db: PrismaClient, customerId: string): Promise<number> {
  return sumCreditForCustomer(db, customerId);
}

// Ticket 24: stock's count-derived-sales formula reads this directly — the
// caller (recordStockCount, already permission-checked) is trusted, so
// this has no access check of its own, same as catalogue's
// findProductsByIds being called from stock/logic.ts.
export async function creditSaleQuantityByProductAtLocation(
  db: PrismaClient,
  locationId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<{ productId: string; quantity: number }[]> {
  return sumCreditSaleQuantityByProductAtLocation(db, locationId, periodStart, periodEnd);
}

export type ListTodaysSalesResult =
  | { ok: true; sales: Sale[] }
  | { ok: false; reason: "forbidden" };

// Ticket 09: own sales only, today only, own location only. Never another
// staff member's sales — that's not a location-access question, so it's
// enforced by scoping the query to requester.staff.id rather than by a
// forbidden check.
export async function listTodaysSalesForStaff(
  db: PrismaClient,
  requester: AuthenticatedStaff,
): Promise<ListTodaysSalesResult> {
  const locationId = requester.staff.locationId;
  if (!canAccessLocation(requester.staff.role, requester.staff.locationId, locationId)) {
    return { ok: false, reason: "forbidden" };
  }

  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const sales = await findSalesForStaffToday(db, requester.staff.id, locationId, dayStart, dayEnd);
  return { ok: true, sales };
}

export type VoidSaleResult =
  | { ok: true; sale: Sale }
  | {
      ok: false;
      reason: "forbidden" | "not_found" | "already_voided" | "not_same_day" | "day_closed";
    };

// architecture.md: "any role," same day, before close. Post-close is
// owner-only — see cash's isDayClosedFor, keyed to the sale's own staff
// member/location, since closing is per-person.
export async function voidSale(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  saleId: string,
): Promise<VoidSaleResult> {
  const sale = await findSaleById(db, saleId);
  if (!sale) return { ok: false, reason: "not_found" };

  if (!canAccessLocation(requester.staff.role, requester.staff.locationId, sale.locationId)) {
    return { ok: false, reason: "forbidden" };
  }

  if (sale.voided) return { ok: false, reason: "already_voided" };

  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);

  if (requester.staff.role !== "owner") {
    if (sale.occurredAt < dayStart) return { ok: false, reason: "not_same_day" };
    const closed = await isDayClosedFor(db, sale.staffMemberId, sale.locationId, dayStart);
    if (closed) return { ok: false, reason: "day_closed" };
  }

  const products = await findProductsByIds(
    db,
    sale.lines.map((line) => line.productId),
  );
  const productById = new Map(products.map((p) => [p.id, p]));

  for (const line of sale.lines) {
    if (productById.get(line.productId)?.kind === "service") continue;
    await recordStockMovement(db, requester, {
      productId: line.productId,
      locationId: sale.locationId,
      quantity: line.quantity,
      reason: "corrected",
    });
  }

  const voided = await markSaleVoided(db, saleId, requester.staff.id);
  return { ok: true, sale: voided };
}

export type SalesRevenueResult =
  | { ok: true; totalMinor: number }
  | { ok: false; reason: "forbidden" };

// Ticket 25 — formulas.md §5's transfer rate ("what its food sold for")
// and §7's restaurant revenue ("recorded sales at the restaurant").
// Owner-gated like every other location-scoped read here; owner passes
// canAccessLocation for any location.
export async function getSalesRevenueAtLocation(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  locationId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<SalesRevenueResult> {
  if (!canAccessLocation(requester.staff.role, requester.staff.locationId, locationId)) {
    return { ok: false, reason: "forbidden" };
  }
  const totalMinor = await sumSalesRevenueMinorAtLocationInPeriod(
    db,
    locationId,
    periodStart,
    periodEnd,
  );
  return { ok: true, totalMinor };
}

function requireOwner(requester: AuthenticatedStaff): boolean {
  return requester.staff.role === "owner";
}

export type TotalCustomerBalanceResult =
  | { ok: true; totalMinor: number }
  | { ok: false; reason: "forbidden" };

// Ticket 33 — Dashboard's "Owed to you": the sum across all customers,
// both locations, per formulas.md §11. Owner-only, same access pattern as
// cash's getRunningCashBalance.
export async function getTotalCustomerBalance(
  db: PrismaClient,
  requester: AuthenticatedStaff,
): Promise<TotalCustomerBalanceResult> {
  if (!requireOwner(requester)) {
    return { ok: false, reason: "forbidden" };
  }
  const totalMinor = await sumCreditAcrossAllCustomers(db);
  return { ok: true, totalMinor };
}
