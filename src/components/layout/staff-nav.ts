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
 * canteen alone, which means she records takings rather than individual sales.
 */

import {
  ShoppingCart,
  Wallet,
  PackagePlus,
  ArrowLeftRight,
  ClipboardList,
  Trash2,
  Receipt,
  Boxes,
  History,
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
  takings: {
    key: "takings",
    label: "Takings",
    icon: Receipt,
    hint: "Record the day's takings",
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
    all.count,
    all.wastage,
    all.stock,
    all.handover,
  ],
  cashier: [all.sell, all.sales, all.wastage, all.stock, all.handover],
  attendant: [
    all.takings,
    all.sales,
    all.receive,
    all.count,
    all.wastage,
    all.stock,
    all.handover,
  ],
};
