// Sales, payment lines, credit. See docs/architecture.md.

export { recordCounterSale, getCustomerBalance, listTodaysSalesForStaff } from "./logic";
export type { RecordSaleResult, ListTodaysSalesResult } from "./logic";
export { recordCounterSaleRoute, todaysSalesRoute } from "./routes";
export type { Sale, SaleLine, PaymentLine, PaymentMethod, SaleFulfilment } from "./schema";
