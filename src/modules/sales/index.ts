// Sales, payment lines, credit. See docs/architecture.md.

export {
  recordCounterSale,
  recordCountDerivedSale,
  getCustomerBalance,
  getCustomerBalanceForOwner,
  getCustomerCreditHistory,
  listTodaysSalesForStaff,
  listTodaysSalesAtLocation,
  voidSale,
  creditSaleQuantityByProductAtLocation,
  getSalesRevenueAtLocation,
  getTotalCustomerBalance,
  recordRepayment,
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
} from "./routes";
export type { Sale, SaleLine, PaymentLine, PaymentMethod, SaleFulfilment, Repayment } from "./schema";
