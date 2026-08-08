// Movements, daily closes, counts, transfers. See docs/architecture.md.

export {
  getCurrentStockAtLocation,
  recordStockMovement,
  recordIngredientReceipt,
  recordNonSalesConsumption,
} from "./logic";
export type {
  StockAccessResult,
  RecordMovementResult,
  RecordIngredientReceiptResult,
  RecordNonSalesConsumptionResult,
} from "./logic";
export {
  stockAtLocationRoute,
  recordIngredientReceiptRoute,
  recordNonSalesConsumptionRoute,
} from "./routes";
export type {
  StockMovement,
  StockMovementReason,
  StockLevel,
  IngredientMovement,
  NonSalesCategory,
} from "./schema";
