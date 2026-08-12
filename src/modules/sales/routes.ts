import { db } from "@/shared/db";
import { getSession, listCustomers } from "@/modules/people";
import { findProductsByIds } from "@/modules/catalogue";
import {
  recordCounterSale,
  listTodaysSalesForStaff,
  voidSale,
  getTotalCustomerBalance,
  getCustomerBalanceForOwner,
  getCustomerCreditHistory,
  recordRepayment,
} from "./logic";

function writeStatus(reason: string): number {
  if (reason === "forbidden" || reason === "day_closed") return 403;
  if (reason === "not_found" || reason === "customer_not_found") return 404;
  return 400;
}

export async function recordCounterSaleRoute(request: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: "unauthenticated" }, { status: 401 });

  const body = await request.json();
  const result = await recordCounterSale(db, session, {
    fulfilment: body.fulfilment,
    customerId: body.customerId,
    deliveryFeeMinor: body.deliveryFeeMinor,
    lines: body.lines,
    paymentLines: body.paymentLines,
  });
  if (!result.ok) {
    return Response.json({ error: result.reason }, { status: writeStatus(result.reason) });
  }
  return Response.json({ sale: result.sale });
}

// The UI needs a credit line's customer by name, not id — resolved here
// rather than widened onto the domain Sale type, which stays a pure record
// of what was charged.
export async function todaysSalesRoute(): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: "unauthenticated" }, { status: 401 });

  const result = await listTodaysSalesForStaff(db, session);
  if (!result.ok) {
    return Response.json({ error: result.reason }, { status: writeStatus(result.reason) });
  }

  const customers = await listCustomers(db);
  const customerNameById = new Map(customers.map((c) => [c.id, c.name]));

  const productIds = [...new Set(result.sales.flatMap((s) => s.lines.map((l) => l.productId)))];
  const products = await findProductsByIds(db, productIds);
  const productNameById = new Map(products.map((p) => [p.id, p.name]));

  const sales = result.sales.map((sale) => ({
    id: sale.id,
    fulfilment: sale.fulfilment,
    customerName: sale.customerId ? (customerNameById.get(sale.customerId) ?? null) : null,
    totalMinor: sale.totalMinor,
    deliveryFeeMinor: sale.deliveryFeeMinor,
    occurredAt: sale.occurredAt,
    voided: sale.voided,
    staffMemberName: session.staff.name,
    lines: sale.lines.map((l) => ({
      id: l.id,
      productName: productNameById.get(l.productId) ?? "Unknown product",
      quantity: l.quantity,
      priceMinor: l.priceMinor,
    })),
    paymentLines: sale.paymentLines.map((p) => ({
      id: p.id,
      method: p.method,
      amountMinor: p.amountMinor,
      customerName: p.customerId ? (customerNameById.get(p.customerId) ?? null) : null,
    })),
  }));

  return Response.json({ sales });
}

export async function voidSaleRoute(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: "unauthenticated" }, { status: 401 });

  const { id } = await params;
  const result = await voidSale(db, session, id);
  if (!result.ok) {
    return Response.json({ error: result.reason }, { status: writeStatus(result.reason) });
  }
  return Response.json({ sale: result.sale });
}

// Ticket 33 — Dashboard's "Owed to you". Owner-only, same access pattern
// as cash's runningCashBalanceRoute.
export async function totalCustomerBalanceRoute(): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: "unauthenticated" }, { status: 401 });

  const result = await getTotalCustomerBalance(db, session);
  if (!result.ok) {
    return Response.json({ error: result.reason }, { status: writeStatus(result.reason) });
  }
  return Response.json({ totalMinor: result.totalMinor });
}

// Ticket 36 — People's Customers tab: a per-customer balance, owner-only.
export async function customerBalanceRoute(
  request: Request,
  { params }: { params: Promise<{ customerId: string }> },
): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: "unauthenticated" }, { status: 401 });

  const { customerId } = await params;
  const result = await getCustomerBalanceForOwner(db, session, customerId);
  if (!result.ok) {
    return Response.json({ error: result.reason }, { status: writeStatus(result.reason) });
  }
  return Response.json({ balanceMinor: result.balanceMinor });
}

// Ticket 36 — the customer detail view's itemized credit/repayment ledger.
export async function customerCreditHistoryRoute(
  request: Request,
  { params }: { params: Promise<{ customerId: string }> },
): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: "unauthenticated" }, { status: 401 });

  const { customerId } = await params;
  const result = await getCustomerCreditHistory(db, session, customerId);
  if (!result.ok) {
    return Response.json({ error: result.reason }, { status: writeStatus(result.reason) });
  }
  return Response.json({ entries: result.entries });
}

// Ticket 36 — "Take a repayment," any staff member, own location.
export async function recordRepaymentRoute(request: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: "unauthenticated" }, { status: 401 });

  const body = await request.json();
  const result = await recordRepayment(db, session, {
    customerId: body.customerId,
    amountMinor: body.amountMinor,
  });
  if (!result.ok) {
    return Response.json({ error: result.reason }, { status: writeStatus(result.reason) });
  }
  return Response.json({ repayment: result.repayment });
}
