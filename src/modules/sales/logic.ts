import type { PrismaClient } from "@/generated/prisma/client";
import { canAccessLocation, findCustomerById, type AuthenticatedStaff } from "@/modules/people";
import { findProductsByIds } from "@/modules/catalogue";
import { recordStockMovement } from "@/modules/stock";
import { createSaleRecord, findSalesForStaffToday, sumCreditForCustomer } from "./queries";
import type { PaymentMethod, Sale } from "./schema";

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
        | "customer_not_found";
    };

export async function recordCounterSale(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  input: {
    lines: { productId: string; quantity: number }[];
    paymentLines: { method: PaymentMethod; amountMinor: number; customerId?: string | null }[];
  },
): Promise<RecordSaleResult> {
  const locationId = requester.staff.locationId;
  if (!canAccessLocation(requester.staff.role, requester.staff.locationId, locationId)) {
    return { ok: false, reason: "forbidden" };
  }

  if (input.lines.some((line) => line.quantity <= 0)) {
    return { ok: false, reason: "invalid_quantity" };
  }

  const creditLines = input.paymentLines.filter((p) => p.method === "credit");
  if (creditLines.some((p) => !p.customerId)) {
    return { ok: false, reason: "credit_requires_customer" };
  }
  for (const creditCustomerId of new Set(creditLines.map((p) => p.customerId!))) {
    const customer = await findCustomerById(db, creditCustomerId);
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

  const totalMinor = saleLines.reduce((sum, l) => sum + l.quantity * l.priceMinor, 0);
  const paidMinor = input.paymentLines.reduce((sum, p) => sum + p.amountMinor, 0);
  if (paidMinor !== totalMinor) {
    return { ok: false, reason: "payment_mismatch" };
  }

  const sale = await createSaleRecord(db, {
    locationId,
    staffMemberId: requester.staff.id,
    fulfilment: "counter",
    totalMinor,
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
