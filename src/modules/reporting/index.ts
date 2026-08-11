// Profit, stock valuation, item history, the audit trail.
// Reads through other modules' interfaces only — owns no data of its own.
// See docs/architecture.md.
export {
  computeTransferCost,
  computeRestaurantCostOfGoods,
  computeCanteenCostOfGoods,
  computeCountCorrection,
  getDashboardProfit,
} from "./logic";
export type {
  TransferCostLine,
  TransferCostResult,
  RestaurantCostOfGoodsResult,
  CanteenCostOfGoodsResult,
  CountCorrectionResult,
  DashboardProfitResult,
} from "./logic";
export { dashboardProfitRoute } from "./routes";
