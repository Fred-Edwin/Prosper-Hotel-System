import { db } from "@/shared/db";
import { getSession } from "@/modules/people";
import {
  getDashboardProfit,
  getLedgerSummary,
  getProductLedger,
  getCashLedger,
  type CashTransactionCategory,
} from "./logic";

function writeStatus(reason: string): number {
  return reason === "forbidden" ? 403 : reason === "not_found" ? 404 : 400;
}

function todayBounds(): { dayStart: Date; dayEnd: Date } {
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);
  return { dayStart, dayEnd };
}

// The dashboard's Profit panel — today's figures, owner-only (the
// dashboard page itself is owner-gated, but the read is gated here too,
// same as every other module's routes).
export async function dashboardProfitRoute(): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: "unauthenticated" }, { status: 401 });

  const { dayStart, dayEnd } = todayBounds();
  const result = await getDashboardProfit(db, session, { dayStart, dayEnd });
  if (!result.ok) {
    return Response.json({ error: result.reason }, { status: writeStatus(result.reason) });
  }

  return Response.json({
    period: result.period,
    revenue: result.revenue,
    costOfGoods: result.costOfGoods,
    runningCostsMinor: result.runningCostsMinor,
    grossProfitMinor: result.grossProfitMinor,
    netProfitMinor: result.netProfitMinor,
    canteenCostRate: result.canteenCostRate,
    lastCanteenCount: result.lastCanteenCount,
    correction: result.correction,
  });
}

// The Ledger's stats waterfall — owner-only, an arbitrary period rather
// than always today. No server-side date-range validation beyond
// periodStart < periodEnd, per ticket 38's scope.
export async function ledgerSummaryRoute(request: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: "unauthenticated" }, { status: 401 });

  const url = new URL(request.url);
  const periodStartParam = url.searchParams.get("periodStart");
  const periodEndParam = url.searchParams.get("periodEnd");
  if (!periodStartParam || !periodEndParam) {
    return Response.json({ error: "periodStart and periodEnd are required" }, { status: 400 });
  }

  const periodStart = new Date(periodStartParam);
  const periodEnd = new Date(periodEndParam);
  if (Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEnd.getTime())) {
    return Response.json({ error: "invalid period" }, { status: 400 });
  }
  if (periodStart >= periodEnd) {
    return Response.json({ error: "periodStart must be before periodEnd" }, { status: 400 });
  }

  const result = await getLedgerSummary(db, session, { periodStart, periodEnd });
  if (!result.ok) {
    return Response.json({ error: result.reason }, { status: writeStatus(result.reason) });
  }

  return Response.json({
    period: result.period,
    openingMinor: result.openingMinor,
    purchasesMinor: result.purchasesMinor,
    closingMinor: result.closingMinor,
    costOfGoodsSoldMinor: result.costOfGoodsSoldMinor,
    salesValueMinor: result.salesValueMinor,
    grossProfitMinor: result.grossProfitMinor,
    nonSalesAtCostMinor: result.nonSalesAtCostMinor,
    nonSalesAtPriceMinor: result.nonSalesAtPriceMinor,
    canteenCostRate: result.canteenCostRate,
    lastCanteenCount: result.lastCanteenCount,
  });
}

// Ticket 39's Product ledger tab — owner-only, same period-query shape as
// the waterfall, plus optional location/category/search filters.
export async function productLedgerRoute(request: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: "unauthenticated" }, { status: 401 });

  const url = new URL(request.url);
  const periodStartParam = url.searchParams.get("periodStart");
  const periodEndParam = url.searchParams.get("periodEnd");
  if (!periodStartParam || !periodEndParam) {
    return Response.json({ error: "periodStart and periodEnd are required" }, { status: 400 });
  }

  const periodStart = new Date(periodStartParam);
  const periodEnd = new Date(periodEndParam);
  if (Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEnd.getTime())) {
    return Response.json({ error: "invalid period" }, { status: 400 });
  }
  if (periodStart >= periodEnd) {
    return Response.json({ error: "periodStart must be before periodEnd" }, { status: 400 });
  }

  const locationId = url.searchParams.get("locationId") ?? undefined;
  const categoryId = url.searchParams.get("categoryId") ?? undefined;
  const search = url.searchParams.get("search") ?? undefined;

  const result = await getProductLedger(db, session, {
    periodStart,
    periodEnd,
    locationId,
    categoryId,
    search,
  });
  if (!result.ok) {
    return Response.json({ error: result.reason }, { status: writeStatus(result.reason) });
  }

  return Response.json({ rows: result.rows });
}

// The Ledger's Cash tab — owner-only, an arbitrary period, business-wide
// (no location filter — cash isn't a location concept).
export async function cashLedgerRoute(request: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: "unauthenticated" }, { status: 401 });

  const url = new URL(request.url);
  const periodStartParam = url.searchParams.get("periodStart");
  const periodEndParam = url.searchParams.get("periodEnd");
  if (!periodStartParam || !periodEndParam) {
    return Response.json({ error: "periodStart and periodEnd are required" }, { status: 400 });
  }

  const periodStart = new Date(periodStartParam);
  const periodEnd = new Date(periodEndParam);
  if (Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEnd.getTime())) {
    return Response.json({ error: "invalid period" }, { status: 400 });
  }
  if (periodStart >= periodEnd) {
    return Response.json({ error: "periodStart must be before periodEnd" }, { status: 400 });
  }

  const category = (url.searchParams.get("category") ?? undefined) as CashTransactionCategory | undefined;
  const search = url.searchParams.get("search") ?? undefined;

  const result = await getCashLedger(db, session, { periodStart, periodEnd, category, search });
  if (!result.ok) {
    return Response.json({ error: result.reason }, { status: writeStatus(result.reason) });
  }

  return Response.json({ days: result.days });
}
