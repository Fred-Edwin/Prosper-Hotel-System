/**
 * Editable-ledger T4.3 — what an edit actually changed, in her words.
 *
 * C7's second stage: a toast quoting **real figures**, not categories.
 * "Beef stew closing rose by 2 across 3 days. Profit for 16 Aug changed by
 * KSh 45" is checkable against the table in front of her; "this affects
 * closing and profit" is not, and an unfalsifiable reassurance is worth
 * less than nothing on a screen whose whole job is that the numbers can be
 * traced.
 *
 * This is why `amendLedgerRoute` returns the rows from *before* the edit
 * alongside the new ones: the difference is computed from two real
 * snapshots rather than predicted from the input.
 */

import { money } from "@/shared/money";
import type { ProductLedgerRowData } from "./product-ledger";

export type AmendSummary = {
  /** One sentence, real figures. Empty when nothing measurable moved. */
  message: string;
  /** True when the cascade reached beyond the row she edited. */
  cascaded: boolean;
};

/**
 * Days whose closing quantity moved, and by how much — the cascade, stated
 * as a count of days rather than a list, because "across 3 days" is what
 * she needs and three dates is more than she asked for.
 */
function daysChanged(
  before: ProductLedgerRowData | undefined,
  after: ProductLedgerRowData | undefined,
): { count: number; delta: number } {
  if (!before || !after) return { count: 0, delta: 0 };
  const beforeByDate = new Map(before.days.map((d) => [d.date, d]));
  let count = 0;
  let delta = 0;
  for (const day of after.days) {
    const was = beforeByDate.get(day.date);
    if (!was) continue;
    if (was.closing !== day.closing) {
      count += 1;
      // The final day's shift is the one that persists forward.
      delta = day.closing - was.closing;
    }
  }
  return { count, delta };
}

export function summariseAmendment(input: {
  productId: string;
  previousRows: ProductLedgerRowData[];
  rows: ProductLedgerRowData[];
}): AmendSummary {
  const before = input.previousRows.find((r) => r.productId === input.productId);
  const after = input.rows.find((r) => r.productId === input.productId);
  if (!before || !after) return { message: "Updated.", cascaded: false };

  const parts: string[] = [];

  const closingDelta = after.closingQty - before.closingQty;
  const { count } = daysChanged(before, after);
  if (closingDelta !== 0) {
    const direction = closingDelta > 0 ? "rose" : "fell";
    const span = count > 1 ? ` across ${count} days` : "";
    parts.push(`${after.productName} closing ${direction} by ${Math.abs(closingDelta)}${span}`);
  }

  // Profit is the figure she will not expect to move, so it is named
  // explicitly whenever it does — C7's whole reason for existing.
  const profitBefore = before.profitMinor;
  const profitAfter = after.profitMinor;
  if (profitBefore !== null && profitAfter !== null && profitBefore !== profitAfter) {
    const delta = profitAfter - profitBefore;
    parts.push(`profit changed by ${money(Math.abs(delta))}`);
  }

  if (parts.length === 0) return { message: "Updated.", cascaded: false };
  return {
    message: `Updated. ${sentence(parts)}.`,
    cascaded: count > 1 || closingDelta !== 0,
  };
}

function sentence(parts: string[]): string {
  if (parts.length === 1) return capitalise(parts[0]!);
  return capitalise(`${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`);
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * C7's *first* stage — the quiet line under the cell while she is still
 * typing. Categories, not figures, because the figures do not exist yet:
 * the edit hasn't happened. Its job is only to say that more than this one
 * cell will move, so the toast's real numbers are not a surprise.
 */
export function previewLine(input: {
  label: string;
  from: number | null;
  to: number;
  affectsMoney: boolean;
}): string {
  const from = input.from === null ? "—" : input.from;
  const tail = input.affectsMoney
    ? " · also changes closing from this day onward, cost of sales and profit"
    : " · also changes closing from this day onward";
  return `${input.label}: ${from} → ${input.to}${tail}`;
}

export type ConfirmCase =
  | { kind: "derivedPosition" }
  | { kind: "farBack"; months: number }
  | { kind: "handover" };

/**
 * C7's three escalations. Everything else is informational — she must be
 * able to edit ten cells in sequence without a confirm click.
 *
 * The handover case is the one to get right. Its expected figure
 * deliberately will *not* move (D2), so the ledger and that day's check
 * will disagree afterwards. That is the only place in this design where
 * two figures are meant to differ, and unexplained it reads exactly like a
 * bug — a false report against correct behaviour.
 */
export function confirmMessage(c: ConfirmCase): { title: string; body: string; confirmLabel: string } {
  switch (c.kind) {
    case "derivedPosition":
      return {
        title: "This changes every following day",
        body: "Opening and closing are running totals, so correcting one moves every day after it, along with cost of sales and profit.",
        confirmLabel: "Change it",
      };
    case "farBack":
      return {
        title:
          c.months >= 2
            ? `This changes figures for the last ${c.months} months`
            : "This changes figures going back more than a month",
        body: "The correction carries forward from the day you edited through to today.",
        confirmLabel: "Change it",
      };
    case "handover":
      return {
        title: "This day already has a handover",
        body: "The handover's expected figure is a record of a check that happened between two people, so it will not change. The ledger and that day's handover will show different figures afterwards — that is correct, not a fault.",
        confirmLabel: "Change it anyway",
      };
  }
}

/** D6: warn beyond 31 days, never block. */
export function farBackMonths(editedDate: Date, now: Date = new Date()): number | null {
  const days = Math.floor((now.getTime() - editedDate.getTime()) / (24 * 60 * 60 * 1000));
  if (days <= 31) return null;
  return Math.max(1, Math.round(days / 30));
}
