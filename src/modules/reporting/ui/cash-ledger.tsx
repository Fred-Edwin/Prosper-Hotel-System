"use client";

/**
 * The Ledger's Cash tab (ticket 40) — adapted from the design-reference
 * worktree's locked `CashLedgerTable` (`ledger/tables.tsx`): one row per
 * day, categories as columns, search plus category filter, day-expansion
 * to individual transactions. Same fetching/LoadState/presentational
 * split as `product-ledger.tsx`.
 *
 * Cash and M-Pesa are never pooled (docs/design.md) — unlike the
 * reference's single opening/closing number, every balance column here is
 * two figures side by side, matching getCashLedger's two independent
 * running balances (ticket 40's Context note on this ambiguity).
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
import { AmendedCell, cellKey as amendCellKey, type AmendedCells } from "./amend-history";
import { ChevronRight, Search, X } from "lucide-react";
import { money } from "@/shared/money";

export type CashTransactionCategory = "handover" | "repayment" | "stock" | "running" | "asset" | "drawing";

export type CashTransactionData = {
  id: string;
  description: string;
  category: CashTransactionCategory;
  method: "cash" | "mpesa";
  amountMinor: number;
  recordedBy: string;
  // Editable-ledger T7.2 — where the figure actually lives. The row id is
  // a display key: a handover emits two rows from one record, so taking
  // `${id}:cash` apart at the client would be writing to whatever record
  // the prefix happened to name. See the CashTransaction comment in
  // reporting/logic.ts.
  recordType: "Handover" | "DrawingRepayment" | "Expense";
  recordId: string;
  amountField: string;
  methodField: string | null;
};

export type CashLedgerDayData = {
  date: string;
  openingCashMinor: number;
  openingMpesaMinor: number;
  handoversMinor: number;
  repaymentsMinor: number;
  stockMinor: number;
  runningMinor: number;
  assetsMinor: number;
  drawingsMinor: number;
  closingCashMinor: number;
  closingMpesaMinor: number;
  transactions: CashTransactionData[];
  // T7.3 / C6 — a later edit moved this day's sales. Null on every day
  // where nothing moved.
  salesEditedSince: { count: number; editedOn: string } | null;
};

export type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "denied" }
  | { status: "ready"; days: CashLedgerDayData[] };

const categoryLabel: Record<CashTransactionCategory, string> = {
  handover: "Handover",
  repayment: "Repayment",
  stock: "Stock",
  running: "Operating cost",
  asset: "Asset",
  drawing: "Drawing",
};

async function fetchCashLedger(periodStart: string, periodEnd: string): Promise<LoadState> {
  try {
    const response = await fetch(
      `/api/ledger/cash?${new URLSearchParams({ periodStart, periodEnd }).toString()}`,
    );
    if (response.status === 403) return { status: "denied" };
    if (!response.ok) return { status: "error" };
    const body = await response.json();
    if (!Array.isArray(body?.days)) return { status: "error" };
    return { status: "ready", days: body.days };
  } catch {
    return { status: "error" };
  }
}

export function CashLedger({ periodStart, periodEnd }: { periodStart: string; periodEnd: string }) {
  const [attempt, setAttempt] = useState(0);
  return (
    <CashLedgerForAttempt
      key={`${periodStart}:${periodEnd}:${attempt}`}
      periodStart={periodStart}
      periodEnd={periodEnd}
      onRetry={() => setAttempt((a) => a + 1)}
    />
  );
}

function CashLedgerForAttempt({
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
    fetchCashLedger(start, end).then((result) => {
      if (!cancelledRef.current) setState(result);
    });
    return () => {
      cancelledRef.current = true;
    };
  }, [periodStart, periodEnd]);

  // Replaces days in place after an edit rather than remounting, so the
  // expanded day she is working inside survives the save. Same reasoning
  // as the Product and Store tabs' onReplaceRows.
  const replaceDays = (days: CashLedgerDayData[]) =>
    setState((s) => (s.status === "ready" ? { ...s, days } : s));

  // T9.1 — which cells carry an edit. Its own read, refreshed after a
  // save: the figure and its history change together, and a marker that
  // appeared only on reload would miss the edit she just made.
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
    <CashLedgerView
      state={state}
      onRetry={onRetry}
      amended={amended}
      onAmendmentsChanged={() => loadAmendments.current()}
      onReplaceRows={replaceDays}
      periodStart={new Date(`${periodStart}T00:00:00`).toISOString()}
      periodEnd={new Date(`${periodEnd}T23:59:59.999`).toISOString()}
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
  muted,
  tone,
  strong,
}: {
  value: number;
  muted?: boolean;
  tone?: "danger" | "success";
  strong?: boolean;
}) {
  if (value === 0 && muted) return <span className="text-muted-foreground">—</span>;
  const cls = tone === "danger" ? "text-danger" : tone === "success" ? "text-success" : "";
  return <span className={`tabular ${cls} ${strong ? "font-medium" : ""}`}>{money(value)}</span>;
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

function Chevron({ open }: { open: boolean }) {
  return (
    <ChevronRight
      className={`size-3.5 shrink-0 text-muted-foreground transition-transform duration-100 ${open ? "rotate-90" : ""}`}
    />
  );
}

/**
 * How amend-feedback reads a Cash day (T7.5).
 *
 * The Cash tab has no closing *quantity* — its running figure is a
 * balance — so `closingOf` reports closing cash, which is the figure an
 * edit to a cash transaction actually moves. M-Pesa moves independently
 * and is named by an extra clause where it is the side that changed;
 * the two are never pooled (docs/design.md).
 *
 * There is no per-day cascade to summarise here the way there is on the
 * Product tab: a day is already the unit, so `daysOf` reports each day's
 * own closing balance across the period, which is exactly the cascade an
 * edit to an early day produces.
 */
