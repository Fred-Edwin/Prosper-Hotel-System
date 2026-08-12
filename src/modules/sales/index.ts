// Sales, payment lines, credit. See docs/architecture.md.

export {
  recordCounterSale,
  getCustomerBalance,
  getCustomerBalanceForOwner,
  getCustomerCreditHistory,
  listTodaysSalesForStaff,
  voidSale,
  creditSaleQuantityByProductAtLocation,
  getSalesRevenueAtLocation,
  getTotalCustomerBalance,
  recordRepayment,
  recordSaleCorrection,
} from "./logic";
export type {
  RecordSaleResult,
  ListTodaysSalesResult,
  VoidSaleResult,
  SalesRevenueResult,
  TotalCustomerBalanceResult,
  GetCustomerBalanceForOwnerResult,
  GetCustomerCreditHistoryResult,
  CustomerCreditHistoryEntry,
  RecordRepaymentResult,
  RecordSaleCorrectionResult,
} from "./logic";
export { listSalesInPeriod } from "./queries";
export {
  recordCounterSaleRoute,
  todaysSalesRoute,
  voidSaleRoute,
  totalCustomerBalanceRoute,
  customerBalanceRoute,
  customerCreditHistoryRoute,
  recordRepaymentRoute,
  recordSaleCorrectionRoute,
} from "./routes";
export type { Sale, SaleLine, PaymentLine, PaymentMethod, SaleFulfilment, Repayment } from "./schema";
