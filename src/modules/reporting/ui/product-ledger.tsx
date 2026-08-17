"use client";

/**
 * The Ledger's Product tab (ticket 39) — adapted from the design-reference
 * worktree's locked `ProductLedgerTable` (`ledger/tables.tsx`): one row per
 * product per location, opening/in/out/money/closing columns, search plus
 * location and category filters, day-expansion with the spine/recessive-
 * child treatment `docs/design.md` describes. Same fetching/LoadState/
 * presentational split as `ledger-shell.tsx`.
 *
 * Category is ticket 41's owner-managed Category, not the reference's fixed
 * food/drinks/snacks list — split out of this ticket during `/build`
 * (2026-08-12) once that field turned out to have no equivalent in this
 * codebase's domain model.
 */

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ErrorState, PermissionDenied, EmptyFiltered, LoadingTable } from "@/components/patterns/states";
import { EditableNum, type EditableNumState } from "./editable-num";
import {
  summariseAmendment,
  confirmMessage,
  farBackMonths,
  type ConfirmCase,
  type LedgerRowAccessors,
} from "./amend-feedback";
import { AmendToast, type AmendToastState } from "./amend-toast";
import { ChevronRight, Search, X } from "lucide-react";
import { money } from "@/shared/money";

export type ProductLedgerDayData = {
  date: string;
  opening: number;
  produced: number;
  received: number;
  transferredIn: number;
  sold: number;
  transferredOut: number;
  nonSales: number;
  // The three reasons behind nonSales. The combined column is what she
  // reads; these decide whether an edit to it is unambiguous.
  wasted: number;
  consumed: number;
  givenAway: number;
  // Editable-ledger T3: signed owner corrections to opening/closing. Shown
  // as its own column so the row still reconciles on screen — a correction
  // that moved closing without appearing anywhere would read as a bug.
  corrected: number;
  salesValueMinor: number;
  closing: number;
};

export type ProductLedgerRowData = {
  productId: string;
  productName: string;
  locationId: string;
  locationCode: string;
  categoryId: string | null;
  openingQty: number;
  produced: number;
  received: number;
  transferredIn: number;
  sold: number;
  transferredOut: number;
  nonSales: number;
  wasted: number;
  consumed: number;
  givenAway: number;
  corrected: number;
  salesValueMinor: number;
  unitCostMinor: number | null;
  isEstimated: boolean;
  sellingPriceMinor: number | null;
  costOfSalesMinor: number | null;
  profitMinor: number | null;
  closingQty: number;
  closingValueMinor: number | null;
  days: ProductLedgerDayData[];
};

export type ProductLedgerFilterOption = { id: string; name: string };

export type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "denied" }
  | { status: "ready"; rows: ProductLedgerRowData[]; categories: ProductLedgerFilterOption[]; locations: ProductLedgerFilterOption[] };

async function fetchCategoriesAndLocations(): Promise<{
  categories: ProductLedgerFilterOption[];
  locations: ProductLedgerFilterOption[];
} | null> {
  try {
    const response = await fetch("/api/catalogue");
    if (!response.ok) return null;
    const body = await response.json();
    if (!Array.isArray(body?.categories) || !Array.isArray(body?.locations)) return null;
    return {
      categories: body.categories.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })),
      locations: body.locations.map((l: { id: string; name: string }) => ({ id: l.id, name: l.name })),
    };
  } catch {
    return null;
  }
}

async function fetchProductLedger(periodStart: string, periodEnd: string): Promise<LoadState> {
  try {
    const [rowsResponse, filters] = await Promise.all([
      fetch(
        `/api/ledger/product?${new URLSearchParams({ periodStart, periodEnd }).toString()}`,
      ),
      fetchCategoriesAndLocations(),
    ]);
    if (rowsResponse.status === 403) return { status: "denied" };
    if (!rowsResponse.ok || !filters) return { status: "error" };
    const body = await rowsResponse.json();
    if (!Array.isArray(body?.rows)) return { status: "error" };
    return { status: "ready", rows: body.rows, categories: filters.categories, locations: filters.locations };
  } catch {
    return { status: "error" };
  }
}

