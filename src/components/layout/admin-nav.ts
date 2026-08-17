/**
 * The admin shell's seven destinations, shared by every frame variant.
 *
 * One list, three frames. The round is about the frame, so the nav content is
 * held constant — same labels, same order, same counts. Anything that differs
 * between variants is the frame's own decision, not a difference in what it is
 * navigating.
 *
 * Counts are attention, not volume. A destination shows a count only when
 * something there is waiting on Lucy: expenses she has not confirmed, handovers
 * that disagree. "How many products exist" is not a reason to put a number in
 * the navigation — it would be a number that is always there, which teaches the
 * eye to stop reading it.
 *
 * Counts and tones are supplied by the caller (real data, once modules exist)
 * rather than computed here — the shell must not depend on fixtures or on any
 * one module's internals.
 */

import {
  LayoutDashboard,
  BookOpen,
  Package,
  Banknote,
  Users,
  Library,
  History,
  type LucideIcon,
} from "lucide-react";

export interface Destination {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
  /** One line, used where a frame has room to explain itself. */
  hint: string;
  /** Waiting on the owner. Absent when nothing is. */
  count?: number;
  /** Attention that is a problem rather than a queue. */
  tone?: "danger";
}

export type DestinationCounts = Partial<
  Record<string, { count?: number; tone?: "danger" }>
>;

const base: Omit<Destination, "count" | "tone">[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    hint: "Today's figures and what needs you",
  },
  {
    key: "ledger",
    label: "Ledger",
    href: "/ledger",
    icon: BookOpen,
    hint: "Where every figure comes from",
  },
  {
    key: "stock",
    label: "Stock",
    href: "/stock",
    icon: Package,
    hint: "What is on hand, and what it is worth",
  },
  {
    key: "money-out",
    label: "Expenses",
    href: "/money-out",
    icon: Banknote,
    hint: "Purchases, operating costs, assets, drawings",
  },
  {
    key: "people",
    label: "People",
    href: "/people",
    icon: Users,
    // Customers moved here from Catalogue in round E. A customer is not
    // reference data — it is a live balance that moves with every credit sale
    // and repayment — and "taking a repayment happens on the customer" only
    // works if the customer is somewhere you would naturally go.
    hint: "Staff and customers — who is owed, and who owes",
  },
  {
    key: "catalogue",
    label: "Catalogue",
    href: "/catalogue",
    icon: Library,
    hint: "Products, ingredients, recipes, assets",
  },
  {
    key: "activity",
    label: "Activity",
    href: "/activity",
    icon: History,
    hint: "Every change, who made it, when",
  },
];

export function getDestinations(counts: DestinationCounts = {}): Destination[] {
  return base.map((d) => ({ ...d, ...counts[d.key] }));
}

/** Held constant across all three frames, so the frame is the only variable. */
export const CONTENT_MAX = 1400;
