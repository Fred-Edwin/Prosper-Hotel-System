"use client";

/**
 * The Ledger's Non-sales tab (ticket 43) — adapted from the design-reference
 * worktree's locked `NonSalesLedgerTable` (`ledger/tables.tsx`): one row per
 * wastage/staff-meal/complimentary entry, reason filter, search by item or
 * recorded-by, a totals footer, and the "not deducted from profit twice"
 * caption. Same fetching/LoadState/presentational split as `store-ledger.tsx`.
 * Unlike Store, there is no day- or item-level rollup here — each entry is
 * already the unit of record, so one row per entry for the whole period is
 * the full shape.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  fetchCascadePreview,
  farBackMonths,
  type ConfirmCase,
  type LedgerRowAccessors,
} from "./amend-feedback";
import { AmendToast, AmendConfirm, type AmendToastState, type AmendConfirmState } from "./amend-toast";
import { AmendedCell, cellKey as amendCellKey, type AmendedCells } from "./amend-history";
import { Search, X } from "lucide-react";
import { money } from "@/shared/money";

export type NonSalesReason = "wasted" | "consumed" | "given_away";

export const nonSalesReasonLabel: Record<NonSalesReason, string> = {
  wasted: "Wasted",
  consumed: "Staff meals",
  given_away: "Complimentary",
};

export type NonSalesLedgerRowData = {
  itemType: "product" | "ingredient";
  /**
   * Editable-ledger T7.4 — the movement this row *is*.
   *
   * Unlike every other tab, a non-sales row is a single movement rather
   * than a rollup, so its snapshotted cost and selling value are edited
   * on that record directly. Quantity still goes through the day-total
   * path, because a day with two wastage entries for one item has the
   * same "which row absorbs it" question every other tab has.
   */
  movementId: string;
  itemId: string;
  itemName: string;
  locationId: string;
  locationCode: string;
  occurredAt: string;
  reason: NonSalesReason;
  quantity: number;
  costBasisMinor: number | null;
  isEstimated: boolean | null;
  sellingValueMinor: number | null;
  recordedBy: string;
};

export type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "denied" }
  | { status: "ready"; rows: NonSalesLedgerRowData[] };

async function fetchNonSalesLedger(periodStart: string, periodEnd: string): Promise<LoadState> {
  try {
    const response = await fetch(
      `/api/ledger/non-sales?${new URLSearchParams({ periodStart, periodEnd }).toString()}`,
    );
    if (response.status === 403) return { status: "denied" };
    if (!response.ok) return { status: "error" };
    const body = await response.json();
    if (!Array.isArray(body?.rows)) return { status: "error" };
    return { status: "ready", rows: body.rows };
  } catch {
    return { status: "error" };
  }
}

export function NonSalesLedger({ periodStart, periodEnd }: { periodStart: string; periodEnd: string }) {
  const [attempt, setAttempt] = useState(0);
  return (
    <NonSalesLedgerForAttempt
      key={`${periodStart}:${periodEnd}:${attempt}`}
      periodStart={periodStart}
      periodEnd={periodEnd}
      onRetry={() => setAttempt((a) => a + 1)}
    />
  );
}

