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

/** Every link, including destinations reached only from a banner (e.g.
 * confirm-transfer) rather than a home-screen tile — keyed lookup for the
 * task header's title, since not every reachable screen is in staffNav. */
export const staffLinks: Record<string, StaffLink> = {
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
  "confirm-transfer": {
    key: "confirm-transfer",
    label: "Confirm transfer",
    icon: ArrowLeftRight,
    hint: "Confirm what actually arrived",
  },
  "sent-transfers": {
    key: "sent-transfers",
    label: "Sent transfers",
    icon: History,
    hint: "See whether what you sent reconciled",
  },
};

/** Six, three and five — the counts settled at setup. Stock added for every
 * role in the tracer slice: it's read-only and useful to everyone who works
 * a location, not tied to one task the way the others are. */
export const staffNav: Record<StaffRole, StaffLink[]> = {
  "store-manager": [
    staffLinks.sell,
    staffLinks.sales,
    staffLinks.receive,
    staffLinks.issue,
    staffLinks.production,
    staffLinks.count,
    staffLinks.wastage,
    staffLinks.stock,
    staffLinks.transfer,
    staffLinks.handover,
  ],
  cashier: [staffLinks.sell, staffLinks.sales, staffLinks.wastage, staffLinks.stock, staffLinks.handover],
  attendant: [
    staffLinks.sell,
    staffLinks.credit,
    staffLinks.sales,
    staffLinks.receive,
    staffLinks.count,
    staffLinks.wastage,
    staffLinks.stock,
    staffLinks.transfer,
    staffLinks.handover,
  ],
};
