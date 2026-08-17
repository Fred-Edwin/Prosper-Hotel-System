"use client";

/**
 * The Ledger's Store tab (ticket 42) — adapted from the design-reference
 * worktree's locked `StoreLedgerTable` (`ledger/tables.tsx`): one row per
 * ingredient per location, opening/purchased/out/closing columns, the
 * running-average cost-move indicator, search. Same fetching/LoadState/
 * presentational split as `product-ledger.tsx`, minus day-expansion — the
 * reference's Store ledger has no chevron, one row per ingredient for the
 * whole period is the full shape here.
 *
 * The reference shows no location split ("no location split shown in the
 * reference" per the ticket) but this codebase's ingredients can exist at
 * either location (transfers move them across), so a location filter is
 * added here, matching the Product ledger's pattern rather than the
 * reference verbatim.
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
  farBackMonths,
  type ConfirmCase,
  type LedgerRowAccessors,
} from "./amend-feedback";
import { AmendToast, AmendConfirm, type AmendToastState, type AmendConfirmState } from "./amend-toast";
import { ChevronRight, Search, X } from "lucide-react";
import { money } from "@/shared/money";

export type StoreLedgerDayData = {
  date: string;
  openingQty: number;
  purchasedQty: number;
  purchasedValueMinor: number;
  issuedToKitchen: number;
  transferredIn: number;
  transferredOut: number;
  spoilage: number;
  // Editable-ledger T6: signed owner corrections to opening/closing. Its
  // own column so the row still reconciles on screen — a correction that
  // moved closing without appearing anywhere would read as a bug.
  corrected: number;
  closingQty: number;
};

export type StoreLedgerRowData = {
  ingredientId: string;
  ingredientName: string;
  unitOfMeasure: string;
  locationId: string;
  locationCode: string;
  openingQty: number;
  purchasedQty: number;
  purchasedValueMinor: number;
  issuedToKitchen: number;
  transferredIn: number;
  transferredOut: number;
  spoilage: number;
  corrected: number;
  closingQty: number;
  closingValueMinor: number;
  unitCostMinor: number;
  previousUnitCostMinor: number;
  days: StoreLedgerDayData[];
};

export type StoreLedgerFilterOption = { id: string; name: string };

export type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "denied" }
  | { status: "ready"; rows: StoreLedgerRowData[]; locations: StoreLedgerFilterOption[] };

async function fetchLocations(): Promise<StoreLedgerFilterOption[] | null> {
  try {
    const response = await fetch("/api/catalogue");
    if (!response.ok) return null;
    const body = await response.json();
    if (!Array.isArray(body?.locations)) return null;
    return body.locations.map((l: { id: string; name: string }) => ({ id: l.id, name: l.name }));
  } catch {
    return null;
  }
}

async function fetchStoreLedger(periodStart: string, periodEnd: string): Promise<LoadState> {
  try {
    const [rowsResponse, locations] = await Promise.all([
      fetch(`/api/ledger/store?${new URLSearchParams({ periodStart, periodEnd }).toString()}`),
      fetchLocations(),
    ]);
    if (rowsResponse.status === 403) return { status: "denied" };
    if (!rowsResponse.ok || !locations) return { status: "error" };
    const body = await rowsResponse.json();
    if (!Array.isArray(body?.rows)) return { status: "error" };
    return { status: "ready", rows: body.rows, locations };
  } catch {
    return { status: "error" };
  }
}

export function StoreLedger({ periodStart, periodEnd }: { periodStart: string; periodEnd: string }) {
  const [attempt, setAttempt] = useState(0);
  return (
    <StoreLedgerForAttempt
      key={`${periodStart}:${periodEnd}:${attempt}`}
      periodStart={periodStart}
      periodEnd={periodEnd}
      onRetry={() => setAttempt((a) => a + 1)}
    />
  );
}

function StoreLedgerForAttempt({
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
    fetchStoreLedger(start, end).then((result) => {
      if (!cancelledRef.current) setState(result);
    });
    return () => {
      cancelledRef.current = true;
    };
  }, [periodStart, periodEnd]);

  // Replaces rows in place after an edit rather than remounting: remounting
  // would collapse the expanded row she is working inside and throw away
  // her scroll position mid-reconciliation. Same reasoning as the Product
  // tab's onReplaceRows.
  const replaceRows = (rows: StoreLedgerRowData[]) =>
    setState((s) => (s.status === "ready" ? { ...s, rows } : s));

  return (
    <StoreLedgerView
      state={state}
      onRetry={onRetry}
      onReplaceRows={replaceRows}
      periodStart={new Date(`${periodStart}T00:00:00`).toISOString()}
      periodEnd={new Date(`${periodEnd}T23:59:59.999`).toISOString()}
    />
  );
}

const FROZEN = "sticky left-0 z-20 bg-card group-hover:bg-muted/40 border-r";
const FROZEN_HEAD = "sticky left-0 z-30 bg-muted border-r";

function Num({
  value,
  asMoney,
  muted,
  tone,
  strong,
}: {
  value: number;
  asMoney?: boolean;
  muted?: boolean;
  tone?: "danger";
  strong?: boolean;
}) {
  if (value === 0 && muted) return <span className="text-muted-foreground">—</span>;
  const cls = tone === "danger" ? "text-danger" : "";
  return (
    <span className={`tabular ${cls} ${strong ? "font-medium" : ""}`}>{asMoney ? money(value) : value}</span>
  );
}

function Th({ children, border }: { children?: React.ReactNode; border?: boolean }) {
  return (
    <th className={`px-2 py-2 text-right font-medium whitespace-nowrap ${border ? "border-l" : ""}`}>
      {children}
    </th>
  );
}

function Td({ children, border }: { children?: React.ReactNode; border?: boolean }) {
  return (
    <td className={`px-2 py-2 text-right whitespace-nowrap ${border ? "border-l" : ""}`}>{children}</td>
  );
}

// Which movement reason a Store column states the day's total for.
// `transferred` carries both directions on one reason — the sign decides
// which, and the query splits them (see
// sumIngredientMovementsByReasonAtLocationInPeriod).
function storeReasonFor(column: string): string {
  switch (column) {
    case "purchasedQty":
      return "received";
    case "issuedToKitchen":
      return "issued";
    case "transferredIn":
    case "transferredOut":
      return "transferred";
    case "spoilage":
      return "wasted";
    default:
      return column;
  }
}

function Chevron({ open }: { open: boolean }) {
  return (
    <ChevronRight
      className={`size-3.5 shrink-0 text-muted-foreground transition-transform duration-100 ${open ? "rotate-90" : ""}`}
    />
  );
}

// How amend-feedback reads a Store row (T6.5). No profit figure on this
// tab, so profitOf returns null and the profit clause drops out of the
// toast sentence.
const STORE_ROW_ACCESSORS: LedgerRowAccessors<StoreLedgerRowData> = {
  identify: (r) => `${r.ingredientId}:${r.locationId}`,
  describe: (r) => r.ingredientName,
  closingOf: (r) => r.closingQty,
  profitOf: () => null,
  daysOf: (r) => r.days.map((d) => ({ date: d.date, closing: d.closingQty })),
};

export function StoreLedgerView({
  state,
  onRetry,
  onReplaceRows,
  periodStart = "",
  periodEnd = "",
  initialExpandedRowKey = null,
  initialQuery = "",
}: {
  state: LoadState;
  onRetry: () => void;
  /** Replaces the rows in place after an edit, without remounting. Absent
   * in Storybook, which stories the view without a network — and its
   * absence is also what makes the table read-only there. */
  onReplaceRows?: (rows: StoreLedgerRowData[]) => void;
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
  const [expanded, setExpanded] = useState<string | null>(initialExpandedRowKey);

  const allRows = useMemo(() => (state.status === "ready" ? state.rows : []), [state]);

  // Per-cell in-flight and failure state, keyed by row+day+column so two
  // edits in flight at once never mask each other. Errors live on the cell
  // rather than in the toast: she needs to know *which* figure failed.
  const [cellState, setCellState] = useState<Record<string, { state: EditableNumState; message?: string }>>({});
  const [toast, setToast] = useState<AmendToastState | null>(null);
  const [confirming, setConfirming] = useState<AmendConfirmState | null>(null);

  const editingEnabled = !!onReplaceRows;

  async function submit(
    cellKey: string,
    body: Record<string, unknown>,
    itemKey: string,
    extraClause?: string,
  ) {
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
        rows: StoreLedgerRowData[];
        previousRows: StoreLedgerRowData[];
      };
      onReplaceRows?.(payload.rows);
      setCellState((s) => {
        const next = { ...s };
        delete next[cellKey];
        return next;
      });

      const summary = summariseAmendment({
        itemId: itemKey,
        previousRows: payload.previousRows,
        rows: payload.rows,
        accessors: STORE_ROW_ACCESSORS,
        extraClause,
      });
      const previousValue = body["newValue"];
      setToast({
        message: summary.message,
        undo: () => {
          setToast(null);
          void submit(cellKey, { ...body, newValue: body["undoValue"] ?? previousValue }, itemKey);
        },
      });
    } catch {
      setCellState((s) => ({
        ...s,
        [cellKey]: { state: "error", message: "Couldn't save. The figure is unchanged." },
      }));
    }
  }

  function amend(input: {
    cellKey: string;
    itemKey: string;
    body: Record<string, unknown>;
    escalation: ConfirmCase | null;
    extraClause?: string;
  }) {
    const run = () => void submit(input.cellKey, input.body, input.itemKey, input.extraClause);
    if (input.escalation) {
      setConfirming({ c: input.escalation, proceed: () => { setConfirming(null); run(); } });
      return;
    }
    run();
  }

  /**
   * One day-level Store cell, wired to its Kind (plan §3.1).
   *
   * Kind A columns state the day's total for a reason; Kind B (opening,
   * closing) state a derived position. `corrected` is deliberately not
   * editable — it is the audit trail of corrections already made, and
   * editing a correction rather than restating the figure it corrects
   * would put two mechanisms on one number.
   */
  function dayCell(
    row: StoreLedgerRowData,
    day: StoreLedgerDayData,
    column:
      | "openingQty"
      | "closingQty"
      | "purchasedQty"
      | "issuedToKitchen"
      | "transferredIn"
      | "transferredOut"
      | "spoilage"
      | "corrected",
  ) {
    const value = day[column];
    const itemKey = `${row.ingredientId}:${row.locationId}`;
    const cellKey = `${itemKey}:${day.date}:${column}`;
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

    const isPosition = column === "openingQty" || column === "closingQty";
    const label = `${column} for ${row.ingredientName} on ${day.date}`;

    return (
      <EditableNum
        value={value}
        muted={!isPosition}
        tone={column === "spoilage" ? "danger" : undefined}
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

                // Purchase quantity: unit cost holds, value follows (plan
                // T6.4). "We got 12kg not 10kg" says nothing about the
                // price per kg, so the figure nobody typed is the one that
                // must not move. No confirm step — there is exactly one
                // sensible reading here, unlike §3.3's `sold` — but the
                // toast names what followed.
                const extraClause =
                  column === "purchasedQty" && row.unitCostMinor
                    ? `purchase value now ${money(next * row.unitCostMinor)}`
                    : undefined;

                amend({
                  cellKey,
                  itemKey,
                  escalation,
                  extraClause,
                  body: isPosition
                    ? {
                        kind: "derivedPosition",
                        itemType: "ingredient",
                        itemId: row.ingredientId,
                        locationId: row.locationId,
                        date: day.date,
                        position: column === "openingQty" ? "opening" : "closing",
                        newValue: next,
                        undoValue: value,
                      }
                    : {
                        kind: "dayTotal",
                        itemType: "ingredient",
                        itemId: row.ingredientId,
                        locationId: row.locationId,
                        date: day.date,
                        reason: storeReasonFor(column),
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
   * "purchased should be 12" has no single date to write a movement
   * against, and picking one would put the correction on a day she did not
   * name. Rather than being silently inert it says so, and points at the
   * day rows where the same edit is unambiguous.
   */
  function periodCell(
    value: number,
    opts: { muted?: boolean; strong?: boolean; tone?: "danger"; asMoney?: boolean } = {},
  ) {
    return (
      <EditableNum
        value={value}
        asMoney={opts.asMoney}
        muted={opts.muted}
        strong={opts.strong}
        tone={opts.tone}
        notEditableReason="This is the total for the whole period. Expand the row and edit a day."
      />
    );
  }

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allRows.filter(
      (r) =>
        (locationId === "all" || r.locationId === locationId) &&
        (!q || r.ingredientName.toLowerCase().includes(q)),
    );
  }, [allRows, query, locationId]);

  const filtered = query !== "" || locationId !== "all";
  const clear = () => {
    setQuery("");
    setLocationId("all");
  };

  if (state.status === "loading") {
    return (
      <div data-testid="store-ledger-loading">
        <LoadingTable summary={0} rows={8} columns={7} />
      </div>
    );
  }

  if (state.status === "denied") {
    return (
      <div className="rounded-lg border bg-card p-4">
        <PermissionDenied
          title="The store ledger is owner-only"
          body="Ingredient cost and value are financial figures. Ask the owner if you need to see them."
        />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="rounded-lg border bg-card p-4">
        <ErrorState what="the store ledger" onRetry={onRetry} />
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card" data-testid="store-ledger">
      <AmendToast toast={toast} onDismiss={() => setToast(null)} />
      <AmendConfirm confirming={confirming} onCancel={() => setConfirming(null)} />

      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
        <div className="relative min-w-48 flex-1">
          <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search ingredients and supplies"
            className="h-8 pl-8 text-[13px]"
            data-testid="store-ledger-search"
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
          <SelectTrigger className="h-8 w-36 text-[13px]" data-testid="store-ledger-location-filter">
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
        <span className="tabular ml-auto shrink-0 text-xs text-muted-foreground">
          {rows.length === allRows.length ? `${allRows.length} rows` : `${rows.length} of ${allRows.length}`}
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="px-4 py-10">
          {filtered ? (
            <EmptyFiltered onClear={clear} noun="ingredients" />
          ) : (
            <p className="text-center text-sm text-muted-foreground">No movements in this period.</p>
          )}
        </div>
      ) : (
        // No overflow-x-auto wrapper — see record-table.tsx's comment on
        // why that would break the thead's sticky positioning.
        <>
          <table className="w-full min-w-[900px] text-[13px]">
            <thead className="sticky top-0 z-10">
              <tr className="border-b bg-muted text-[11px] text-muted-foreground">
                <th className={`${FROZEN_HEAD} px-3 py-1.5 text-left font-medium`}>Item</th>
                <th className="border-l px-2 py-1.5 text-center font-medium" colSpan={2}>Opening</th>
                <th className="border-l px-2 py-1.5 text-center font-medium" colSpan={3}>Purchased</th>
                <th className="border-l px-2 py-1.5 text-center font-medium" colSpan={4}>Out</th>
                <th className="border-l px-2 py-1.5 text-center font-medium" colSpan={1}>Corrected</th>
                <th className="border-l px-2 py-1.5 text-center font-medium" colSpan={2}>Closing</th>
              </tr>
              <tr className="border-b bg-muted text-[11px] text-muted-foreground">
                <th className={`${FROZEN_HEAD} px-3 py-2 text-left font-medium`}>Ingredient</th>
                <Th border>Qty</Th>
                <Th>Value</Th>
                <Th border>Qty</Th>
                <Th>Value</Th>
                <Th>Unit cost</Th>
                <Th border>To kitchen</Th>
                <Th>In</Th>
                <Th>Out</Th>
                <Th>Spoilage</Th>
                <Th border>Adj</Th>
                <Th border>Qty</Th>
                <Th>Value</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const rowKey = `${r.ingredientId}:${r.locationId}`;
                const costMoved = r.unitCostMinor - r.previousUnitCostMinor;
                const open = expanded === rowKey;
                return (
                  <Fragment key={rowKey}>
                    <tr className="group border-b hover:bg-muted/40" data-testid={`store-ledger-row-${rowKey}`}>
                      <td className={`${FROZEN} px-3 py-2`}>
                        <button
                          onClick={() => setExpanded(open ? null : rowKey)}
                          className="flex items-center gap-1.5 text-left focus-visible:ring-2 focus-visible:ring-ring/50"
                          aria-expanded={open}
                          data-testid={`store-ledger-expand-${rowKey}`}
                        >
                          <Chevron open={open} />
                          <span>
                            <span className="font-medium">{r.ingredientName}</span>
                            <span className="block text-[11px] text-muted-foreground">
                              per {r.unitOfMeasure}
                            </span>
                          </span>
                        </button>
                      </td>
                      <Td border>{periodCell(r.openingQty)}</Td>
                      <Td>{periodCell(r.openingQty * r.previousUnitCostMinor, { asMoney: true, muted: true })}</Td>
                      <Td border>{periodCell(r.purchasedQty, { muted: true })}</Td>
                      <Td>{periodCell(r.purchasedValueMinor, { asMoney: true, muted: true })}</Td>
                      <Td>
                        <span className="tabular">
                          {money(r.unitCostMinor)}
                          {costMoved !== 0 && (
                            <span
                              className={`ml-1 text-[11px] ${costMoved > 0 ? "text-danger" : "text-success"}`}
                              title={`Unit cost moved from ${money(r.previousUnitCostMinor)}`}
                            >
                              {costMoved > 0 ? "↑" : "↓"}
                              {money(Math.abs(costMoved))}
                            </span>
                          )}
                        </span>
                      </Td>
                      <Td border>{periodCell(r.issuedToKitchen, { strong: true })}</Td>
                      <Td>{periodCell(r.transferredIn, { muted: true })}</Td>
                      <Td>{periodCell(r.transferredOut, { muted: true })}</Td>
                      <Td>{periodCell(r.spoilage, { muted: true, tone: "danger" })}</Td>
                      <Td border>
                        <EditableNum
                          value={r.corrected}
                          muted
                          signed
                          notEditableReason="This is a correction already recorded. Edit the figure it corrects instead."
                        />
                      </Td>
                      <Td border>{periodCell(r.closingQty, { strong: true })}</Td>
                      <Td>{periodCell(r.closingValueMinor, { asMoney: true, strong: true })}</Td>
                    </tr>

                    {open &&
                      r.days.map((day) => (
                        <tr
                          key={`${rowKey}:${day.date}`}
                          className="group border-b bg-muted/20 text-muted-foreground"
                          data-testid={`store-ledger-day-${rowKey}-${day.date}`}
                        >
                          <td className={`${FROZEN} py-1.5 pr-3 pl-9 text-[12px]`}>{day.date}</td>
                          <Td border>{dayCell(r, day, "openingQty")}</Td>
                          <Td>
                            <Num value={day.openingQty * r.unitCostMinor} asMoney muted />
                          </Td>
                          <Td border>{dayCell(r, day, "purchasedQty")}</Td>
                          <Td>
                            <Num value={day.purchasedValueMinor} asMoney muted />
                          </Td>
                          <Td />
                          <Td border>{dayCell(r, day, "issuedToKitchen")}</Td>
                          <Td>{dayCell(r, day, "transferredIn")}</Td>
                          <Td>{dayCell(r, day, "transferredOut")}</Td>
                          <Td>{dayCell(r, day, "spoilage")}</Td>
                          <Td border>{dayCell(r, day, "corrected")}</Td>
                          <Td border>{dayCell(r, day, "closingQty")}</Td>
                          <Td>
                            <Num value={day.closingQty * r.unitCostMinor} asMoney muted />
                          </Td>
                        </tr>
                      ))}
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
