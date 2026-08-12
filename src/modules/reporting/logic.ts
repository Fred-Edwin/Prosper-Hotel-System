// Profit assembly for the dashboard's Profit panel — formulas.md §5
// (transfer cost split), §6 (cost of goods sold, both locations), §7
// (profit). Reads through stock/sales/cash/catalogue/people's
// interfaces only, per docs/architecture.md's "reporting owns no data."
import type { PrismaClient } from "@/generated/prisma/client";
import {
  type AuthenticatedStaff,
  findLocationByCode,
  findStaffMembersByIds,
  listLocations,
  getDaysWorkedForActivity,
} from "@/modules/people";
import { getCurrentRecipe, findProductsByIds, findIngredientsByIds } from "@/modules/catalogue";
import {
  getIngredientStockValueAtLocation,
  getIngredientQuantityAtLocationAsOf,
  getIngredientsBoughtMinor,
  getIngredientsIssuedMinor,
  getIngredientsPurchasedByIngredient,
  getIngredientMovementsByReasonInPeriod,
  getProductMovementByReasonInPeriod,
  getProductMovementsByReasonInPeriod,
  getProductQuantityAtLocationAsOf,
  resolveProductCostBasis,
  getLatestStockCount,
  getPreviousStockCount,
  getNonSalesConsumptionValue,
  getNonSalesLedger,
  getMovementsForActivity,
  getStockCountsForActivity,
  type DerivedSalesDetail,
  type NonSalesCategory,
} from "@/modules/stock";
import { getSalesRevenueAtLocation, listSalesInPeriod } from "@/modules/sales";
import {
  getTakingsAtLocation,
  getRunningCosts,
  getCashLedgerTransactions,
  listTakingsInPeriod,
  type ExpenseCategory,
} from "@/modules/cash";

function requireOwner(requester: AuthenticatedStaff): boolean {
  return requester.staff.role === "owner";
}

async function locations(db: PrismaClient) {
  const [restaurant, canteen] = await Promise.all([
    findLocationByCode(db, "restaurant"),
    findLocationByCode(db, "canteen"),
  ]);
  return { restaurant, canteen };
}

export type TransferCostLine = {
  productId: string;
  quantity: number;
  costMinor: number;
  usedRecipeCost: boolean;
};

export type TransferCostResult =
  | {
      ok: true;
      rate: number;
      transferCostMinor: number;
      lines: TransferCostLine[];
    }
  | { ok: false; reason: "forbidden" | "not_found" };

// formulas.md §5 — rate = kitchen ingredients consumed ÷ what its food
// sold for, applied to transferred food's selling value. Where a
// transferred item has a recipe, its recipe cost is used instead of the
// derived rate (the note under the formula). Zero kitchen revenue in the
// period (no sales yet) makes the rate 0 rather than dividing by zero —
// there is nothing to split cost against, not an error.
export async function computeTransferCost(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  input: { periodStart: Date; periodEnd: Date },
): Promise<TransferCostResult> {
  if (!requireOwner(requester)) return { ok: false, reason: "forbidden" };

  const { restaurant, canteen } = await locations(db);
  if (!restaurant || !canteen) return { ok: false, reason: "not_found" };

  const [consumed, revenue, transferredIn] = await Promise.all([
    getIngredientsIssuedMinor(db, requester, restaurant.id, input.periodStart, input.periodEnd),
    getSalesRevenueAtLocation(db, requester, restaurant.id, input.periodStart, input.periodEnd),
    getProductMovementByReasonInPeriod(
      db,
      requester,
      canteen.id,
      "transferred",
      input.periodStart,
      input.periodEnd,
    ),
  ]);
  if (!consumed.ok) return consumed;
  if (!revenue.ok) return revenue;
  if (!transferredIn.ok) return transferredIn;

  const rate = revenue.totalMinor > 0 ? consumed.totalMinor / revenue.totalMinor : 0;

  const incomingLines = transferredIn.lines.filter((line) => line.quantity > 0);
  const products = await findProductsByIds(db, incomingLines.map((line) => line.productId));
  const productById = new Map(products.map((p) => [p.id, p]));

  const lines: TransferCostLine[] = [];
  let transferCostMinor = 0;
  for (const line of incomingLines) {
    const product = productById.get(line.productId);
    const recipe = product ? await getCurrentRecipe(db, product.id) : null;
    if (recipe?.perUnitCostMinor != null) {
      const costMinor = recipe.perUnitCostMinor * line.quantity;
      transferCostMinor += costMinor;
      lines.push({ productId: line.productId, quantity: line.quantity, costMinor, usedRecipeCost: true });
      continue;
    }
    const sellingValueMinor = (product?.priceMinor ?? 0) * line.quantity;
    const costMinor = Math.round(sellingValueMinor * rate);
    transferCostMinor += costMinor;
    lines.push({ productId: line.productId, quantity: line.quantity, costMinor, usedRecipeCost: false });
  }

  return { ok: true, rate, transferCostMinor, lines };
}

export type RestaurantCostOfGoodsResult =
  | {
      ok: true;
      openingMinor: number;
      boughtMinor: number;
      closingMinor: number;
      transferCostMinor: number;
      totalMinor: number;
    }
  | { ok: false; reason: "forbidden" | "not_found" };

// formulas.md §6, restaurant — exact, daily:
//   opening ingredients + ingredients bought − closing ingredients − food sent to canteen
// Opening/closing are ingredient stock *value* (§12) at the day's two
// boundaries, valued at each ingredient's current running-average cost —
// same simplification correctStockCount already makes, since no
// historical per-batch cost is kept (§3).
export async function computeRestaurantCostOfGoods(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  input: { dayStart: Date; dayEnd: Date },
): Promise<RestaurantCostOfGoodsResult> {
  if (!requireOwner(requester)) return { ok: false, reason: "forbidden" };

  const { restaurant } = await locations(db);
  if (!restaurant) return { ok: false, reason: "not_found" };

  const [opening, closing, bought, transfer] = await Promise.all([
    getIngredientStockValueAtLocation(db, requester, restaurant.id, input.dayStart),
    getIngredientStockValueAtLocation(db, requester, restaurant.id, input.dayEnd),
    getIngredientsBoughtMinor(db, requester, restaurant.id, input.dayStart, input.dayEnd),
    computeTransferCost(db, requester, { periodStart: input.dayStart, periodEnd: input.dayEnd }),
  ]);
  if (!opening.ok) return opening;
  if (!closing.ok) return closing;
  if (!bought.ok) return bought;
  if (!transfer.ok) return transfer;

  const totalMinor =
    opening.totalMinor + bought.totalMinor - closing.totalMinor - transfer.transferCostMinor;

  return {
    ok: true,
    openingMinor: opening.totalMinor,
    boughtMinor: bought.totalMinor,
    closingMinor: closing.totalMinor,
    transferCostMinor: transfer.transferCostMinor,
    totalMinor,
  };
}

export type CanteenCostOfGoodsResult =
  | {
      ok: true;
      exactMinor: number;
      estimatedMinor: number;
      totalMinor: number;
      canteenCostRate: number | null;
      lastCanteenCount: Date | null;
    }
  | { ok: false; reason: "forbidden" | "not_found" };

// formulas.md §6, canteen — two parts.
//
// Restaurant food (exact, counted daily): opening + transferred in −
// closing − wasted. Valued at the *same cost basis §5 already computed*
// for what arrived — "the same figure is subtracted from one side and
// added to the other" (§5) is only true if the canteen's restaurant-food
// cost reuses computeTransferCost's own per-line costMinor rather than
// re-deriving a figure from selling price. Wasted quantity is valued at
// each line's implied per-unit cost (costMinor ÷ quantity) for the same
// reason — it's food that arrived at transfer cost, not goods the
// canteen bought itself.
//
// Own goods (estimated between counts): today's takings from own goods ×
// the rate measured at the last count. "Today's takings from own goods"
// has no separate ledger — the canteen declares one total takings figure
// (ticket 23), not itemised by category — so this uses the *proportion*
// of own-goods revenue within the last count's own derived-sales detail,
// applied to today's declared takings. Where there is no previous count
// (first count, or no count at all), the estimate is unavailable rather
// than guessed — formulas.md's "the first period has no measured rate."
export async function computeCanteenCostOfGoods(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  input: { dayStart: Date; dayEnd: Date },
): Promise<CanteenCostOfGoodsResult> {
  if (!requireOwner(requester)) return { ok: false, reason: "forbidden" };

  const { canteen } = await locations(db);
  if (!canteen) return { ok: false, reason: "not_found" };

  const wasted = await getProductMovementByReasonInPeriod(
    db,
    requester,
    canteen.id,
    "wasted",
    input.dayStart,
    input.dayEnd,
  );
  if (!wasted.ok) return wasted;

  // The transfer itself, and its per-line cost basis (§5) — the figure
  // the restaurant subtracted is exactly what the canteen's restaurant-
  // food cost must add, so this reuses it rather than re-deriving one.
  const transfer = await computeTransferCost(db, requester, {
    periodStart: input.dayStart,
    periodEnd: input.dayEnd,
  });
  if (!transfer.ok) return transfer;

  // formulas.md §6's canteen restaurant-food cost: opening + transferred
  // in − closing − wasted. Most days everything sent is sold, so closing
  // is zero; where food carries forward, it is tomorrow's opening,
  // exactly as the formula's Monday/Tuesday samosa example shows — this
  // ticket computes one day at a time, so a carried balance shows up as
  // that later day's smaller net figure rather than as a tracked
  // opening/closing pair here.
  let exactMinor = 0;
  const restaurantSuppliedIds = new Set<string>();
  for (const line of transfer.lines) {
    restaurantSuppliedIds.add(line.productId);
    const wastedQty = -(wasted.lines.find((l) => l.productId === line.productId)?.quantity ?? 0);
    const costPerUnit = line.quantity > 0 ? line.costMinor / line.quantity : 0;
    const soldQty = Math.max(0, line.quantity - wastedQty);
    exactMinor += Math.round(soldQty * costPerUnit);
  }

  const latestCount = await getLatestStockCount(db, requester, canteen.id);
  if (!latestCount.ok) return latestCount;

  // Classification for the rate uses the count's own period, not
  // today's window — a product only shows up in the rate if it was
  // actually received (own goods) between the previous count and this
  // one.
  const rate = await ownGoodsRateFromCount(
    db,
    requester,
    canteen.id,
    latestCount.count,
    latestCount.derivedSales,
  );

  const takings = await getTakingsAtLocation(db, requester, canteen.id, input.dayStart, input.dayEnd);
  if (!takings.ok) return takings;
  const takingsTotalMinor = takings.cashMinor + takings.mpesaMinor;

  const estimatedMinor = rate != null ? Math.round(takingsTotalMinor * rate) : 0;

  return {
    ok: true,
    exactMinor,
    estimatedMinor,
    totalMinor: exactMinor + estimatedMinor,
    canteenCostRate: rate,
    lastCanteenCount: latestCount.count?.occurredAt ?? null,
  };
}

