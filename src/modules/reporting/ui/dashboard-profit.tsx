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
 * for that scope note. Every canteen figure here is provisional
 * (formulas.md §7's own-goods estimate) and labelled as such; restaurant,
 * revenue and running costs are final.
 */

import { useEffect, useRef, useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  SectionHeader,
  ErrorState,
  PermissionDenied,
} from "@/components/patterns/states";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, Info } from "lucide-react";
import { money } from "@/shared/money";

export type DashboardProfitLocationBreakdown = {
  revenueMinor: number;
  costOfGoodsMinor: number;
  grossProfitMinor: number;
  runningCostsMinor: number;
  netProfitMinor: number;
  provisional: boolean;
};

export type DashboardProfitData = {
  revenue: { restaurant: number; canteen: number; total: number };
  costOfGoods: {
    restaurant: number;
    canteenExact: number;
    canteenEstimated: number;
    total: number;
  };
  runningCostsMinor: number;
  grossProfitMinor: number;
  netProfitMinor: number;
  canteenCostRate: number | null;
  lastCanteenCount: string | null;
  correction:
    | {
        available: true;
        estimatedSinceLastCountMinor: number;
        measuredAtCountMinor: number;
        differenceMinor: number;
      }
    | { available: false };
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

export type Period = "day" | "week" | "month";

// ISO week (Monday start) and calendar month — no existing convention in
// docs/conventions.md for either, confirmed with Edwinfred (ticket 46).
function periodBounds(period: Period, now: Date): { periodStart: Date; periodEnd: Date } {
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

async function fetchDashboardProfit(period: Period): Promise<LoadState> {
  try {
    const { periodStart, periodEnd } = periodBounds(period, new Date());
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
  return (
    <DashboardProfitForPeriod
      key={period}
      period={period}
      onPeriodChange={setPeriod}
      onRetry={onRetry}
    />
  );
}

function DashboardProfitForPeriod({
  period,
  onPeriodChange,
  onRetry,
}: {
  period: Period;
  onPeriodChange: (period: Period) => void;
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
    fetchDashboardProfit(period).then((result) => {
      if (!cancelledRef.current) setState(result);
    });
  }, [period]);

  return <DashboardProfitView state={state} period={period} onPeriodChange={onPeriodChange} onRetry={onRetry} />;
}

type TermKey = "revenue" | "cogs" | "running" | "net";

/** The presentational half, driven by state rather than fetching — what
 * Storybook mounts to show every state without a network. */
export function DashboardProfitView({
  state,
  period = "day",
  onPeriodChange = () => {},
  onRetry = () => {},
}: {
  state: LoadState;
  period?: Period;
  onPeriodChange?: (period: Period) => void;
  onRetry?: () => void;
}) {
  // Keying on period remounts this state below on every period change, so
  // switching period resets the expanded detail term rather than trying to
  // preserve it — a different period's own detail is usually what's
  // relevant, and there's no guarantee the same term stays interesting
  // (ticket 46's acceptance criteria: pick one, document the choice).
  return <DashboardProfitViewForPeriod key={period} {...{ state, period, onPeriodChange, onRetry }} />;
}

function DashboardProfitViewForPeriod({
  state,
  period,
  onPeriodChange,
  onRetry,
}: {
  state: LoadState;
  period: Period;
  onPeriodChange: (period: Period) => void;
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
          <ErrorState what="today's profit" onRetry={onRetry} />
        </div>
      </div>
    );
  }

  const { data } = state;
  const max = data.revenue.total;
  const pct = (n: number) => Math.max(0, max > 0 ? (n / max) * 100 : 0);

  const terms: {
    key: TermKey;
    label: string;
    value: number;
    width: number;
    colour: string;
    provisional?: boolean;
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
      provisional: true,
      operator: "−",
    },
    {
      key: "running",
      label: "Running costs",
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
      provisional: true,
      operator: "=",
    },
  ];

  return (
    <>
    <div className="mb-4 overflow-hidden rounded-xl border bg-card shadow-sm" data-testid="dashboard-profit">
      <div className="flex items-center justify-between px-5 pt-4 pb-3">
        <h2 className="text-sm font-medium">Profit</h2>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px] font-normal">
            partly provisional
          </Badge>
          <Tabs value={period} onValueChange={(value) => onPeriodChange(value as Period)}>
            <TabsList>
              <TabsTrigger value="day">Day</TabsTrigger>
              <TabsTrigger value="week">Week</TabsTrigger>
              <TabsTrigger value="month">Month</TabsTrigger>
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
                <div className="tabular mt-1 text-2xl font-semibold">{money(t.value)}</div>
                <div className="tabular mt-0.5 mb-3 text-[11px] text-muted-foreground">
                  {t.key === "revenue" ? "of takings" : max > 0 ? `${((t.value / max) * 100).toFixed(0)}% of revenue` : "—"}
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
              <Term label="Canteen — the day's declared takings" value={data.revenue.canteen} />
              <Term label="Revenue" value={data.revenue.total} rule strong />
            </Detail>
          )}
          {open === "cogs" && (
            <Detail title="What stock was used up">
              <Term label="Restaurant" value={data.costOfGoods.restaurant} muted />
              <div className="mt-3 border-t pt-2">
                <Term label="Canteen — food from restaurant" value={data.costOfGoods.canteenExact} muted />
                <Term
                  label={
                    data.canteenCostRate != null
                      ? `Canteen — own goods, takings × ${(data.canteenCostRate * 100).toFixed(0)}%`
                      : "Canteen — own goods (no count yet)"
                  }
                  value={data.costOfGoods.canteenEstimated}
                  muted
                  note="estimated"
                />
                <Term label="Canteen cost" value={data.costOfGoods.canteenExact + data.costOfGoods.canteenEstimated} rule strong />
              </div>
              <div className="mt-3 border-t pt-2">
                <Term label="Cost of goods sold" value={data.costOfGoods.total} strong />
              </div>
              <div className="mt-3">
                <ProvisionalNote lastCount={data.lastCanteenCount} />
              </div>
              {data.correction.available && (
                <div className="mt-3 border-t pt-2" data-testid="dashboard-profit-correction">
                  <h4 className="mb-1 text-[11px] font-medium text-muted-foreground">
                    The last count corrected the estimate
                  </h4>
                  <Term label="Estimated since last count" value={data.correction.estimatedSinceLastCountMinor} muted />
                  <Term label="Measured at the count" value={data.correction.measuredAtCountMinor} muted />
                  <Term
                    label="Correction"
                    value={data.correction.differenceMinor}
                    sign={data.correction.differenceMinor < 0 ? "−" : undefined}
                    strong
                  />
                </div>
              )}
            </Detail>
          )}
          {open === "running" && (
            <Detail title="What the business spent to keep running">
              <Term label="Running costs" value={data.runningCostsMinor} rule strong />
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
              <Term label="Running costs" value={data.runningCostsMinor} sign="−" muted />
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
                {l.provisional && (
                  <Badge variant="outline" className="text-[10px] font-normal">
                    provisional
                  </Badge>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
                <LocationCell label="Revenue" value={l.revenueMinor} />
                <LocationCell label="Cost of goods" value={l.costOfGoodsMinor} />
                <LocationCell label="Gross profit" value={l.grossProfitMinor} />
                <LocationCell label="Running costs" value={l.runningCostsMinor} />
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
  value: number;
  tone?: "danger";
}) {
  return (
    <div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className={`tabular font-medium ${tone === "danger" ? "text-danger" : ""}`}>
        {value < 0 ? `−${money(Math.abs(value))}` : money(value)}
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
  note,
}: {
  label: string;
  value: number;
  sign?: "+" | "−";
  rule?: boolean;
  strong?: boolean;
  muted?: boolean;
  note?: string;
}) {
  return (
    <div
      className={`flex items-baseline justify-between gap-3 py-1 text-sm ${rule ? "mt-1 border-t pt-2" : ""} ${strong ? "font-semibold" : ""}`}
    >
      <span className={muted ? "text-muted-foreground" : ""}>
        {label}
        {note && (
          <Badge variant="outline" className="ml-1.5 text-[10px] font-normal">
            {note}
          </Badge>
        )}
      </span>
      <span className="tabular whitespace-nowrap">
        {sign === "−" ? "−" : ""}
        {money(Math.abs(value))}
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

function ProvisionalNote({ lastCount }: { lastCount: string | null }) {
  return (
    <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
      <Info className="mt-0.5 size-3 shrink-0" />
      {lastCount
        ? `Canteen own-goods cost is estimated from the rate measured at the last count on ${new Date(lastCount).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}. Replaced by a measured figure at the next count, and the correction is reported rather than applied silently.`
        : "Canteen own-goods cost has no measured rate yet — record a canteen stock count to replace this estimate with a real figure."}
    </p>
  );
}
