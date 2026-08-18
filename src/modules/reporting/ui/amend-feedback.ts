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

export type AmendSummary = {
  /** One sentence, real figures. Empty when nothing measurable moved. */
  message: string;
  /** True when the cascade reached beyond the row she edited. */
  cascaded: boolean;
};

/**
 * How to read one ledger's rows, supplied by the tab.
 *
 * Editable-ledger T6.5 made this generic. It was product-shaped — it took
 * `productId` and `ProductLedgerRowData[]` and reached into `closingQty`,
 * `profitMinor` and `days[].closing` directly — which meant the Store tab
 * would have needed a second copy, and Cash a third. The owner's decision
 * that **no edit on any tab is accepted silently** made three copies the
 * likely outcome, so the shape moved out to the caller instead.
 *
 * A tab that has no profit figure (Store) returns null from `profitOf` and
 * the profit clause simply drops out of the sentence.
 */
export type LedgerRowAccessors<Row> = {
  identify: (row: Row) => string;
  describe: (row: Row) => string;
  closingOf: (row: Row) => number;
  profitOf: (row: Row) => number | null;
  daysOf: (row: Row) => { date: string; closing: number }[];
};

/**
 * Days whose closing quantity moved, and by how much — the cascade, stated
 * as a count of days rather than a list, because "across 3 days" is what
 * she needs and three dates is more than she asked for.
 */
