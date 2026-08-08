// Movements, daily closes, counts, transfers. See docs/architecture.md.

export {
  getCurrentStockAtLocation,
  recordStockMovement,
  recordIngredientReceipt,
} from "./logic";
export type {
  StockAccessResult,
  RecordMovementResult,
  RecordIngredientReceiptResult,
} from "./logic";
export { stockAtLocationRoute, recordIngredientReceiptRoute } from "./routes";
export type {
  StockMovement,
  StockMovementReason,
  StockLevel,
  IngredientMovement,
} from "./schema";