// formulas.md §6's own-goods rate: cost of these goods at the last count
// ÷ what they sold for over that period.
//
// "Cost of these goods at the last count" — the count-derived-sold
// quantity of each own-goods product (ticket 24's sold_derived — what
// the count measured as having sold over the period), valued at that
// product's current running-average cost (§3/§4's bought-in-goods
// basis; same current-cost simplification used throughout, since no
// historical per-count cost is kept). Read as "the cost of what this
// count showed had gone" rather than "what's left on the shelf" — the
// parallel revenue term below is exactly the selling value of that same
// sold quantity, so cost ÷ revenue is a margin ratio on goods actually
// sold, not a snapshot of unsold stock.
//
// "What they sold for over that period" — the last count's own
// derived-sales revenue (ticket 24) for those same own-goods products;
// `derivedSales` already covers exactly "since the previous count",
// which is the period the count measures against.
//
// "Own goods" here is classified over the count's own period (since the
// previous count, via `sincePreviousCountAt`) — a product only counts as
// own-goods if it was received directly (not transferred from the
// restaurant) within that same period, not today's window.
//
// Unavailable (null) where there's no previous count to derive sales
// from, or no own-goods lines counted — formulas.md's "the first period
// has no measured rate."
async function ownGoodsRateFromCount(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  canteenLocationId: string,
  count: { occurredAt: Date } | null,
  derivedSales: DerivedSalesDetail,
): Promise<number | null> {
  if (!count || !derivedSales.available) return null;

  const received = await getProductMovementByReasonInPeriod(
    db,
    requester,
    canteenLocationId,
    "received",
    derivedSales.sincePreviousCountAt,
    count.occurredAt,
  );
  if (!received.ok) return null;
  const ownGoodsProductIds = new Set(
    received.lines.filter((line) => line.quantity > 0).map((line) => line.productId),
  );

  const ownGoodsSoldLines = derivedSales.lines.filter((line) => ownGoodsProductIds.has(line.productId));
  if (ownGoodsSoldLines.length === 0) return null;

  const products = await findProductsByIds(db, ownGoodsSoldLines.map((line) => line.productId));
  const costById = new Map(products.map((p) => [p.id, p.lastKnownCostMinor ?? 0]));

  const costAtCountMinor = ownGoodsSoldLines.reduce(
    (sum, line) => sum + line.quantity * (costById.get(line.productId) ?? 0),
    0,
  );

  const revenueMinor = ownGoodsSoldLines.reduce((sum, line) => sum + (line.revenueMinor ?? 0), 0);

  if (revenueMinor <= 0) return null;
  return costAtCountMinor / revenueMinor;
}

export type CountCorrectionResult =
  | {
      ok: true;
      available: true;
      estimatedSinceLastCountMinor: number;
      measuredAtCountMinor: number;
      differenceMinor: number;
    }
  | { ok: true; available: false }
  | { ok: false; reason: "forbidden" | "not_found" };

// formulas.md §6's "the count corrects the estimate" — shown, not
// applied quietly:
//   Estimated since last count    KSh 61,200
//   Measured at the count         KSh 63,800
//   Correction                  − KSh  2,600
//
// "Measured at the count" — the latest count's own derived-sales revenue
// (ticket 24) for own-goods products, i.e. what they actually sold for
// over the period.
//
// "Estimated since last count" — what the dashboard's daily estimate
// would have shown across that same period, which used the rate
// measured at the count *before* the latest one (the rate in force
// during that period) applied to that period's own-goods takings.
// Unavailable where there's no prior-prior count to derive that earlier
// rate from — same "first period has no measured rate" caveat, one
// level further back.
export async function computeCountCorrection(
  db: PrismaClient,
  requester: AuthenticatedStaff,
): Promise<CountCorrectionResult> {
  if (!requireOwner(requester)) return { ok: false, reason: "forbidden" };

  const { canteen } = await locations(db);
  if (!canteen) return { ok: false, reason: "not_found" };

  const latestCount = await getLatestStockCount(db, requester, canteen.id);
  if (!latestCount.ok) return latestCount;
  if (!latestCount.count || !latestCount.derivedSales.available) {
    return { ok: true, available: false };
  }

  // The count immediately before the latest one — its own rate is what
  // was "in force" during the period the latest count now corrects.
  const priorRate = await getPreviousStockCount(db, requester, canteen.id, latestCount.count.occurredAt);
  if (!priorRate.ok) return priorRate;

  const rateBeforeThisPeriod = await ownGoodsRateFromCount(
    db,
    requester,
    canteen.id,
    priorRate.count,
    priorRate.derivedSales,
  );
  if (rateBeforeThisPeriod == null) return { ok: true, available: false };

  const ownGoods = await getProductMovementByReasonInPeriod(
    db,
    requester,
    canteen.id,
    "received",
    latestCount.derivedSales.sincePreviousCountAt,
    latestCount.count.occurredAt,
  );
  if (!ownGoods.ok) return ownGoods;
  const ownGoodsProductIds = new Set(
    ownGoods.lines.filter((line) => line.quantity > 0).map((line) => line.productId),
  );

  const measuredAtCountMinor = latestCount.derivedSales.lines
    .filter((line) => ownGoodsProductIds.has(line.productId))
    .reduce((sum, line) => sum + (line.revenueMinor ?? 0), 0);

  const takings = await getTakingsAtLocation(
    db,
    requester,
    canteen.id,
    latestCount.derivedSales.sincePreviousCountAt,
    latestCount.count.occurredAt,
  );
  if (!takings.ok) return takings;
  const takingsSinceLastCountMinor = takings.cashMinor + takings.mpesaMinor;

  const estimatedSinceLastCountMinor = Math.round(
    takingsSinceLastCountMinor * rateBeforeThisPeriod,
  );

  return {
    ok: true,
    available: true,
    estimatedSinceLastCountMinor,
    measuredAtCountMinor,
    differenceMinor: measuredAtCountMinor - estimatedSinceLastCountMinor,
  };
}

export type DashboardProfitLocationBreakdown = {
  revenueMinor: number;
  costOfGoodsMinor: number;
  grossProfitMinor: number;
  runningCostsMinor: number;
  netProfitMinor: number;
  provisional: boolean;
};

export type DashboardProfitResult =
  | {
      ok: true;
      period: { dayStart: Date; dayEnd: Date };
      revenue: { restaurant: number; canteen: number; total: number };
      costOfGoods: {
        restaurant: number;
        canteenExact: number;
        canteenEstimated: number;
        total: number;
      };
      runningCostsMinor: number;
      grossProfitMinor: number;
      netProfitMinor: number;
      canteenCostRate: number | null;
      lastCanteenCount: Date | null;
      correction: CountCorrectionResult;
      byLocation: {
        restaurant: DashboardProfitLocationBreakdown;
        canteen: DashboardProfitLocationBreakdown;
      };
    }
  | { ok: false; reason: "forbidden" | "not_found" };

