// Sales, payment lines, credit. See docs/architecture.md.

export {
  recordCounterSale,
  getCustomerBalance,
  listTodaysSalesForStaff,
  voidSale,
  creditSaleQuantityByProductAtLocation,
} from "./logic";
export type { RecordSaleResult, ListTodaysSalesResult, VoidSaleResult } from "./logic";
export { recordCounterSaleRoute, todaysSalesRoute, voidSaleRoute } from "./routes";
export type { Sale, SaleLine, PaymentLine, PaymentMethod, SaleFulfilment } from "./schema";