export function ProductLedger({ periodStart, periodEnd }: { periodStart: string; periodEnd: string }) {
  const [attempt, setAttempt] = useState(0);
  return (
    <ProductLedgerForAttempt
      key={`${periodStart}:${periodEnd}:${attempt}`}
      periodStart={periodStart}
      periodEnd={periodEnd}
      onRetry={() => setAttempt((a) => a + 1)}
    />
  );
}

function ProductLedgerForAttempt({
  periodStart,
  periodEnd,
  onRetry,
}: {
  periodStart: string;
  periodEnd: string;
  onRetry: () => void;
}) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    const start = new Date(`${periodStart}T00:00:00`).toISOString();
    const end = new Date(`${periodEnd}T23:59:59.999`).toISOString();
    fetchProductLedger(start, end).then((result) => {
      if (!cancelledRef.current) setState(result);
    });
    return () => {
      cancelledRef.current = true;
    };
  }, [periodStart, periodEnd]);

  /**
   * T4.2 — refresh **without remounting**.
   *
   * An edit changes other cells: closing, every later day's opening, and
   * the money columns. So the table has to re-read after a save, and the
   * obvious way to do that — bumping the `attempt` key above — destroys
   * the component and takes her expanded row, scroll position, search text
   * and filters with it. Ten edits in sequence would mean ten scroll-
   * position losses, which quietly defeats C7's "edit ten cells without a
   * confirm click".
   *
   * Replacing `state.rows` in place keeps every one of those, because the
   * view never unmounts. Only the figures change, which is exactly what
   * the edit changed.
   */
  const replaceRows = (rows: ProductLedgerRowData[]) => {
    setState((current) => (current.status === "ready" ? { ...current, rows } : current));
  };

  const refresh = async () => {
    const start = new Date(`${periodStart}T00:00:00`).toISOString();
    const end = new Date(`${periodEnd}T23:59:59.999`).toISOString();
    const result = await fetchProductLedger(start, end);
    if (!cancelledRef.current && result.status === "ready") replaceRows(result.rows);
  };

  const startIso = new Date(`${periodStart}T00:00:00`).toISOString();
  const endIso = new Date(`${periodEnd}T23:59:59.999`).toISOString();

  return (
    <ProductLedgerView
      state={state}
      onRetry={onRetry}
      onReplaceRows={replaceRows}
      onRefresh={refresh}
      periodStart={startIso}
      periodEnd={endIso}
    />
  );
}

const FROZEN = "sticky left-0 z-20 bg-card group-hover:bg-muted/40 border-r";
const FROZEN_HEAD = "sticky left-0 z-30 bg-muted border-r";
const CHILD_ROW = "bg-muted/25 text-[12px]";
const CHILD_FROZEN = "sticky left-0 z-20 bg-muted/25 border-r";
const CHILD_LAST = "border-b-2 border-b-neutral-300";

function Spine({ label }: { label: string }) {
  return (
    <span className="flex items-stretch gap-2 pl-[7px]">
      <span className="w-px shrink-0 bg-neutral-300" aria-hidden />
      <span className="py-0.5 pl-2 text-muted-foreground">{label}</span>
    </span>
  );
}

function Num({
  value,
  asMoney,
  muted,
  tone,
  strong,
  signed,
}: {
  value: number | null;
  asMoney?: boolean;
  muted?: boolean;
  tone?: "danger";
  strong?: boolean;
  /** Show an explicit + on positive figures. Only the corrections column
   * uses this: a correction's direction is the whole point of it, and an
   * unsigned "4" next to a delivery of 4 reads as another delivery. */
  signed?: boolean;
}) {
  if (value === null) return <span className="text-muted-foreground">—</span>;
  if (value === 0 && muted) return <span className="text-muted-foreground">—</span>;
  const cls = tone === "danger" ? "text-danger" : "";
  const rendered = asMoney ? money(value) : value;
  return (
    <span className={`tabular ${cls} ${strong ? "font-medium" : ""}`}>
      {signed && value > 0 ? `+${rendered}` : rendered}
    </span>
  );
}

function Th({ children, border, align = "right" }: { children?: React.ReactNode; border?: boolean; align?: "left" | "right" }) {
  return (
    <th className={`px-2 py-2 font-medium whitespace-nowrap ${align === "right" ? "text-right" : "text-left"} ${border ? "border-l" : ""}`}>
      {children}
    </th>
  );
}

