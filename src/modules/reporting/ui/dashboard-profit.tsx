"use client";

/**
 * Dashboard's Profit panel (ticket 25) — adapted from the design-reference
 * worktree's locked `DashboardR3` waterfall
 * (`components/design/dashboard/dashboard-r3.tsx`, `figures.tsx`): one
 * continuous track for revenue / cost of goods sold / running costs / net
 * profit, a raised selection with a top rule in the term's own colour, and
 * an expandable detail panel per term. Same fetching/LoadState/presentational
 * split as ticket 14's `dashboard-handovers.tsx`, since the prototype only
 * ever rendered fixture data.
 *
 * Only the canteen side of cost of goods sold was this ticket's original
 * scope; restaurant cost of goods, running costs and net profit assembly
 * were added to the same ticket by user decision (2026-08-11) once ticket
 * 25's own text ruled them out as already-real elsewhere, since a
 * partly-placeholder waterfall wasn't what was wanted — see the ticket file
 * for that scope note.
 *
 * 2026-08-13 canteen redesign, item 8: the canteen's cost of goods and
 * profit are final now, same status as the restaurant's — the count-
 * derived estimate (canteenCostRate/lastCanteenCount/canteenEstimated/
 * provisional) this view previously read no longer exists in
 * getDashboardProfit's response (see reporting/logic.ts). Every figure
 * here is final and presented the same way, no "provisional" badge.
 */

import { useEffect, useRef, useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  SectionHeader,
  ErrorState,
  PermissionDenied,
} from "@/components/patterns/states";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight } from "lucide-react";
import { money } from "@/shared/money";
import { isOpeningBalanceLoadDay } from "./opening-balance";

export type DashboardProfitLocationBreakdown = {
  revenueMinor: number;
  costOfGoodsMinor: number;
  grossProfitMinor: number;
  runningCostsMinor: number;
  netProfitMinor: number;
};

export type DashboardProfitData = {
  revenue: { restaurant: number; canteen: number; total: number };
  costOfGoods: { restaurant: number; canteen: number; total: number };
  runningCostsMinor: number;
  grossProfitMinor: number;
  netProfitMinor: number;
  byLocation: {
    restaurant: DashboardProfitLocationBreakdown;
    canteen: DashboardProfitLocationBreakdown;
  };
};

export type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "denied" }
  | { status: "ready"; data: DashboardProfitData };

export type Period = "day" | "week" | "month" | "custom";

function isIsoDate(v: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(v);
}

/** Local calendar date as YYYY-MM-DD, for the two `type="date"` inputs.
 * Deliberately not `toISOString()`, which formats in UTC — east of
 * Greenwich (Nairobi is UTC+3) that yields *yesterday* for every local
 * time before 03:00. Same helper as `ledger-shell.tsx`'s. */
export function isoDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// ISO week (Monday start) and calendar month — no existing convention in
// docs/conventions.md for either, confirmed with Edwinfred (ticket 46).
//
// 2026-08-18: "custom" added so the owner can pick any range, or a single
// day anywhere in the past, rather than only the three presets (client
// request). The Ledger already had this; the Dashboard did not. A custom
// range reads its bounds from `customStart`/`customEnd` instead of `now`,
// and — matching the Ledger — treats both as *inclusive* local dates, so
// picking the same date twice means that one whole day. The presets stay
// half-open (end is exclusive), which is why custom builds its end from
// the day *after* customEnd.
function periodBounds(
  period: Period,
  now: Date,
  customStart?: string,
  customEnd?: string,
): { periodStart: Date; periodEnd: Date } {
  if (period === "custom") {
    const start = new Date(`${customStart}T00:00:00`);
    const end = new Date(`${customEnd}T00:00:00`);
    end.setDate(end.getDate() + 1);
    return { periodStart: start, periodEnd: end };
  }
  if (period === "day") {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { periodStart: start, periodEnd: end };
  }
  if (period === "week") {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    // getDay(): 0 = Sunday .. 6 = Saturday. Days back to Monday: Sunday
    // needs 6, everything else needs (day - 1).
    const day = start.getDay();
    const daysSinceMonday = day === 0 ? 6 : day - 1;
    start.setDate(start.getDate() - daysSinceMonday);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return { periodStart: start, periodEnd: end };
  }
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { periodStart: start, periodEnd: end };
}

