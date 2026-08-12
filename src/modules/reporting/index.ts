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
  getProductLedger,
  getStoreLedger,
  getCashLedger,
} from "./logic";
export type {
  TransferCostLine,
  TransferCostResult,
  RestaurantCostOfGoodsResult,
  CanteenCostOfGoodsResult,
  CountCorrectionResult,
  DashboardProfitResult,
  LedgerSummaryResult,
  ProductLedgerRow,
  ProductLedgerDay,
  ProductLedgerResult,
  StoreLedgerRow,
  StoreLedgerResult,
  CashLedgerDay,
  CashTransaction,
  CashTransactionCategory,
  CashLedgerResult,
} from "./logic";
export { dashboardProfitRoute, ledgerSummaryRoute, productLedgerRoute, storeLedgerRoute, cashLedgerRoute } from "./routes";
