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

/**
 * Till categories.
 *
 * Distinct from `kind`, deliberately. `kind` is the accounting classification
 * from CONTEXT.md — it decides whether a thing is stocked and costed. A
 * category is how a cashier finds something in a hurry, which is a different
 * question: "drinks" spans bought-in sodas and kitchen-made tea, and no
 * cashier thinks of those as different sorts of thing.
 */
export type Category =
  | "food"
  | "drinks"
  | "snacks"
  | "stationery"
  | "household"
  | "services";

export const categories: { key: Category; label: string }[] = [
  { key: "food", label: "Food" },
  { key: "drinks", label: "Drinks" },
  { key: "snacks", label: "Snacks" },
  { key: "stationery", label: "Stationery" },
  { key: "household", label: "Household" },
  { key: "services", label: "Services" },
];

export interface Product {
  id: string;
  name: string;
  kind: ProductKind;
  category: Category;
  price: number;
  /** Null where no recipe exists — cooked food without a recorded yield. */
  unitCost: number | null;
  location: Location[];
  stock: number | null;
}

export const products: Product[] = [
  // Cooked food — restaurant kitchen
  { id: "p1", name: "Mukimo", kind: "cooked", category: "food", price: 150, unitCost: 89, location: ["restaurant"], stock: 24 },
  { id: "p2", name: "Chips", kind: "cooked", category: "food", price: 100, unitCost: 41, location: ["restaurant", "canteen"], stock: 38 },
  { id: "p3", name: "Chapati", kind: "cooked", category: "food", price: 20, unitCost: 11, location: ["restaurant", "canteen"], stock: 64 },
  { id: "p4", name: "Githeri", kind: "cooked", category: "food", price: 120, unitCost: 67, location: ["restaurant"], stock: 18 },
  { id: "p5", name: "Beef stew", kind: "cooked", category: "food", price: 180, unitCost: null, location: ["restaurant"], stock: 12 },
  { id: "p6", name: "Tea", kind: "cooked", category: "drinks", price: 30, unitCost: 8, location: ["restaurant", "canteen"], stock: 40 },
  { id: "p7", name: "Rice", kind: "cooked", category: "food", price: 100, unitCost: 52, location: ["restaurant"], stock: 22 },
  { id: "p8", name: "Ugali", kind: "cooked", category: "food", price: 50, unitCost: 19, location: ["restaurant"], stock: 30 },
  { id: "p26", name: "Pilau", kind: "cooked", category: "food", price: 180, unitCost: 96, location: ["restaurant"], stock: 16 },
  { id: "p27", name: "Sukuma wiki", kind: "cooked", category: "food", price: 50, unitCost: 18, location: ["restaurant"], stock: 28 },
  { id: "p28", name: "Beans", kind: "cooked", category: "food", price: 80, unitCost: 34, location: ["restaurant"], stock: 20 },
  { id: "p29", name: "Mandazi", kind: "cooked", category: "snacks", price: 20, unitCost: 8, location: ["restaurant", "canteen"], stock: 45 },
  { id: "p30", name: "Samosa", kind: "cooked", category: "snacks", price: 30, unitCost: 14, location: ["restaurant", "canteen"], stock: 32 },
  { id: "p31", name: "Coffee", kind: "cooked", category: "drinks", price: 40, unitCost: 12, location: ["restaurant"], stock: 30 },
  { id: "p32", name: "Chai ya maziwa", kind: "cooked", category: "drinks", price: 40, unitCost: 14, location: ["restaurant"], stock: 35 },

  // Goods — canteen retail
  { id: "p9", name: "Soda 500ml", kind: "goods", category: "drinks", price: 80, unitCost: 58, location: ["canteen", "restaurant"], stock: 96 },
  { id: "p10", name: "Water 1L", kind: "goods", category: "drinks", price: 60, unitCost: 42, location: ["canteen", "restaurant"], stock: 54 },
  { id: "p11", name: "Biscuits", kind: "goods", category: "snacks", price: 50, unitCost: 36, location: ["canteen"], stock: 120 },
  { id: "p12", name: "Crisps", kind: "goods", category: "snacks", price: 60, unitCost: 44, location: ["canteen"], stock: 78 },
  { id: "p13", name: "Sweets", kind: "goods", category: "snacks", price: 10, unitCost: 7, location: ["canteen"], stock: 340 },
  { id: "p14", name: "Exercise book", kind: "goods", category: "stationery", price: 60, unitCost: 43, location: ["canteen"], stock: 85 },
  { id: "p15", name: "Foolscaps", kind: "goods", category: "stationery", price: 5, unitCost: 3, location: ["canteen"], stock: 500 },
  { id: "p16", name: "Pen", kind: "goods", category: "stationery", price: 20, unitCost: 12, location: ["canteen"], stock: 145 },
  { id: "p17", name: "ENO", kind: "goods", category: "household", price: 30, unitCost: 21, location: ["canteen"], stock: 42 },
  { id: "p18", name: "Painkillers", kind: "goods", category: "household", price: 20, unitCost: 13, location: ["canteen"], stock: 68 },
  { id: "p19", name: "Airtime 50", kind: "goods", category: "services", price: 50, unitCost: 48, location: ["canteen"], stock: null },
  { id: "p20", name: "Handkerchief", kind: "goods", category: "household", price: 50, unitCost: 34, location: ["canteen"], stock: 26 },

  // Services — no stock
  { id: "p21", name: "Photocopy (per page)", kind: "service", category: "services", price: 5, unitCost: 2, location: ["canteen", "restaurant"], stock: null },
  { id: "p22", name: "Printing (per page)", kind: "service", category: "services", price: 10, unitCost: 4, location: ["canteen"], stock: null },
  { id: "p23", name: "Binding", kind: "service", category: "services", price: 100, unitCost: 35, location: ["canteen"], stock: null },

  // Packaging
  { id: "p24", name: "Takeaway container", kind: "packaging", category: "household", price: 20, unitCost: 14, location: ["restaurant"], stock: 210 },

  // STRESS CASE — 200-character name. Overflow must truncate with a tooltip.
  {
    id: "p25",
    name: "Large capacity insulated food flask with double-walled stainless steel interior and locking clip lid, supplied by the Nakuru wholesaler, used for the school delivery run on Tuesdays and Thursdays only",
    kind: "goods",
    category: "household",
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

/** Per-location trading figures, for the comparison the dashboard carries. */
export const locationPerformance = [
  {
    location: "restaurant" as Location,
    revenue: 18600,
    costOfGoods: 9600,
    grossProfit: 9000,
    runningCosts: 1700,
    netProfit: 7300,
    margin: 0.484,
    transactions: 47,
    provisional: false,
  },
  {
    location: "canteen" as Location,
    revenue: 5400,
    costOfGoods: 5280,
    grossProfit: 120,
    runningCosts: 600,
    netProfit: -480,
    margin: 0.022,
    transactions: 1,
    provisional: true,
  },
];

/** Today's stock flow at both locations, summarised by reason. */
export const stockFlow = [
  { reason: "Received", qty: 52, value: 9560, location: "both" },
  { reason: "Produced", qty: 75, value: 4515, location: "restaurant" },
  { reason: "Transferred", qty: 34, value: 1952, location: "both" },
  { reason: "Sold", qty: 118, value: 8940, location: "both" },
  { reason: "Wasted", qty: 3, value: 324, location: "restaurant" },
  { reason: "Consumed", qty: 9, value: 116, location: "restaurant" },
  { reason: "Given away", qty: 2, value: 116, location: "restaurant" },
];

/** The restaurant store specifically: in from suppliers, out to kitchen and canteen. */
export const storeFlow = [
  { item: "Potatoes", received: 40, issued: 18, transferred: 0, closing: 48 },
  { item: "Beef", received: 12, issued: 6, transferred: 0, closing: 8 },
  { item: "Cooking oil", received: 0, issued: 3, transferred: 0, closing: 14 },
  { item: "Maize flour", received: 0, issued: 8, transferred: 0, closing: 32 },
  { item: "Chips", received: 0, issued: 0, transferred: 12, closing: 38 },
  { item: "Chapati", received: 0, issued: 0, transferred: 20, closing: 64 },
];

/**
 * Fourteen trading days to today.
 *
 * Trend is the one thing a single figure cannot carry: it turns "6,820 today"
 * into "6,820, and that is normal" or "…and that is the worst this fortnight".
 * Sundays are closed, so the series has genuine gaps rather than zeroes — a
 * chart that draws a zero on a closed day tells a lie about trading.
 */
export interface DayPoint {
  date: string;
  label: string;
  revenue: number | null;
  netProfit: number | null;
  cash: number;
  mpesa: number;
  owed: number;
  drawings: number;
}

export const trend: DayPoint[] = [
  { date: "2026-07-24", label: "Fri 24", revenue: 21400, netProfit: 5980, cash: 18200, mpesa: 32100, owed: 6200, drawings: 0 },
  { date: "2026-07-25", label: "Sat 25", revenue: 26800, netProfit: 8140, cash: 24600, mpesa: 38400, owed: 6450, drawings: 0 },
  { date: "2026-07-26", label: "Sun 26", revenue: null, netProfit: null, cash: 24600, mpesa: 38400, owed: 6450, drawings: 0 },
  { date: "2026-07-27", label: "Mon 27", revenue: 19200, netProfit: 5210, cash: 12800, mpesa: 40200, owed: 6890, drawings: 5000 },
  { date: "2026-07-28", label: "Tue 28", revenue: 22600, netProfit: 6740, cash: 16400, mpesa: 41800, owed: 7100, drawings: 5000 },
  { date: "2026-07-29", label: "Wed 29", revenue: 20100, netProfit: 5420, cash: 19900, mpesa: 39600, owed: 7340, drawings: 5000 },
  { date: "2026-07-30", label: "Thu 30", revenue: 23800, netProfit: 7260, cash: 22100, mpesa: 42300, owed: 7520, drawings: 5000 },
  { date: "2026-07-31", label: "Fri 31", revenue: 24900, netProfit: 7880, cash: 26800, mpesa: 44100, owed: 7680, drawings: 5000 },
  { date: "2026-08-01", label: "Sat 1", revenue: 28200, netProfit: 9140, cash: 31200, mpesa: 46900, owed: 7810, drawings: 5000 },
  { date: "2026-08-02", label: "Sun 2", revenue: null, netProfit: null, cash: 31200, mpesa: 46900, owed: 7810, drawings: 5000 },
  { date: "2026-08-03", label: "Mon 3", revenue: 18900, netProfit: 4820, cash: 14600, mpesa: 43200, owed: 7940, drawings: 10000 },
  { date: "2026-08-04", label: "Tue 4", revenue: 21700, netProfit: 6110, cash: 18300, mpesa: 41700, owed: 8120, drawings: 10000 },
  { date: "2026-08-05", label: "Wed 5", revenue: 22400, netProfit: 6390, cash: 20900, mpesa: 40800, owed: 8210, drawings: 15000 },
  { date: "2026-08-06", label: "Thu 6", revenue: 24000, netProfit: 6820, cash: 23200, mpesa: 41350, owed: 8030, drawings: 15000 },
];

/* ---------------------------------------------------------------- ledger -- */

/**
 * Ledger rows.
 *
 * Each row is one item at one location over the selected period: opening at
 * the period's start, movements summed across it, closing at its end. The
 * columns aggregate arithmetically, so a month is one row per item rather than
 * thirty — and `days` carries the detail for when she needs to investigate.
 *
 * Product rows split by location deliberately. Chips exist at both, and a
 * combined row would hide which location holds the stock, which is the first
 * thing a count needs to know.
 */
export interface LedgerDay {
  date: string;
  opening: number;
  produced: number;
  received: number;
  transferredIn: number;
  transferredOut: number;
  sold: number;
  nonSales: number;
  closing: number;
}

export interface ProductLedgerRow {
  id: string;
  item: string;
  location: Location;
  category: Category;
  openingQty: number;
  openingValue: number;
  produced: number;
  received: number;
  transferredIn: number;
  transferredOut: number;
  sold: number;
  nonSales: number;
  salesValue: number;
  /** Null where no recipe exists — cost is unknown, not zero. */
  unitCost: number | null;
  sellingPrice: number;
  closingQty: number;
  days: LedgerDay[];
}

const day = (
  date: string,
  o: number,
  p: number,
  ti: number,
  to: number,
  s: number,
  ns: number,
  r = 0,
): LedgerDay => ({
  date,
  opening: o,
  produced: p,
  received: r,
  transferredIn: ti,
  transferredOut: to,
  sold: s,
  nonSales: ns,
  closing: o + p + r + ti - to - s - ns,
});

export const productLedger: ProductLedgerRow[] = [
  {
    id: "pl1", item: "Chips", location: "restaurant", category: "food",
    openingQty: 8, openingValue: 328, produced: 205, received: 0,
    transferredIn: 0, transferredOut: 60, sold: 112, nonSales: 3,
    salesValue: 11200, unitCost: 41, sellingPrice: 100, closingQty: 38,
    days: [
      day("2026-08-02", 8, 40, 0, 10, 26, 2),
      day("2026-08-03", 10, 38, 0, 12, 30, 0),
      day("2026-08-04", 6, 42, 0, 12, 28, 1),
      day("2026-08-05", 7, 40, 0, 14, 25, 0),
      day("2026-08-06", 8, 45, 0, 12, 3, 0),
    ],
  },
  {
    id: "pl2", item: "Chips", location: "canteen", category: "food",
    openingQty: 2, openingValue: 82, produced: 0, received: 0,
    transferredIn: 60, transferredOut: 0, sold: 58, nonSales: 1,
    salesValue: 5800, unitCost: 41, sellingPrice: 100, closingQty: 3,
    days: [
      day("2026-08-02", 2, 0, 10, 0, 11, 0),
      day("2026-08-03", 1, 0, 12, 0, 12, 1),
      day("2026-08-04", 0, 0, 12, 0, 11, 0),
      day("2026-08-05", 1, 0, 14, 0, 13, 0),
      day("2026-08-06", 2, 0, 12, 0, 11, 0),
    ],
  },
  {
    id: "pl3", item: "Mukimo", location: "restaurant", category: "food",
    openingQty: 4, openingValue: 356, produced: 148, received: 0,
    transferredIn: 0, transferredOut: 0, sold: 126, nonSales: 2,
    salesValue: 18900, unitCost: 89, sellingPrice: 150, closingQty: 24,
    days: [
      day("2026-08-02", 4, 28, 0, 0, 24, 1),
      day("2026-08-03", 7, 30, 0, 0, 28, 0),
      day("2026-08-04", 9, 30, 0, 0, 26, 1),
      day("2026-08-05", 12, 30, 0, 0, 28, 0),
      day("2026-08-06", 14, 30, 0, 0, 20, 0),
    ],
  },
  {
    // STRESS CASE — no recipe, so no unit cost. Profit cannot be stated.
    id: "pl4", item: "Beef stew", location: "restaurant", category: "food",
    openingQty: 3, openingValue: 0, produced: 96, received: 0,
    transferredIn: 0, transferredOut: 0, sold: 84, nonSales: 3,
    salesValue: 15120, unitCost: null, sellingPrice: 180, closingQty: 12,
    days: [
      day("2026-08-02", 3, 18, 0, 0, 16, 0),
      day("2026-08-03", 5, 20, 0, 0, 18, 1),
      day("2026-08-04", 6, 20, 0, 0, 17, 0),
      day("2026-08-05", 9, 18, 0, 0, 16, 2),
      day("2026-08-06", 9, 20, 0, 0, 17, 0),
    ],
  },
  {
    id: "pl5", item: "Soda 500ml", location: "canteen", category: "drinks",
    openingQty: 84, openingValue: 4872, produced: 0, received: 120,
    transferredIn: 0, transferredOut: 0, sold: 106, nonSales: 2,
    salesValue: 8480, unitCost: 58, sellingPrice: 80, closingQty: 96,
    days: [
      day("2026-08-02", 84, 0, 0, 0, 22, 0, 0),
      day("2026-08-03", 62, 0, 0, 0, 18, 1, 60),
      day("2026-08-04", 103, 0, 0, 0, 24, 0, 0),
      day("2026-08-05", 79, 0, 0, 0, 21, 1, 60),
      day("2026-08-06", 117, 0, 0, 0, 21, 0, 0),
    ],
  },
  {
    id: "pl6", item: "Chapati", location: "restaurant", category: "food",
    openingQty: 12, openingValue: 132, produced: 260, received: 0,
    transferredIn: 0, transferredOut: 100, sold: 104, nonSales: 4,
    salesValue: 2080, unitCost: 11, sellingPrice: 20, closingQty: 64,
    days: [
      day("2026-08-02", 12, 50, 0, 20, 20, 1),
      day("2026-08-03", 21, 52, 0, 20, 22, 0),
      day("2026-08-04", 31, 50, 0, 20, 20, 2),
      day("2026-08-05", 39, 54, 0, 20, 21, 1),
      day("2026-08-06", 51, 54, 0, 20, 21, 0),
    ],
  },
  {
    id: "pl7", item: "Exercise book", location: "canteen", category: "stationery",
    openingQty: 62, openingValue: 2666, produced: 0, received: 60,
    transferredIn: 0, transferredOut: 0, sold: 36, nonSales: 1,
    salesValue: 2160, unitCost: 43, sellingPrice: 60, closingQty: 85,
    days: [
      day("2026-08-02", 62, 0, 0, 0, 8, 0, 0),
      day("2026-08-03", 54, 0, 0, 0, 6, 1, 0),
      day("2026-08-04", 47, 0, 0, 0, 7, 0, 60),
      day("2026-08-05", 100, 0, 0, 0, 8, 0, 0),
      day("2026-08-06", 92, 0, 0, 0, 7, 0, 0),
    ],
  },
];

export interface StoreLedgerRow {
  id: string;
  item: string;
  unit: string;
  openingQty: number;
  purchasedQty: number;
  purchasedValue: number;
  unitCost: number;
  /** Weighted average moves with each purchase; the change is the answer to
      "why did my costs rise". */
  previousUnitCost: number;
  issuedToKitchen: number;
  transferredOut: number;
  spoilage: number;
  closingQty: number;
}

export const storeLedger: StoreLedgerRow[] = [
  { id: "sl1", item: "Potatoes", unit: "kg", openingQty: 34, purchasedQty: 120, purchasedValue: 7560, unitCost: 65, previousUnitCost: 61, issuedToKitchen: 104, transferredOut: 0, spoilage: 2, closingQty: 48 },
  { id: "sl2", item: "Beef", unit: "kg", openingQty: 6, purchasedQty: 36, purchasedValue: 20880, unitCost: 580, previousUnitCost: 560, issuedToKitchen: 34, transferredOut: 0, spoilage: 0, closingQty: 8 },
  { id: "sl3", item: "Cooking oil", unit: "L", openingQty: 18, purchasedQty: 12, purchasedValue: 3840, unitCost: 320, previousUnitCost: 320, issuedToKitchen: 16, transferredOut: 0, spoilage: 0, closingQty: 14 },
  { id: "sl4", item: "Maize flour", unit: "kg", openingQty: 28, purchasedQty: 50, purchasedValue: 3900, unitCost: 78, previousUnitCost: 74, issuedToKitchen: 46, transferredOut: 0, spoilage: 0, closingQty: 32 },
  { id: "sl5", item: "Wheat flour", unit: "kg", openingQty: 20, purchasedQty: 40, purchasedValue: 3680, unitCost: 92, previousUnitCost: 88, issuedToKitchen: 36, transferredOut: 0, spoilage: 0, closingQty: 24 },
  { id: "sl6", item: "Rice", unit: "kg", openingQty: 22, purchasedQty: 30, purchasedValue: 4950, unitCost: 165, previousUnitCost: 165, issuedToKitchen: 26, transferredOut: 0, spoilage: 0, closingQty: 26 },
  { id: "sl7", item: "Printing paper", unit: "ream", openingQty: 6, purchasedQty: 8, purchasedValue: 4960, unitCost: 620, previousUnitCost: 600, issuedToKitchen: 0, transferredOut: 5, spoilage: 0, closingQty: 9 },
];

export type NonSalesReason = "wasted" | "consumed" | "given-away";

export interface NonSalesRow {
  id: string;
  date: string;
  item: string;
  location: Location;
  reason: NonSalesReason;
  qty: number;
  sellingPrice: number;
  /** Null where no recipe exists — the 60% rule then applies. */
  unitCost: number | null;
  recordedBy: string;
}

export const nonSalesLedger: NonSalesRow[] = [
  { id: "ns1", date: "2026-08-06", item: "Beef stew", location: "restaurant", reason: "wasted", qty: 3, sellingPrice: 180, unitCost: null, recordedBy: "Mercy" },
  { id: "ns2", date: "2026-08-06", item: "Tea", location: "restaurant", reason: "consumed", qty: 5, sellingPrice: 30, unitCost: 8, recordedBy: "Sarah" },
  { id: "ns3", date: "2026-08-06", item: "Ugali", location: "restaurant", reason: "consumed", qty: 4, sellingPrice: 50, unitCost: 19, recordedBy: "Sarah" },
  { id: "ns4", date: "2026-08-06", item: "Soda 500ml", location: "restaurant", reason: "given-away", qty: 2, sellingPrice: 80, unitCost: 58, recordedBy: "Mercy" },
  { id: "ns5", date: "2026-08-05", item: "Chapati", location: "restaurant", reason: "wasted", qty: 4, sellingPrice: 20, unitCost: 11, recordedBy: "Janiffer" },
  { id: "ns6", date: "2026-08-05", item: "Chips", location: "canteen", reason: "wasted", qty: 1, sellingPrice: 100, unitCost: 41, recordedBy: "Anne" },
  { id: "ns7", date: "2026-08-04", item: "Mukimo", location: "restaurant", reason: "given-away", qty: 1, sellingPrice: 150, unitCost: 89, recordedBy: "Lucy" },
  { id: "ns8", date: "2026-08-04", item: "Exercise book", location: "canteen", reason: "wasted", qty: 1, sellingPrice: 60, unitCost: 43, recordedBy: "Anne" },
];

/**
 * Where the 60% rule applies.
 *
 * proposal.md §10.5: cooked food with no recipe is valued at 60% of selling
 * price, and the estimate is used for this report only. Where a real cost
 * exists — a purchase price, or a recipe — it is used instead, because 60% of
 * a soda's price is not its cost.
 */
export const nonSalesCost = (r: NonSalesRow) =>
  r.unitCost !== null
    ? { value: r.unitCost * r.qty, estimated: false }
    : { value: Math.round(r.sellingPrice * 0.6 * r.qty), estimated: true };

export type CashCategory =
  | "handover"
  | "repayment"
  | "stock"
  | "running"
  | "asset"
  | "drawing";

export interface CashTransaction {
  id: string;
  description: string;
  category: CashCategory;
  method: "cash" | "mpesa";
  in: number;
  out: number;
  recordedBy: string;
  location: Location | "both";
}

/**
 * The cash ledger: one row per day, categories as columns.
 *
 * Deliberately the same shape as the product and store ledgers — opening, what
 * came in, what went out by category, closing — so all three read as one kind
 * of record. An earlier version listed one row per transaction, which made cash
 * look like a different sort of thing and could not answer "what did I spend on
 * stock this week" without arithmetic.
 *
 * Closing is the point of the row: every column is a delta, and the closing
 * balance is what makes the dashboard's expected cash traceable line by line.
 */
export interface CashLedgerDay {
  date: string;
  opening: number;
  handovers: number;
  repayments: number;
  stock: number;
  running: number;
  assets: number;
  drawings: number;
  closing: number;
  transactions: CashTransaction[];
}

export const cashLedger: CashLedgerDay[] = [
  {
    date: "2026-08-02",
    opening: 38600, handovers: 9400, repayments: 0,
    stock: 0, running: 0, assets: 0, drawings: 0, closing: 48000,
    transactions: [
      { id: "t1", description: "Handover — Sarah", category: "handover", method: "cash", in: 6200, out: 0, recordedBy: "Lucy", location: "restaurant" },
      { id: "t2", description: "Handover — Anne", category: "handover", method: "cash", in: 3200, out: 0, recordedBy: "Lucy", location: "canteen" },
    ],
  },
  {
    date: "2026-08-03",
    opening: 48000, handovers: 10800, repayments: 800,
    stock: 12400, running: 6000, assets: 0, drawings: 0, closing: 41200,
    transactions: [
      { id: "t3", description: "Maize flour, rice — wholesaler", category: "stock", method: "cash", in: 0, out: 12400, recordedBy: "Lucy", location: "restaurant" },
      { id: "t4", description: "Wages — week", category: "running", method: "cash", in: 0, out: 6000, recordedBy: "Lucy", location: "both" },
      { id: "t5", description: "Handover — Sarah", category: "handover", method: "cash", in: 7100, out: 0, recordedBy: "Lucy", location: "restaurant" },
      { id: "t6", description: "Handover — Anne", category: "handover", method: "cash", in: 3700, out: 0, recordedBy: "Lucy", location: "canteen" },
      { id: "t7", description: "Repayment — Wanjiru", category: "repayment", method: "cash", in: 800, out: 0, recordedBy: "Anne", location: "canteen" },
    ],
  },
  {
    date: "2026-08-04",
    opening: 41200, handovers: 11800, repayments: 0,
    stock: 0, running: 25000, assets: 0, drawings: 0, closing: 28000,
    transactions: [
      { id: "t8", description: "Rent — August", category: "running", method: "cash", in: 0, out: 25000, recordedBy: "Lucy", location: "both" },
      { id: "t9", description: "Handover — Sarah", category: "handover", method: "cash", in: 7840, out: 0, recordedBy: "Lucy", location: "restaurant" },
      { id: "t10", description: "Handover — Anne", category: "handover", method: "cash", in: 3960, out: 0, recordedBy: "Lucy", location: "canteen" },
    ],
  },
  {
    date: "2026-08-05",
    opening: 28000, handovers: 13520, repayments: 1200,
    stock: 0, running: 3200, assets: 0, drawings: 15000, closing: 24520,
    transactions: [
      { id: "t11", description: "Electricity", category: "running", method: "cash", in: 0, out: 3200, recordedBy: "Lucy", location: "both" },
      { id: "t12", description: "Personal drawing", category: "drawing", method: "cash", in: 0, out: 15000, recordedBy: "Lucy", location: "both" },
      { id: "t13", description: "Handover — Sarah", category: "handover", method: "cash", in: 8120, out: 0, recordedBy: "Lucy", location: "restaurant" },
      { id: "t14", description: "Handover — Mercy", category: "handover", method: "cash", in: 5400, out: 0, recordedBy: "Lucy", location: "restaurant" },
      { id: "t15", description: "Repayment — Kimani", category: "repayment", method: "cash", in: 1200, out: 0, recordedBy: "Anne", location: "canteen" },
    ],
  },
  {
    date: "2026-08-06",
    opening: 24520, handovers: 17510, repayments: 0,
    stock: 13760, running: 5070, assets: 0, drawings: 0, closing: 23200,
    transactions: [
      { id: "t16", description: "Potatoes, beef — Nakuru supplier", category: "stock", method: "cash", in: 0, out: 9560, recordedBy: "Lucy", location: "restaurant" },
      { id: "t17", description: "Sodas, water — canteen delivery", category: "stock", method: "cash", in: 0, out: 4200, recordedBy: "Anne", location: "canteen" },
      { id: "t18", description: "Gas refill", category: "running", method: "cash", in: 0, out: 2400, recordedBy: "Lucy", location: "restaurant" },
      { id: "t19", description: "Charcoal", category: "running", method: "cash", in: 0, out: 1800, recordedBy: "Janiffer", location: "restaurant" },
      { id: "t20", description: "Freezer repair", category: "running", method: "cash", in: 0, out: 870, recordedBy: "Lucy", location: "restaurant" },
      { id: "t21", description: "Handover — Sarah", category: "handover", method: "cash", in: 8150, out: 0, recordedBy: "Lucy", location: "restaurant" },
      { id: "t22", description: "Handover — Mercy", category: "handover", method: "cash", in: 5240, out: 0, recordedBy: "Lucy", location: "restaurant" },
      { id: "t23", description: "Handover — Anne", category: "handover", method: "cash", in: 4120, out: 0, recordedBy: "Lucy", location: "canteen" },
    ],
  },
];

export const cashCategoryLabel: Record<CashCategory, string> = {
  handover: "Handover",
  stock: "Stock",
  running: "Running cost",
  asset: "Asset",
  drawing: "Drawing",
  repayment: "Repayment",
};

export const nonSalesReasonLabel: Record<NonSalesReason, string> = {
  wasted: "Wasted",
  consumed: "Staff meal",
  "given-away": "Complimentary",
};

export const money = (n: number) =>
  `KSh ${n.toLocaleString("en-KE", { maximumFractionDigits: 0 })}`;

/** Compact form for axis ticks and sparkline labels, where space is scarce. */
export const moneyCompact = (n: number) => {
  const abs = Math.abs(n);
  const sign = n < 0 ? "−" : "";
  if (abs >= 1000) return `${sign}${(abs / 1000).toFixed(abs >= 10000 ? 0 : 1)}k`;
  return `${sign}${abs}`;
};

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

/* ------------------------------------------------------------- people ------ */

/**
 * Per-person detail, for the People destination.
 *
 * A staff member is the app's most complete record: identity, employment terms,
 * money the business owes them, money they owe it, and a history of days worked
 * and handovers. It exercises every part of a detail page, which is why the
 * detail template is prototyped on it.
 */
export interface WorkedDay {
  date: string;
  location: Location;
  /** Absent days are recorded, not omitted — a gap is not the same as a zero. */
  worked: boolean;
  note?: string;
}

export interface StaffDetail {
  id: string;
  daysWorked: WorkedDay[];
  /** Earned but not yet paid. */
  owedToStaff: number;
  /** Advances taken against future pay. */
  advances: number;
  lastPaid: string | null;
  startedOn: string;
  phone: string | null;
  /** Shortfalls attributed to this person over the period. */
  shortfalls: { date: string; amount: number; resolved: boolean }[];
}

export const staffDetail: Record<string, StaffDetail> = {
  s2: {
    id: "s2",
    startedOn: "2024-03-11",
    phone: "0721 664 032",
    daysWorked: [
      { date: "2026-08-06", location: "restaurant", worked: true },
      { date: "2026-08-05", location: "restaurant", worked: true },
      { date: "2026-08-04", location: "restaurant", worked: true },
      { date: "2026-08-03", location: "restaurant", worked: false, note: "Sick" },
      { date: "2026-08-02", location: "restaurant", worked: true },
    ],
    owedToStaff: 2800,
    advances: 1000,
    lastPaid: "2026-07-31",
    shortfalls: [],
  },
  s3: {
    id: "s3",
    startedOn: "2025-06-02",
    phone: "0715 220 981",
    daysWorked: [
      { date: "2026-08-06", location: "restaurant", worked: true },
      { date: "2026-08-05", location: "restaurant", worked: true },
      { date: "2026-08-04", location: "restaurant", worked: true },
      { date: "2026-08-03", location: "restaurant", worked: true },
      { date: "2026-08-02", location: "restaurant", worked: true },
    ],
    owedToStaff: 2750,
    advances: 0,
    lastPaid: "2026-07-31",
    // STRESS CASE — an unresolved shortfall on a person's own record.
    shortfalls: [{ date: "2026-08-06", amount: 250, resolved: false }],
  },
  s5: {
    id: "s5",
    startedOn: "2025-11-18",
    phone: null,
    daysWorked: [
      { date: "2026-08-06", location: "canteen", worked: true },
      { date: "2026-08-05", location: "canteen", worked: true },
      { date: "2026-08-04", location: "canteen", worked: false, note: "Not needed" },
      { date: "2026-08-03", location: "canteen", worked: true },
      { date: "2026-08-02", location: "canteen", worked: true },
    ],
    owedToStaff: 2400,
    advances: 500,
    lastPaid: "2026-07-31",
    shortfalls: [{ date: "2026-08-06", amount: 130, resolved: false }],
  },
};

export const roleLabel: Record<Staff["role"], string> = {
  owner: "Owner",
  "store-manager": "Store manager",
  cashier: "Cashier",
  attendant: "Attendant",
};

/* ------------------------------------------------------------- recipes ----- */

/**
 * A recipe is not a record — it is a composition, and the only shape in this
 * app that is neither a table row nor a fact list. Ingredient lines at cost sum
 * to a batch cost; batch cost divided by yield gives the per-unit cost that
 * every profit figure in the system depends on.
 *
 * **Recipes are versioned, effective-dated.** architecture.md: closed figures
 * are never edited. Changing a recipe cannot retroactively change what last
 * month's chips cost, so a change is a new version from a date, and past
 * movements keep the version they were costed with. That is why the UI shows a
 * version history rather than an edit form.
 */
export interface RecipeLine {
  ingredientId: string;
  qty: number;
}

export interface RecipeVersion {
  /** Applies from this date forward. Past figures keep the earlier version. */
  effectiveFrom: string;
  /** How many sellable units one batch produces. */
  yield: number;
  lines: RecipeLine[];
  note?: string;
  recordedBy: string;
}

export interface Recipe {
  id: string;
  productId: string;
  product: string;
  unit: string;
  /** Newest first. `versions[0]` is what applies today. */
  versions: RecipeVersion[];
}

export const recipes: Recipe[] = [
  {
    id: "r1",
    productId: "p2",
    product: "Chips",
    unit: "plate",
    versions: [
      {
        effectiveFrom: "2026-07-01",
        yield: 12,
        recordedBy: "Janiffer",
        note: "Oil went up; measured the batch again",
        lines: [
          { ingredientId: "i1", qty: 6 },
          { ingredientId: "i4", qty: 0.5 },
        ],
      },
      {
        effectiveFrom: "2026-03-15",
        yield: 12,
        recordedBy: "Lucy",
        lines: [
          { ingredientId: "i1", qty: 6 },
          { ingredientId: "i4", qty: 0.4 },
        ],
      },
    ],
  },
  {
    id: "r2",
    productId: "p4",
    product: "Githeri",
    unit: "plate",
    versions: [
      {
        effectiveFrom: "2026-05-20",
        yield: 20,
        recordedBy: "Janiffer",
        lines: [
          { ingredientId: "i6", qty: 2 },
          { ingredientId: "i2", qty: 1.5 },
          { ingredientId: "i4", qty: 0.2 },
        ],
      },
    ],
  },
  {
    id: "r3",
    productId: "p5",
    product: "Beef stew",
    unit: "portion",
    versions: [
      {
        effectiveFrom: "2026-06-02",
        yield: 15,
        recordedBy: "Janiffer",
        lines: [
          { ingredientId: "i5", qty: 3 },
          { ingredientId: "i4", qty: 0.3 },
          { ingredientId: "i1", qty: 1 },
        ],
      },
    ],
  },
];

/** Batch cost, and the per-unit cost every profit figure depends on. */
export const recipeCost = (v: RecipeVersion) => {
  const batch = v.lines.reduce((sum, l) => {
    const ing = ingredients.find((i) => i.id === l.ingredientId);
    return sum + (ing ? ing.unitCost * l.qty : 0);
  }, 0);
  return { batch, perUnit: v.yield > 0 ? batch / v.yield : 0 };
};

/** Cooked products with no recipe — their cost is unknown, never zero. */
export const productsWithoutRecipe = () =>
  products.filter(
    (p) => p.kind === "cooked" && !recipes.some((r) => r.productId === p.id),
  );

/* ----------------------------------------------------------- customers ----- */

/**
 * Customer detail. Customers moved from Catalogue to People in round E — a
 * customer is not reference data, it is a live balance that moves with every
 * credit sale and every repayment.
 *
 * The balance is an arithmetic, not a stored number: credit extended less
 * repayments. That is why the detail page shows the movements rather than the
 * figure alone — the client's recurring question is never "what is the number"
 * but "how did we get there".
 */
export interface CustomerMovement {
  date: string;
  kind: "credit" | "repayment";
  description: string;
  amount: number;
  recordedBy: string;
}

export interface CustomerDetail {
  id: string;
  since: string;
  movements: CustomerMovement[];
  /** Oldest unpaid credit, in days. The number that decides who to chase. */
  oldestDays: number;
}

export const customerDetail: Record<string, CustomerDetail> = {
  c1: {
    id: "c1",
    since: "2025-09-14",
    oldestDays: 18,
    movements: [
      { date: "2026-08-04", kind: "credit", description: "Lunch × 4", amount: 620, recordedBy: "Sarah" },
      { date: "2026-08-01", kind: "repayment", description: "Cash", amount: 800, recordedBy: "Lucy" },
      { date: "2026-07-19", kind: "credit", description: "Lunch × 6, sodas", amount: 1420, recordedBy: "Mercy" },
    ],
  },
  c6: {
    id: "c6",
    since: "2025-04-02",
    // STRESS CASE — the largest debt, and the oldest. Who to chase first.
    oldestDays: 74,
    movements: [
      { date: "2026-08-05", kind: "credit", description: "Staff lunches, week", amount: 2100, recordedBy: "Janiffer" },
      { date: "2026-07-02", kind: "repayment", description: "M-Pesa", amount: 1500, recordedBy: "Lucy" },
      { date: "2026-05-24", kind: "credit", description: "Function catering", amount: 2850, recordedBy: "Lucy" },
    ],
  },
};

/* ------------------------------------------------------------- activity ---- */

/**
 * The audit trail. Every change, who made it, when.
 *
 * architecture.md: every entry carries two dates, effective and entered.
 * Normally identical; for a correction they differ, and that gap is the
 * information — it distinguishes "what Tuesday looked like on Tuesday" from
 * "what Tuesday looks like now".
 *
 * This is the destination that reaches 1000+ rows first, so it is the one that
 * has to stay readable at volume.
 */
export type ActivityKind =
  | "sale"
  | "handover"
  | "expense"
  | "movement"
  | "correction"
  | "void"
  | "recipe"
  | "person";

export interface ActivityEntry {
  id: string;
  /** When it was recorded. */
  enteredAt: string;
  /** What day it belongs to. Differs from enteredAt only for a correction. */
  effectiveOn: string;
  kind: ActivityKind;
  who: string;
  what: string;
  location: Location | null;
  amount: number | null;
  /** Why, where a correction or void requires one. */
  reason?: string;
}

export const activityKindLabel: Record<ActivityKind, string> = {
  sale: "Sale",
  handover: "Handover",
  expense: "Money out",
  movement: "Stock",
  correction: "Correction",
  void: "Void",
  recipe: "Recipe",
  person: "People",
};

export const activity: ActivityEntry[] = [
  { id: "ac1", enteredAt: "2026-08-06 14:22", effectiveOn: "2026-08-06", kind: "sale", who: "Sarah", what: "Sale S-1184 · 3 items", location: "restaurant", amount: 480 },
  { id: "ac2", enteredAt: "2026-08-06 14:05", effectiveOn: "2026-08-06", kind: "expense", who: "Janiffer", what: "Charcoal, 2 sacks — pending your confirmation", location: "restaurant", amount: 1600 },
  // STRESS CASE — a correction whose effective date is in the past.
  { id: "ac3", enteredAt: "2026-08-06 13:40", effectiveOn: "2026-08-03", kind: "correction", who: "Lucy", what: "Canteen takings restated", location: "canteen", amount: 900, reason: "M-Pesa message arrived late; original figure kept" },
  { id: "ac4", enteredAt: "2026-08-06 12:58", effectiveOn: "2026-08-06", kind: "movement", who: "Janiffer", what: "12kg potatoes issued to kitchen", location: "restaurant", amount: null },
  // STRESS CASE — a void, attributed, shown on the day's summary.
  { id: "ac5", enteredAt: "2026-08-06 12:31", effectiveOn: "2026-08-06", kind: "void", who: "Mercy", what: "Sale S-1179 voided", location: "restaurant", amount: 260, reason: "Customer changed their order" },
  { id: "ac6", enteredAt: "2026-08-06 11:14", effectiveOn: "2026-08-06", kind: "recipe", who: "Janiffer", what: "Chips recipe — new version", location: null, amount: null, reason: "Oil went up; measured the batch again" },
  { id: "ac7", enteredAt: "2026-08-06 09:02", effectiveOn: "2026-08-06", kind: "handover", who: "Anne", what: "Handed over cash and M-Pesa", location: "canteen", amount: 5270 },
  { id: "ac8", enteredAt: "2026-08-05 19:47", effectiveOn: "2026-08-05", kind: "handover", who: "Sarah", what: "Handed over — cash short KSh 250", location: "restaurant", amount: 14350, reason: "Gave change from my own money for a 1000 note" },
  { id: "ac9", enteredAt: "2026-08-05 18:20", effectiveOn: "2026-08-05", kind: "person", who: "Lucy", what: "Mercy — daily rate changed to KSh 550", location: null, amount: null },
  { id: "ac10", enteredAt: "2026-08-05 16:05", effectiveOn: "2026-08-05", kind: "movement", who: "Janiffer", what: "Delivery received — 40kg potatoes", location: "restaurant", amount: 2600 },
  { id: "ac11", enteredAt: "2026-08-05 15:31", effectiveOn: "2026-08-05", kind: "sale", who: "Anne", what: "Canteen takings recorded", location: "canteen", amount: 4800 },
  { id: "ac12", enteredAt: "2026-08-05 11:12", effectiveOn: "2026-08-05", kind: "expense", who: "Lucy", what: "Electricity — July", location: null, amount: 3400 },
];

/** How many entries the real trail holds. The list must survive this. */
export const activityTotal = 1284;
