/**
 * Fixture data for design prototypes.
 *
 * Real Prosper Hotel content — the products, figures and edge cases the
 * business actually has. Never lorem ipsum: a design judged on placeholder
 * text is judged on the wrong thing.
 *
 * Deliberately seeded stress cases, each marked below:
 *   - a sale settled part cash, part M-Pesa (payment is a list, not a value)
 *   - a cooked-food product with no recipe (no per-unit cost, so margin is
 *     blank rather than zero)
 *   - a provisional canteen figure (estimated between counts)
 *   - a handover that does not agree (the discrepancy is the point)
 *   - a voided entry, still attributed
 *   - a 200-character product name (overflow)
 *   - null values that must render as "—", never "undefined"
 *
 * Deleted with the variants at lock.
 */

export type Location = "restaurant" | "canteen";

export type ProductKind = "goods" | "cooked" | "service" | "packaging";

export interface Product {
  id: string;
  name: string;
  kind: ProductKind;
  price: number;
  /** Null where no recipe exists — cooked food without a recorded yield. */
  unitCost: number | null;
  location: Location[];
  stock: number | null;
}

export const products: Product[] = [
  // Cooked food — restaurant kitchen
  { id: "p1", name: "Mukimo", kind: "cooked", price: 150, unitCost: 89, location: ["restaurant"], stock: 24 },
  { id: "p2", name: "Chips", kind: "cooked", price: 100, unitCost: 41, location: ["restaurant", "canteen"], stock: 38 },
  { id: "p3", name: "Chapati", kind: "cooked", price: 20, unitCost: 11, location: ["restaurant", "canteen"], stock: 64 },
  { id: "p4", name: "Githeri", kind: "cooked", price: 120, unitCost: 67, location: ["restaurant"], stock: 18 },
  { id: "p5", name: "Beef stew", kind: "cooked", price: 180, unitCost: null, location: ["restaurant"], stock: 12 },
  { id: "p6", name: "Tea", kind: "cooked", price: 30, unitCost: 8, location: ["restaurant", "canteen"], stock: 40 },
  { id: "p7", name: "Rice", kind: "cooked", price: 100, unitCost: 52, location: ["restaurant"], stock: 22 },
  { id: "p8", name: "Ugali", kind: "cooked", price: 50, unitCost: 19, location: ["restaurant"], stock: 30 },

  // Goods — canteen retail
  { id: "p9", name: "Soda 500ml", kind: "goods", price: 80, unitCost: 58, location: ["canteen", "restaurant"], stock: 96 },
  { id: "p10", name: "Water 1L", kind: "goods", price: 60, unitCost: 42, location: ["canteen"], stock: 54 },
  { id: "p11", name: "Biscuits", kind: "goods", price: 50, unitCost: 36, location: ["canteen"], stock: 120 },
  { id: "p12", name: "Crisps", kind: "goods", price: 60, unitCost: 44, location: ["canteen"], stock: 78 },
  { id: "p13", name: "Sweets", kind: "goods", price: 10, unitCost: 7, location: ["canteen"], stock: 340 },
  { id: "p14", name: "Exercise book", kind: "goods", price: 60, unitCost: 43, location: ["canteen"], stock: 85 },
  { id: "p15", name: "Foolscaps", kind: "goods", price: 5, unitCost: 3, location: ["canteen"], stock: 500 },
  { id: "p16", name: "Pen", kind: "goods", price: 20, unitCost: 12, location: ["canteen"], stock: 145 },
  { id: "p17", name: "ENO", kind: "goods", price: 30, unitCost: 21, location: ["canteen"], stock: 42 },
  { id: "p18", name: "Painkillers", kind: "goods", price: 20, unitCost: 13, location: ["canteen"], stock: 68 },
  { id: "p19", name: "Airtime 50", kind: "goods", price: 50, unitCost: 48, location: ["canteen"], stock: null },
  { id: "p20", name: "Handkerchief", kind: "goods", price: 50, unitCost: 34, location: ["canteen"], stock: 26 },

  // Services — no stock
  { id: "p21", name: "Photocopy (per page)", kind: "service", price: 5, unitCost: 2, location: ["canteen", "restaurant"], stock: null },
  { id: "p22", name: "Printing (per page)", kind: "service", price: 10, unitCost: 4, location: ["canteen"], stock: null },
  { id: "p23", name: "Binding", kind: "service", price: 100, unitCost: 35, location: ["canteen"], stock: null },

  // Packaging
  { id: "p24", name: "Takeaway container", kind: "packaging", price: 20, unitCost: 14, location: ["restaurant"], stock: 210 },

  // STRESS CASE — 200-character name. Overflow must truncate with a tooltip.
  {
    id: "p25",
    name: "Large capacity insulated food flask with double-walled stainless steel interior and locking clip lid, supplied by the Nakuru wholesaler, used for the school delivery run on Tuesdays and Thursdays only",
    kind: "goods",
    price: 1200,
    unitCost: 940,
    location: ["canteen"],
    stock: 3,
  },
];