const zeroDashboardProfitData: DashboardProfitData = {
  revenue: { restaurant: 0, canteen: 0, total: 0 },
  costOfGoods: { restaurant: 0, canteen: 0, total: 0 },
  runningCostsMinor: 0,
  grossProfitMinor: 0,
  netProfitMinor: 0,
  byLocation: {
    restaurant: { revenueMinor: 0, costOfGoodsMinor: 0, grossProfitMinor: 0, runningCostsMinor: 0, netProfitMinor: 0 },
    canteen: { revenueMinor: 0, costOfGoodsMinor: 0, grossProfitMinor: 0, runningCostsMinor: 0, netProfitMinor: 0 },
  },
};

async function fetchDashboardProfit(
  period: Period,
  customStart: string,
  customEnd: string,
): Promise<LoadState> {
  // 2026-08-14's opening-balance stock load produces a large negative
  // cost-of-goods-sold (see opening-balance.ts) — real trading hasn't
  // started, so there's nothing real to show yet. Skip the fetch and show
  // a quiet zero day instead of that artifact. Only suppresses the "Day"
  // default — picking 8/14 explicitly via Custom still shows the real
  // figures, matching `ledger-shell.tsx`'s handling of the same day.
  const now = new Date();
  if (period === "day" && isOpeningBalanceLoadDay(now)) {
    return { status: "ready", data: zeroDashboardProfitData };
  }
  // A half-typed date input ("2026-08-") parses as Invalid Date and would
  // send "Invalid Date" to the route, which 400s. Hold the previous view
  // instead of flashing an error while she is still picking.
  if (period === "custom" && !(isIsoDate(customStart) && isIsoDate(customEnd))) {
    return { status: "loading" };
  }
  try {
    const { periodStart, periodEnd } = periodBounds(period, new Date(), customStart, customEnd);
    if (Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEnd.getTime())) {
      return { status: "error" };
    }
    // The route requires periodStart < periodEnd. An inverted custom range
    // (end before start) is a normal thing to have on screen mid-pick, so
    // treat it as "nothing to show" rather than an error.
    if (periodStart >= periodEnd) {
      return { status: "ready", data: zeroDashboardProfitData };
    }
    const params = new URLSearchParams({
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
    });
    const response = await fetch(`/api/dashboard/profit?${params}`);
    if (response.status === 403) return { status: "denied" };
    if (!response.ok) return { status: "error" };
    const body = await response.json();
    return { status: "ready", data: body };
  } catch {
    return { status: "error" };
  }
}

export function DashboardProfit() {
  const [attempt, setAttempt] = useState(0);
  return <DashboardProfitForAttempt key={attempt} onRetry={() => setAttempt((a) => a + 1)} />;
}

function DashboardProfitForAttempt({ onRetry }: { onRetry: () => void }) {
  const [period, setPeriod] = useState<Period>("day");
  // Defaults for the custom inputs: the last seven days, so switching to
  // Custom lands on a sensible range rather than two empty boxes. Kept
  // even when a preset is active, so toggling back to Custom restores
  // whatever she last picked. Unlike the Ledger this is component state,
  // not URL state — the Dashboard has no existing query-param convention
  // and this control governs one card, not the page.
  const [customStart, setCustomStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return isoDate(d);
  });
  const [customEnd, setCustomEnd] = useState(() => isoDate(new Date()));

  return (
    <DashboardProfitForPeriod
      key={period === "custom" ? `custom:${customStart}:${customEnd}` : period}
      period={period}
      onPeriodChange={setPeriod}
      customStart={customStart}
      customEnd={customEnd}
      onCustomStartChange={setCustomStart}
      onCustomEndChange={setCustomEnd}
      onRetry={onRetry}
    />
  );
}

