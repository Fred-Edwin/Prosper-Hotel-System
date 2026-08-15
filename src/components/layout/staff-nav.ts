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
 * canteen alone — receiving, counts and handover, since she is effectively
 * store manager for one location, but no "sell" or "credit" destination
 * (2026-08-15 revision: the canteen has no individual sale entry at all —
 * a stock count infers what sold instead, see docs/scope.md's 2026-08-15
 * entry — reversing the 2026-08-13 revision this comment used to describe).
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
    label: "Today's summary",
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
    label: "Non-sales",
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
  "transfer-history": {
    key: "transfer-history",
    label: "Transfer history",
    icon: History,
    hint: "Everything sent and received, pending or confirmed",
  },
};

/** Six, three and five were the counts settled at setup. store-manager has
 * since grown past docs/design.md's 5-8 target (11 tiles) as the canteen
 * redesign added real destinations — flagged as its own follow-up rather
 * than silently absorbed here; see docs/screens.md's 2026-08-13 note.
 * attendant dropped back to 7 on 2026-08-15 when sell/credit were removed.
 * Stock added for every role in the tracer slice: it's read-only and useful
 * to everyone who works a location, not tied to one task the way the others
 * are. */
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
    staffLinks["transfer-history"],
    staffLinks.handover,
  ],
  cashier: [staffLinks.sell, staffLinks.sales, staffLinks.wastage, staffLinks.stock, staffLinks.handover],
  // 2026-08-15: sell and credit dropped — the canteen no longer records
  // individual sales at all (docs/scope.md's 2026-08-15 entry). A stock
  // count is now how a canteen sale gets recorded; count remains her entry
  // point for that.
  attendant: [
    staffLinks.sales,
    staffLinks.receive,
    staffLinks.count,
    staffLinks.wastage,
    staffLinks.stock,
    staffLinks.transfer,
    staffLinks["transfer-history"],
    staffLinks.handover,
  ],
};
