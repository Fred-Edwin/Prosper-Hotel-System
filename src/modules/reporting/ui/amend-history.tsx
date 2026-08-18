"use client";

/**
 * Editable-ledger T9.1 — the marker on a cell that has been edited, and
 * the history behind it.
 *
 * ## The marker
 *
 * A small neutral dot in the cell's top-right corner, visible at rest.
 *
 * Visible at rest is a deliberate departure from the *editable*
 * affordance, which shows nothing until she reaches for a cell. The
 * always-visible underline was built and rejected on 2026-08-17 for
 * exactly the reason it looks like this one should be too — but the two
 * are not the same case. Fourteen columns are editable on the widest
 * table in the app, so marking them all was marking everything. An
 * amended cell is rare: twelve amendments across an eighteen-day period
 * in a realistic database, touching five cells. A mark that appears five
 * times is a signal; a mark that appears everywhere is texture.
 *
 * And the two markers answer different questions. "You could change
 * this" only matters when she is reaching for the cell, so hover is the
 * right moment. "This was changed" is something she needs to be able to
 * *scan* for — the whole point is finding the edited figures without
 * knowing in advance which they are, and a hover-only marker would mean
 * hovering every cell to discover them.
 *
 * Never the accent. `docs/design.md` allows one accent element per
 * screen and it belongs to Undo in the toast (T4 established this).
 * Neutral, and small enough that the figure is still what the eye lands
 * on — the cell's own number must not have to compete with a note about
 * its past.
 *
 * ## The history
 *
 * A popover anchored to the cell, rather than a modal. She is reading the
 * history *against* the table it explains, so covering the table would
 * take away the thing she opened it to compare with.
 *
 * Newest first, because "what did this say before" is nearly always a
 * question about the most recent change. Each entry shows both figures,
 * who, and when she typed it — with the ledger day stated separately
 * where the two differ, since an edit typed in September to an August
 * figure is precisely the case the Amendment model keeps two dates for.
 */

import { useEffect, useRef, useState } from "react";

export type CellAmendmentData = {
  cellKey: string;
  previousValue: string;
  newValue: string;
  who: string;
  enteredAt: string;
  effectiveOn: string | null;
  ledgerContext: string | null;
};

/** Amended cells for a period, keyed as `getLedgerAmendments` keys them. */
export type AmendedCells = Record<string, CellAmendmentData[]>;

/**
 * The cell key, mirroring `cellKeyFor` in reporting/logic.ts.
 *
 * Kept in step with that function by construction — same field order,
 * same rule about when the day is part of the key. The server builds it
 * from the amendment's own stored fields; the client builds it from the
 * cell it is rendering, and they meet in the middle.
 */
export function cellKey(input: {
  recordType: string;
  recordId: string;
  field: string;
  /** Only used for a day-total edit — see cellKeyFor. */
  day?: string | null;
  locationId?: string | null;
}): string {
  const isDayTotal = input.recordType === "StockMovement" || input.recordType === "IngredientMovement";
  const scoped = isDayTotal && input.day ? input.day : "";
  return [input.recordType, input.recordId, input.field, scoped, input.locationId ?? ""].join("|");
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

/**
 * Wraps a ledger cell, adding the marker where that cell has a history.
 *
 * Renders its child untouched when there is none — a cell that has never
 * been edited is byte-identical to what it was before this existed, the
 * same guarantee `EditableNum` makes about the resting editable cell.
 */
export function AmendedCell({
  amendments,
  label,
  children,
}: {
  amendments?: CellAmendmentData[];
  /** The cell in her words, for the popover's heading. */
  label: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);

  // Close on an outside click or Escape. Without this the popover
  // survives her moving on to another cell, which on a table this wide
  // means it ends up floating over figures it has nothing to do with.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!amendments || amendments.length === 0) return <>{children}</>;

  const count = amendments.length;

  return (
    <span ref={wrapRef} className="relative inline-flex items-start">
      {children}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={`${label} — edited ${count} ${count === 1 ? "time" : "times"}. Show history.`}
        aria-expanded={open}
        className="ml-0.5 -mt-0.5 size-1.5 shrink-0 self-start rounded-full bg-muted-foreground/60 hover:bg-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
        data-testid="amend-history-dot"
      />

      {open && (
        <span
          role="dialog"
          aria-label={`History for ${label}`}
          className="absolute top-full right-0 z-40 mt-1 w-64 rounded-lg border bg-card p-3 text-left shadow-lg"
          data-testid="amend-history-popover"
        >
          <span className="block text-[12px] font-medium">{label}</span>
          <span className="mt-0.5 block text-[11px] text-muted-foreground">
            Edited {count} {count === 1 ? "time" : "times"}
          </span>

          <span className="mt-2 block space-y-2">
            {amendments.map((a, i) => (
              <span key={`${a.enteredAt}-${i}`} className="block border-t pt-2 first:border-t-0 first:pt-0">
                <span className="tabular block text-[13px]">
                  <span className="text-muted-foreground line-through">{a.previousValue}</span>
                  <span className="mx-1.5 text-muted-foreground" aria-hidden>
                    →
                  </span>
                  <span className="font-medium">{a.newValue}</span>
                </span>
                <span className="mt-0.5 block text-[11px] text-muted-foreground">
                  {a.who} · {formatDateTime(a.enteredAt)}
                </span>
                {/* The ledger day, stated only where it differs from the
                    day she typed it. Saying "for 11 Aug" on an edit made
                    on 11 Aug is noise; saying it on one made a week later
                    is the whole distinction the Amendment model keeps two
                    dates for. */}
                {a.effectiveOn && a.effectiveOn !== a.enteredAt.slice(0, 10) && (
                  <span className="block text-[11px] text-muted-foreground">for {a.effectiveOn}</span>
                )}
              </span>
            ))}
          </span>
        </span>
      )}
    </span>
  );
}