// Assembles the dashboard's Profit waterfall (dashboard-r3.tsx's
// revenue / cost of goods sold / running costs / net profit strip) for
// one day. formulas.md §7 — sales revenue − cost of goods sold = gross
// profit; gross profit − running costs = net profit. Business total is
// unaffected by the transfer rate chosen (formulas.md §5) since the
// same figure is subtracted from the restaurant and added to the
// canteen — computeRestaurantCostOfGoods and computeCanteenCostOfGoods
// each call computeTransferCost independently but with identical
// inputs, so both sides always agree on the same figure.
export async function getDashboardProfit(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  input: { dayStart: Date; dayEnd: Date },
): Promise<DashboardProfitResult> {
  if (!requireOwner(requester)) return { ok: false, reason: "forbidden" };

  const { restaurant, canteen } = await locations(db);
  if (!restaurant || !canteen) return { ok: false, reason: "not_found" };

  const [
    restaurantRevenue,
    canteenTakings,
    restaurantCogs,
    canteenCogs,
    runningCosts,
    restaurantRunningCosts,
    canteenRunningCosts,
    correction,
  ] = await Promise.all([
    getSalesRevenueAtLocation(db, requester, restaurant.id, input.dayStart, input.dayEnd),
    getTakingsAtLocation(db, requester, canteen.id, input.dayStart, input.dayEnd),
    computeRestaurantCostOfGoods(db, requester, input),
    computeCanteenCostOfGoods(db, requester, input),
    getRunningCosts(db, requester, input.dayStart, input.dayEnd),
    getRunningCosts(db, requester, input.dayStart, input.dayEnd, restaurant.id),
    getRunningCosts(db, requester, input.dayStart, input.dayEnd, canteen.id),
    computeCountCorrection(db, requester),
  ]);
  if (!restaurantRevenue.ok) return restaurantRevenue;
  if (!canteenTakings.ok) return canteenTakings;
  if (!restaurantCogs.ok) return restaurantCogs;
  if (!canteenCogs.ok) return canteenCogs;
  if (!runningCosts.ok) return runningCosts;
  if (!restaurantRunningCosts.ok) return restaurantRunningCosts;
  if (!canteenRunningCosts.ok) return canteenRunningCosts;

  const canteenRevenueMinor = canteenTakings.cashMinor + canteenTakings.mpesaMinor;
  const revenue = {
    restaurant: restaurantRevenue.totalMinor,
    canteen: canteenRevenueMinor,
    total: restaurantRevenue.totalMinor + canteenRevenueMinor,
  };
  const costOfGoods = {
    restaurant: restaurantCogs.totalMinor,
    canteenExact: canteenCogs.exactMinor,
    canteenEstimated: canteenCogs.estimatedMinor,
    total: restaurantCogs.totalMinor + canteenCogs.totalMinor,
  };
  const grossProfitMinor = revenue.total - costOfGoods.total;
  const netProfitMinor = grossProfitMinor - runningCosts.totalMinor;

  const canteenCostOfGoodsMinor = canteenCogs.exactMinor + canteenCogs.estimatedMinor;
  const restaurantGrossProfitMinor = revenue.restaurant - costOfGoods.restaurant;
  const canteenGrossProfitMinor = revenue.canteen - canteenCostOfGoodsMinor;

  return {
    ok: true,
    period: { dayStart: input.dayStart, dayEnd: input.dayEnd },
    revenue,
    costOfGoods,
    runningCostsMinor: runningCosts.totalMinor,
    grossProfitMinor,
    netProfitMinor,
    canteenCostRate: canteenCogs.canteenCostRate,
    lastCanteenCount: canteenCogs.lastCanteenCount,
    correction,
    byLocation: {
      restaurant: {
        revenueMinor: revenue.restaurant,
        costOfGoodsMinor: costOfGoods.restaurant,
        grossProfitMinor: restaurantGrossProfitMinor,
        runningCostsMinor: restaurantRunningCosts.totalMinor,
        netProfitMinor: restaurantGrossProfitMinor - restaurantRunningCosts.totalMinor,
        provisional: false,
      },
      canteen: {
        revenueMinor: revenue.canteen,
        costOfGoodsMinor: canteenCostOfGoodsMinor,
        grossProfitMinor: canteenGrossProfitMinor,
        runningCostsMinor: canteenRunningCosts.totalMinor,
        netProfitMinor: canteenGrossProfitMinor - canteenRunningCosts.totalMinor,
        // The canteen's own-goods cost is always an estimate between counts
        // (formulas.md §6) — provisional whenever there's any estimated
        // portion, same framing the combined "partly provisional" badge uses.
        provisional: canteenCogs.estimatedMinor !== 0 || canteenCogs.canteenCostRate == null,
      },
    },
  };
}

export type RevenueProfitTrendPoint = {
  date: string;
  revenue: number | null;
  netProfit: number | null;
};

export type RevenueProfitTrendResult =
  | { ok: true; points: RevenueProfitTrendPoint[] }
  | { ok: false; reason: "forbidden" | "not_found" };

// Local-time day boundary, matching the rest of the dashboard's day/week/
// month convention (routes.ts's todayBounds, dashboard-profit.tsx's
// periodBounds) rather than UTC — a sale at 11pm local time belongs to
// that local day, not the next UTC day.
function dayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Ticket 47 — the Dashboard's Revenue and profit chart. One point per day
// over a rolling window ending `windowEnd`, combining both locations (the
// chart has no per-location toggle — that's the separate "By location"
// card). Reuses getDashboardProfit's own per-day assembly rather than
// duplicating it, since the trend is nothing more than that same
// computation repeated across the window.
//
// Gap detection: there is no business-wide "day open/closed" flag
// anywhere in the schema — isDayClosedFor (ticket 28) is per-person,
// per-location, and doesn't describe whether the business traded at all.
// A day is a gap (null) only when it has zero Sale rows AND zero Takings
// rows across both locations; a day with at least one recorded row, even
// one that nets to zero, is real trading data (2026-08-12, confirmed with
// Edwinfred — see this ticket's file for the full note).
export async function getRevenueProfitTrend(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  input: { windowEnd: Date; days: number },
): Promise<RevenueProfitTrendResult> {
  if (!requireOwner(requester)) return { ok: false, reason: "forbidden" };

  const { restaurant, canteen } = await locations(db);
  if (!restaurant || !canteen) return { ok: false, reason: "not_found" };

  const windowEndOfDay = new Date(input.windowEnd);
  windowEndOfDay.setHours(23, 59, 59, 999);
  const windowStart = new Date(windowEndOfDay);
  windowStart.setDate(windowStart.getDate() - (input.days - 1));
  windowStart.setHours(0, 0, 0, 0);

  const [sales, takings] = await Promise.all([
    listSalesInPeriod(db, windowStart, windowEndOfDay),
    listTakingsInPeriod(db, windowStart, windowEndOfDay),
  ]);
  const tradedDays = new Set<string>([
    ...sales.map((s) => dayKey(s.occurredAt)),
    ...takings.map((t) => dayKey(t.occurredAt)),
  ]);

  const dayBounds: { date: string; dayStart: Date; dayEnd: Date }[] = [];
  for (let i = 0; i < input.days; i++) {
    const dayStart = new Date(windowStart);
    dayStart.setDate(dayStart.getDate() + i);
    const dayEnd = new Date(dayStart);
    dayEnd.setHours(23, 59, 59, 999);
    dayBounds.push({ date: dayKey(dayStart), dayStart, dayEnd });
  }

  const results = await Promise.all(
    dayBounds.map(({ dayStart, dayEnd }) => getDashboardProfit(db, requester, { dayStart, dayEnd })),
  );

  const points: RevenueProfitTrendPoint[] = [];
  for (let i = 0; i < dayBounds.length; i++) {
    const { date } = dayBounds[i];
    const day = results[i];
    if (!day.ok) return day;

    const traded = tradedDays.has(date);
    points.push({
      date,
      revenue: traded ? day.revenue.total : null,
      netProfit: traded ? day.netProfitMinor : null,
    });
  }

  return { ok: true, points };
}

export type ExceptionShortfall = {
  handoverId: string;
  staffName: string;
  locationCode: string;
  cashDiffMinor: number;
  mpesaDiffMinor: number;
  occurredAt: Date;
};

export type ExceptionVoidedSale = {
  saleId: string;
  saleRef: string;
  voidedByName: string;
  totalMinor: number;
  locationCode: string;
  voidedAt: Date;
};

export type GetExceptionsResult =
  | { ok: true; shortfalls: ExceptionShortfall[]; voidedSales: ExceptionVoidedSale[] }
  | { ok: false; reason: "forbidden" };

// Ticket 48 — the Dashboard's "Needs you" card: today's handover
// shortfalls (cash and/or M-Pesa actual != expected, either location —
// canteen does get a handover check per roadmap.md's Stage 5, just with
// a different expected-amount source) and today's voided sales. No
// pending-expense source — this codebase has no submit-for-confirmation
// concept for expenses (2026-08-12, confirmed with Edwinfred, see ticket
// 48's file). Business-wide, owner-only, same gate as every other
// dashboard-feeding read here.
export async function getExceptions(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  input: { today: Date },
): Promise<GetExceptionsResult> {
  if (!requireOwner(requester)) return { ok: false, reason: "forbidden" };

  const dayStart = new Date(input.today);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const [cashTransactions, sales, allLocations] = await Promise.all([
    getCashLedgerTransactions(db, requester, dayStart, dayEnd),
    listSalesInPeriod(db, dayStart, dayEnd),
    listLocations(db),
  ]);
  if (!cashTransactions.ok) return cashTransactions;

  const locationCodeById = new Map(allLocations.map((l) => [l.id, l.code]));

  const shortfallHandovers = cashTransactions.handovers.filter(
    (h) => h.actualCashMinor !== h.expectedCashMinor || h.actualMpesaMinor !== h.expectedMpesaMinor,
  );
  const voidedSaleRows = sales.filter((s) => s.voided);

  const staffIds = new Set<string>([
    ...shortfallHandovers.map((h) => h.staffMemberId),
    ...voidedSaleRows.filter((s) => s.voidedBy).map((s) => s.voidedBy!),
  ]);
  const staff = await findStaffMembersByIds(db, Array.from(staffIds));
  const staffNameById = new Map(staff.map((s) => [s.id, s.name]));
  const nameFor = (id: string | null) => (id ? (staffNameById.get(id) ?? "Unknown") : "Unknown");

  const shortfalls: ExceptionShortfall[] = shortfallHandovers.map((h) => ({
    handoverId: h.id,
    staffName: nameFor(h.staffMemberId),
    locationCode: locationCodeById.get(h.locationId) ?? "unknown",
    cashDiffMinor: h.actualCashMinor - h.expectedCashMinor,
    mpesaDiffMinor: h.actualMpesaMinor - h.expectedMpesaMinor,
    occurredAt: h.occurredAt,
  }));

  const voidedSales: ExceptionVoidedSale[] = voidedSaleRows.map((s) => ({
    saleId: s.id,
    saleRef: s.id.slice(0, 8),
    voidedByName: nameFor(s.voidedBy),
    totalMinor: s.totalMinor,
    locationCode: locationCodeById.get(s.locationId) ?? "unknown",
    voidedAt: s.voidedAt ?? s.occurredAt,
  }));

  return { ok: true, shortfalls, voidedSales };
}