export interface Ingredient {
  id: string;
  name: string;
  unit: string;
  unitCost: number;
  stock: number;
}

export const ingredients: Ingredient[] = [
  { id: "i1", name: "Potatoes", unit: "kg", unitCost: 65, stock: 48 },
  { id: "i2", name: "Maize flour", unit: "kg", unitCost: 78, stock: 32 },
  { id: "i3", name: "Wheat flour", unit: "kg", unitCost: 92, stock: 24 },
  { id: "i4", name: "Cooking oil", unit: "L", unitCost: 320, stock: 14 },
  { id: "i5", name: "Beef", unit: "kg", unitCost: 580, stock: 8 },
  { id: "i6", name: "Beans", unit: "kg", unitCost: 140, stock: 18 },
  { id: "i7", name: "Rice", unit: "kg", unitCost: 165, stock: 26 },
  { id: "i8", name: "Milk", unit: "L", unitCost: 70, stock: 12 },
  { id: "i9", name: "Sugar", unit: "kg", unitCost: 145, stock: 20 },
  { id: "i10", name: "Printing paper", unit: "ream", unitCost: 620, stock: 9 },
  { id: "i11", name: "Toner", unit: "unit", unitCost: 2800, stock: 2 },
];

export interface Staff {
  id: string;
  name: string;
  role: "owner" | "store-manager" | "cashier" | "attendant";
  location: Location | "both";
  dailyRate: number;
  active: boolean;
}

export const staff: Staff[] = [
  { id: "s1", name: "Lucy", role: "owner", location: "both", dailyRate: 0, active: true },
  { id: "s2", name: "Janiffer", role: "store-manager", location: "restaurant", dailyRate: 700, active: true },
  { id: "s3", name: "Sarah", role: "cashier", location: "restaurant", dailyRate: 550, active: true },
  { id: "s4", name: "Mercy", role: "cashier", location: "restaurant", dailyRate: 550, active: true },
  { id: "s5", name: "Anne", role: "attendant", location: "canteen", dailyRate: 600, active: true },
];

export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  balance: number;
}

export const customers: Customer[] = [
  { id: "c1", name: "Kimani", phone: "0722 145 880", balance: 1240 },
  { id: "c2", name: "Wanjiru", phone: "0733 902 114", balance: 480 },
  { id: "c3", name: "Otieno", phone: null, balance: 2100 },
  { id: "c4", name: "Njoroge", phone: "0710 447 203", balance: 0 },
  { id: "c5", name: "Achieng", phone: "0745 118 662", balance: 760 },
  { id: "c6", name: "Mwangi", phone: "0726 330 917", balance: 3450 },
];

export type PaymentMethod = "cash" | "mpesa" | "credit";

