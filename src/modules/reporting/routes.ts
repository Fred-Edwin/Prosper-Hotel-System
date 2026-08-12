import { db } from "@/shared/db";
import { getSession } from "@/modules/people";
import {
  getDashboardProfit,
  getRevenueProfitTrend,
  getExceptions,
  getLedgerSummary,
  getProductLedger,
  getStoreLedger,
  getNonSalesLedgerReport,
  getCashLedger,
  getActivity,
  type CashTransactionCategory,
  type ActivityKind,
} from "./logic";
import type { NonSalesCategory } from "@/modules/stock";

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

// The dashboard's Profit panel — owner-only (the dashboard page itself is
// owner-gated, but the read is gated here too, same as every other
// module's routes). Defaults to today; ticket 46's Day/Week/Month tabs
// pass an explicit period the same way the Ledger routes already do.
export async function dashboardProfitRoute(request: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: "unauthenticated" }, { status: 401 });

  const url = new URL(request.url);
  const periodStartParam = url.searchParams.get("periodStart");
  const periodEndParam = url.searchParams.get("periodEnd");

  let dayStart: Date;
  let dayEnd: Date;
  if (periodStartParam || periodEndParam) {
    if (!periodStartParam || !periodEndParam) {
      return Response.json({ error: "periodStart and periodEnd are required together" }, { status: 400 });
    }
    dayStart = new Date(periodStartParam);
    dayEnd = new Date(periodEndParam);
    if (Number.isNaN(dayStart.getTime()) || Number.isNaN(dayEnd.getTime())) {
      return Response.json({ error: "invalid period" }, { status: 400 });
    }
    if (dayStart >= dayEnd) {
      return Response.json({ error: "periodStart must be before periodEnd" }, { status: 400 });
    }
  } else {
    ({ dayStart, dayEnd } = todayBounds());
  }

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
    byLocation: result.byLocation,
  });
}

// Ticket 47 — the Dashboard's Revenue and profit chart. Defaults to a
// 14-day window ending today, matching the design reference's fixture
// shape; `days` is accepted so Storybook/tests can request a smaller
// window without waiting on 14 days of fixtures.
export async function revenueProfitTrendRoute(request: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: "unauthenticated" }, { status: 401 });

  const url = new URL(request.url);
  const daysParam = url.searchParams.get("days");
  const days = daysParam ? Number(daysParam) : 14;
  if (!Number.isInteger(days) || days < 1) {
    return Response.json({ error: "days must be a positive integer" }, { status: 400 });
  }

  const result = await getRevenueProfitTrend(db, session, { windowEnd: new Date(), days });
  if (!result.ok) {
    return Response.json({ error: result.reason }, { status: writeStatus(result.reason) });
  }

  return Response.json({ points: result.points });
}

// Ticket 48 — the Dashboard's "Needs you" card. Owner-only, always today
// (no period param — an exceptions list is inherently "what needs
// attention right now," not a historical query the Ledger already
// serves).
export async function exceptionsRoute(request: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: "unauthenticated" }, { status: 401 });

  const result = await getExceptions(db, session, { today: new Date() });
  if (!result.ok) {
    return Response.json({ error: result.reason }, { status: writeStatus(result.reason) });
  }

  return Response.json({ shortfalls: result.shortfalls, voidedSales: result.voidedSales });
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

// Ticket 42's Store ledger tab — owner-only, same period-query shape as
// the Product ledger, plus optional location/search filters (no category
// — ingredients aren't categorised).
export async function storeLedgerRoute(request: Request): Promise<Response> {
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
  const search = url.searchParams.get("search") ?? undefined;

  const result = await getStoreLedger(db, session, { periodStart, periodEnd, locationId, search });
  if (!result.ok) {
    return Response.json({ error: result.reason }, { status: writeStatus(result.reason) });
  }

  return Response.json({ rows: result.rows });
}

// Ticket 43's Non-sales ledger tab — owner-only, same period-query shape
// as the Store ledger, plus an optional reason filter (wasted/consumed/
// given_away) alongside location/search.
export async function nonSalesLedgerRoute(request: Request): Promise<Response> {
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
  const reason = (url.searchParams.get("reason") ?? undefined) as NonSalesCategory | undefined;
  const search = url.searchParams.get("search") ?? undefined;

  const result = await getNonSalesLedgerReport(db, session, { periodStart, periodEnd, locationId, reason, search });
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

// Ticket 45 — Activity's paginated trail. periodStart/periodEnd are
// optional (getActivity defaults to a trailing window) — the reference
// UI has no date-range control, only kind/who/search filters, so no
// route-level validation forces both to be present together the way the
// other ledger routes do.
export async function activityRoute(request: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: "unauthenticated" }, { status: 401 });

  const url = new URL(request.url);
  const periodStartParam = url.searchParams.get("periodStart");
  const periodEndParam = url.searchParams.get("periodEnd");

  let periodStart: Date | undefined;
  let periodEnd: Date | undefined;
  if (periodStartParam) {
    periodStart = new Date(periodStartParam);
    if (Number.isNaN(periodStart.getTime())) {
      return Response.json({ error: "invalid period" }, { status: 400 });
    }
  }
  if (periodEndParam) {
    periodEnd = new Date(periodEndParam);
    if (Number.isNaN(periodEnd.getTime())) {
      return Response.json({ error: "invalid period" }, { status: 400 });
    }
  }

  const personId = url.searchParams.get("personId") ?? undefined;
  const kind = (url.searchParams.get("kind") ?? undefined) as ActivityKind | undefined;
  const search = url.searchParams.get("search") ?? undefined;
  const page = Number(url.searchParams.get("page") ?? "1") || 1;
  const pageSize = Number(url.searchParams.get("pageSize") ?? "50") || 50;

  const result = await getActivity(db, session, {
    periodStart,
    periodEnd,
    personId,
    kind,
    search,
    page,
    pageSize,
  });
  if (!result.ok) {
    return Response.json({ error: result.reason }, { status: writeStatus(result.reason) });
  }

  return Response.json({ rows: result.rows, total: result.total });
}
