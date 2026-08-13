"use client";

/**
 * The Ledger's page shell (ticket 38) — period picker, the cost-of-goods-
 * sold waterfall, and the four-tab sub-ledger layout, adapted from the
 * design-reference worktree's locked `LedgerR3` (`ledger-r3.tsx`) and its
 * waterfall (`stats.tsx`). Same fetching/LoadState/presentational split as
 * `dashboard-profit.tsx`, since the prototype only ever rendered fixture
 * data.
 *
 * Only the waterfall shows real figures in ticket 38. Ticket 39 wires the
 * Product tab (`product-ledger.tsx`) in via `productLedgerSlot`, ticket 40
 * the Cash tab (`cash-ledger.tsx`) via `cashLedgerSlot`, ticket 42 the
 * Store tab (`store-ledger.tsx`) via `storeLedgerSlot`, ticket 43 the
 * Non-sales tab (`non-sales-ledger.tsx`) via `nonSalesLedgerSlot` — all
 * supplied only by the real page composition, never by this shell's own
 * Storybook story, which stories each *LedgerView in isolation instead
 * (same split `dashboard-body.tsx` uses for `DashboardHandovers`).
 *
 * "Opening stock" / "Closing stock" on the waterfall are the restaurant's
 * ingredient stock value at the period's two boundaries — the same figure
 * the cost-of-goods-sold formula actually uses (formulas.md §6) — not a
 * combined ingredient-plus-finished-goods figure (2026-08-12
 * clarification). Clicking any term still switches to the Product ledger
 * tab per the design reference's `explains` field, since that is a
 * navigation choice independent of which underlying figures compose the
 * number.
 */

import { useEffect, useRef, useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ErrorState, PermissionDenied, SectionNotBuilt } from "@/components/patterns/states";
import { Skeleton } from "@/components/ui/skeleton";
import { Info, Maximize2, RotateCw, X } from "lucide-react";
import { money } from "@/shared/money";
import { ProductLedger } from "./product-ledger";
import { StoreLedger } from "./store-ledger";
import { NonSalesLedger } from "./non-sales-ledger";
import { CashLedger } from "./cash-ledger";

export type LedgerSummaryData = {
  openingMinor: number;
  purchasesMinor: number;
  closingMinor: number;
  costOfGoodsSoldMinor: number | null;
  salesValueMinor: number;
  grossProfitMinor: number | null;
  nonSalesAtCostMinor: number;
  nonSalesAtPriceMinor: number;
  canteenCostRate: number | null;
};

export type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "denied" }
  | { status: "ready"; data: LedgerSummaryData };

type PeriodPreset = "day" | "week" | "month" | "custom";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function boundsForPreset(preset: PeriodPreset, customStart: string, customEnd: string) {
  if (preset === "day") return { periodStart: todayIso(), periodEnd: todayIso() };
  if (preset === "week") return { periodStart: daysAgoIso(7), periodEnd: todayIso() };
  if (preset === "month") return { periodStart: daysAgoIso(30), periodEnd: todayIso() };
  return { periodStart: customStart, periodEnd: customEnd };
}

async function fetchLedgerSummary(periodStart: string, periodEnd: string): Promise<LoadState> {
  try {
    const start = new Date(`${periodStart}T00:00:00`);
    const end = new Date(`${periodEnd}T23:59:59.999`);
    const params = new URLSearchParams({
      periodStart: start.toISOString(),
      periodEnd: end.toISOString(),
    });
    const response = await fetch(`/api/ledger/summary?${params.toString()}`);
    if (response.status === 403) return { status: "denied" };
    if (!response.ok) return { status: "error" };
    const body = await response.json();
    return { status: "ready", data: body };
  } catch {
    return { status: "error" };
  }
}

export function LedgerShell() {
  const [preset, setPreset] = useState<PeriodPreset>("week");
  const [customStart, setCustomStart] = useState(daysAgoIso(7));
  const [customEnd, setCustomEnd] = useState(todayIso());
  const [attempt, setAttempt] = useState(0);

  const { periodStart, periodEnd } = boundsForPreset(preset, customStart, customEnd);

  return (
    <LedgerShellForPeriod
      key={`${periodStart}:${periodEnd}:${attempt}`}
      periodStart={periodStart}
      periodEnd={periodEnd}
      preset={preset}
      onPresetChange={setPreset}
      customStart={customStart}
      customEnd={customEnd}
      onCustomStartChange={setCustomStart}
      onCustomEndChange={setCustomEnd}
      onRetry={() => setAttempt((a) => a + 1)}
    />
  );
}