function daysChanged<Row>(
  before: Row | undefined,
  after: Row | undefined,
  accessors: LedgerRowAccessors<Row>,
): { count: number; delta: number } {
  if (!before || !after) return { count: 0, delta: 0 };
  const beforeByDate = new Map(accessors.daysOf(before).map((d) => [d.date, d]));
  let count = 0;
  let delta = 0;
  for (const day of accessors.daysOf(after)) {
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

export function summariseAmendment<Row>(input: {
  itemId: string;
  previousRows: Row[];
  rows: Row[];
  accessors: LedgerRowAccessors<Row>;
  /**
   * An extra clause for a figure the tab knows moved but the generic
   * closing/profit comparison cannot see — the Store tab's purchase edits
   * use it to name the unit cost that followed, since editing quantity or
   * value moves the figure nobody typed (plan T6.4).
   */
  extraClause?: string;
}): AmendSummary {
  const { accessors } = input;
  const before = input.previousRows.find((r) => accessors.identify(r) === input.itemId);
  const after = input.rows.find((r) => accessors.identify(r) === input.itemId);
  if (!before || !after) return { message: "Updated.", cascaded: false };

  const parts: string[] = [];

  const closingDelta = accessors.closingOf(after) - accessors.closingOf(before);
  const { count } = daysChanged(before, after, accessors);
  if (closingDelta !== 0) {
    const direction = closingDelta > 0 ? "rose" : "fell";
    const span = count > 1 ? ` across ${count} days` : "";
    parts.push(`${accessors.describe(after)} closing ${direction} by ${Math.abs(closingDelta)}${span}`);
  }

  // Profit is the figure she will not expect to move, so it is named
  // explicitly whenever it does — C7's whole reason for existing.
  const profitBefore = accessors.profitOf(before);
  const profitAfter = accessors.profitOf(after);
  if (profitBefore !== null && profitAfter !== null && profitBefore !== profitAfter) {
    const delta = profitAfter - profitBefore;
    parts.push(`profit changed by ${money(Math.abs(delta))}`);
  }

  if (input.extraClause) parts.push(input.extraClause);

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
 * What the confirm dialog says for one pending edit.
 *
 * **Every edit confirms** (owner decision, 2026-08-18). T4 originally
 * reserved the dialog for three escalations, on the reasoning that a
 * dialog firing constantly gets clicked through unread. The owner
 * overrode that: this is her money, and a figure changing because she
 * pressed Enter while reading is the failure she actually fears.
 *
 * So the escalations stop deciding *whether* to confirm and become extra
 * warning text on a dialog that was going to appear regardless. The
 * ordinary case still names the cell and both figures — a confirm that
 * says only "are you sure?" adds a click without adding a check, because
 * she cannot see what she is agreeing to.
 */
export type PendingEdit = {
  /** The cell in her words: "Operating cost, 15 Aug". */
  label: string;
  /** Rendered values, already formatted as money or a bare quantity. */
  from: string;
  to: string;
  /** The escalation, where one applies. Adds a paragraph; never replaces
   * the figures. */
  escalation?: ConfirmCase | null;
};

export function confirmMessage(edit: PendingEdit): {
  title: string;
  label: string;
  from: string;
  to: string;
  body: string | null;
  confirmLabel: string;
} {
  const escalation = edit.escalation ? escalationText(edit.escalation) : null;
  return {
    title: escalation?.title ?? "Change this figure?",
    label: edit.label,
    from: edit.from,
    to: edit.to,
    body: escalation?.body ?? null,
    confirmLabel: escalation?.confirmLabel ?? "Change it",
  };
}

/**
 * C7's three escalations — now extra warning text rather than the reason
 * a dialog appears.
 *
 * The handover case is the one to get right. Its expected figure
 * deliberately will *not* move (D2), so the ledger and that day's check
 * will disagree afterwards. That is the only place in this design where
 * two figures are meant to differ, and unexplained it reads exactly like a
 * bug — a false report against correct behaviour.
 */
function escalationText(c: ConfirmCase): { title: string; body: string; confirmLabel: string } {
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


/**
 * Editable-ledger T12 — what else this edit moves, for the confirm dialog.
 *
 * The dialog already names the cell and both figures. This is the second
 * half of the disclosure: an edit to a day's opening moves closing on
 * every following day, and cost of sales and profit with it, so agreeing
 * to one figure can mean agreeing to twenty.
 *
 * **Only present when there is something to say.** A "this also changes"
 * section that appears on every edit saying "nothing else" is noise that
 * teaches her to stop reading it — and then it is not there when it
 * matters. A short dialog on the ordinary edit is exactly what makes the
 * section mean something when it does appear.
 *
 * It reuses `summariseAmendment` rather than wording the cascade a second
 * time. The figures come from the server's rolled-back preview, so the
 * sentence in the confirm and the sentence in the toast afterwards are
 * produced by one function from the same kind of data — if they ever
 * disagreed, that would be the app contradicting itself about what it
 * just did.
 */
export function cascadePreview<Row>(input: {
  itemId: string;
  previousRows: Row[];
  rows: Row[];
  accessors: LedgerRowAccessors<Row>;
}): string | null {
  const summary = summariseAmendment(input);
  if (!summary.cascaded) return null;

  // "Updated." is the toast's voice — past tense, the edit has happened.
  // The dialog is asking, so it must not claim the change already
  // landed.
  return summary.message.replace(/^Updated\.\s*/, "");
}

/**
 * T12 — ask the server what this edit would do, without doing it.
 *
 * The same POST the commit uses, with `preview: true`. One endpoint, one
 * dispatch, one set of write functions: the preview cannot describe a
 * different edit from the one that follows, because it *is* that edit,
 * run and rolled back.
 *
 * Returns null when nothing beyond the edited cell moves — which is what
 * keeps the dialog's "this also changes" section meaningful, since it
 * then only appears when there is something to warn about.
 */
export async function fetchCascadePreview<Row>(input: {
  body: Record<string, unknown>;
  /**
   * Which table to preview against — stated, never inferred.
   *
   * The route defaults this from `itemType`, which resolves to the
   * Product ledger for anything that is not an ingredient. The Cash and
   * non-sales tabs add `ledger` at their own fetch rather than carrying
   * it on the edit body, so relying on the body here would have quietly
   * previewed a Cash edit against a table of products.
   */
  ledger: "product" | "store" | "cash" | "nonSales";
  periodStart: string;
  periodEnd: string;
  itemId: string;
  accessors: LedgerRowAccessors<Row>;
}): Promise<string | null> {
  const response = await fetch("/api/ledger/amend", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      ...input.body,
      ledger: input.ledger,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      preview: true,
    }),
  });
  // Thrown rather than swallowed, so the dialog can say it could not
  // check instead of showing the short form and implying nothing else
  // moves.
  if (!response.ok) throw new Error("preview failed");

  const payload = (await response.json()) as { rows: Row[]; previousRows: Row[] };
  return cascadePreview({
    itemId: input.itemId,
    previousRows: payload.previousRows,
    rows: payload.rows,
    accessors: input.accessors,
  });
}