export type LedgerSummaryResult =
  | {
      ok: true;
      period: { periodStart: Date; periodEnd: Date };
      openingMinor: number;
      purchasesMinor: number;
      closingMinor: number;
      costOfGoodsSoldMinor: number;
      salesValueMinor: number;
      grossProfitMinor: number;
      nonSalesAtCostMinor: number;
      nonSalesAtPriceMinor: number;
      canteenCostRate: number | null;
      lastCanteenCount: Date | null;
    }
  | { ok: false; reason: "forbidden" | "not_found" };

// Ticket 38's ledger waterfall — proposal.md §10.2's opening/purchases/
// closing/cost-of-goods-sold arithmetic, generalised from the dashboard's
// one-day figure to an arbitrary period, and combining both locations into
// one whole-business total (which getDashboardProfit does not do).
//
// "Opening stock" and "closing stock" here are the restaurant's ingredient
// stock value at the period's two boundaries — the same figure
// computeRestaurantCostOfGoods already uses, per formulas.md §6. The
// canteen's cost of goods is transfer-cost-plus-estimated-rate, not an
// opening/closing stock figure of its own (2026-08-12 clarification), so it
// has no separate opening/closing contribution here — it only enters via
// costOfGoodsSoldMinor, same as computeCanteenCostOfGoods elsewhere.
export async function getLedgerSummary(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  input: { periodStart: Date; periodEnd: Date },
): Promise<LedgerSummaryResult> {
  if (!requireOwner(requester)) return { ok: false, reason: "forbidden" };

  const { restaurant, canteen } = await locations(db);
  if (!restaurant || !canteen) return { ok: false, reason: "not_found" };

  const dayShapedInput = { dayStart: input.periodStart, dayEnd: input.periodEnd };

  const [
    opening,
    closing,
    purchases,
    restaurantCogs,
    canteenCogs,
    restaurantRevenue,
    canteenTakings,
    restaurantNonSales,
    canteenNonSales,
  ] = await Promise.all([
    getIngredientStockValueAtLocation(db, requester, restaurant.id, input.periodStart),
    getIngredientStockValueAtLocation(db, requester, restaurant.id, input.periodEnd),
    getIngredientsBoughtMinor(db, requester, restaurant.id, input.periodStart, input.periodEnd),
    computeRestaurantCostOfGoods(db, requester, dayShapedInput),
    computeCanteenCostOfGoods(db, requester, dayShapedInput),
    getSalesRevenueAtLocation(db, requester, restaurant.id, input.periodStart, input.periodEnd),
    getTakingsAtLocation(db, requester, canteen.id, input.periodStart, input.periodEnd),
    getNonSalesConsumptionValue(db, requester, restaurant.id, input.periodStart, input.periodEnd),
    getNonSalesConsumptionValue(db, requester, canteen.id, input.periodStart, input.periodEnd),
  ]);
  if (!opening.ok) return opening;
  if (!closing.ok) return closing;
  if (!purchases.ok) return purchases;
  if (!restaurantCogs.ok) return restaurantCogs;
  if (!canteenCogs.ok) return canteenCogs;
  if (!restaurantRevenue.ok) return restaurantRevenue;
  if (!canteenTakings.ok) return canteenTakings;
  if (!restaurantNonSales.ok) return restaurantNonSales;
  if (!canteenNonSales.ok) return canteenNonSales;

  const costOfGoodsSoldMinor = restaurantCogs.totalMinor + canteenCogs.totalMinor;
  const salesValueMinor =
    restaurantRevenue.totalMinor + canteenTakings.cashMinor + canteenTakings.mpesaMinor;

  return {
    ok: true,
    period: { periodStart: input.periodStart, periodEnd: input.periodEnd },
    openingMinor: opening.totalMinor,
    purchasesMinor: purchases.totalMinor,
    closingMinor: closing.totalMinor,
    costOfGoodsSoldMinor,
    salesValueMinor,
    grossProfitMinor: salesValueMinor - costOfGoodsSoldMinor,
    nonSalesAtCostMinor: restaurantNonSales.atCostMinor + canteenNonSales.atCostMinor,
    nonSalesAtPriceMinor: restaurantNonSales.atPriceMinor + canteenNonSales.atPriceMinor,
    canteenCostRate: canteenCogs.canteenCostRate,
    lastCanteenCount: canteenCogs.lastCanteenCount,
  };
}

export type ProductLedgerDay = {
  date: string;
  opening: number;
  produced: number;
  received: number;
  transferredIn: number;
  sold: number;
  transferredOut: number;
  nonSales: number;
  salesValueMinor: number;
  closing: number;
};

export type ProductLedgerRow = {
  productId: string;
  productName: string;
  locationId: string;
  locationCode: string;
  categoryId: string | null;
  openingQty: number;
  produced: number;
  received: number;
  transferredIn: number;
  sold: number;
  transferredOut: number;
  nonSales: number;
  salesValueMinor: number;
  unitCostMinor: number | null;
  isEstimated: boolean;
  sellingPriceMinor: number | null;
  costOfSalesMinor: number | null;
  profitMinor: number | null;
  closingQty: number;
  closingValueMinor: number | null;
  days: ProductLedgerDay[];
};

export type ProductLedgerResult =
  | { ok: true; rows: ProductLedgerRow[] }
  | { ok: false; reason: "forbidden" | "not_found" };