function LedgerShellForPeriod({
  periodStart,
  periodEnd,
  ...viewProps
}: {
  periodStart: string;
  periodEnd: string;
} & Omit<React.ComponentProps<typeof LedgerShellView>, "state">) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    fetchLedgerSummary(periodStart, periodEnd).then((result) => {
      if (!cancelledRef.current) setState(result);
    });
    return () => {
      cancelledRef.current = true;
    };
  }, [periodStart, periodEnd]);

  return (
    <LedgerShellView
      state={state}
      {...viewProps}
      productLedgerSlot={<ProductLedger periodStart={periodStart} periodEnd={periodEnd} />}
      storeLedgerSlot={<StoreLedger periodStart={periodStart} periodEnd={periodEnd} />}
      nonSalesLedgerSlot={<NonSalesLedger periodStart={periodStart} periodEnd={periodEnd} />}
      cashLedgerSlot={<CashLedger periodStart={periodStart} periodEnd={periodEnd} />}
    />
  );
}

type StatTerm = "opening" | "purchases" | "closing" | "cogs";

const subLedgers = [
  { key: "products", label: "Product ledger", hint: "What was sold, and what it earned" },
  { key: "store", label: "Store ledger", hint: "Ingredients in, and out to the kitchen" },
  { key: "nonsales", label: "Non-sales ledger", hint: "Wastage, staff meals, complimentary" },
  { key: "cash", label: "Cash ledger", hint: "In, out, and the balance" },
];