export interface PaymentLine {
  method: PaymentMethod;
  amount: number;
}

export interface SaleLine {
  productId: string;
  name: string;
  qty: number;
  price: number;
}

export interface Sale {
  id: string;
  ref: string;
  time: string;
  location: Location;
  staffId: string;
  staffName: string;
  fulfilment: "counter" | "delivery";
  lines: SaleLine[];
  payments: PaymentLine[];
  customerId: string | null;
  customerName: string | null;
  total: number;
  voided?: { by: string; at: string; reason: string };
}

export const sales: Sale[] = [
  {
    id: "sa1", ref: "S-0412", time: "07:42", location: "restaurant", staffId: "s3", staffName: "Sarah",
    fulfilment: "counter",
    lines: [
      { productId: "p6", name: "Tea", qty: 2, price: 30 },
      { productId: "p3", name: "Chapati", qty: 3, price: 20 },
    ],
    payments: [{ method: "cash", amount: 120 }],
    customerId: null, customerName: null, total: 120,
  },
  {
    id: "sa2", ref: "S-0413", time: "08:15", location: "restaurant", staffId: "s3", staffName: "Sarah",
    fulfilment: "counter",
    lines: [
      { productId: "p1", name: "Mukimo", qty: 1, price: 150 },
      { productId: "p5", name: "Beef stew", qty: 1, price: 180 },
      { productId: "p9", name: "Soda 500ml", qty: 1, price: 80 },
    ],
    payments: [{ method: "mpesa", amount: 410 }],
    customerId: null, customerName: null, total: 410,
  },
  {
    // STRESS CASE — part cash, part M-Pesa. Payment is a list, not a value.
    id: "sa3", ref: "S-0414", time: "09:03", location: "restaurant", staffId: "s4", staffName: "Mercy",
    fulfilment: "counter",
    lines: [
      { productId: "p2", name: "Chips", qty: 2, price: 100 },
      { productId: "p4", name: "Githeri", qty: 1, price: 120 },
      { productId: "p9", name: "Soda 500ml", qty: 2, price: 80 },
    ],
    payments: [
      { method: "cash", amount: 300 },
      { method: "mpesa", amount: 180 },
    ],
    customerId: null, customerName: null, total: 480,
  },
  {
    id: "sa4", ref: "S-0415", time: "10:28", location: "restaurant", staffId: "s2", staffName: "Janiffer",
    fulfilment: "delivery",
    lines: [
      { productId: "p1", name: "Mukimo", qty: 4, price: 150 },
      { productId: "p5", name: "Beef stew", qty: 4, price: 180 },
      { productId: "p24", name: "Takeaway container", qty: 4, price: 20 },
    ],
    payments: [{ method: "mpesa", amount: 1400 }],
    customerId: "c6", customerName: "Mwangi", total: 1400,
  },
  {
    // STRESS CASE — credit sale. No money changed hands; excluded from handover.
    id: "sa5", ref: "S-0416", time: "11:14", location: "canteen", staffId: "s5", staffName: "Anne",
    fulfilment: "counter",
    lines: [
      { productId: "p14", name: "Exercise book", qty: 4, price: 60 },
      { productId: "p16", name: "Pen", qty: 2, price: 20 },
    ],
    payments: [{ method: "credit", amount: 280 }],
    customerId: "c1", customerName: "Kimani", total: 280,
  },
  {
    // STRESS CASE — voided, still attributed and still visible.
    id: "sa6", ref: "S-0417", time: "12:02", location: "restaurant", staffId: "s3", staffName: "Sarah",
    fulfilment: "counter",
    lines: [{ productId: "p7", name: "Rice", qty: 2, price: 100 }],
    payments: [{ method: "cash", amount: 200 }],
    customerId: null, customerName: null, total: 200,
    voided: { by: "Sarah", at: "12:04", reason: "Rang up twice" },
  },
  {
    id: "sa7", ref: "S-0418", time: "12:47", location: "restaurant", staffId: "s4", staffName: "Mercy",
    fulfilment: "counter",
    lines: [
      { productId: "p8", name: "Ugali", qty: 3, price: 50 },
      { productId: "p5", name: "Beef stew", qty: 3, price: 180 },
    ],
    payments: [{ method: "cash", amount: 690 }],
    customerId: null, customerName: null, total: 690,
  },
  {
    id: "sa8", ref: "S-0419", time: "13:20", location: "restaurant", staffId: "s3", staffName: "Sarah",
    fulfilment: "delivery",
    lines: [
      { productId: "p2", name: "Chips", qty: 6, price: 100 },
      { productId: "p9", name: "Soda 500ml", qty: 6, price: 80 },
    ],
    payments: [
      { method: "cash", amount: 500 },
      { method: "credit", amount: 580 },
    ],
    customerId: "c3", customerName: "Otieno", total: 1080,
  },
];