function NonSalesLedgerForAttempt({
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
    fetchNonSalesLedger(start, end).then((result) => {
      if (!cancelledRef.current) setState(result);
    });
    return () => {
      cancelledRef.current = true;
    };
  }, [periodStart, periodEnd]);

  // Replaces rows in place after an edit rather than remounting, so her
  // scroll position and filters survive the save. Same reasoning as the
  // other three tabs' onReplaceRows.
  const replaceRows = (rows: NonSalesLedgerRowData[]) =>
    setState((s) => (s.status === "ready" ? { ...s, rows } : s));

  // T9.1 — which cells carry an edit.
  const [amended, setAmended] = useState<AmendedCells>({});
  const loadAmendments = useRef<() => void>(() => {});
  useEffect(() => {
    const start = new Date(`${periodStart}T00:00:00`).toISOString();
    const end = new Date(`${periodEnd}T23:59:59.999`).toISOString();
    const load = () => {
      fetch(`/api/ledger/amendments?${new URLSearchParams({ periodStart: start, periodEnd: end })}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((b) => {
          if (b?.cells && !cancelledRef.current) setAmended(b.cells);
        })
        .catch(() => {});
    };
    loadAmendments.current = load;
    load();
  }, [periodStart, periodEnd]);

  return (
    <NonSalesLedgerView
      state={state}
      onRetry={onRetry}
      amended={amended}
      onAmendmentsChanged={() => loadAmendments.current()}
      onReplaceRows={replaceRows}
      periodStart={new Date(`${periodStart}T00:00:00`).toISOString()}
      periodEnd={new Date(`${periodEnd}T23:59:59.999`).toISOString()}
    />
  );
}

const FROZEN = "sticky left-0 z-20 bg-card group-hover:bg-muted/40 border-r";
const FROZEN_HEAD = "sticky left-0 z-30 bg-muted border-r";

function Th({ children, align = "right" }: { children?: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th className={`px-2 py-2 font-medium whitespace-nowrap ${align === "right" ? "text-right" : "text-left"}`}>
      {children}
    </th>
  );
}

function Td({
  children,
  border,
  align = "right",
}: {
  children?: React.ReactNode;
  border?: boolean;
  align?: "left" | "right";
}) {
  return (
    <td
      className={`px-2 py-2 whitespace-nowrap ${align === "right" ? "text-right" : "text-left"} ${border ? "border-l" : ""}`}
    >
      {children}
    </td>
  );
}

/**
 * How amend-feedback reads a non-sales row (T7.5).
 *
 * A row here is one movement, so there is no closing position and no
 * cascade of its own — most edits produce the plain no-cascade toast.
 * `closingOf` reports the row's quantity, which is the figure an edit to
 * it actually moves; profit is not shown on this tab.
 */
const NON_SALES_ROW_ACCESSORS: LedgerRowAccessors<NonSalesLedgerRowData> = {
  identify: (r) => r.movementId,
  describe: (r) => r.itemName,
  closingOf: (r) => Math.abs(r.quantity),
  profitOf: () => null,
  daysOf: () => [],
};

export function NonSalesLedgerView({
  state,
  onRetry,
  onReplaceRows,
  amended = {},
  onAmendmentsChanged,
  periodStart = "",
  periodEnd = "",
  initialQuery = "",
}: {
  state: LoadState;
  onRetry: () => void;
  /** T9.1 — cells carrying an edit. */
  amended?: AmendedCells;
  /** Re-reads the trail after a save. */
  onAmendmentsChanged?: () => void;
  /** Replaces the rows in place after an edit, without remounting. Absent
   * in Storybook, which stories the view without a network — and its
   * absence is also what makes the table read-only there. */
  onReplaceRows?: (rows: NonSalesLedgerRowData[]) => void;
  /** ISO instants for the period on screen — the amend endpoint recomputes
   * and returns exactly this window, so the edit and the refresh agree. */
  periodStart?: string;
  periodEnd?: string;
  /** Storybook only, for the "filtered to zero rows" state — the real page
   * always starts with an empty search. */
  initialQuery?: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [reason, setReason] = useState<NonSalesReason | "all">("all");

  // Per-cell in-flight and failure state, keyed by movement and column so
  // two edits in flight never mask each other. Errors live on the cell:
  // she needs to know *which* figure failed.
  const [cellState, setCellState] = useState<Record<string, { state: EditableNumState; message?: string }>>({});
  const [toast, setToast] = useState<AmendToastState | null>(null);
  const [confirming, setConfirming] = useState<AmendConfirmState | null>(null);

  const editingEnabled = !!onReplaceRows;

  const allRows = useMemo(() => (state.status === "ready" ? state.rows : []), [state]);

  async function submit(cellKey: string, body: Record<string, unknown>, movementId: string) {
    setCellState((s) => ({ ...s, [cellKey]: { state: "saving" } }));
    try {
      const response = await fetch("/api/ledger/amend", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...body, ledger: "nonSales", periodStart, periodEnd }),
      });
      if (!response.ok) {
        setCellState((s) => ({
          ...s,
          [cellKey]: { state: "error", message: "Couldn't save. The figure is unchanged." },
        }));
        return;
      }
      const payload = (await response.json()) as {
        rows: NonSalesLedgerRowData[];
        previousRows: NonSalesLedgerRowData[];
      };
      onReplaceRows?.(payload.rows);
      onAmendmentsChanged?.();
      setCellState((s) => {
        const next = { ...s };
        delete next[cellKey];
        return next;
      });

      const summary = summariseAmendment({
        itemId: movementId,
        previousRows: payload.previousRows,
        rows: payload.rows,
        accessors: NON_SALES_ROW_ACCESSORS,
      });
      const previousValue = body["newValue"];
      setToast({
        message: summary.message,
        undo: () => {
          setToast(null);
          void submit(cellKey, { ...body, newValue: body["undoValue"] ?? previousValue }, movementId);
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
    movementId: string;
    body: Record<string, unknown>;
    escalation: ConfirmCase | null;
    /** The cell in her words, and both figures already formatted — the
     * confirm names what she is agreeing to. */
    label: string;
    from: string;
    to: string;
  }) {
    const run = () => void submit(input.cellKey, input.body, input.movementId);
    // Every edit confirms (owner decision, 2026-08-18). The escalation,
    // where there is one, adds a paragraph to a dialog that was going to
    // appear regardless — it no longer decides whether to ask.
    setConfirming({
      edit: {
        label: input.label,
        from: input.from,
        to: input.to,
        escalation: input.escalation,
      },
      proceed: () => {
        setConfirming(null);
        run();
      },
      // T12 — the real cascade, from the server, fetched as the dialog
      // opens. The dialog does not wait for it: the cell and both
      // figures are already on screen, and this fills in what *else*
      // moves a moment later.
      previewCascade: () =>
        fetchCascadePreview({
          body: input.body,
          ledger: "nonSales",
          periodStart,
          periodEnd,
          itemId: input.movementId,
          accessors: NON_SALES_ROW_ACCESSORS,
        }),
    });
  }

  /**
   * A money figure on one movement — Kind C, edited in place.
   *
   * Cost basis and selling value are snapshotted at the moment the
   * movement was recorded (ticket 15) and are never recomputed, which is
   * exactly why they are editable here: there is a stored number, it can
   * be wrong, and nothing else will correct it.
   */
  function moneyCell(row: NonSalesLedgerRowData, field: "costBasisMinor" | "sellingValueMinor") {
    const value = row[field];
    const cellKey = `${row.movementId}:${field}`;
    const cell = cellState[cellKey];
    const label = `${field === "costBasisMinor" ? "cost" : "selling value"} for ${row.itemName}`;
    const history =
      amended[
        amendCellKey({
          recordType: row.itemType === "product" ? "StockMovement" : "IngredientMovement",
          recordId: row.movementId,
          field,
          day: row.occurredAt.slice(0, 10),
          locationId: row.locationId,
        })
      ];

    return (
      <AmendedCell
        amendments={history}
        label={`${field === "costBasisMinor" ? "At cost" : "At selling price"} · ${row.itemName}`}
      >
      <EditableNum
        value={value}
        asMoney
        muted={field === "sellingValueMinor"}
        state={cell?.state}
        errorMessage={cell?.message}
        label={label}
        onCommit={
          editingEnabled
            ? (next) => {
                const months = farBackMonths(new Date(row.occurredAt));
                amend({
                  cellKey,
                  movementId: row.movementId,
                  escalation: months !== null ? { kind: "farBack", months } : null,
                  label: `${field === "costBasisMinor" ? "At cost" : "At selling price"} · ${row.itemName} · ${row.occurredAt.slice(0, 10)}`,
                  from: money(value ?? 0),
                  to: money(next),
                  body: {
                    kind: "scalar",
                    recordType: row.itemType === "product" ? "StockMovement" : "IngredientMovement",
                    recordId: row.movementId,
                    field,
                    newValue: next,
                    undoValue: value ?? 0,
                    locationId: row.locationId,
                    ledgerContext: `${label} · ${row.locationCode}`,
                    effectiveDate: `${row.occurredAt.slice(0, 10)}T00:00:00.000Z`,
                  },
                });
              }
            : undefined
        }
      />
      </AmendedCell>
    );
  }

  /**
   * The quantity, Kind A via the day-total path.
   *
   * Not a scalar edit, even though the row is one movement: a day with
   * two wastage entries for the same item has the same "which row absorbs
   * it" question every other tab has, and amendDayTotal already answers
   * it deterministically. Two write paths onto one figure is the failure
   * BUG-10 came from.
   */
  function quantityCell(row: NonSalesLedgerRowData) {
    const value = Math.abs(row.quantity);
    const cellKey = `${row.movementId}:quantity`;
    const cell = cellState[cellKey];
    const history =
      amended[
        amendCellKey({
          recordType: row.itemType === "product" ? "StockMovement" : "IngredientMovement",
          recordId: row.itemId,
          field: row.reason,
          day: row.occurredAt.slice(0, 10),
          locationId: row.locationId,
        })
      ];

    return (
      <AmendedCell
        amendments={history}
        label={`${nonSalesReasonLabel[row.reason]} · ${row.itemName} · ${row.occurredAt.slice(0, 10)}`}
      >
      <EditableNum
        value={value}
        state={cell?.state}
        errorMessage={cell?.message}
        label={`quantity for ${row.itemName}`}
        onCommit={
          editingEnabled
            ? (next) => {
                const occurred = new Date(row.occurredAt);
                const months = farBackMonths(occurred);
                amend({
                  cellKey,
                  movementId: row.movementId,
                  escalation: months !== null ? { kind: "farBack", months } : null,
                  label: `${nonSalesReasonLabel[row.reason]} · ${row.itemName} · ${row.occurredAt.slice(0, 10)}`,
                  from: String(value),
                  to: String(next),
                  body: {
                    kind: "dayTotal",
                    itemType: row.itemType,
                    itemId: row.itemId,
                    locationId: row.locationId,
                    date: row.occurredAt.slice(0, 10),
                    reason: row.reason,
                    newValue: next,
                    undoValue: value,
                  },
                });
              }
            : undefined
        }
      />
      </AmendedCell>
    );
  }

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allRows.filter(
      (r) =>
        (reason === "all" || r.reason === reason) &&
        (!q || r.itemName.toLowerCase().includes(q) || r.recordedBy.toLowerCase().includes(q)),
    );
  }, [allRows, query, reason]);

  const filtered = query !== "" || reason !== "all";
  const clear = () => {
    setQuery("");
    setReason("all");
  };

  const totals = rows.reduce(
    (a, r) => ({
      cost: a.cost + (r.costBasisMinor ?? 0),
      price: a.price + (r.sellingValueMinor ?? 0),
    }),
    { cost: 0, price: 0 },
  );

  if (state.status === "loading") {
    return (
      <div data-testid="non-sales-ledger-loading">
        <LoadingTable summary={0} rows={8} columns={8} />
      </div>
    );
  }

  if (state.status === "denied") {
    return (
      <div className="rounded-lg border bg-card p-4">
        <PermissionDenied
          title="The non-sales ledger is owner-only"
          body="Wastage and cost figures are financial. Ask the owner if you need to see them."
        />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="rounded-lg border bg-card p-4">
        <ErrorState what="the non-sales ledger" onRetry={onRetry} />
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card" data-testid="non-sales-ledger">
      <AmendToast toast={toast} onDismiss={() => setToast(null)} />
      <AmendConfirm confirming={confirming} onCancel={() => setConfirming(null)} />

      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
        <div className="relative min-w-48 flex-1">
          <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search items or people"
            className="h-8 pl-8 text-[13px]"
            data-testid="non-sales-ledger-search"
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
        <Select value={reason} onValueChange={(v) => setReason(v as NonSalesReason | "all")}>
          <SelectTrigger className="h-8 w-40 text-[13px]" data-testid="non-sales-ledger-reason-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All reasons</SelectItem>
            <SelectItem value="wasted">Wasted</SelectItem>
            <SelectItem value="consumed">Staff meals</SelectItem>
            <SelectItem value="given_away">Complimentary</SelectItem>
          </SelectContent>
        </Select>
        <span className="tabular ml-auto shrink-0 text-xs text-muted-foreground">
          {rows.length === allRows.length ? `${allRows.length} rows` : `${rows.length} of ${allRows.length}`}
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="px-4 py-10">
          {filtered ? (
            <EmptyFiltered onClear={clear} noun="entries" />
          ) : (
            <p className="text-center text-sm text-muted-foreground">No movements in this period.</p>
          )}
        </div>
      ) : (
        // No overflow-x-auto wrapper — see record-table.tsx's comment on
        // why that would break the thead's sticky positioning.
        <>
          <table className="w-full min-w-[720px] text-[13px]">
            <thead className="sticky top-0 z-10">
              <tr className="border-b bg-muted text-[11px] text-muted-foreground">
                <th className={`${FROZEN_HEAD} px-3 py-2 text-left font-medium`}>Item</th>
                <Th align="left">Date</Th>
                <Th align="left">Location</Th>
                <Th align="left">Reason</Th>
                <Th>Qty</Th>
                <Th>At cost</Th>
                <Th>At selling price</Th>
                <Th align="left">By</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                return (
                  <tr
                    key={r.movementId}
                    className="group border-b hover:bg-muted/40"
                    data-testid={`non-sales-ledger-row-${r.itemId}-${i}`}
                  >
                    <td className={`${FROZEN} px-3 py-2 font-medium`}>{r.itemName}</td>
                    <Td align="left">
                      <span className="text-muted-foreground">
                        {new Date(r.occurredAt).toLocaleDateString()}
                      </span>
                    </Td>
                    <Td align="left">
                      <span className="capitalize text-muted-foreground">{r.locationCode}</span>
                    </Td>
                    <Td align="left">
                      <Badge variant="outline" className="text-[10px] font-normal">
                        {nonSalesReasonLabel[r.reason]}
                      </Badge>
                    </Td>
                    <Td>{quantityCell(r)}</Td>
                    <Td>
                      {moneyCell(r, "costBasisMinor")}
                      {r.isEstimated && (
                        <span
                          className="ml-1 text-[10px] text-muted-foreground"
                          title="No recipe — estimated at 60% of selling price, for this report only. Type a real figure to replace the estimate."
                        >
                          est
                        </span>
                      )}
                    </Td>
                    <Td>{moneyCell(r, "sellingValueMinor")}</Td>
                    <Td align="left">
                      <span className="text-muted-foreground">{r.recordedBy}</span>
                    </Td>
                  </tr>
                );
              })}
              <tr className="bg-muted/40 font-medium">
                <td className={`${FROZEN} bg-muted/40 px-3 py-2`}>Total</td>
                <Td />
                <Td />
                <Td />
                <Td />
                {/* Read-only: the sum of individually editable rows, and
                    changing the sum offers no way to say which row was
                    wrong. Same rule as the other tabs' period totals. */}
                <Td>
                  <EditableNum
                    value={totals.cost}
                    asMoney
                    notEditableReason="This is the total for the rows shown. Edit an entry's own figure."
                  />
                </Td>
                <Td>
                  <EditableNum
                    value={totals.price}
                    asMoney
                    notEditableReason="This is the total for the rows shown. Edit an entry's own figure."
                  />
                </Td>
                <Td />
              </tr>
            </tbody>
          </table>
        </>
      )}
      <p className="border-t px-3 py-2 text-[11px] text-muted-foreground">
        These amounts are not deducted from profit a second time — stock no longer present is already
        counted as used up in cost of goods sold. This shows where stock is going.
      </p>
    </div>
  );
}