function DashboardProfitForPeriod({
  period,
  onPeriodChange,
  customStart,
  customEnd,
  onCustomStartChange,
  onCustomEndChange,
  onRetry,
}: {
  period: Period;
  onPeriodChange: (period: Period) => void;
  customStart: string;
  customEnd: string;
  onCustomStartChange: (v: string) => void;
  onCustomEndChange: (v: string) => void;
  onRetry: () => void;
}) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  useEffect(() => {
    fetchDashboardProfit(period, customStart, customEnd).then((result) => {
      if (!cancelledRef.current) setState(result);
    });
  }, [period, customStart, customEnd]);

  return (
    <DashboardProfitView
      state={state}
      period={period}
      onPeriodChange={onPeriodChange}
      customStart={customStart}
      customEnd={customEnd}
      onCustomStartChange={onCustomStartChange}
      onCustomEndChange={onCustomEndChange}
      onRetry={onRetry}
    />
  );
}

type TermKey = "revenue" | "cogs" | "running" | "net";

/** The presentational half, driven by state rather than fetching — what
 * Storybook mounts to show every state without a network. */
export function DashboardProfitView({
  state,
  period = "day",
  onPeriodChange = () => {},
  customStart = "",
  customEnd = "",
  onCustomStartChange = () => {},
  onCustomEndChange = () => {},
  onRetry = () => {},
}: {
  state: LoadState;
  period?: Period;
  onPeriodChange?: (period: Period) => void;
  customStart?: string;
  customEnd?: string;
  onCustomStartChange?: (v: string) => void;
  onCustomEndChange?: (v: string) => void;
  onRetry?: () => void;
}) {
  // Keying on period remounts this state below on every period change, so
  // switching period resets the expanded detail term rather than trying to
  // preserve it — a different period's own detail is usually what's
  // relevant, and there's no guarantee the same term stays interesting
  // (ticket 46's acceptance criteria: pick one, document the choice).
  return (
    <DashboardProfitViewForPeriod
      key={period}
      {...{
        state,
        period,
        onPeriodChange,
        customStart,
        customEnd,
        onCustomStartChange,
        onCustomEndChange,
        onRetry,
      }}
    />
  );
}

