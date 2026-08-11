// Sales, payment lines, credit. See docs/architecture.md.

export {
  recordCounterSale,
  getCustomerBalance,
  listTodaysSalesForStaff,
  voidSale,
  creditSaleQuantityByProductAtLocation,
  getSalesRevenueAtLocation,
  getTotalCustomerBalance,
} from "./logic";
export type {
  RecordSaleResult,
  ListTodaysSalesResult,
  VoidSaleResult,
  SalesRevenueResult,
  TotalCustomerBalanceResult,
} from "./logic";
export {
  recordCounterSaleRoute,
  todaysSalesRoute,
  voidSaleRoute,
  totalCustomerBalanceRoute,
} from "./routes";
export type { Sale, SaleLine, PaymentLine, PaymentMethod, SaleFulfilment } from "./schema";