export type MovementReason =
  | "received"
  | "issued"
  | "produced"
  | "transferred-in"
  | "transferred-out"
  | "sold"
  | "sold-derived"
  | "wasted"
  | "consumed"
  | "given-away"
  | "corrected";

export interface Movement {
  id: string;
  date: string;
  time: string;
  itemId: string;
  itemName: string;
  location: Location;
  reason: MovementReason;
  qty: number;
  unitCost: number | null;
  value: number | null;
  staffName: string;
  note: string | null;
  /** Where a correction carries an effective date in the past. */
  effectiveDate?: string;
}

export const movements: Movement[] = [
  { id: "m1", date: "2026-08-06", time: "06:10", itemId: "i1", itemName: "Potatoes", location: "restaurant", reason: "received", qty: 40, unitCost: 65, value: 2600, staffName: "Janiffer", note: "Nakuru supplier" },
  { id: "m2", date: "2026-08-06", time: "06:12", itemId: "i5", itemName: "Beef", location: "restaurant", reason: "received", qty: 12, unitCost: 580, value: 6960, staffName: "Janiffer", note: null },
  { id: "m3", date: "2026-08-06", time: "06:40", itemId: "i1", itemName: "Potatoes", location: "restaurant", reason: "issued", qty: 18, unitCost: 65, value: 1170, staffName: "Janiffer", note: "To kitchen" },
  { id: "m4", date: "2026-08-06", time: "06:41", itemId: "i4", itemName: "Cooking oil", location: "restaurant", reason: "issued", qty: 3, unitCost: 320, value: 960, staffName: "Janiffer", note: null },
  { id: "m5", date: "2026-08-06", time: "08:05", itemId: "p2", itemName: "Chips", location: "restaurant", reason: "produced", qty: 45, unitCost: 41, value: 1845, staffName: "Janiffer", note: "From 18kg potatoes" },
  { id: "m6", date: "2026-08-06", time: "08:06", itemId: "p1", itemName: "Mukimo", location: "restaurant", reason: "produced", qty: 30, unitCost: 89, value: 2670, staffName: "Janiffer", note: null },
  { id: "m7", date: "2026-08-06", time: "09:30", itemId: "p2", itemName: "Chips", location: "restaurant", reason: "transferred-out", qty: 12, unitCost: 41, value: 492, staffName: "Janiffer", note: "To canteen" },
  { id: "m8", date: "2026-08-06", time: "09:30", itemId: "p2", itemName: "Chips", location: "canteen", reason: "transferred-in", qty: 12, unitCost: 41, value: 492, staffName: "Anne", note: "From restaurant" },
  { id: "m9", date: "2026-08-06", time: "09:32", itemId: "p3", itemName: "Chapati", location: "restaurant", reason: "transferred-out", qty: 20, unitCost: 11, value: 220, staffName: "Janiffer", note: "To canteen" },
  { id: "m10", date: "2026-08-06", time: "10:15", itemId: "i10", itemName: "Printing paper", location: "canteen", reason: "transferred-out", qty: 2, unitCost: 620, value: 1240, staffName: "Anne", note: "To restaurant printing station" },
  { id: "m11", date: "2026-08-06", time: "11:20", itemId: "p5", itemName: "Beef stew", location: "restaurant", reason: "wasted", qty: 3, unitCost: null, value: 324, staffName: "Mercy", note: "Left out too long. Cost estimated at 60% of price — no recipe" },
  { id: "m12", date: "2026-08-06", time: "13:00", itemId: "p6", itemName: "Tea", location: "restaurant", reason: "consumed", qty: 5, unitCost: 8, value: 40, staffName: "Sarah", note: "Staff lunch" },
  { id: "m13", date: "2026-08-06", time: "13:05", itemId: "p8", itemName: "Ugali", location: "restaurant", reason: "consumed", qty: 4, unitCost: 19, value: 76, staffName: "Sarah", note: "Staff lunch" },
  { id: "m14", date: "2026-08-06", time: "14:30", itemId: "p9", itemName: "Soda 500ml", location: "restaurant", reason: "given-away", qty: 2, unitCost: 58, value: 116, staffName: "Mercy", note: "Regular customer, complimentary" },
  { id: "m15", date: "2026-08-05", time: "17:40", itemId: "p11", itemName: "Biscuits", location: "canteen", reason: "sold-derived", qty: 34, unitCost: 36, value: 1224, staffName: "Anne", note: "Established at count" },
  { id: "m16", date: "2026-08-05", time: "17:40", itemId: "p13", itemName: "Sweets", location: "canteen", reason: "sold-derived", qty: 88, unitCost: 7, value: 616, staffName: "Anne", note: "Established at count" },
  { id: "m17", date: "2026-08-05", time: "17:45", itemId: "p12", itemName: "Crisps", location: "canteen", reason: "corrected", qty: -6, unitCost: 44, value: -264, staffName: "Lucy", note: "Count found 6 fewer than expected" },
  // STRESS CASE — correction carrying a past effective date. Entered today, applies to the 3rd.
  { id: "m18", date: "2026-08-06", time: "08:50", itemId: "p9", itemName: "Soda 500ml", location: "canteen", reason: "sold", qty: 4, unitCost: 58, value: 232, staffName: "Lucy", note: "Omitted sale found after close", effectiveDate: "2026-08-03" },
];

