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
  running: "Running cost",
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

  return <CashLedgerView state={state} onRetry={onRetry} />;
}

const FROZEN = "sticky left-0 z-20 bg-card group-hover:bg-muted/40 border-r";
const FROZEN_HEAD = "sticky left-0 z-30 bg-muted/60 border-r";
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

export function CashLedgerView({
  state,
  onRetry,
  initialExpandedRowKey = null,
  initialQuery = "",
}: {
  state: LoadState;
  onRetry: () => void;
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

  const allDays = useMemo(() => (state.status === "ready" ? state.days : []), [state]);

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
    <div className="overflow-hidden rounded-lg border bg-card" data-testid="cash-ledger">
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
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] text-[13px]">
            <thead>
              <tr className="border-b bg-muted/60 text-[11px] text-muted-foreground">
                <th className={`${FROZEN_HEAD} px-3 py-1.5 text-left font-medium`}>Day</th>
                <th className="border-l px-2 py-1.5 text-center font-medium" colSpan={2}>Opening</th>
                <th className="border-l px-2 py-1.5 text-center font-medium" colSpan={2}>In</th>
                <th className="border-l px-2 py-1.5 text-center font-medium" colSpan={4}>Out</th>
                <th className="border-l px-2 py-1.5 text-center font-medium" colSpan={2}>Closing</th>
              </tr>
              <tr className="border-b text-[11px] text-muted-foreground">
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
                      <Td border><Num value={d.openingCashMinor} /></Td>
                      <Td><Num value={d.openingMpesaMinor} /></Td>
                      <Td border><Num value={d.handoversMinor} muted tone="success" /></Td>
                      <Td><Num value={d.repaymentsMinor} muted tone="success" /></Td>
                      <Td border><Num value={d.stockMinor} muted tone="danger" /></Td>
                      <Td><Num value={d.runningMinor} muted tone="danger" /></Td>
                      <Td><Num value={d.assetsMinor} muted tone="danger" /></Td>
                      <Td><Num value={d.drawingsMinor} muted tone="danger" /></Td>
                      <Td border><Num value={d.closingCashMinor} strong /></Td>
                      <Td><Num value={d.closingMpesaMinor} strong /></Td>
                    </tr>

                    {open &&
                      d.transactions.map((t, i) => {
                        const last = i === d.transactions.length - 1;
                        const isIn = t.category === "handover" || t.category === "repayment";
                        return (
                          <tr key={t.id} className={`${CHILD_ROW} ${last ? CHILD_LAST : "border-b"}`}>
                            <td className={`${CHILD_FROZEN} py-1.5 pr-3 pl-3`}>
                              <Spine label={t.description} />
                            </td>
                            <Td border>
                              <span className="text-muted-foreground">{t.method === "mpesa" ? "M-Pesa" : "Cash"}</span>
                            </Td>
                            <Td />
                            <Td border>
                              <Num value={t.category === "handover" ? t.amountMinor : 0} muted />
                            </Td>
                            <Td>
                              <Num value={t.category === "repayment" ? t.amountMinor : 0} muted />
                            </Td>
                            <Td border>
                              <Num value={t.category === "stock" ? t.amountMinor : 0} muted />
                            </Td>
                            <Td>
                              <Num value={t.category === "running" ? t.amountMinor : 0} muted />
                            </Td>
                            <Td>
                              <Num value={t.category === "asset" ? t.amountMinor : 0} muted />
                            </Td>
                            <Td>
                              <Num value={t.category === "drawing" ? t.amountMinor : 0} muted />
                            </Td>
                            <Td border>
                              <span className={isIn ? "" : "text-muted-foreground"}>{t.recordedBy}</span>
                            </Td>
                            <Td />
                          </tr>
                        );
                      })}
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
        </div>
      )}
    </div>
  );
}
