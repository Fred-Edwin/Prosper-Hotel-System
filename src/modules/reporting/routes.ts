import { db } from "@/shared/db";
import { getSession } from "@/modules/people";
import { getDashboardProfit } from "./logic";

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
