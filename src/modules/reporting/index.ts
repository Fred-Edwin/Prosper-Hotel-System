// Profit, stock valuation, item history, the audit trail.
// Reads through other modules' interfaces only — owns no data of its own.
// See docs/architecture.md.
export {
  computeTransferCost,
  computeRestaurantCostOfGoods,
  computeCanteenCostOfGoods,
  computeCountCorrection,
  getDashboardProfit,
  getLedgerSummary,
} from "./logic";
export type {
  TransferCostLine,
  TransferCostResult,
  RestaurantCostOfGoodsResult,
  CanteenCostOfGoodsResult,
  CountCorrectionResult,
  DashboardProfitResult,
  LedgerSummaryResult,
} from "./logic";
export { dashboardProfitRoute, ledgerSummaryRoute } from "./routes";