/** Presentational half — what Storybook mounts to show every state without a network. */
export function LedgerShellView({
  state,
  preset,
  onPresetChange,
  customStart,
  customEnd,
  onCustomStartChange,
  onCustomEndChange,
  onRetry = () => {},
  productLedgerSlot,
  storeLedgerSlot,
  nonSalesLedgerSlot,
  cashLedgerSlot,
}: {
  state: LoadState;
  preset: PeriodPreset;
  onPresetChange: (p: PeriodPreset) => void;
  customStart: string;
  customEnd: string;
  onCustomStartChange: (v: string) => void;
  onCustomEndChange: (v: string) => void;
  onRetry?: () => void;
  /** Real fetching Product/Store/Non-sales/Cash ledgers, supplied by the
   * page composition only — never by Storybook, which stories each view
   * in isolation instead (same split as `dashboard-body.tsx` mounting
   * `DashboardHandovers` outside any storied shell). Falls back to the
   * not-built placeholder for any sub-ledger tab not yet wired. */
  productLedgerSlot?: React.ReactNode;
  storeLedgerSlot?: React.ReactNode;
  nonSalesLedgerSlot?: React.ReactNode;
  cashLedgerSlot?: React.ReactNode;
}) {
  const [active, setActive] = useState("products");
  const [statTerm, setStatTerm] = useState<StatTerm | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const selectTerm = (t: StatTerm) => {
    setStatTerm(statTerm === t ? null : t);
    setActive("products");
  };

  return (
    <div data-testid="ledger-shell">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Ledger</h1>
          <p className="text-sm text-muted-foreground">Where every figure comes from.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={preset} onValueChange={(v) => onPresetChange(v as PeriodPreset)}>
            <SelectTrigger className="h-8 w-40 text-[13px]" data-testid="ledger-period-preset">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Today</SelectItem>
              <SelectItem value="week">This week</SelectItem>
              <SelectItem value="month">This month</SelectItem>
              <SelectItem value="custom">Custom range</SelectItem>
            </SelectContent>
          </Select>
          {preset === "custom" && (
            <div className="flex items-center gap-1.5">
              <Input
                type="date"
                value={customStart}
                onChange={(e) => onCustomStartChange(e.target.value)}
                className="h-8 w-auto text-[13px]"
              />
              <span className="text-xs text-muted-foreground">to</span>
              <Input
                type="date"
                value={customEnd}
                onChange={(e) => onCustomEndChange(e.target.value)}
                className="h-8 w-auto text-[13px]"
              />
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            disabled
            title="Export isn't built yet"
          >
            Export
          </Button>
        </div>
      </div>

      <div className="mb-5">
        <LedgerWaterfall state={state} active={statTerm} onSelect={selectTerm} onRetry={onRetry} />
      </div>

      <Tabs value={active} onValueChange={setActive}>
        <TabsList className="mb-3 flex-wrap">
          {subLedgers.map((l) => (
            <TabsTrigger key={l.key} value={l.key} data-testid={`ledger-tab-${l.key}`}>
              {l.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {subLedgers.map((l) => (
          <TabsContent key={l.key} value={l.key}>
            <p className="mb-2 hidden text-xs text-muted-foreground lg:block">{l.hint}</p>
            <RotatePrompt onExpand={() => setExpanded(l.key)} />
            {l.key === "products" && productLedgerSlot ? (
              productLedgerSlot
            ) : l.key === "store" && storeLedgerSlot ? (
              storeLedgerSlot
            ) : l.key === "nonsales" && nonSalesLedgerSlot ? (
              nonSalesLedgerSlot
            ) : l.key === "cash" && cashLedgerSlot ? (
              cashLedgerSlot
            ) : (
              <div className="overflow-hidden rounded-lg border bg-card">
                <SectionNotBuilt section={l.label} />
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {expanded && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background">
          <div className="flex items-center gap-2 border-b px-3 py-2">
            <span className="flex-1 text-[13px] font-medium">
              {subLedgers.find((l) => l.key === expanded)?.label}
            </span>
            <Button variant="ghost" size="sm" className="h-8" onClick={() => setExpanded(null)}>
              <X className="size-4" /> Close
            </Button>
          </div>
          <div className="flex-1 overflow-auto p-2">
            {expanded === "products" && productLedgerSlot ? (
              productLedgerSlot
            ) : expanded === "store" && storeLedgerSlot ? (
              storeLedgerSlot
            ) : expanded === "nonsales" && nonSalesLedgerSlot ? (
              nonSalesLedgerSlot
            ) : expanded === "cash" && cashLedgerSlot ? (
              cashLedgerSlot
            ) : (
              <SectionNotBuilt section={subLedgers.find((l) => l.key === expanded)?.label ?? ""} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Offered on narrow screens, never forced. */
function RotatePrompt({ onExpand }: { onExpand: () => void }) {
  return (
    <button
      onClick={onExpand}
      className="mb-3 flex w-full items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-left lg:hidden"
    >
      <RotateCw className="size-4 shrink-0 text-muted-foreground" />
      <span className="flex-1 text-[13px]">
        <span className="font-medium">More room for the table</span>
        <span className="block text-[11px] text-muted-foreground">
          Turn your phone sideways and tap here
        </span>
      </span>
      <Maximize2 className="size-4 shrink-0 text-muted-foreground" />
    </button>
  );
}

function LedgerWaterfall({
  state,
  active,
  onSelect,
  onRetry,
}: {
  state: LoadState;
  active: StatTerm | null;
  onSelect: (t: StatTerm) => void;
  onRetry: () => void;
}) {
  if (state.status === "loading") {
    return (
      <div className="overflow-hidden rounded-xl border bg-card shadow-sm" data-testid="ledger-waterfall-loading">
        <div className="px-5 pt-4 pb-3">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="mt-2 h-3 w-56" />
        </div>
        <div className="grid grid-cols-2 gap-px bg-border lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="space-y-2 bg-card p-5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (state.status === "denied") {
    return (
      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="p-4">
          <PermissionDenied
            title="The ledger is owner-only"
            body="Cost of goods sold and profit are financial figures. Ask the owner if you need to see them."
          />
        </div>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="p-4">
          <ErrorState what="the ledger" onRetry={onRetry} />
        </div>
      </div>
    );
  }

  const { data } = state;
  const hasMovements =
    data.openingMinor > 0 ||
    data.purchasesMinor > 0 ||
    data.closingMinor > 0 ||
    data.salesValueMinor > 0;

  if (!hasMovements) {
    return (
      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="flex flex-col items-center justify-center px-6 py-12 text-center" data-testid="ledger-waterfall-empty">
          <p className="text-sm font-medium">No movements in this period</p>
          <p className="mt-1 max-w-sm text-[13px] text-muted-foreground">
            Nothing was bought, sold or used up in the selected period.
          </p>
        </div>
      </div>
    );
  }

  const terms: {
    key: StatTerm;
    label: string;
    value: number | null;
    operator?: string;
    colour: string;
    provisional?: boolean;
  }[] = [
    { key: "opening", label: "Opening stock", value: data.openingMinor, colour: "var(--color-neutral-400)" },
    {
      key: "purchases",
      label: "Purchases",
      value: data.purchasesMinor,
      operator: "+",
      colour: "var(--color-brand-600)",
    },
    {
      key: "closing",
      label: "Closing stock",
      value: data.closingMinor,
      operator: "−",
      colour: "var(--color-neutral-400)",
    },
    {
      key: "cogs",
      label: "Cost of goods sold",
      value: data.costOfGoodsSoldMinor,
      operator: "=",
      colour: "var(--color-danger)",
      provisional: true,
    },
  ];
  const max = Math.max(...terms.map((t) => t.value ?? 0), 1);

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm" data-testid="ledger-waterfall">
      <div className="flex items-center justify-between px-5 pt-4 pb-3">
        <div>
          <h2 className="text-sm font-medium">Cost of goods sold</h2>
          <p className="text-xs text-muted-foreground">What the stock movements below add up to.</p>
        </div>
        <Badge variant="outline" className="text-[10px] font-normal">
          partly provisional
        </Badge>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4">
        {terms.map((t, i) => {
          const on = active === t.key;
          return (
            <button
              key={t.key}
              onClick={() => onSelect(t.key)}
              data-testid={`ledger-waterfall-term-${t.key}`}
              className={`group relative flex flex-col justify-between pt-3 pb-0 text-left transition-colors duration-100 ${
                on ? "bg-card" : "bg-muted/25 hover:bg-muted/50"
              } ${i > 0 ? "border-l" : ""}`}
              aria-pressed={on}
            >
              <span
                className="absolute inset-x-0 top-0 h-0.5 transition-opacity duration-100"
                style={{ background: t.colour, opacity: on ? 1 : 0 }}
              />
              <div className="px-5">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  {t.operator && <span className="text-sm text-muted-foreground/60">{t.operator}</span>}
                  {t.label}
                  {t.provisional && (
                    <span title="Canteen own-goods cost is estimated between counts">
                      <Info className="size-3" />
                    </span>
                  )}
                </div>
                <div className="tabular mt-1 text-2xl font-semibold">
                  {t.value != null ? money(t.value) : "—"}
                </div>
                <div className="tabular mt-0.5 mb-3 text-[11px] text-muted-foreground">&nbsp;</div>
              </div>
              <div className="h-1.5 w-full bg-muted">
                <div
                  className="h-full transition-[width] duration-200"
                  style={{ width: `${((t.value ?? 0) / max) * 100}%`, background: t.colour }}
                />
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t bg-muted/20 px-5 py-3">
        <Piece label="Sales value" value={data.salesValueMinor} />
        <Piece label="Gross profit" value={data.grossProfitMinor} strong />
        <Piece
          label="Non-sales consumption"
          value={data.nonSalesAtCostMinor}
          tone="danger"
          note={`${money(data.nonSalesAtPriceMinor)} at selling price`}
        />
        <p className="ml-auto max-w-md text-[11px] text-muted-foreground">
          Non-sales consumption is already inside cost of goods sold — stock no longer present
          was counted as used up. It is shown to say where stock went, not deducted twice.
        </p>
      </div>
    </div>
  );
}

function Piece({
  label,
  value,
  strong,
  tone,
  note,
}: {
  label: string;
  value: number | null;
  strong?: boolean;
  tone?: "danger";
  note?: string;
}) {
  return (
    <span className="whitespace-nowrap">
      <span className="text-[11px] text-muted-foreground">{label} </span>
      <span
        className={`tabular text-[13px] ${strong ? "font-semibold" : ""} ${tone === "danger" ? "text-danger" : ""}`}
      >
        {value != null ? money(value) : "—"}
      </span>
      {note && <span className="tabular ml-1 text-[11px] text-muted-foreground">· {note}</span>}
    </span>
  );
}