const PRODUCT_IN_REASONS = ["produced", "received", "transferred"] as const;
const PRODUCT_OUT_REASONS = ["sold", "sold_derived", "transferred", "wasted", "consumed", "given_away"] as const;

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// One calendar day per entry, periodStart's date through periodEnd's date
// inclusive — matches the day-expansion child rows against the same
// calendar days a person reading a date range would expect, regardless of
// what time of day periodStart/periodEnd fall at.
function daysInPeriod(periodStart: Date, periodEnd: Date): { start: Date; end: Date; label: string }[] {
  const days: { start: Date; end: Date; label: string }[] = [];
  const cursor = new Date(periodStart);
  cursor.setUTCHours(0, 0, 0, 0);
  const last = new Date(periodEnd);
  last.setUTCHours(0, 0, 0, 0);
  while (cursor <= last) {
    const start = new Date(cursor);
    const end = new Date(cursor);
    end.setUTCDate(end.getUTCDate() + 1);
    days.push({ start, end, label: isoDate(cursor) });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

type ReasonSums = {
  produced: number;
  received: number;
  transferredIn: number;
  transferredOut: number;
  sold: number;
  nonSales: number;
};

function emptyReasonSums(): ReasonSums {
  return { produced: 0, received: 0, transferredIn: 0, transferredOut: 0, sold: 0, nonSales: 0 };
}

// Folds one product's movement-by-reason lines (both signed `transferred`
// directions, and quantity sign already flipped to positive "out" figures
// for out-reasons) into the ledger's named columns.
function foldReasonLines(
  lines: { reason: string; quantity: number }[],
): ReasonSums {
  const sums = emptyReasonSums();
  for (const line of lines) {
    if (line.reason === "produced") sums.produced += line.quantity;
    else if (line.reason === "received") sums.received += line.quantity;
    else if (line.reason === "transferred") {
      if (line.quantity > 0) sums.transferredIn += line.quantity;
      else sums.transferredOut += -line.quantity;
    } else if (line.reason === "sold" || line.reason === "sold_derived") sums.sold += -line.quantity;
    else if (line.reason === "wasted" || line.reason === "consumed" || line.reason === "given_away") {
      sums.nonSales += -line.quantity;
    }
  }
  return sums;
}

// Ticket 39's Product ledger — proposal.md §9's "for any item on any date"
// stock history, one row per product per location for the selected period,
// expandable to a day-by-day breakdown. Opening/closing quantities come
// from stock's as-of reads (ground truth), the in/out columns from the
// same period's movement-by-reason sums, so the two always reconcile by
// construction — they're reading the same underlying movements two ways,
// not two independently-derived figures. Cost basis reuses stock's
// resolveProductCostBasis (ticket 37's three-tier table) directly rather
// than re-deriving it, and is resolved even for a product
// getProductStockValueAtLocation(AsOf) would otherwise skip, so a product
// with genuinely no cost basis still gets a row with profit shown as
// unavailable (formulas.md's "not zero, not a guess").
export async function getProductLedger(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  input: {
    periodStart: Date;
    periodEnd: Date;
    locationId?: string;
    categoryId?: string;
    search?: string;
  },
): Promise<ProductLedgerResult> {
  if (!requireOwner(requester)) return { ok: false, reason: "forbidden" };

  const allLocations = await listLocations(db);
  const targetLocations = input.locationId
    ? allLocations.filter((l) => l.id === input.locationId)
    : allLocations;
  if (targetLocations.length === 0) return { ok: false, reason: "not_found" };

  const days = daysInPeriod(input.periodStart, input.periodEnd);
  const rows: ProductLedgerRow[] = [];

  for (const location of targetLocations) {
    const [openingQuantities, closingQuantities, periodMovements] = await Promise.all([
      getProductQuantityAtLocationAsOf(db, requester, location.id, input.periodStart),
      getProductQuantityAtLocationAsOf(db, requester, location.id, input.periodEnd),
      getProductMovementsByReasonInPeriod(
        db,
        requester,
        location.id,
        [...PRODUCT_IN_REASONS, ...PRODUCT_OUT_REASONS],
        input.periodStart,
        input.periodEnd,
      ),
    ]);
    if (!openingQuantities.ok) return openingQuantities;
    if (!closingQuantities.ok) return closingQuantities;
    if (!periodMovements.ok) return periodMovements;

    const openingByProduct = new Map(
      openingQuantities.quantities.map((q) => [q.productId, q.quantityOnHand]),
    );
    const closingByProduct = new Map(
      closingQuantities.quantities.map((q) => [q.productId, q.quantityOnHand]),
    );

    const productIds = new Set<string>([
      ...openingQuantities.quantities.map((q) => q.productId),
      ...closingQuantities.quantities.map((q) => q.productId),
      ...periodMovements.lines.map((l) => l.productId),
    ]);
    if (productIds.size === 0) continue;

    const products = await findProductsByIds(db, Array.from(productIds));
    const productById = new Map(products.map((p) => [p.id, p]));

    const linesByProduct = new Map<string, { reason: string; quantity: number }[]>();
    for (const line of periodMovements.lines) {
      const list = linesByProduct.get(line.productId) ?? [];
      list.push(line);
      linesByProduct.set(line.productId, list);
    }

    // Per-day movement sums, fetched once per day for the whole location
    // rather than once per product per day.
    const dayMovements = await Promise.all(
      days.map((day) =>
        getProductMovementsByReasonInPeriod(
          db,
          requester,
          location.id,
          [...PRODUCT_IN_REASONS, ...PRODUCT_OUT_REASONS],
          day.start,
          day.end,
        ),
      ),
    );
    for (const dm of dayMovements) if (!dm.ok) return dm;

    for (const productId of productIds) {
      const product = productById.get(productId);
      if (!product) continue;

      const openingQty = openingByProduct.get(productId) ?? 0;
      const closingQty = closingByProduct.get(productId) ?? openingQty;
      const sums = foldReasonLines(linesByProduct.get(productId) ?? []);

      const recipe = product.kind === "cooked_food" ? await getCurrentRecipe(db, product.id) : null;
      const basis = resolveProductCostBasis(product, recipe);

      const soldQty = sums.sold;
      const salesValueMinor = product.priceMinor != null ? soldQty * product.priceMinor : 0;
      const costOfSalesMinor = basis ? basis.costBasisMinor * soldQty : null;
      const profitMinor = costOfSalesMinor === null ? null : salesValueMinor - costOfSalesMinor;
      const closingValueMinor = basis ? basis.costBasisMinor * closingQty : null;

      const productDays: ProductLedgerDay[] = [];
      let runningOpening = openingQty;
      for (let i = 0; i < days.length; i++) {
        const dm = dayMovements[i];
        if (!dm.ok) continue;
        const dayLines = dm.lines.filter((l) => l.productId === productId);
        const daySums = foldReasonLines(dayLines);
        const dayClosing =
          runningOpening +
          daySums.produced +
          daySums.received +
          daySums.transferredIn -
          daySums.sold -
          daySums.transferredOut -
          daySums.nonSales;
        productDays.push({
          date: days[i].label,
          opening: runningOpening,
          produced: daySums.produced,
          received: daySums.received,
          transferredIn: daySums.transferredIn,
          sold: daySums.sold,
          transferredOut: daySums.transferredOut,
          nonSales: daySums.nonSales,
          salesValueMinor: product.priceMinor != null ? daySums.sold * product.priceMinor : 0,
          closing: dayClosing,
        });
        runningOpening = dayClosing;
      }

      rows.push({
        productId: product.id,
        productName: product.name,
        locationId: location.id,
        locationCode: location.code,
        categoryId: product.categoryId,
        openingQty,
        produced: sums.produced,
        received: sums.received,
        transferredIn: sums.transferredIn,
        sold: sums.sold,
        transferredOut: sums.transferredOut,
        nonSales: sums.nonSales,
        salesValueMinor,
        unitCostMinor: basis?.costBasisMinor ?? null,
        isEstimated: basis?.isEstimated ?? false,
        sellingPriceMinor: product.priceMinor,
        costOfSalesMinor,
        profitMinor,
        closingQty,
        closingValueMinor,
        days: productDays,
      });
    }
  }

  const search = input.search?.trim().toLowerCase();
  const filtered = rows.filter(
    (row) =>
      (!input.categoryId || row.categoryId === input.categoryId) &&
      (!search || row.productName.toLowerCase().includes(search)),
  );

  filtered.sort((a, b) => a.productName.localeCompare(b.productName) || a.locationCode.localeCompare(b.locationCode));

  return { ok: true, rows: filtered };
}

// Ticket 42's Store ledger — one row per ingredient per location for the
// selected period, no day-expansion (unlike Product/Cash — the design
// reference's Store ledger has no chevron, and this ticket doesn't add
// one the design didn't ask for). Opening/closing quantities come from
// stock's as-of reads (ground truth), purchased/issued/transferred/
// spoilage from the same period's per-reason sums, so the two reconcile
// by construction, same principle as getProductLedger.
const STORE_OUT_REASONS = ["issued", "transferred", "wasted"] as const;

export type StoreLedgerRow = {
  ingredientId: string;
  ingredientName: string;
  unitOfMeasure: string;
  locationId: string;
  locationCode: string;
  openingQty: number;
  purchasedQty: number;
  purchasedValueMinor: number;
  issuedToKitchen: number;
  transferredOut: number;
  spoilage: number;
  closingQty: number;
  closingValueMinor: number;
  unitCostMinor: number;
  previousUnitCostMinor: number;
};

export type StoreLedgerResult =
  | { ok: true; rows: StoreLedgerRow[] }
  | { ok: false; reason: "forbidden" | "not_found" };

// The reference shows the *previous* running-average cost alongside the
// current one to indicate movement (formulas.md §3's weighted average has
// no historical snapshots). Reconstructed algebraically by reversing this
// period's purchases out of the current average, treating them as a
// single combined delivery — the running-average formula is linear, so
// this reverse is exact even though the real average may have moved in
// several individual steps during the period.
function previousUnitCostMinor(input: {
  currentAverageMinor: number;
  closingQty: number;
  purchasedQty: number;
  purchasedValueMinor: number;
}): number {
  const { currentAverageMinor, closingQty, purchasedQty, purchasedValueMinor } = input;
  const qtyBeforePurchases = closingQty - purchasedQty;
  if (purchasedQty <= 0 || qtyBeforePurchases <= 0) return currentAverageMinor;

  const valueBeforePurchases = closingQty * currentAverageMinor - purchasedValueMinor;
  if (valueBeforePurchases < 0) return currentAverageMinor;
  return Math.round(valueBeforePurchases / qtyBeforePurchases);
}

export async function getStoreLedger(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  input: {
    periodStart: Date;
    periodEnd: Date;
    locationId?: string;
    search?: string;
  },
): Promise<StoreLedgerResult> {
  if (!requireOwner(requester)) return { ok: false, reason: "forbidden" };

  const allLocations = await listLocations(db);
  const targetLocations = input.locationId
    ? allLocations.filter((l) => l.id === input.locationId)
    : allLocations;
  if (targetLocations.length === 0) return { ok: false, reason: "not_found" };

  const rows: StoreLedgerRow[] = [];

  for (const location of targetLocations) {
    const [openingQuantities, closingQuantities, purchases, movements] = await Promise.all([
      getIngredientQuantityAtLocationAsOf(db, requester, location.id, input.periodStart),
      getIngredientQuantityAtLocationAsOf(db, requester, location.id, input.periodEnd),
      getIngredientsPurchasedByIngredient(db, requester, location.id, input.periodStart, input.periodEnd),
      getIngredientMovementsByReasonInPeriod(
        db,
        requester,
        location.id,
        [...STORE_OUT_REASONS],
        input.periodStart,
        input.periodEnd,
      ),
    ]);
    if (!openingQuantities.ok) return openingQuantities;
    if (!closingQuantities.ok) return closingQuantities;
    if (!purchases.ok) return purchases;
    if (!movements.ok) return movements;

    const openingByIngredient = new Map(
      openingQuantities.quantities.map((q) => [q.ingredientId, q.quantityOnHand]),
    );
    const closingByIngredient = new Map(
      closingQuantities.quantities.map((q) => [q.ingredientId, q.quantityOnHand]),
    );
    const purchasesByIngredient = new Map(purchases.lines.map((p) => [p.ingredientId, p]));

    const outByIngredient = new Map<
      string,
      { issuedToKitchen: number; transferredOut: number; spoilage: number }
    >();
    for (const line of movements.lines) {
      const sums = outByIngredient.get(line.ingredientId) ?? {
        issuedToKitchen: 0,
        transferredOut: 0,
        spoilage: 0,
      };
      // Out-reason quantities are stored negative (stock leaving); flip to
      // positive "out" figures for the ledger's columns. `transferred` on
      // IngredientMovement carries both directions (see stock's transfer
      // logic) — only the negative (outbound) side belongs in this
      // location's "transferred out" column, same convention
      // getProductLedger's foldReasonLines uses for products.
      if (line.reason === "issued") sums.issuedToKitchen += -line.quantity;
      else if (line.reason === "transferred" && line.quantity < 0) sums.transferredOut += -line.quantity;
      else if (line.reason === "wasted") sums.spoilage += -line.quantity;
      outByIngredient.set(line.ingredientId, sums);
    }

    const ingredientIds = new Set<string>([
      ...openingQuantities.quantities.map((q) => q.ingredientId),
      ...closingQuantities.quantities.map((q) => q.ingredientId),
      ...purchases.lines.map((p) => p.ingredientId),
      ...movements.lines.map((l) => l.ingredientId),
    ]);
    if (ingredientIds.size === 0) continue;

    const ingredients = await findIngredientsByIds(db, Array.from(ingredientIds));
    const ingredientById = new Map(ingredients.map((i) => [i.id, i]));

    for (const ingredientId of ingredientIds) {
      const ingredient = ingredientById.get(ingredientId);
      if (!ingredient) continue;

      const openingQty = openingByIngredient.get(ingredientId) ?? 0;
      const closingQty = closingByIngredient.get(ingredientId) ?? openingQty;
      const purchase = purchasesByIngredient.get(ingredientId) ?? { quantity: 0, valueMinor: 0 };
      const out = outByIngredient.get(ingredientId) ?? {
        issuedToKitchen: 0,
        transferredOut: 0,
        spoilage: 0,
      };

      const unitCostMinor = ingredient.lastKnownCostMinor ?? 0;
      const previousCostMinor = previousUnitCostMinor({
        currentAverageMinor: unitCostMinor,
        closingQty,
        purchasedQty: purchase.quantity,
        purchasedValueMinor: purchase.valueMinor,
      });

      rows.push({
        ingredientId: ingredient.id,
        ingredientName: ingredient.name,
        unitOfMeasure: ingredient.unitOfMeasure,
        locationId: location.id,
        locationCode: location.code,
        openingQty,
        purchasedQty: purchase.quantity,
        purchasedValueMinor: purchase.valueMinor,
        issuedToKitchen: out.issuedToKitchen,
        transferredOut: out.transferredOut,
        spoilage: out.spoilage,
        closingQty,
        closingValueMinor: closingQty * unitCostMinor,
        unitCostMinor,
        previousUnitCostMinor: previousCostMinor,
      });
    }
  }

  const search = input.search?.trim().toLowerCase();
  const filtered = rows.filter((row) => !search || row.ingredientName.toLowerCase().includes(search));

  filtered.sort((a, b) => a.ingredientName.localeCompare(b.ingredientName) || a.locationCode.localeCompare(b.locationCode));

  return { ok: true, rows: filtered };
}

// Ticket 43's Non-sales ledger — one row per wasted/consumed/given-away
// entry across the selected location(s) (or all, matching the Product and
// Store ledgers' pattern), with an optional reason filter and a search
// across item name and recorded-by. Line-level rows come straight from
// stock's getNonSalesLedger — this function joins locations and applies
// the ledger's own filters, no re-valuation.
export type NonSalesLedgerRow = {
  itemType: "product" | "ingredient";
  itemId: string;
  itemName: string;
  locationId: string;
  locationCode: string;
  occurredAt: string;
  reason: NonSalesCategory;
  quantity: number;
  costBasisMinor: number | null;
  isEstimated: boolean | null;
  sellingValueMinor: number | null;
  recordedBy: string;
};

export type NonSalesLedgerResult =
  | { ok: true; rows: NonSalesLedgerRow[] }
  | { ok: false; reason: "forbidden" | "not_found" };

export async function getNonSalesLedgerReport(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  input: {
    periodStart: Date;
    periodEnd: Date;
    locationId?: string;
    reason?: NonSalesCategory;
    search?: string;
  },
): Promise<NonSalesLedgerResult> {
  if (!requireOwner(requester)) return { ok: false, reason: "forbidden" };

  const allLocations = await listLocations(db);
  const targetLocations = input.locationId
    ? allLocations.filter((l) => l.id === input.locationId)
    : allLocations;
  if (targetLocations.length === 0) return { ok: false, reason: "not_found" };

  const rows: NonSalesLedgerRow[] = [];
  for (const location of targetLocations) {
    const result = await getNonSalesLedger(db, requester, location.id, input.periodStart, input.periodEnd);
    if (!result.ok) return result;
    for (const line of result.lines) {
      rows.push({
        itemType: line.itemType,
        itemId: line.itemId,
        itemName: line.itemName,
        locationId: location.id,
        locationCode: location.code,
        occurredAt: line.occurredAt.toISOString(),
        reason: line.reason,
        quantity: line.quantity,
        costBasisMinor: line.costBasisMinor,
        isEstimated: line.isEstimated,
        sellingValueMinor: line.sellingValueMinor,
        recordedBy: line.staffMemberName,
      });
    }
  }

  const search = input.search?.trim().toLowerCase();
  const filtered = rows.filter(
    (row) =>
      (!input.reason || row.reason === input.reason) &&
      (!search ||
        row.itemName.toLowerCase().includes(search) ||
        row.recordedBy.toLowerCase().includes(search)),
  );

  filtered.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));

  return { ok: true, rows: filtered };
}