export interface HandoverCheck {
  staffId: string;
  staffName: string;
  location: Location;
  cashExpected: number;
  cashActual: number;
  mpesaExpected: number;
  mpesaActual: number;
}

export const handovers: HandoverCheck[] = [
  // STRESS CASE — Sarah's cash is short. The discrepancy is the point of the screen.
  { staffId: "s3", staffName: "Sarah", location: "restaurant", cashExpected: 8400, cashActual: 8150, mpesaExpected: 6200, mpesaActual: 6200 },
  { staffId: "s4", staffName: "Mercy", location: "restaurant", cashExpected: 5240, cashActual: 5240, mpesaExpected: 3180, mpesaActual: 3180 },
  { staffId: "s2", staffName: "Janiffer", location: "restaurant", cashExpected: 0, cashActual: 0, mpesaExpected: 1400, mpesaActual: 1400 },
  { staffId: "s5", staffName: "Anne", location: "canteen", cashExpected: 4120, cashActual: 4120, mpesaExpected: 1280, mpesaActual: 1150 },
];

export interface Asset {
  id: string;
  name: string;
  purchasedOn: string;
  cost: number;
  location: Location;
  expenseRef: string;
}

export const assets: Asset[] = [
  { id: "a1", name: "Chest freezer", purchasedOn: "2026-05-14", cost: 30000, location: "restaurant", expenseRef: "E-0088" },
  { id: "a2", name: "Gas cooker (6 burner)", purchasedOn: "2026-03-02", cost: 24500, location: "restaurant", expenseRef: "E-0041" },
  { id: "a3", name: "Photocopier", purchasedOn: "2026-01-19", cost: 78000, location: "canteen", expenseRef: "E-0012" },
  { id: "a4", name: "Display fridge", purchasedOn: "2026-06-08", cost: 42000, location: "canteen", expenseRef: "E-0103" },
  { id: "a5", name: "Serving tables (x6)", purchasedOn: "2025-11-22", cost: 18000, location: "restaurant", expenseRef: "E-0004" },
  { id: "a6", name: "Sufuria set", purchasedOn: "2026-02-11", cost: 9400, location: "restaurant", expenseRef: "E-0029" },
];

