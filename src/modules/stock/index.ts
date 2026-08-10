// Movements, daily closes, counts, transfers. See docs/architecture.md.

export {
  getCurrentStockAtLocation,
  recordStockMovement,
  recordIngredientReceipt,
  recordIngredientIssue,
  recordProduction,
  recordNonSalesConsumption,
  listReceiptsAtLocation,
  findReceipt,
  recordStockCount,
  getStockCount,
  getLatestStockCount,
  correctStockCount,
} from "./logic";
export type {
  StockAccessResult,
  RecordMovementResult,
  RecordIngredientReceiptResult,
  RecordIngredientIssueResult,
  RecordProductionResult,
  RecordNonSalesConsumptionResult,
  ReceiptsAtLocationResult,
  RecordStockCountResult,
  StockCountResult,
  LatestStockCountResult,
  CorrectStockCountResult,
} from "./logic";
export {
  stockAtLocationRoute,
  recordIngredientReceiptRoute,
  recordIngredientIssueRoute,
  recordProductionRoute,
  recordNonSalesConsumptionRoute,
  recordStockCountRoute,
  stockCountRoute,
  latestStockCountRoute,
  correctStockCountRoute,
} from "./routes";
export type {
  StockMovement,
  StockMovementReason,
  StockLevel,
  IngredientMovement,
  NonSalesCategory,
  Receipt,
  StockCount,
  StockCountLine,
  StockCountItemType,
  StockCountForReader,
  StockCountLineForReader,
} from "./schema";
