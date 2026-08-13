/**
 * Staff shell navigation, shared by every frame variant.
 *
 * Three people, three different sets of links — this is what "staff shells at
 * 6/3/5 links" meant. The shell follows the task, so the list is derived from
 * what the person actually does, not from their job title.
 *
 * Cashiers get three, and should barely notice navigation exists: they sell,
 * and at the end of a shift they hand over. Janiffer runs the restaurant store
 * as well as selling, so she gets receiving, issuing and counts. Anne runs the
 * canteen alone — she sells the same way a cashier does (2026-08-13 revision:
 * real per-sale recording replaced declaring a daily takings total), plus
 * receiving and counts, since she is effectively cashier and store manager
 * for one location.
 */

import {
  ShoppingCart,
  Wallet,
  PackagePlus,
  ArrowLeftRight,
  ClipboardList,
  Trash2,
  Boxes,
  History,
  ChefHat,
  HandCoins,
  type LucideIcon,
} from "lucide-react";

export type StaffRole = "cashier" | "store-manager" | "attendant";

export interface StaffLink {
  key: string;
  label: string;
  icon: LucideIcon;
  /** One line, for frames with room to explain themselves. */
  hint: string;
  /** Waiting on this person right now. */
  badge?: string;
  /** Attention that is a problem, not a queue. */
  tone?: "danger";
}

const all: Record<string, StaffLink> = {
  sell: {
    key: "sell",
    label: "New sale",
    icon: ShoppingCart,
    hint: "Take a sale at the counter",
  },
  sales: {
    key: "sales",
    label: "Today's sales",
    icon: History,
    hint: "Sales you've recorded today",
  },
  credit: {
    key: "credit",
    label: "Credit sale",
    icon: HandCoins,
    hint: "Record a sale on credit",
  },
  handover: {
    key: "handover",
    label: "Handover",
    icon: Wallet,
    hint: "Hand over cash and M-Pesa",
  },
  receive: {
    key: "receive",
    label: "Receiving",
    icon: PackagePlus,
    hint: "Record a delivery into the store",
  },
  issue: {
    key: "issue",
    label: "To kitchen",
    icon: ArrowLeftRight,
    hint: "Issue ingredients from the store",
  },
  production: {
    key: "production",
    label: "Production",
    icon: ChefHat,
    hint: "Record what the kitchen made",
  },
  count: {
    key: "count",
    label: "Stock count",
    icon: ClipboardList,
    hint: "Count what is on hand",
  },
  wastage: {
    key: "wastage",
    label: "Wastage",
    icon: Trash2,
    hint: "Wasted, staff meals, complimentary",
  },
  stock: {
    key: "stock",
    label: "Stock",
    icon: Boxes,
    hint: "What's on hand at your location",
  },
  transfer: { key: "transfer", label: "Transfer stock", icon: ArrowLeftRight, hint: "Move stock to the other location" },
};

/** Six, three and five — the counts settled at setup. Stock added for every
 * role in the tracer slice: it's read-only and useful to everyone who works
 * a location, not tied to one task the way the others are. */
export const staffNav: Record<StaffRole, StaffLink[]> = {
  "store-manager": [
    all.sell,
    all.sales,
    all.receive,
    all.issue,
    all.production,
    all.count,
    all.wastage,
    all.stock,
    all.transfer,
    all.handover,
  ],
  cashier: [all.sell, all.sales, all.wastage, all.stock, all.handover],
  attendant: [
    all.sell,
    all.credit,
    all.sales,
    all.receive,
    all.count,
    all.wastage,
    all.stock,
    all.transfer,
    all.handover,
  ],
};
