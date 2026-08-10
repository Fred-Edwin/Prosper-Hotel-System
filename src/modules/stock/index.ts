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
} from "./logic";
export type {
  StockAccessResult,
  RecordMovementResult,
  RecordIngredientReceiptResult,
  RecordIngredientIssueResult,
  RecordProductionResult,
  RecordNonSalesConsumptionResult,
  ReceiptsAtLocationResult,
} from "./logic";
export {
  stockAtLocationRoute,
  recordIngredientReceiptRoute,
  recordIngredientIssueRoute,
  recordProductionRoute,
  recordNonSalesConsumptionRoute,
} from "./routes";
export type {
  StockMovement,
  StockMovementReason,
  StockLevel,
  IngredientMovement,
  NonSalesCategory,
  Receipt,
} from "./schema";