export type ExpenseCategory = "stock" | "running" | "asset" | "drawing";

export interface Expense {
  id: string;
  ref: string;
  date: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  location: Location | "both";
  recordedBy: string;
  /** Staff-recorded expenses await the owner's confirmation before they move the cash balance. */
  status: "confirmed" | "pending";
}

export const expenses: Expense[] = [
  { id: "e1", ref: "E-0118", date: "2026-08-06", category: "stock", description: "Potatoes, beef — Nakuru supplier", amount: 9560, location: "restaurant", recordedBy: "Lucy", status: "confirmed" },
  { id: "e2", ref: "E-0119", date: "2026-08-06", category: "running", description: "Charcoal", amount: 1800, location: "restaurant", recordedBy: "Janiffer", status: "pending" },
  { id: "e3", ref: "E-0120", date: "2026-08-06", category: "running", description: "Gas refill", amount: 2400, location: "restaurant", recordedBy: "Lucy", status: "confirmed" },
  { id: "e4", ref: "E-0121", date: "2026-08-05", category: "running", description: "Electricity", amount: 3200, location: "both", recordedBy: "Lucy", status: "confirmed" },
  { id: "e5", ref: "E-0122", date: "2026-08-05", category: "drawing", description: "Personal", amount: 15000, location: "both", recordedBy: "Lucy", status: "confirmed" },
  { id: "e6", ref: "E-0123", date: "2026-08-06", category: "stock", description: "Sodas, water — canteen delivery", amount: 4200, location: "canteen", recordedBy: "Anne", status: "pending" },
  { id: "e7", ref: "E-0124", date: "2026-08-04", category: "running", description: "Rent — August", amount: 25000, location: "both", recordedBy: "Lucy", status: "confirmed" },
];

/**
 * Dashboard figures. The canteen's own-goods cost is estimated between counts,
 * so anything derived from it is provisional and must say so.
 */
export const dashboard = {
  period: "Today — Thursday 6 August 2026",
  revenue: { restaurant: 18600, canteen: 5400, total: 24000 },
  costOfGoods: {
    restaurant: 9600,
    canteenExact: 2400,
    canteenEstimated: 2880,
    total: 14880,
    provisional: true,
  },
  grossProfit: 9120,
  runningCosts: 2300,
  netProfit: 6820,
  cash: {
    handoversReceived: 142000,
    paidOut: 118800,
    expectedCash: 23200,
    expectedMpesa: 41350,
  },
  drawingsOutstanding: 15000,
  owedToBusiness: 8030,
  lastCanteenCount: "2026-08-01",
  canteenCostRate: 0.72,
};

export const money = (n: number) =>
  `KSh ${n.toLocaleString("en-KE", { maximumFractionDigits: 0 })}`;

export const reasonLabel: Record<MovementReason, string> = {
  received: "Received",
  issued: "Issued",
  produced: "Produced",
  "transferred-in": "Transferred in",
  "transferred-out": "Transferred out",
  sold: "Sold",
  "sold-derived": "Sold, derived",
  wasted: "Wasted",
  consumed: "Consumed",
  "given-away": "Given away",
  corrected: "Corrected",
};