function Td({ children, border, align = "right" }: { children?: React.ReactNode; border?: boolean; align?: "left" | "right" }) {
  return (
    <td className={`px-2 py-2 whitespace-nowrap ${align === "right" ? "text-right" : "text-left"} ${border ? "border-l" : ""}`}>
      {children}
    </td>
  );
}

/**
 * Ledger column -> movement reason. `transferredIn`/`transferredOut` are
 * the two signed directions of one reason, and `nonSales` folds three
 * (wasted/consumed/given_away); editing that total needs a reason to write
 * against, and `wasted` is the one the owner means when she says a figure
 * on that column is wrong — the other two are recorded deliberately at the
 * time, with a person attached.
 */
/** "1 wasted, 1 staff meal" — names what the combined figure is made of. */
function nonSalesBreakdown(day: ProductLedgerDayData): string {
  const parts: string[] = [];
  if (day.wasted) parts.push(`${day.wasted} wasted`);
  if (day.consumed) parts.push(`${day.consumed} staff meal${day.consumed === 1 ? "" : "s"}`);
  if (day.givenAway) parts.push(`${day.givenAway} given away`);
  return parts.join(", ");
}

function movementReasonFor(column: string): string {
  switch (column) {
    case "produced":
      return "produced";
    case "received":
      return "received";
    case "transferredIn":
    case "transferredOut":
      return "transferred";
    case "sold":
      return "sold";
    case "nonSales":
      return "wasted";
    default:
      return column;
  }
}

// How amend-feedback reads a Product row (T6.5). The Store tab supplies its
// own; the summariser knows neither shape.
const PRODUCT_ROW_ACCESSORS: LedgerRowAccessors<ProductLedgerRowData> = {
  identify: (r) => r.productId,
  describe: (r) => r.productName,
  closingOf: (r) => r.closingQty,
  profitOf: (r) => r.profitMinor,
  daysOf: (r) => r.days.map((d) => ({ date: d.date, closing: d.closing })),
};

function Chevron({ open }: { open: boolean }) {
  return (
    <ChevronRight
      className={`size-3.5 shrink-0 text-muted-foreground transition-transform duration-100 ${open ? "rotate-90" : ""}`}
    />
  );
}