function DashboardProfitViewForPeriod({
  state,
  period,
  onPeriodChange,
  customStart,
  customEnd,
  onCustomStartChange,
  onCustomEndChange,
  onRetry,
}: {
  state: LoadState;
  period: Period;
  onPeriodChange: (period: Period) => void;
  customStart: string;
  customEnd: string;
  onCustomStartChange: (v: string) => void;
  onCustomEndChange: (v: string) => void;
  onRetry: () => void;
}) {
  const [open, setOpen] = useState<TermKey | null>("cogs");

  if (state.status === "loading") {
    return (
      <div className="mb-4 overflow-hidden rounded-xl border bg-card">
        <SectionHeader title="Profit" />
        <div className="grid grid-cols-2 gap-px bg-border lg:grid-cols-4" data-testid="dashboard-profit-loading">
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
      <div className="mb-4 overflow-hidden rounded-xl border bg-card">
        <SectionHeader title="Profit" />
        <div className="p-4">
          <PermissionDenied
            title="Profit is owner-only"
            body="Revenue, cost of goods sold and net profit are financial figures. Ask the owner if you need to see them."
          />
        </div>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="mb-4 overflow-hidden rounded-xl border bg-card">
        <SectionHeader title="Profit" />
        <div className="p-4">
          <ErrorState what="the profit figures" onRetry={onRetry} />
        </div>
      </div>
    );
  }

  const { data } = state;
  const max = data.revenue.total;
  const pct = (n: number | null) => Math.max(0, n != null && max > 0 ? (n / max) * 100 : 0);

  const terms: {
    key: TermKey;
    label: string;
    value: number | null;
    width: number;
    colour: string;
    operator?: string;
  }[] = [
    {
      key: "revenue",
      label: "Revenue",
      value: data.revenue.total,
      width: 100,
      colour: "var(--color-neutral-400)",
    },
    {
      key: "cogs",
      label: "Cost of goods sold",
      value: data.costOfGoods.total,
      width: pct(data.costOfGoods.total),
      colour: "var(--color-danger)",
      operator: "−",
    },
    {
      key: "running",
      label: "Operating costs",
      value: data.runningCostsMinor,
      width: pct(data.runningCostsMinor),
      colour: "var(--color-warning)",
      operator: "−",
    },
    {
      key: "net",
      label: "Net profit",
      value: data.netProfitMinor,
      width: pct(data.netProfitMinor),
      colour: "var(--color-success)",
      operator: "=",
    },
  ];

  return (
    <>
    <div className="mb-4 overflow-hidden rounded-xl border bg-card shadow-sm" data-testid="dashboard-profit">
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-4 pb-3">
        <h2 className="text-sm font-medium">Profit</h2>
        <div className="flex flex-wrap items-center gap-2">
          {/* The two date inputs sit before the tabs so the range reads
              left-to-right into the "Custom" tab that owns it. Shown only
              when Custom is active — the presets have no range to edit. */}
          {period === "custom" && (
            <div className="flex items-center gap-1.5" data-testid="dashboard-profit-custom-range">
              <Input
                type="date"
                aria-label="Range start"
                value={customStart}
                max={customEnd || undefined}
                onChange={(e) => onCustomStartChange(e.target.value)}
                className="h-8 w-auto text-[13px]"
                data-testid="dashboard-profit-custom-start"
              />
              <span className="text-xs text-muted-foreground">to</span>
              <Input
                type="date"
                aria-label="Range end"
                value={customEnd}
                min={customStart || undefined}
                onChange={(e) => onCustomEndChange(e.target.value)}
                className="h-8 w-auto text-[13px]"
                data-testid="dashboard-profit-custom-end"
              />
            </div>
          )}
          <Tabs value={period} onValueChange={(value) => onPeriodChange(value as Period)}>
            <TabsList>
              <TabsTrigger value="day">Day</TabsTrigger>
              <TabsTrigger value="week">Week</TabsTrigger>
              <TabsTrigger value="month">Month</TabsTrigger>
              <TabsTrigger value="custom" data-testid="dashboard-profit-period-custom">
                Custom
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4">
        {terms.map((t, i) => {
          const on = open === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setOpen(on ? null : t.key)}
              data-testid={`dashboard-profit-term-${t.key}`}
              className={`group relative flex flex-col justify-between pt-3 pb-0 text-left transition-colors duration-100 ${
                on ? "bg-card" : "bg-muted/25 hover:bg-muted/50"
              } ${i > 0 ? "border-l" : ""}`}
              aria-expanded={on}
            >
              <span
                className="absolute inset-x-0 top-0 h-0.5 transition-opacity duration-100"
                style={{ background: t.colour, opacity: on ? 1 : 0 }}
              />

              <div className="px-5">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  {t.operator && <span className="text-sm text-muted-foreground/60">{t.operator}</span>}
                  {t.label}
                </div>
                <div className="tabular mt-1 text-2xl font-semibold">
                  {t.value != null ? money(t.value) : "—"}
                </div>
                <div className="tabular mt-0.5 mb-3 text-[11px] text-muted-foreground">
                  {t.key === "revenue"
                    ? "of takings"
                    : t.value != null && max > 0
                      ? `${((t.value / max) * 100).toFixed(0)}% of revenue`
                      : "—"}
                </div>
              </div>

              <div className="h-1.5 w-full bg-muted">
                <div className="h-full transition-[width] duration-200" style={{ width: `${t.width}%`, background: t.colour }} />
              </div>
            </button>
          );
        })}
      </div>

      {open && (
        <div className="border-t bg-muted/20 px-5 py-4">
          {open === "revenue" && (
            <Detail title="Where the revenue came from">
              <Term label="Restaurant — each sale as recorded" value={data.revenue.restaurant} />
              {/* "the day's declared takings" until 2026-08-18 — wrong for
                  Week and Month even before Custom existed, since this
                  panel renders for whatever period is selected. */}
              <Term label="Canteen — declared takings" value={data.revenue.canteen} />
              <Term label="Revenue" value={data.revenue.total} rule strong />
            </Detail>
          )}
          {open === "cogs" && (
            <Detail title="What stock was used up">
              <Term label="Restaurant" value={data.costOfGoods.restaurant} muted />
              <Term label="Canteen" value={data.costOfGoods.canteen} muted />
              <div className="mt-3 border-t pt-2">
                <Term label="Cost of goods sold" value={data.costOfGoods.total} strong />
              </div>
            </Detail>
          )}
          {open === "running" && (
            <Detail title="What the business spent to keep running">
              <Term label="Operating costs" value={data.runningCostsMinor} rule strong />
              <p className="mt-3 text-xs text-muted-foreground">
                Equipment and your drawings are not here — they reduce cash but not profit.
              </p>
            </Detail>
          )}
          {open === "net" && (
            <Detail title="How the net profit is reached">
              <Term label="Revenue" value={data.revenue.total} />
              <Term label="Cost of goods sold" value={data.costOfGoods.total} sign="−" muted />
              <Term label="Gross profit" value={data.grossProfitMinor} rule strong />
              <Term label="Operating costs" value={data.runningCostsMinor} sign="−" muted />
              <Term label="Net profit" value={data.netProfitMinor} rule strong />
            </Detail>
          )}
          <LedgerLink />
        </div>
      )}
    </div>
    <ByLocation byLocation={data.byLocation} />
    </>
  );
}

