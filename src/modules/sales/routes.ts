import { db } from "@/shared/db";
import { getSession, listCustomers } from "@/modules/people";
import { findProductsByIds } from "@/modules/catalogue";
import { recordCounterSale, listTodaysSalesForStaff } from "./logic";

function writeStatus(reason: string): number {
  if (reason === "forbidden") return 403;
  return 400;
}

export async function recordCounterSaleRoute(request: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: "unauthenticated" }, { status: 401 });

  const body = await request.json();
  const result = await recordCounterSale(db, session, {
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
    totalMinor: sale.totalMinor,
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
