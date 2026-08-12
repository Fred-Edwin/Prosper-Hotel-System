// Profit assembly for the dashboard's Profit panel — formulas.md §5
// (transfer cost split), §6 (cost of goods sold, both locations), §7
// (profit). Reads through stock/sales/cash/catalogue/people's
// interfaces only, per docs/architecture.md's "reporting owns no data."
import type { PrismaClient } from "@/generated/prisma/client";
import { type AuthenticatedStaff, findLocationByCode } from "@/modules/people";
import { getCurrentRecipe, findProductsByIds } from "@/modules/catalogue";
import {
  getIngredientStockValueAtLocation,
  getIngredientsBoughtMinor,
  getIngredientsIssuedMinor,
  getProductMovementByReasonInPeriod,
  getLatestStockCount,
  getPreviousStockCount,
  getNonSalesConsumptionValue,
  type DerivedSalesDetail,
} from "@/modules/stock";
import { getSalesRevenueAtLocation } from "@/modules/sales";
import { getTakingsAtLocation, getRunningCosts } from "@/modules/cash";

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

  const [restaurantRevenue, canteenTakings, restaurantCogs, canteenCogs, runningCosts, correction] =
    await Promise.all([
      getSalesRevenueAtLocation(db, requester, restaurant.id, input.dayStart, input.dayEnd),
      getTakingsAtLocation(db, requester, canteen.id, input.dayStart, input.dayEnd),
      computeRestaurantCostOfGoods(db, requester, input),
      computeCanteenCostOfGoods(db, requester, input),
      getRunningCosts(db, requester, input.dayStart, input.dayEnd),
      computeCountCorrection(db, requester),
    ]);
  if (!restaurantRevenue.ok) return restaurantRevenue;
  if (!canteenTakings.ok) return canteenTakings;
  if (!restaurantCogs.ok) return restaurantCogs;
  if (!canteenCogs.ok) return canteenCogs;
  if (!runningCosts.ok) return runningCosts;

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
  };
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