export type CashTransactionCategory = "handover" | "repayment" | "stock" | "running" | "asset" | "drawing";

export type CashTransaction = {
  id: string;
  description: string;
  category: CashTransactionCategory;
  method: "cash" | "mpesa";
  amountMinor: number;
  recordedBy: string;
};

export type CashLedgerDay = {
  date: string;
  openingCashMinor: number;
  openingMpesaMinor: number;
  handoversMinor: number;
  repaymentsMinor: number;
  stockMinor: number;
  runningMinor: number;
  assetsMinor: number;
  drawingsMinor: number;
  closingCashMinor: number;
  closingMpesaMinor: number;
  transactions: CashTransaction[];
};

export type CashLedgerResult =
  | { ok: true; days: CashLedgerDay[] }
  | { ok: false; reason: "forbidden" };

const EXPENSE_CATEGORY_LABEL: Record<ExpenseCategory, string> = {
  stock: "Stock",
  running: "Running cost",
  asset: "Asset",
  drawing: "Drawing",
};

// Ticket 40 — the cash ledger: one row per day, opening/closing cash and
// M-Pesa balances kept separate throughout (docs/design.md: "cash and
// M-Pesa are never pooled"), with every money-in/money-out category as a
// column and that day's individual transactions for expansion. The
// opening balance for the period's first day is the running balance as of
// just before periodStart (everything before it, netted the same way
// getRunningCashBalance nets all-time); each subsequent day's opening is
// simply the previous day's closing, so the two reconcile by construction.
// Business-wide, not location-scoped, same as getRunningCashBalance —
// cash isn't a location concept (proposal.md §6).
export async function getCashLedger(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  input: { periodStart: Date; periodEnd: Date; category?: CashTransactionCategory; search?: string },
): Promise<CashLedgerResult> {
  if (!requireOwner(requester)) return { ok: false, reason: "forbidden" };

  const days = daysInPeriod(input.periodStart, input.periodEnd);

  const [beforePeriod, duringPeriod] = await Promise.all([
    getCashLedgerTransactions(db, requester, new Date(0), input.periodStart),
    getCashLedgerTransactions(db, requester, input.periodStart, input.periodEnd),
  ]);
  if (!beforePeriod.ok) return beforePeriod;
  if (!duringPeriod.ok) return duringPeriod;

  const staffIds = new Set<string>([
    ...duringPeriod.handovers.map((h) => h.staffMemberId),
    ...duringPeriod.expenses.map((e) => e.staffMemberId),
    ...duringPeriod.repayments.map((r) => r.recordedBy),
  ]);
  const staff = await findStaffMembersByIds(db, Array.from(staffIds));
  const staffNameById = new Map(staff.map((s) => [s.id, s.name]));
  const nameFor = (id: string) => staffNameById.get(id) ?? "Unknown";

  const netBeforePeriod = (method: "cash" | "mpesa") => {
    const handoversIn = beforePeriod.handovers.reduce(
      (sum, h) => sum + (method === "cash" ? h.actualCashMinor : h.actualMpesaMinor),
      0,
    );
    const repaymentsIn = beforePeriod.repayments
      .filter((r) => !r.reversed && r.paymentMethod === method)
      .reduce((sum, r) => sum + r.amountMinor, 0);
    const expensesOut = beforePeriod.expenses
      .filter((e) => !e.reversed && e.paymentMethod === method)
      .reduce((sum, e) => sum + e.amountMinor, 0);
    return handoversIn + repaymentsIn - expensesOut;
  };

  let runningCash = netBeforePeriod("cash");
  let runningMpesa = netBeforePeriod("mpesa");

  const search = input.search?.trim().toLowerCase();
  const matchesFilter = (t: CashTransaction) =>
    (!input.category || t.category === input.category) &&
    (!search || t.description.toLowerCase().includes(search) || t.recordedBy.toLowerCase().includes(search));

  const result: CashLedgerDay[] = [];

  for (const day of days) {
    const dayHandovers = duringPeriod.handovers.filter((h) => h.occurredAt >= day.start && h.occurredAt < day.end);
    const dayExpenses = duringPeriod.expenses.filter(
      (e) => !e.reversed && e.occurredAt >= day.start && e.occurredAt < day.end,
    );
    const dayRepayments = duringPeriod.repayments.filter(
      (r) => !r.reversed && r.occurredAt >= day.start && r.occurredAt < day.end,
    );

    const transactions: CashTransaction[] = [
      ...dayHandovers.flatMap((h) => {
        const lines: CashTransaction[] = [];
        if (h.actualCashMinor !== 0) {
          lines.push({
            id: `${h.id}:cash`,
            description: "Handover",
            category: "handover",
            method: "cash",
            amountMinor: h.actualCashMinor,
            recordedBy: nameFor(h.staffMemberId),
          });
        }
        if (h.actualMpesaMinor !== 0) {
          lines.push({
            id: `${h.id}:mpesa`,
            description: "Handover",
            category: "handover",
            method: "mpesa",
            amountMinor: h.actualMpesaMinor,
            recordedBy: nameFor(h.staffMemberId),
          });
        }
        return lines;
      }),
      ...dayRepayments.map((r) => ({
        id: r.id,
        description: "Drawings repayment",
        category: "repayment" as const,
        method: r.paymentMethod,
        amountMinor: r.amountMinor,
        recordedBy: nameFor(r.recordedBy),
      })),
      ...dayExpenses.map((e) => ({
        id: e.id,
        description: e.note?.trim() || EXPENSE_CATEGORY_LABEL[e.category],
        category: e.category,
        method: e.paymentMethod,
        amountMinor: e.amountMinor,
        recordedBy: nameFor(e.staffMemberId),
      })),
    ];

    // Running balances always reconcile against the full, unfiltered transaction set — a
    // category/search filter narrows what's displayed, not the actual cash movement.
    const isMoneyIn = (t: CashTransaction) => t.category === "handover" || t.category === "repayment";
    const sumWhere = (method: "cash" | "mpesa", moneyIn: boolean) =>
      transactions
        .filter((t) => t.method === method && isMoneyIn(t) === moneyIn)
        .reduce((sum, t) => sum + t.amountMinor, 0);
    const cashIn = sumWhere("cash", true);
    const cashOut = sumWhere("cash", false);
    const mpesaIn = sumWhere("mpesa", true);
    const mpesaOut = sumWhere("mpesa", false);

    const openingCashMinor = runningCash;
    const openingMpesaMinor = runningMpesa;
    runningCash = runningCash + cashIn - cashOut;
    runningMpesa = runningMpesa + mpesaIn - mpesaOut;

    const filteredTransactions = transactions.filter(matchesFilter);
    if (filteredTransactions.length === 0) continue;

    const sumFor = (category: CashTransactionCategory) =>
      filteredTransactions.filter((t) => t.category === category).reduce((sum, t) => sum + t.amountMinor, 0);

    const handoversMinor = sumFor("handover");
    const repaymentsMinor = sumFor("repayment");
    const stockMinor = sumFor("stock");
    const runningMinor = sumFor("running");
    const assetsMinor = sumFor("asset");
    const drawingsMinor = sumFor("drawing");

    result.push({
      date: day.label,
      openingCashMinor,
      openingMpesaMinor,
      handoversMinor,
      repaymentsMinor,
      stockMinor,
      runningMinor,
      assetsMinor,
      drawingsMinor,
      closingCashMinor: runningCash,
      closingMpesaMinor: runningMpesa,
      transactions: filteredTransactions,
    });
  }

  return { ok: true, days: result };
}

