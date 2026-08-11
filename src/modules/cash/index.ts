// Handovers, expenses, the running balance, drawings. See docs/architecture.md.

export {
  getTodaysHandoverForStaff,
  getTodaysHandoversAtLocation,
  recordHandover,
  isDayClosedFor,
} from "./logic";
export type {
  GetTodaysHandoverResult,
  GetTodaysHandoversAtLocationResult,
  RecordHandoverResult,
} from "./logic";
export { recordHandoverRoute, todaysHandoverRoute, todaysHandoversAtRestaurantRoute } from "./routes";
export type { Handover } from "./schema";
export type { HandoverWithStaffName } from "./queries";

export { getTodaysTakingsForStaff, recordTakings, getTakingsAtLocation } from "./logic";
export type {
  GetTodaysTakingsResult,
  RecordTakingsResult,
  TakingsAtLocationResult,
} from "./logic";
export { recordTakingsRoute, todaysTakingsRoute } from "./routes";
export type { Takings } from "./schema";

export { recordExpense, reverseExpense, listExpenses, drawingDebtOwed, getRunningCosts } from "./logic";
export type {
  RecordExpenseResult,
  ReverseExpenseResult,
  ListExpensesResult,
  RunningCostsResult,
} from "./logic";
export {
  listExpensesRoute,
  receiptsForExpenseRoute,
  recordExpenseRoute,
  reverseExpenseRoute,
} from "./routes";
export type { Expense, ExpenseCategory, DrawingDebt } from "./schema";
