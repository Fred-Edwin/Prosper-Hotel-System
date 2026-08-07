// Sales, payment lines, credit. See docs/architecture.md.

export { recordCounterSale, getCustomerBalance } from "./logic";
export type { RecordSaleResult } from "./logic";
export { recordCounterSaleRoute } from "./routes";
export type { Sale, SaleLine, PaymentLine, PaymentMethod, SaleFulfilment } from "./schema";