// Ticket 45 — the Activity trail's row kinds. Matches the design
// reference's ActivityKind minus recipe/person (out of this ticket's
// scope) plus the split this ticket's Scope calls for explicitly:
// takings and days_worked get their own kind rather than folding into
// "sale"/"movement", since the reference's fixture predates this
// codebase's actual domain model.
export type ActivityKind =
  | "sale"
  | "void"
  | "correction"
  | "movement"
  | "handover"
  | "takings"
  | "expense"
  | "repayment"
  | "days_worked";

export type ActivityEntry = {
  id: string;
  enteredAt: Date;
  effectiveOn: Date;
  kind: ActivityKind;
  who: string;
  whoId: string | null;
  what: string;
  locationName: string | null;
  amountMinor: number | null;
  reason: string | null;
};

export type GetActivityResult =
  | { ok: true; rows: ActivityEntry[]; total: number }
  | { ok: false; reason: "forbidden" };

const ACTIVITY_DEFAULT_PERIOD_DAYS = 90;

// Ticket 45 — the owner's audit trail: one row per action across sales
// (including voids and corrections), stock (wastage/consumption/
// complimentary/counts), cash (handovers, takings, expenses,
// repayments), people (days worked). Reads through each module's
// index.ts only, per docs/architecture.md's "reporting owns no data."
// Owner-only, same gate as every other business-wide read here.
export async function getActivity(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  input: {
    periodStart?: Date;
    periodEnd?: Date;
    personId?: string;
    kind?: ActivityKind;
    search?: string;
    page: number;
    pageSize: number;
  },
): Promise<GetActivityResult> {
  if (!requireOwner(requester)) return { ok: false, reason: "forbidden" };

  const periodEnd = input.periodEnd ?? new Date();
  const periodStart =
    input.periodStart ??
    new Date(periodEnd.getTime() - ACTIVITY_DEFAULT_PERIOD_DAYS * 24 * 60 * 60 * 1000);

  const [
    sales,
    movements,
    stockCounts,
    cashTransactions,
    takings,
    daysWorked,
    locations,
  ] = await Promise.all([
    listSalesInPeriod(db, periodStart, periodEnd),
    getMovementsForActivity(db, requester, periodStart, periodEnd),
    getStockCountsForActivity(db, requester, periodStart, periodEnd),
    getCashLedgerTransactions(db, requester, periodStart, periodEnd),
    listTakingsInPeriod(db, periodStart, periodEnd),
    getDaysWorkedForActivity(db, requester, periodStart, periodEnd),
    listLocations(db),
  ]);
  if (!movements.ok) return movements;
  if (!stockCounts.ok) return stockCounts;
  if (!cashTransactions.ok) return cashTransactions;
  if (!daysWorked.ok) return daysWorked;

  const locationNameById = new Map(locations.map((l) => [l.id, l.name]));

  const productIds = new Set<string>();
  const ingredientIds = new Set<string>();
  for (const sale of sales) {
    for (const line of sale.lines) productIds.add(line.productId);
  }
  for (const m of movements.lines) {
    if (m.itemType === "product") productIds.add(m.itemId);
    else ingredientIds.add(m.itemId);
  }
  for (const count of stockCounts.counts) {
    for (const line of count.lines) {
      if (line.itemType === "product") productIds.add(line.itemId);
      else ingredientIds.add(line.itemId);
    }
  }

  const [products, ingredients] = await Promise.all([
    findProductsByIds(db, Array.from(productIds)),
    findIngredientsByIds(db, Array.from(ingredientIds)),
  ]);
  const productNameById = new Map(products.map((p) => [p.id, p.name]));
  const ingredientNameById = new Map(ingredients.map((i) => [i.id, i.name]));

  const staffIds = new Set<string>([
    ...sales.map((s) => s.staffMemberId),
    ...sales.filter((s) => s.voidedBy).map((s) => s.voidedBy!),
    ...movements.lines.map((m) => m.staffMemberId),
    ...stockCounts.counts.map((c) => c.staffMemberId),
    ...cashTransactions.handovers.map((h) => h.staffMemberId),
    ...cashTransactions.expenses.map((e) => e.staffMemberId),
    ...cashTransactions.repayments.map((r) => r.recordedBy),
    ...takings.filter((t) => t.staffMemberId).map((t) => t.staffMemberId!),
    ...daysWorked.value.map((d) => d.staffMemberId),
  ]);
  const staff = await findStaffMembersByIds(db, Array.from(staffIds));
  const staffNameById = new Map(staff.map((s) => [s.id, s.name]));
  const nameFor = (id: string | null) => (id ? (staffNameById.get(id) ?? "Unknown") : "—");

  const rows: ActivityEntry[] = [];

  for (const sale of sales) {
    const itemSummary = sale.lines
      .map((l) => `${l.quantity} × ${productNameById.get(l.productId) ?? "item"}`)
      .join(", ");
    const locationName = locationNameById.get(sale.locationId) ?? null;

    if (sale.isCorrection) {
      rows.push({
        id: `sale-correction-${sale.id}`,
        enteredAt: sale.occurredAt,
        effectiveOn: sale.effectiveAt,
        kind: "correction",
        who: nameFor(sale.staffMemberId),
        whoId: sale.staffMemberId,
        what: `Sale corrected — ${itemSummary}`,
        locationName,
        amountMinor: sale.totalMinor,
        reason: sale.correctionReason,
      });
      continue;
    }

    rows.push({
      id: `sale-${sale.id}`,
      enteredAt: sale.occurredAt,
      effectiveOn: sale.effectiveAt,
      kind: "sale",
      who: nameFor(sale.staffMemberId),
      whoId: sale.staffMemberId,
      what: `Sale — ${itemSummary}`,
      locationName,
      amountMinor: sale.totalMinor,
      reason: null,
    });

    if (sale.voided) {
      rows.push({
        id: `sale-void-${sale.id}`,
        enteredAt: sale.voidedAt ?? sale.occurredAt,
        effectiveOn: sale.voidedAt ?? sale.occurredAt,
        kind: "void",
        who: nameFor(sale.voidedBy),
        whoId: sale.voidedBy,
        what: `Sale voided — ${itemSummary}`,
        locationName,
        amountMinor: sale.totalMinor,
        reason: null,
      });
    }
  }

  for (const m of movements.lines) {
    const itemName =
      m.itemType === "product"
        ? (productNameById.get(m.itemId) ?? "Unknown item")
        : (ingredientNameById.get(m.itemId) ?? "Unknown item");
    const reasonLabel = m.reason === "wasted" ? "wasted" : m.reason === "consumed" ? "consumed" : "given away";
    rows.push({
      id: `movement-${m.itemType}-${m.itemId}-${m.occurredAt.getTime()}-${m.staffMemberId}`,
      enteredAt: m.occurredAt,
      effectiveOn: m.occurredAt,
      kind: "movement",
      who: nameFor(m.staffMemberId),
      whoId: m.staffMemberId,
      what: `${Math.abs(m.quantity)} × ${itemName} — ${reasonLabel}`,
      locationName: locationNameById.get(m.locationId) ?? null,
      amountMinor: m.costBasisMinor,
      reason: null,
    });
  }

  for (const count of stockCounts.counts) {
    const locationName = locationNameById.get(count.locationId) ?? null;

    rows.push({
      id: `count-${count.id}`,
      enteredAt: count.occurredAt,
      effectiveOn: count.occurredAt,
      kind: "movement",
      who: nameFor(count.staffMemberId),
      whoId: count.staffMemberId,
      what: `Stock count — ${count.lines.length} ${count.lines.length === 1 ? "item" : "items"}`,
      locationName,
      amountMinor: null,
      reason: null,
    });

    // docs/architecture.md: "only the owner may correct" — a count
    // correction is its own row, read from the corrected line itself
    // (not the underlying StockMovement, which shares reason "corrected"
    // with voidSale's unrelated stock reversal — see
    // findAllNonSalesMovementsInPeriod's comment).
    for (const line of count.lines) {
      if (!line.correctedAt || !line.correctedBy) continue;
      const itemName =
        line.itemType === "product"
          ? (productNameById.get(line.itemId) ?? "Unknown item")
          : (ingredientNameById.get(line.itemId) ?? "Unknown item");
      rows.push({
        id: `count-correction-${line.id}`,
        enteredAt: line.correctedAt,
        effectiveOn: line.correctedAt,
        kind: "movement",
        who: nameFor(line.correctedBy),
        whoId: line.correctedBy,
        what: `${itemName} count corrected — counted ${line.countedQuantity}, expected ${line.expectedQuantity}`,
        locationName,
        amountMinor: null,
        reason: null,
      });
    }
  }

  for (const h of cashTransactions.handovers) {
    rows.push({
      id: `handover-${h.id}`,
      enteredAt: h.occurredAt,
      effectiveOn: h.occurredAt,
      kind: "handover",
      who: nameFor(h.staffMemberId),
      whoId: h.staffMemberId,
      what: "Handed over cash and M-Pesa",
      locationName: locationNameById.get(h.locationId) ?? null,
      amountMinor: h.actualCashMinor + h.actualMpesaMinor,
      reason: null,
    });
  }

  for (const t of takings) {
    rows.push({
      id: `takings-${t.id}`,
      enteredAt: t.occurredAt,
      effectiveOn: t.occurredAt,
      kind: "takings",
      who: nameFor(t.staffMemberId),
      whoId: t.staffMemberId,
      what: "Canteen takings recorded",
      locationName: locationNameById.get(t.locationId) ?? null,
      amountMinor: t.cashMinor + t.mpesaMinor,
      reason: null,
    });
  }

  for (const e of cashTransactions.expenses) {
    rows.push({
      id: `expense-${e.id}`,
      enteredAt: e.occurredAt,
      effectiveOn: e.occurredAt,
      kind: "expense",
      who: nameFor(e.staffMemberId),
      whoId: e.staffMemberId,
      what: e.note ? `Money out — ${e.category} — ${e.note}` : `Money out — ${e.category}`,
      locationName: locationNameById.get(e.locationId) ?? null,
      amountMinor: e.amountMinor,
      reason: null,
    });
  }

  for (const r of cashTransactions.repayments) {
    rows.push({
      id: `repayment-${r.id}`,
      enteredAt: r.occurredAt,
      effectiveOn: r.occurredAt,
      kind: "repayment",
      who: nameFor(r.recordedBy),
      whoId: r.recordedBy,
      what: "Drawing repayment",
      locationName: null,
      amountMinor: r.amountMinor,
      reason: null,
    });
  }

  for (const d of daysWorked.value) {
    // DaysWorked has no separate recorded-at timestamp distinct from the
    // day itself — unlike a correction, there is no effective/entered gap
    // here, so both columns show the same date.
    rows.push({
      id: `days-worked-${d.id}`,
      enteredAt: d.date,
      effectiveOn: d.date,
      kind: "days_worked",
      who: nameFor(d.staffMemberId),
      whoId: d.staffMemberId,
      what: `${nameFor(d.staffMemberId)} — day worked`,
      locationName: null,
      amountMinor: null,
      reason: null,
    });
  }

  rows.sort((a, b) => b.enteredAt.getTime() - a.enteredAt.getTime());

  const search = input.search?.trim().toLowerCase();
  const filtered = rows.filter(
    (r) =>
      (!input.personId || r.whoId === input.personId) &&
      (!input.kind || r.kind === input.kind) &&
      (!search ||
        r.what.toLowerCase().includes(search) ||
        r.who.toLowerCase().includes(search) ||
        (r.reason?.toLowerCase().includes(search) ?? false)),
  );

  const total = filtered.length;
  const start = (input.page - 1) * input.pageSize;
  const paged = filtered.slice(start, start + input.pageSize);

  return { ok: true, rows: paged, total };
}

