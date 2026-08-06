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
import { expenses, handovers } from "@/lib/fixtures";

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

const pendingExpenses = expenses.filter((e) => e.status === "pending").length;
const shortHandovers = handovers.filter(
  (h) => h.cashActual !== h.cashExpected || h.mpesaActual !== h.mpesaExpected,
).length;

export const destinations: Destination[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    href: "/design/shell",
    icon: LayoutDashboard,
    hint: "Today's figures and what needs you",
    count: shortHandovers || undefined,
    tone: shortHandovers ? "danger" : undefined,
  },
  {
    key: "ledger",
    label: "Ledger",
    href: "/design/ledger",
    icon: BookOpen,
    hint: "Where every figure comes from",
  },
  {
    key: "stock",
    label: "Stock",
    href: "/design/frame",
    icon: Package,
    hint: "What is on hand, and what it is worth",
  },
  {
    key: "money-out",
    label: "Money out",
    href: "/design/money-out",
    icon: Banknote,
    hint: "Purchases, running costs, assets, drawings",
    count: pendingExpenses || undefined,
  },
  {
    key: "people",
    label: "People",
    href: "/design/people",
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
    href: "/design/catalogue",
    icon: Library,
    hint: "Products, ingredients, recipes, assets",
  },
  {
    key: "activity",
    label: "Activity",
    href: "/design/activity",
    icon: History,
    hint: "Every change, who made it, when",
  },
];

/** Held constant across all three frames, so the frame is the only variable. */
export const CONTENT_MAX = 1400;