function ByLocation({ byLocation }: { byLocation: DashboardProfitData["byLocation"] }) {
  const rows: { key: "restaurant" | "canteen"; label: string }[] = [
    { key: "restaurant", label: "Restaurant" },
    { key: "canteen", label: "Canteen" },
  ];

  return (
    <div className="mb-4 overflow-hidden rounded-xl border bg-card shadow-sm" data-testid="dashboard-profit-by-location">
      <SectionHeader title="By location" />
      <div className="divide-y">
        {rows.map(({ key, label }) => {
          const l = byLocation[key];
          return (
            <div key={key} className="px-5 py-3">
              <div className="mb-2 flex items-center gap-1.5">
                <span className="text-sm font-medium">{label}</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
                <LocationCell label="Revenue" value={l.revenueMinor} />
                <LocationCell label="Cost of goods" value={l.costOfGoodsMinor} />
                <LocationCell label="Gross profit" value={l.grossProfitMinor} />
                <LocationCell label="Operating costs" value={l.runningCostsMinor} />
                <LocationCell
                  label="Net profit"
                  value={l.netProfitMinor}
                  tone={l.netProfitMinor < 0 ? "danger" : undefined}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LocationCell({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | null;
  tone?: "danger";
}) {
  return (
    <div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className={`tabular font-medium ${tone === "danger" ? "text-danger" : ""}`}>
        {value == null ? "—" : value < 0 ? `−${money(Math.abs(value))}` : money(value)}
      </div>
    </div>
  );
}

function Detail({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-medium text-muted-foreground">{title}</h3>
      <div className="max-w-lg">{children}</div>
    </div>
  );
}

function Term({
  label,
  value,
  sign,
  rule,
  strong,
  muted,
}: {
  label: string;
  value: number | null;
  sign?: "+" | "−";
  rule?: boolean;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      className={`flex items-baseline justify-between gap-3 py-1 text-sm ${rule ? "mt-1 border-t pt-2" : ""} ${strong ? "font-semibold" : ""}`}
    >
      <span className={muted ? "text-muted-foreground" : ""}>{label}</span>
      <span className="tabular whitespace-nowrap">
        {value == null ? "—" : (sign === "−" ? "−" : "") + money(Math.abs(value))}
      </span>
    </div>
  );
}

function LedgerLink({ label = "Open the ledger" }: { label?: string }) {
  return (
    <button className="mt-2 flex items-center gap-1 text-xs text-muted-foreground transition-colors duration-100 hover:text-foreground">
      {label} <ArrowRight className="size-3" />
    </button>
  );
}
