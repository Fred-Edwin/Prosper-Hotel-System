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