// Ticket 49's Dashboard "Stock movements" card — today's product movements
// folded by reason and location rather than by product, a thin regrouping
// of ticket 39's getProductLedger for the same day so the two always
// reconcile by construction (same underlying rows, different fold).
export type DashboardStockMovementReason =
  | "produced"
  | "received"
  | "transferred_in"
  | "transferred_out"
  | "sold"
  | "wasted"
  | "consumed"
  | "given_away";

export type DashboardStockMovementRow = {
  reason: DashboardStockMovementReason;
  locationCode: string;
  qty: number;
  valueMinor: number;
};

export type GetDashboardStockMovementsResult =
  | { ok: true; rows: DashboardStockMovementRow[] }
  | { ok: false; reason: "forbidden" | "not_found" };

export async function getDashboardStockMovements(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  input: { today: Date },
): Promise<GetDashboardStockMovementsResult> {
  if (!requireOwner(requester)) return { ok: false, reason: "forbidden" };

  const dayStart = new Date(input.today);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const ledger = await getProductLedger(db, requester, { periodStart: dayStart, periodEnd: dayEnd });
  if (!ledger.ok) return ledger;

  const totals = new Map<string, DashboardStockMovementRow>();
  const add = (reason: DashboardStockMovementReason, locationCode: string, qty: number, valueMinor: number) => {
    if (qty === 0) return;
    const key = `${reason}:${locationCode}`;
    const existing = totals.get(key);
    if (existing) {
      existing.qty += qty;
      existing.valueMinor += valueMinor;
    } else {
      totals.set(key, { reason, locationCode, qty, valueMinor });
    }
  };

  for (const row of ledger.rows) {
    const unitCostMinor = row.unitCostMinor ?? 0;
    add("produced", row.locationCode, row.produced, row.produced * unitCostMinor);
    add("received", row.locationCode, row.received, row.received * unitCostMinor);
    add("transferred_in", row.locationCode, row.transferredIn, row.transferredIn * unitCostMinor);
    add("transferred_out", row.locationCode, row.transferredOut, row.transferredOut * unitCostMinor);
    add("sold", row.locationCode, row.sold, row.salesValueMinor);
    // nonSales folds wasted/consumed/given-away together in getProductLedger;
    // this card shows them as three separate danger-toned rows per the
    // design reference, which the ledger's own folding doesn't distinguish
    // — re-derive that split from the day's raw lines instead of the
    // already-folded nonSales total.
  }

  const rowByProductLocation = new Map(ledger.rows.map((r) => [`${r.productId}:${r.locationId}`, r]));
  const allLocations = await listLocations(db);
  for (const location of allLocations) {
    const nonSalesLines = await getProductMovementsByReasonInPeriod(
      db,
      requester,
      location.id,
      ["wasted", "consumed", "given_away"],
      dayStart,
      dayEnd,
    );
    if (!nonSalesLines.ok) continue;
    for (const line of nonSalesLines.lines) {
      const ledgerRow = rowByProductLocation.get(`${line.productId}:${location.id}`);
      const unitCostMinor = ledgerRow?.unitCostMinor ?? 0;
      const qty = -line.quantity;
      const reason = line.reason as "wasted" | "consumed" | "given_away";
      add(reason, location.code, qty, qty * unitCostMinor);
    }
  }

  const rows = Array.from(totals.values());
  rows.sort((a, b) => a.reason.localeCompare(b.reason) || a.locationCode.localeCompare(b.locationCode));

  return { ok: true, rows };
}

// Ticket 49's Dashboard "Store movements" card — today's per-ingredient
// flow at the restaurant only (the design reference's "Restaurant store"
// title), a thin reshape of ticket 42's getStoreLedger for the same day.
export type DashboardStoreMovementRow = {
  ingredientName: string;
  unitOfMeasure: string;
  received: number;
  issuedToKitchen: number;
  transferredOut: number;
  closingQty: number;
};

export type GetDashboardStoreMovementsResult =
  | { ok: true; rows: DashboardStoreMovementRow[] }
  | { ok: false; reason: "forbidden" | "not_found" };

export async function getDashboardStoreMovements(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  input: { today: Date },
): Promise<GetDashboardStoreMovementsResult> {
  if (!requireOwner(requester)) return { ok: false, reason: "forbidden" };

  const dayStart = new Date(input.today);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const restaurant = await findLocationByCode(db, "restaurant");
  if (!restaurant) return { ok: false, reason: "not_found" };

  const ledger = await getStoreLedger(db, requester, {
    periodStart: dayStart,
    periodEnd: dayEnd,
    locationId: restaurant.id,
  });
  if (!ledger.ok) return ledger;

  const rows: DashboardStoreMovementRow[] = ledger.rows.map((row) => ({
    ingredientName: row.ingredientName,
    unitOfMeasure: row.unitOfMeasure,
    received: row.purchasedQty,
    issuedToKitchen: row.issuedToKitchen,
    transferredOut: row.transferredOut,
    closingQty: row.closingQty,
  }));

  return { ok: true, rows };
}