export function ProductLedgerView({
  state,
  onRetry,
  onReplaceRows,
  onRefresh,
  periodStart = "",
  periodEnd = "",
  initialExpandedRowKey = null,
  initialQuery = "",
}: {
  state: LoadState;
  onRetry: () => void;
  /** Replaces the rows in place after an edit, without remounting — see
   * ProductLedgerForAttempt's note on why remounting is wrong here. Absent
   * in Storybook, which stories the view without a network. */
  onReplaceRows?: (rows: ProductLedgerRowData[]) => void;
  onRefresh?: () => Promise<void>;
  /** ISO instants for the period on screen — the amend endpoint recomputes
   * and returns exactly this window, so the edit and the refresh agree. */
  periodStart?: string;
  periodEnd?: string;
  /** Storybook only, for the "row expanded" state — the real page always
   * starts collapsed. */
  initialExpandedRowKey?: string | null;
  /** Storybook only, for the "filtered to zero rows" state — the real page
   * always starts with an empty search. */
  initialQuery?: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [locationId, setLocationId] = useState<string>("all");
  const [categoryId, setCategoryId] = useState<string>("all");
  const [expanded, setExpanded] = useState<string | null>(initialExpandedRowKey);

  const allRows = useMemo(() => (state.status === "ready" ? state.rows : []), [state]);

  // T4.2 — per-cell in-flight and failure state, keyed by row+column so two
  // edits in flight at once never mask each other. Errors live on the cell
  // rather than in a toast: she needs to know *which* figure failed.
  const [cellState, setCellState] = useState<Record<string, { state: EditableNumState; message?: string }>>({});
  const [toast, setToast] = useState<AmendToastState | null>(null);
  const [confirming, setConfirming] = useState<
    { c: ConfirmCase; proceed: () => void } | null
  >(null);
  // §3.3's two-button choice, pending her answer. Not a confirmation
  // dialog and not a reason prompt: two buttons naming two different real
  // situations, on this one cell only.
  const [soldChoice, setSoldChoice] = useState<{
    productName: string;
    from: number;
    to: number;
    revenueMinor: number;
    unitPriceMinor: number | null;
    choose: (treatment: "stock" | "stockAndMoney") => void;
  } | null>(null);

  const editingEnabled = !!onReplaceRows;

  async function submit(cellKey: string, body: Record<string, unknown>, productId: string) {
    setCellState((s) => ({ ...s, [cellKey]: { state: "saving" } }));
    try {
      const response = await fetch("/api/ledger/amend", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...body, periodStart, periodEnd }),
      });
      if (!response.ok) {
        setCellState((s) => ({
          ...s,
          [cellKey]: { state: "error", message: "Couldn't save. The figure is unchanged." },
        }));
        return;
      }
      const payload = (await response.json()) as {
        rows: ProductLedgerRowData[];
        previousRows: ProductLedgerRowData[];
      };
      onReplaceRows?.(payload.rows);
      setCellState((s) => {
        const next = { ...s };
        delete next[cellKey];
        return next;
      });

      // C7 stage two: real figures, and Undo. Undo is itself an amendment
      // (C8) — it re-submits the previous value rather than deleting
      // anything, so the trail records both moves.
      const summary = summariseAmendment({
        itemId: productId,
        previousRows: payload.previousRows,
        rows: payload.rows,
        accessors: PRODUCT_ROW_ACCESSORS,
      });
      const previousValue = body["newValue"];
      setToast({
        message: summary.message,
        undo: () => {
          setToast(null);
          void submit(cellKey, { ...body, newValue: body["undoValue"] ?? previousValue }, productId);
        },
      });
    } catch {
      setCellState((s) => ({
        ...s,
        [cellKey]: { state: "error", message: "Couldn't save. The figure is unchanged." },
      }));
    }
  }

  /**
   * One ledger cell, wired to its Kind (plan §3.1). This is where C1's
   * "one write path per kind" pays off: a column declares which kind it
   * is and the semantics follow, rather than each cell growing its own
   * handler.
   *
   * Kind A columns state the day's total for a reason; Kind B (opening,
   * closing) state a derived position. `corrected` is deliberately *not*
   * editable — it is the audit trail of corrections already made, and
   * editing a correction directly rather than restating the figure it
   * corrects would put two mechanisms on one number.
   */
  function dayCell(
    row: ProductLedgerRowData,
    day: ProductLedgerDayData,
    column:
      | "opening"
      | "closing"
      | "produced"
      | "received"
      | "transferredIn"
      | "transferredOut"
      | "sold"
      | "nonSales"
      | "corrected",
  ) {
    const value = day[column];
    const cellKey = `${row.productId}:${row.locationId}:${day.date}:${column}`;
    const cell = cellState[cellKey];

    if (column === "corrected") {
      return (
        <EditableNum
          value={value}
          muted
          signed
          notEditableReason="This is a correction already recorded. Edit the figure it corrects instead."
        />
      );
    }

    const isPosition = column === "opening" || column === "closing";
    const label = `${column} for ${row.productName} on ${day.date}`;

    // Non-sales folds three reasons that mean different things — wastage is
    // a loss, a staff meal is a benefit with a person attached, a giveaway
    // is a decision. Plan §3.1 says to edit the thing she is looking at
    // when there is exactly one thing to edit, and to defer only when it is
    // genuinely ambiguous which she meant. That is precisely this split:
    //
    //   one reason non-zero  -> unambiguous, edit it in place. The common
    //                           case, and she never learns the column had
    //                           a breakdown.
    //   several non-zero     -> silently picking one would file a staff
    //                           meal under wastage and quietly overstate
    //                           loss for months. Defer to the breakdown.
    //   none                 -> nothing recorded yet, so nothing to
    //                           disambiguate: wastage is the sensible
    //                           default for a figure she is adding.
    //
    // This is the one place the app declines to take an edit, and it says
    // why rather than being inert.
    if (column === "nonSales") {
      const present = ([
        ["wasted", day.wasted],
        ["consumed", day.consumed],
        ["given_away", day.givenAway],
      ] as const).filter(([, qty]) => qty !== 0);

      if (present.length > 1) {
        return (
          <EditableNum
            value={value}
            muted
            tone="danger"
            notEditableReason={`${nonSalesBreakdown(day)} — correct one of them in the breakdown below.`}
          />
        );
      }

      const reason = present[0]?.[0] ?? "wasted";
      return (
        <EditableNum
          value={value}
          muted
          tone="danger"
          state={cell?.state}
          errorMessage={cell?.message}
          label={label}
          onCommit={
            editingEnabled
              ? (next) => {
                  const editedDate = new Date(`${day.date}T00:00:00.000Z`);
                  const months = farBackMonths(editedDate);
                  amend({
                    cellKey,
                    productId: row.productId,
                    escalation: months !== null ? { kind: "farBack", months } : null,
                    body: {
                      kind: "dayTotal",
                      itemType: "product",
                      itemId: row.productId,
                      locationId: row.locationId,
                      date: day.date,
                      reason,
                      newValue: next,
                      undoValue: value,
                    },
                  });
                }
              : undefined
          }
        />
      );
    }

    return (
      <EditableNum
        value={value}
        muted={column !== "sold" && !isPosition}
        state={cell?.state}
        errorMessage={cell?.message}
        label={label}
        onCommit={
          editingEnabled
            ? (next) => {
                const editedDate = new Date(`${day.date}T00:00:00.000Z`);
                const months = farBackMonths(editedDate);
                const escalation: ConfirmCase | null = isPosition
                  ? { kind: "derivedPosition" }
                  : months !== null
                    ? { kind: "farBack", months }
                    : null;
                // §3.3 — reducing `sold` has no neutral option, so ask.
                // Only on a reduction: raising it cannot invent a sale.
                if (column === "sold" && next < value) {
                  setSoldChoice({
                    productName: row.productName,
                    from: value,
                    to: next,
                    revenueMinor: day.salesValueMinor,
                    unitPriceMinor: row.sellingPriceMinor,
                    choose: (treatment) => {
                      setSoldChoice(null);
                      amend({
                        cellKey,
                        productId: row.productId,
                        escalation,
                        body: {
                          kind: "dayTotal",
                          itemType: "product",
                          itemId: row.productId,
                          locationId: row.locationId,
                          date: day.date,
                          reason: "sold",
                          newValue: next,
                          undoValue: value,
                          revenueTreatment: treatment,
                        },
                      });
                    },
                  });
                  return;
                }
                amend({
                  cellKey,
                  productId: row.productId,
                  escalation,
                  body: isPosition
                    ? {
                        kind: "derivedPosition",
                        itemType: "product",
                        itemId: row.productId,
                        locationId: row.locationId,
                        date: day.date,
                        position: column,
                        newValue: next,
                        undoValue: value,
                      }
                    : {
                        kind: "dayTotal",
                        itemType: "product",
                        itemId: row.productId,
                        locationId: row.locationId,
                        date: day.date,
                        reason: movementReasonFor(column),
                        newValue: next,
                        undoValue: value,
                      },
                });
              }
            : undefined
        }
      />
    );
  }

  /**
   * A period-total quantity on the parent row.
   *
   * Deliberately not editable. The figure spans every day in the period, so
   * "received should be 12" has no single date to write a movement against
   * — and picking one would put the correction on a day she did not name.
   * Rather than being silently inert it says so, and points at the day
   * rows, where the same edit is unambiguous.
   */
  function periodCell(
    row: ProductLedgerRowData,
    value: number,
    opts: { muted?: boolean; strong?: boolean; tone?: "danger" } = {},
  ) {
    return (
      <EditableNum
        value={value}
        muted={opts.muted}
        strong={opts.strong}
        tone={opts.tone}
        notEditableReason={
          editingEnabled
            ? `This is the total for the whole period. Expand ${row.productName} and correct the day.`
            : undefined
        }
      />
    );
  }

  /**
   * Kind C — a scalar on the product itself, edited from the period row.
   *
   * Price and unit cost are the only two figures on that row that *can* be
   * edited there: everything else is a period aggregate spanning many days,
   * with no single date to write a movement against. Those stay read-only
   * and say so, rather than being silently inert (expand the row and edit
   * the day).
   *
   * Not retroactive, and T8 is what makes that true — past sales carry
   * their own snapshotted cost, so changing the price here moves the figure
   * from now on without reshaping a closed month.
   */
  function scalarCell(row: ProductLedgerRowData, field: "sellingPriceMinor" | "unitCostMinor") {
    const value = field === "sellingPriceMinor" ? row.sellingPriceMinor : row.unitCostMinor;
    const cellKey = `${row.productId}:${row.locationId}:${field}`;
    const cell = cellState[cellKey];

    return (
      <EditableNum
        value={value}
        asMoney
        state={cell?.state}
        errorMessage={cell?.message}
        label={`${field === "sellingPriceMinor" ? "selling price" : "unit cost"} for ${row.productName}`}
        onCommit={
          editingEnabled
            ? (next) =>
                amend({
                  cellKey,
                  productId: row.productId,
                  escalation: null,
                  body: {
                    kind: "scalar",
                    recordType: "Product",
                    recordId: row.productId,
                    field: field === "sellingPriceMinor" ? "priceMinor" : "lastKnownCostMinor",
                    locationId: row.locationId,
                    newValue: next,
                    undoValue: value,
                  },
                })
            : undefined
        }
      />
    );
  }

  /** Runs the edit, pausing on C7's three escalations first. */
  function amend(input: {
    cellKey: string;
    productId: string;
    body: Record<string, unknown>;
    escalation: ConfirmCase | null;
  }) {
    const run = () => void submit(input.cellKey, input.body, input.productId);
    if (input.escalation) {
      setConfirming({ c: input.escalation, proceed: () => { setConfirming(null); run(); } });
      return;
    }
    run();
  }

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allRows.filter(
      (r) =>
        (locationId === "all" || r.locationId === locationId) &&
        (categoryId === "all" || r.categoryId === categoryId) &&
        (!q || r.productName.toLowerCase().includes(q)),
    );
  }, [allRows, query, locationId, categoryId]);

  const filtered = query !== "" || locationId !== "all" || categoryId !== "all";
  const clear = () => {
    setQuery("");
    setLocationId("all");
    setCategoryId("all");
  };

  if (state.status === "loading") {
    return (
      <div data-testid="product-ledger-loading">
        <LoadingTable summary={0} rows={8} columns={9} />
      </div>
    );
  }

  if (state.status === "denied") {
    return (
      <div className="rounded-lg border bg-card p-4">
        <PermissionDenied
          title="The product ledger is owner-only"
          body="Cost of sales and profit are financial figures. Ask the owner if you need to see them."
        />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="rounded-lg border bg-card p-4">
        <ErrorState what="the product ledger" onRetry={onRetry} />
      </div>
    );
  }

  const costOfSales = (r: ProductLedgerRowData) => r.costOfSalesMinor;

  return (
    <div className="rounded-lg border bg-card" data-testid="product-ledger">
      <AmendToast toast={toast} onDismiss={() => setToast(null)} />

      {/* §3.3 — the one place the app asks. Two buttons naming two real
          situations, not a confirmation and not a reason prompt. Cancelling
          leaves the figure untouched, which is itself one of the honest
          answers. */}
      {soldChoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="sold-choice-title"
            className="max-w-md rounded-lg border bg-card p-4 shadow-lg"
            data-testid="sold-choice"
          >
            <h2 id="sold-choice-title" className="text-sm font-medium">
              Sold: {soldChoice.from} → {soldChoice.to}
            </h2>
            <p className="mt-1.5 text-[13px] text-muted-foreground">
              Revenue recorded for these is {money(soldChoice.revenueMinor)}.
            </p>
            <div className="mt-4 grid gap-2">
              <button
                onClick={() => soldChoice.choose("stock")}
                className="rounded-md border px-3 py-2 text-left focus-visible:ring-2 focus-visible:ring-ring/50"
                data-testid="sold-choice-stock"
              >
                <span className="block text-[13px] font-medium">Stock only</span>
                <span className="block text-[12px] text-muted-foreground">
                  {soldChoice.from - soldChoice.to} never left the shelf (miscount, breakage).
                  Revenue unchanged.
                </span>
              </button>
              <button
                onClick={() => soldChoice.choose("stockAndMoney")}
                className="rounded-md border px-3 py-2 text-left focus-visible:ring-2 focus-visible:ring-ring/50"
                data-testid="sold-choice-stock-and-money"
              >
                <span className="block text-[13px] font-medium">Stock and money</span>
                <span className="block text-[12px] text-muted-foreground">
                  These {soldChoice.from - soldChoice.to} were never sold.
                  {soldChoice.unitPriceMinor !== null && (
                    <>
                      {" "}
                      Revenue drops to{" "}
                      {money(
                        soldChoice.revenueMinor -
                          (soldChoice.from - soldChoice.to) * soldChoice.unitPriceMinor,
                      )}
                      .
                    </>
                  )}
                </span>
              </button>
            </div>
            <div className="mt-3 flex justify-end">
              <button
                onClick={() => setSoldChoice(null)}
                className="text-[13px] text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
                data-testid="sold-choice-cancel"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* C7's three escalations. Disclosure, never a permission gate — the
          confirm button always proceeds (D6: warn, never block). */}
      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="amend-confirm-title"
            className="max-w-md rounded-lg border bg-card p-4 shadow-lg"
            data-testid="amend-confirm"
          >
            <h2 id="amend-confirm-title" className="text-sm font-medium">
              {confirmMessage(confirming.c).title}
            </h2>
            <p className="mt-1.5 text-[13px] text-muted-foreground">
              {confirmMessage(confirming.c).body}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setConfirming(null)}
                className="rounded-md border px-3 py-1.5 text-[13px] focus-visible:ring-2 focus-visible:ring-ring/50"
                data-testid="amend-confirm-cancel"
              >
                Cancel
              </button>
              <button
                onClick={confirming.proceed}
                className="rounded-md bg-primary px-3 py-1.5 text-[13px] font-medium text-primary-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
                data-testid="amend-confirm-proceed"
              >
                {confirmMessage(confirming.c).confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
        <div className="relative min-w-48 flex-1">
          <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products"
            className="h-8 pl-8 text-[13px]"
            data-testid="product-ledger-search"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground"
              aria-label="Clear search"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
        <Select value={locationId} onValueChange={setLocationId}>
          <SelectTrigger className="h-8 w-36 text-[13px]" data-testid="product-ledger-location-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Both locations</SelectItem>
            {state.locations.map((l) => (
              <SelectItem key={l.id} value={l.id}>
                {l.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger className="h-8 w-32 text-[13px]" data-testid="product-ledger-category-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {state.categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="tabular ml-auto shrink-0 text-xs text-muted-foreground">
          {rows.length === allRows.length ? `${allRows.length} rows` : `${rows.length} of ${allRows.length}`}
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="px-4 py-10">
          {filtered ? (
            <EmptyFiltered onClear={clear} noun="products" />
          ) : (
            <p className="text-center text-sm text-muted-foreground">No movements in this period.</p>
          )}
        </div>
      ) : (
        // No overflow-x-auto wrapper — see record-table.tsx's comment on
        // why that would break the thead's sticky positioning.
        <>
          <table className="w-full min-w-[1260px] text-[13px]">
            <thead className="sticky top-0 z-10">
              <tr className="border-b bg-muted text-[11px] text-muted-foreground">
                <th className={`${FROZEN_HEAD} px-3 py-1.5 text-left font-medium`}>Item</th>
                <th className="border-l px-2 py-1.5 text-center font-medium" colSpan={2}>Opening</th>
                <th className="border-l px-2 py-1.5 text-center font-medium" colSpan={3}>In</th>
                <th className="border-l px-2 py-1.5 text-center font-medium" colSpan={4}>Out</th>
                <th className="border-l px-2 py-1.5 text-center font-medium" colSpan={5}>Money</th>
                <th className="border-l px-2 py-1.5 text-center font-medium" colSpan={2}>Closing</th>
              </tr>
              <tr className="border-b bg-muted text-[11px] text-muted-foreground">
                <th className={`${FROZEN_HEAD} px-3 py-2 text-left font-medium`}>Product</th>
                <Th border>Qty</Th>
                <Th>Value</Th>
                <Th border>Produced</Th>
                <Th>Received</Th>
                <Th>Transf. in</Th>
                <Th border>Sold</Th>
                <Th>Transf. out</Th>
                <Th>Non-sales</Th>
                <Th>Corrected</Th>
                <Th border>Sales value</Th>
                <Th>Unit cost</Th>
                <Th>Price</Th>
                <Th>Cost of sales</Th>
                <Th>Profit</Th>
                <Th border>Qty</Th>
                <Th>Value</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const cos = costOfSales(r);
                const p = r.profitMinor;
                const rowKey = `${r.productId}:${r.locationId}`;
                const open = expanded === rowKey;
                return (
                  <Fragment key={rowKey}>
                    <tr className="group border-b hover:bg-muted/40">
                      <td className={`${FROZEN} px-3 py-2`}>
                        <button
                          onClick={() => setExpanded(open ? null : rowKey)}
                          className="flex items-center gap-1.5 text-left"
                          aria-expanded={open}
                          data-testid={`product-ledger-row-${rowKey}`}
                        >
                          <Chevron open={open} />
                          <span>
                            <span className="font-medium">{r.productName}</span>
                            <span className="block text-[11px] capitalize text-muted-foreground">{r.locationCode}</span>
                          </span>
                        </button>
                      </td>
                      <Td border>{periodCell(r, r.openingQty)}</Td>
                      <Td>
                        <Num value={r.unitCostMinor === null ? null : r.unitCostMinor * r.openingQty} asMoney muted />
                      </Td>
                      <Td border>{periodCell(r, r.produced, { muted: true })}</Td>
                      <Td>{periodCell(r, r.received, { muted: true })}</Td>
                      <Td>{periodCell(r, r.transferredIn, { muted: true })}</Td>
                      <Td border>{periodCell(r, r.sold, { strong: true })}</Td>
                      <Td>{periodCell(r, r.transferredOut, { muted: true })}</Td>
                      <Td>{periodCell(r, r.nonSales, { muted: true, tone: "danger" })}</Td>
                      <Td><Num value={r.corrected} muted signed /></Td>
                      <Td border><Num value={r.salesValueMinor} asMoney strong /></Td>
                      <Td>
                        <span className="tabular">
                          {scalarCell(r, "unitCostMinor")}
                          {r.isEstimated && r.unitCostMinor !== null && (
                            <span className="ml-1 text-[10px] text-muted-foreground" title="Estimated at 60% of selling price">
                              est
                            </span>
                          )}
                        </span>
                      </Td>
                      <Td>{scalarCell(r, "sellingPriceMinor")}</Td>
                      <Td><Num value={cos} asMoney /></Td>
                      <Td>
                        {p === null ? (
                          <span className="text-muted-foreground" title="No recipe — per-unit cost unknown, so profit cannot be stated">
                            —
                          </span>
                        ) : (
                          <span className="tabular font-medium">{money(p)}</span>
                        )}
                      </Td>
                      <Td border><Num value={r.closingQty} strong /></Td>
                      <Td><Num value={r.closingValueMinor} asMoney /></Td>
                    </tr>

                    {open &&
                      r.days.map((d, i) => {
                        const last = i === r.days.length - 1;
                        return (
                          <tr key={`${rowKey}-${d.date}`} className={`${CHILD_ROW} ${last ? CHILD_LAST : "border-b"}`}>
                            <td className={`${CHILD_FROZEN} py-1.5 pr-3 pl-3`}>
                              <Spine label={d.date} />
                            </td>
                            <Td border>{dayCell(r, d, "opening")}</Td>
                            <Td />
                            <Td border>{dayCell(r, d, "produced")}</Td>
                            <Td>{dayCell(r, d, "received")}</Td>
                            <Td>{dayCell(r, d, "transferredIn")}</Td>
                            <Td border>{dayCell(r, d, "sold")}</Td>
                            <Td>{dayCell(r, d, "transferredOut")}</Td>
                            <Td>{dayCell(r, d, "nonSales")}</Td>
                            <Td>{dayCell(r, d, "corrected")}</Td>
                            <Td border><Num value={d.salesValueMinor} asMoney muted /></Td>
                            <Td /><Td /><Td /><Td />
                            <Td border>{dayCell(r, d, "closing")}</Td>
                            <Td />
                          </tr>
                        );
                      })}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
