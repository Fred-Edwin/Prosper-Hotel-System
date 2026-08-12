// Profit assembly for the dashboard's Profit panel — formulas.md §5
// (transfer cost split), §6 (cost of goods sold, both locations), §7
// (profit). Reads through stock/sales/cash/catalogue/people's
// interfaces only, per docs/architecture.md's "reporting owns no data."
import type { PrismaClient } from "@/generated/prisma/client";
import { type AuthenticatedStaff, findLocationByCode, findStaffMembersByIds, listLocations } from "@/modules/people";
import { getCurrentRecipe, findProductsByIds } from "@/modules/catalogue";
import {
  getIngredientStockValueAtLocation,
  getIngredientsBoughtMinor,
  getIngredientsIssuedMinor,
  getProductMovementByReasonInPeriod,
  getProductMovementsByReasonInPeriod,
  getProductQuantityAtLocationAsOf,
  resolveProductCostBasis,
  getLatestStockCount,
  getPreviousStockCount,
  getNonSalesConsumptionValue,
  type DerivedSalesDetail,
} from "@/modules/stock";
import { getSalesRevenueAtLocation } from "@/modules/sales";
import {
  getTakingsAtLocation,
  getRunningCosts,
  getCashLedgerTransactions,
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