/**
 * Names the M-Pesa balance when *that* is the side that moved.
 *
 * `closingOf` reports closing cash, so an edit to an M-Pesa transaction
 * would otherwise produce a toast saying nothing measurable changed —
 * true of cash, and misleading about the edit she just made. Cash and
 * M-Pesa are never pooled, so the summary cannot average over the two;
 * it names whichever one moved.
 */
function mpesaClause(
  previousDays: CashLedgerDayData[],
  days: CashLedgerDayData[],
  date: string,
): string | undefined {
  const before = previousDays.find((d) => d.date === date);
  const after = days.find((d) => d.date === date);
  if (!before || !after) return undefined;
  if (before.closingMpesaMinor === after.closingMpesaMinor) return undefined;
  return `closing M-Pesa is now ${money(after.closingMpesaMinor)}`;
}

const CASH_ROW_ACCESSORS: LedgerRowAccessors<CashLedgerDayData> = {
  identify: (d) => d.date,
  describe: (d) => `Closing cash for ${d.date}`,
  closingOf: (d) => d.closingCashMinor,
  profitOf: () => null,
  daysOf: (d) => [{ date: d.date, closing: d.closingCashMinor }],
};

export function CashLedgerView({
  state,
  onRetry,
  onReplaceRows,
  amended = {},
  onAmendmentsChanged,
  periodStart = "",
  periodEnd = "",
  initialExpandedRowKey = null,
  initialQuery = "",
}: {
  state: LoadState;
  onRetry: () => void;
  /** T9.1 — cells carrying an edit, keyed as getLedgerAmendments keys them. */
  amended?: AmendedCells;
  /** Re-reads the trail after a save, so the marker appears on the figure
   * she just changed rather than on the next page load. */
  onAmendmentsChanged?: () => void;
  /** Replaces the days in place after an edit, without remounting. Absent
   * in Storybook, which stories the view without a network — and its
   * absence is also what makes the table read-only there. */
  onReplaceRows?: (days: CashLedgerDayData[]) => void;
  /** ISO instants for the period on screen — the amend endpoint recomputes
   * and returns exactly this window, so the edit and the refresh agree. */
  periodStart?: string;
  periodEnd?: string;
  /** Storybook only, for the "day expanded" state — the real page always
   * starts collapsed. */
  initialExpandedRowKey?: string | null;
  /** Storybook only, for the "filtered to zero rows" state — the real page
   * always starts with an empty search. */
  initialQuery?: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState<CashTransactionCategory | "all">("all");
  const [expanded, setExpanded] = useState<string | null>(initialExpandedRowKey);

  // Per-cell in-flight and failure state, keyed by transaction so two
  // edits in flight never mask each other. Errors live on the cell: she
  // needs to know *which* figure failed, which a toast cannot tell her.
  const [cellState, setCellState] = useState<Record<string, { state: EditableNumState; message?: string }>>({});
  const [toast, setToast] = useState<AmendToastState | null>(null);
  const [confirming, setConfirming] = useState<AmendConfirmState | null>(null);

  const editingEnabled = !!onReplaceRows;

  const allDays = useMemo(() => (state.status === "ready" ? state.days : []), [state]);

  async function submit(
    cellKey: string,
    body: Record<string, unknown>,
    dayKey: string,
    extraClause?: string,
  ) {
    setCellState((s) => ({ ...s, [cellKey]: { state: "saving" } }));
    try {
      const response = await fetch("/api/ledger/amend", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...body, ledger: "cash", periodStart, periodEnd }),
      });
      if (!response.ok) {
        setCellState((s) => ({
          ...s,
          [cellKey]: { state: "error", message: "Couldn't save. The figure is unchanged." },
        }));
        return;
      }
      const payload = (await response.json()) as {
        rows: CashLedgerDayData[];
        previousRows: CashLedgerDayData[];
      };
      onReplaceRows?.(payload.rows);
      onAmendmentsChanged?.();
      setCellState((s) => {
        const next = { ...s };
        delete next[cellKey];
        return next;
      });

      const summary = summariseAmendment({
        itemId: dayKey,
        previousRows: payload.previousRows,
        rows: payload.rows,
        accessors: CASH_ROW_ACCESSORS,
        extraClause: extraClause ?? mpesaClause(payload.previousRows, payload.rows, dayKey),
      });
      const previousValue = body["newValue"];
      setToast({
        message: summary.message,
        undo: () => {
          setToast(null);
          void submit(cellKey, { ...body, newValue: body["undoValue"] ?? previousValue }, dayKey);
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
    dayKey: string;
    body: Record<string, unknown>;
    escalation: ConfirmCase | null;
    /** The cell in her words, and both figures already formatted — the
     * confirm names what she is agreeing to. */
    label: string;
    from: string;
    to: string;
    extraClause?: string;
  }) {
    const run = () => void submit(input.cellKey, input.body, input.dayKey, input.extraClause);
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
    });
  }

  /**
   * An opening or closing balance on the day row.
   *
   * Not editable, and it says so. These are derived from the day's
   * transactions — there is no stored figure to change, and writing an
   * offsetting row to force a balance would invent a payment that never
   * happened. The transactions below are where the real edit is.
   */
  function balanceCell(value: number, opts: { strong?: boolean } = {}) {
    return (
      <EditableNum
        value={value}
        asMoney
        strong={opts.strong}
        notEditableReason="Balances are worked out from the day's transactions. Expand the day and edit one."
      />
    );
  }

  /**
   * A per-day category total on the day row.
   *
   * Read-only for the same reason the Product and Store tabs' period
   * totals are: it is the sum of several individually editable rows, and
   * changing the sum offers no way to say which of them was wrong.
   */
  function dayTotalCell(value: number, opts: { tone?: "danger" | "success" } = {}) {
    return (
      <EditableNum
        value={value}
        asMoney
        muted
        tone={opts.tone}
        notEditableReason="This is the day's total. Expand the day and edit a transaction."
      />
    );
  }

  /**
   * One transaction's amount, editable in the column it already occupies.
   *
   * The cell she reads is the cell she edits — no separate Amount column,
   * which would print every figure twice on the same row and leave her
   * working out which of two identical numbers is the real one. Each
   * child row carries exactly one non-dash figure anyway, so there is
   * nothing to hunt for.
   */
  function amountCell(day: CashLedgerDayData, t: CashTransactionData, column: CashTransactionCategory) {
    // A transaction only shows a figure in its own category's column.
    if (t.category !== column) return <Num value={0} muted />;

    const cellKey = `${t.id}:amount`;
    const cell = cellState[cellKey];
    const history = amended[amendCellKey({ recordType: t.recordType, recordId: t.recordId, field: t.amountField })];

    return (
      <AmendedCell amendments={history} label={`${t.description} · ${day.date}`}>
      <EditableNum
        value={t.amountMinor}
        asMoney
        muted
        state={cell?.state}
        errorMessage={cell?.message}
        label={`${t.description} on ${day.date}`}
        onCommit={
          editingEnabled
            ? (next) => {
                const months = farBackMonths(new Date(`${day.date}T00:00:00.000Z`));
                // A day with a handover is the D2 case the handover
                // confirm exists for: the expected figure will not follow,
                // so the two are meant to disagree afterwards. That
                // outranks the far-back warning, which is only about span.
                const escalation: ConfirmCase | null =
                  t.recordType === "Handover"
                    ? { kind: "handover" }
                    : months !== null
                      ? { kind: "farBack", months }
                      : null;
                amend({
                  cellKey,
                  dayKey: day.date,
                  escalation,
                  label: `${t.description} · ${day.date}`,
                  from: money(t.amountMinor),
                  to: money(next),
                  body: {
                    kind: "scalar",
                    recordType: t.recordType,
                    recordId: t.recordId,
                    field: t.amountField,
                    newValue: next,
                    undoValue: t.amountMinor,
                    ledgerContext: `${t.description} · ${day.date}`,
                    effectiveDate: `${day.date}T00:00:00.000Z`,
                  },
                });
              }
            : undefined
        }
      />
      </AmendedCell>
    );
  }

  const days = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q && category === "all") return allDays;
    return allDays
      .map((d) => ({
        ...d,
        transactions: d.transactions.filter(
          (t) =>
            (category === "all" || t.category === category) &&
            (!q || t.description.toLowerCase().includes(q) || t.recordedBy.toLowerCase().includes(q)),
        ),
      }))
      .filter((d) => d.transactions.length > 0);
  }, [allDays, query, category]);

  const filtered = query !== "" || category !== "all";
  const clear = () => {
    setQuery("");
    setCategory("all");
  };

  if (state.status === "loading") {
    return (
      <div data-testid="cash-ledger-loading">
        <LoadingTable summary={0} rows={8} columns={9} />
      </div>
    );
  }

  if (state.status === "denied") {
    return (
      <div className="rounded-lg border bg-card p-4">
        <PermissionDenied
          title="The cash ledger is owner-only"
          body="Cash and M-Pesa balances are financial figures. Ask the owner if you need to see them."
        />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="rounded-lg border bg-card p-4">
        <ErrorState what="the cash ledger" onRetry={onRetry} />
      </div>
    );
  }

  const totals = days.reduce(
    (a, d) => ({
      handovers: a.handovers + d.handoversMinor,
      repayments: a.repayments + d.repaymentsMinor,
      stock: a.stock + d.stockMinor,
      running: a.running + d.runningMinor,
      assets: a.assets + d.assetsMinor,
      drawings: a.drawings + d.drawingsMinor,
    }),
    { handovers: 0, repayments: 0, stock: 0, running: 0, assets: 0, drawings: 0 },
  );

  return (
    <div className="rounded-lg border bg-card" data-testid="cash-ledger">
      <AmendToast toast={toast} onDismiss={() => setToast(null)} />
      <AmendConfirm confirming={confirming} onCancel={() => setConfirming(null)} />

      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
        <div className="relative min-w-48 flex-1">
          <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search descriptions or people"
            className="h-8 pl-8 text-[13px]"
            data-testid="cash-ledger-search"
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
        <Select value={category} onValueChange={(v) => setCategory(v as CashTransactionCategory | "all")}>
          <SelectTrigger className="h-8 w-40 text-[13px]" data-testid="cash-ledger-category-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {(Object.keys(categoryLabel) as CashTransactionCategory[]).map((k) => (
              <SelectItem key={k} value={k}>
                {categoryLabel[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="tabular ml-auto shrink-0 text-xs text-muted-foreground">
          {days.length === allDays.length ? `${allDays.length} days` : `${days.length} of ${allDays.length}`}
        </span>
      </div>

      {days.length === 0 ? (
        <div className="px-4 py-10">
          {filtered ? (
            <EmptyFiltered onClear={clear} noun="transactions" />
          ) : (
            <p className="text-center text-sm text-muted-foreground">No movements in this period.</p>
          )}
        </div>
      ) : (
        // No overflow-x-auto wrapper — see record-table.tsx's comment on
        // why that would break the thead's sticky positioning.
        <>
          <table className="w-full min-w-[1180px] text-[13px]">
            <thead className="sticky top-0 z-10">
              <tr className="border-b bg-muted text-[11px] text-muted-foreground">
                <th className={`${FROZEN_HEAD} px-3 py-1.5 text-left font-medium`}>Day</th>
                <th className="border-l px-2 py-1.5 text-center font-medium" colSpan={2}>Opening</th>
                <th className="border-l px-2 py-1.5 text-center font-medium" colSpan={2}>In</th>
                <th className="border-l px-2 py-1.5 text-center font-medium" colSpan={4}>Out</th>
                <th className="border-l px-2 py-1.5 text-center font-medium" colSpan={2}>Closing</th>
              </tr>
              <tr className="border-b bg-muted text-[11px] text-muted-foreground">
                <th className={`${FROZEN_HEAD} px-3 py-2 text-left font-medium`}>Date</th>
                <Th border>Cash</Th>
                <Th>M-Pesa</Th>
                <Th border>Handovers</Th>
                <Th>Repayments</Th>
                <Th border>Stock</Th>
                <Th>Running</Th>
                <Th>Assets</Th>
                <Th>Drawings</Th>
                <Th border>Cash</Th>
                <Th>M-Pesa</Th>
              </tr>
            </thead>
            <tbody>
              {days.map((d) => {
                const open = expanded === d.date;
                return (
                  <Fragment key={d.date}>
                    <tr className="group border-b hover:bg-muted/40">
                      <td className={`${FROZEN} px-3 py-2`}>
                        <button
                          onClick={() => setExpanded(open ? null : d.date)}
                          className="flex items-center gap-1.5 text-left"
                          aria-expanded={open}
                          data-testid={`cash-ledger-row-${d.date}`}
                        >
                          <Chevron open={open} />
                          <span>
                            <span className="font-medium">{d.date}</span>
                            <span className="block text-[11px] text-muted-foreground">
                              {d.transactions.length} {d.transactions.length === 1 ? "entry" : "entries"}
                            </span>
                          </span>
                        </button>
                      </td>
                      <Td border>{balanceCell(d.openingCashMinor)}</Td>
                      <Td>{balanceCell(d.openingMpesaMinor)}</Td>
                      <Td border>{dayTotalCell(d.handoversMinor, { tone: "success" })}</Td>
                      <Td>{dayTotalCell(d.repaymentsMinor, { tone: "success" })}</Td>
                      <Td border>{dayTotalCell(d.stockMinor, { tone: "danger" })}</Td>
                      <Td>{dayTotalCell(d.runningMinor, { tone: "danger" })}</Td>
                      <Td>{dayTotalCell(d.assetsMinor, { tone: "danger" })}</Td>
                      <Td>{dayTotalCell(d.drawingsMinor, { tone: "danger" })}</Td>
                      <Td border>{balanceCell(d.closingCashMinor, { strong: true })}</Td>
                      <Td>{balanceCell(d.closingMpesaMinor, { strong: true })}</Td>
                    </tr>

                    {open &&
                      d.transactions.map((t, i) => {
                        const last = i === d.transactions.length - 1 && !d.salesEditedSince;
                        const isIn = t.category === "handover" || t.category === "repayment";
                        return (
                          <tr
                            key={t.id}
                            className={`${CHILD_ROW} ${last ? CHILD_LAST : "border-b"}`}
                            data-testid={`cash-ledger-transaction-${t.id}`}
                          >
                            <td className={`${CHILD_FROZEN} py-1.5 pr-3 pl-3`}>
                              <Spine label={t.description} />
                            </td>
                            <Td border>
                              {/* Read-only in T7, deliberately. The write
                                  layer supports it, but an editable
                                  choice inside a table cell exists
                                  nowhere else in the app and a two-value
                                  toggle is not worth inventing a pattern
                                  for: the method moves no figure the
                                  ledger shows, only which of the two
                                  balance columns the amount lands in. */}
                              <span
                                className="text-muted-foreground"
                                title="Recorded as this method. Change it where the payment was recorded."
                              >
                                {t.method === "mpesa" ? "M-Pesa" : "Cash"}
                              </span>
                            </Td>
                            <Td />
                            <Td border>{amountCell(d, t, "handover")}</Td>
                            <Td>{amountCell(d, t, "repayment")}</Td>
                            <Td border>{amountCell(d, t, "stock")}</Td>
                            <Td>{amountCell(d, t, "running")}</Td>
                            <Td>{amountCell(d, t, "asset")}</Td>
                            <Td>{amountCell(d, t, "drawing")}</Td>
                            <Td border>
                              <span className={isIn ? "" : "text-muted-foreground"}>{t.recordedBy}</span>
                            </Td>
                            <Td />
                          </tr>
                        );
                      })}

                    {/* C6 — the day's sales moved after the handover was
                        recorded. Stated in words, under the transactions
                        it concerns, because the expected figure
                        deliberately does not follow (D2) and a recomputed
                        number would erase the disagreement rather than
                        explain it. Quiet and neutral: the screen's one
                        accent belongs to Undo in the toast. */}
                    {open && d.salesEditedSince && (
                      <tr className={`${CHILD_ROW} ${CHILD_LAST}`} data-testid={`cash-ledger-sales-edited-${d.date}`}>
                        <td className={`${CHILD_FROZEN} py-1.5 pr-3 pl-3`} />
                        <td className="border-l px-2 py-1.5 text-left text-muted-foreground" colSpan={10}>
                          Sales for this day were edited on {d.salesEditedSince.editedOn}. The expected
                          figure records the check made that evening and has not changed.
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}

              <tr className="bg-muted/40 font-medium">
                <td className={`${FROZEN} bg-muted/40 px-3 py-2`}>Period</td>
                <Td border><Num value={days[0]?.openingCashMinor ?? 0} /></Td>
                <Td><Num value={days[0]?.openingMpesaMinor ?? 0} /></Td>
                <Td border><Num value={totals.handovers} tone="success" /></Td>
                <Td><Num value={totals.repayments} tone="success" /></Td>
                <Td border><Num value={totals.stock} tone="danger" /></Td>
                <Td><Num value={totals.running} tone="danger" /></Td>
                <Td><Num value={totals.assets} tone="danger" /></Td>
                <Td><Num value={totals.drawings} tone="danger" /></Td>
                <Td border><Num value={days[days.length - 1]?.closingCashMinor ?? 0} strong /></Td>
                <Td><Num value={days[days.length - 1]?.closingMpesaMinor ?? 0} strong /></Td>
              </tr>
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
