"use client";

/**
 * Dashboard's Revenue and profit chart (ticket 47) — adapted from the
 * design-reference worktree's `RevenueProfitChart`
 * (`components/design/dashboard/charts.tsx`): one axis, revenue as
 * context, net profit as emphasis, no dual scale, no pie chart. Only the
 * `revenue-profit` series pair is built here — the reference file's other
 * four series options (cost, cash/M-Pesa, owed, by-location) belong to a
 * fuller history view, out of this ticket's scope; the Ledger is where
 * that history is browsed in full.
 *
 * Closed days are gaps, not zeroes: a day with zero Sale rows and zero
 * Takings rows across both locations breaks the bars rather than drawing
 * to the floor — see getRevenueProfitTrend's own comment for why no
 * business-wide "closed" signal exists beyond that. Built to the dataviz
 * skill's mark specs: bars capped at 24px with a 4px rounded data-end
 * square at the baseline, a 2px surface gap between adjacent bars,
 * hairline solid gridlines one step off the surface.
 */

import { useEffect, useRef, useState } from "react";
import { ErrorState, PermissionDenied, EmptyFirstUse } from "@/components/patterns/states";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp } from "lucide-react";
import { money, moneyCompact } from "@/shared/money";

const PALETTE = {
  revenue: "var(--color-neutral-300)",
  profit: "var(--color-brand-600)",
  grid: "var(--color-neutral-200)",
};

export type RevenueProfitTrendPoint = {
  date: string;
  revenue: number | null;
  netProfit: number | null;
};

export type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "denied" }
  | { status: "ready"; points: RevenueProfitTrendPoint[] };

async function fetchRevenueProfitTrend(days = 14): Promise<LoadState> {
  try {
    const response = await fetch(`/api/dashboard/revenue-profit-trend?days=${days}`);
    if (response.status === 403) return { status: "denied" };
    if (!response.ok) return { status: "error" };
    const body = await response.json();
    return { status: "ready", points: body.points };
  } catch {
    return { status: "error" };
  }
}

export function DashboardRevenueProfitChart() {
  const [attempt, setAttempt] = useState(0);
  return <DashboardRevenueProfitChartForAttempt key={attempt} onRetry={() => setAttempt((a) => a + 1)} />;
}

function DashboardRevenueProfitChartForAttempt({ onRetry }: { onRetry: () => void }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  useEffect(() => {
    fetchRevenueProfitTrend().then((result) => {
      if (!cancelledRef.current) setState(result);
    });
  }, []);

  return <DashboardRevenueProfitChartView state={state} onRetry={onRetry} />;
}

function dayLabel(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-KE", { weekday: "short", day: "numeric" });
}

/** The presentational half, driven by state rather than fetching — what
 * Storybook mounts to show every state without a network. */
export function DashboardRevenueProfitChartView({
  state,
  onRetry = () => {},
}: {
  state: LoadState;
  onRetry?: () => void;
}) {
  if (state.status === "loading") {
    return (
      <div className="p-5" data-testid="dashboard-revenue-profit-chart-loading">
        <Skeleton className="mb-3 h-3 w-40" />
        <Skeleton className="h-[168px] w-full" />
      </div>
    );
  }

  if (state.status === "denied") {
    return (
      <div className="p-4">
        <PermissionDenied
          title="Revenue and profit is owner-only"
          body="Revenue and net profit are financial figures. Ask the owner if you need to see them."
        />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="p-4">
        <ErrorState what="the revenue and profit trend" onRetry={onRetry} />
      </div>
    );
  }

  const { points } = state;
  const hasAnyTrading = points.some((p) => p.revenue !== null);
  if (!hasAnyTrading) {
    return (
      <div className="p-4">
        <EmptyFirstUse
          icon={<TrendingUp className="size-4" />}
          title="No trading history yet"
          body="Once sales and takings start coming in, this chart will show revenue and net profit over time."
        />
      </div>
    );
  }

  return <RevenueProfitBars points={points} />;
}

function RevenueProfitBars({ points }: { points: RevenueProfitTrendPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);

  const height = 168;
  const axisBand = 20;
  const plot = height - axisBand;

  const values = points.flatMap((p) => [p.revenue, p.netProfit].filter((v): v is number => v !== null));
  const max = Math.max(...values, 0);
  const magnitude = Math.pow(10, Math.floor(Math.log10(max || 1)));
  const ceiling = Math.ceil(max / (magnitude / 2)) * (magnitude / 2) || 1;
  const ticks = [0, ceiling / 2, ceiling];

  const active = hover !== null ? points[hover] : null;

  return (
    <div className="p-5" data-testid="dashboard-revenue-profit-chart">
      <div className="mb-3 flex items-center gap-4">
        <Legend color={PALETTE.revenue} label="Revenue" />
        <Legend color={PALETTE.profit} label="Net profit" />
      </div>

      <div className="relative" style={{ height }} onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <div
            key={t}
            className="absolute right-0 left-10 border-t"
            style={{ top: plot - (t / ceiling) * plot, borderColor: PALETTE.grid }}
          />
        ))}
        {ticks.map((t) => (
          <div
            key={`l-${t}`}
            className="tabular absolute left-0 -translate-y-1/2 text-[10px] text-muted-foreground"
            style={{ top: plot - (t / ceiling) * plot }}
          >
            {moneyCompact(t)}
          </div>
        ))}

        <div className="absolute inset-0 left-10 flex items-end gap-[2px]">
          {points.map((p, i) => {
            const closed = p.revenue === null;
            const revenueHeight = closed ? 0 : (p.revenue! / ceiling) * plot;
            const profitHeight = p.netProfit === null ? 0 : (p.netProfit / ceiling) * plot;
            return (
              <button
                key={p.date}
                type="button"
                className="group relative flex h-full flex-1 flex-col justify-end"
                style={{ paddingBottom: axisBand }}
                onMouseEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                aria-label={
                  closed
                    ? `${dayLabel(p.date)}: closed`
                    : `${dayLabel(p.date)}: Revenue ${money(p.revenue!)}, Net profit ${
                        p.netProfit != null ? money(p.netProfit) : "not yet available"
                      }`
                }
              >
                {closed ? (
                  <span className="mx-auto mb-1 text-[9px] text-muted-foreground">closed</span>
                ) : (
                  <span
                    className="relative mx-auto block w-full"
                    style={{ maxWidth: 14, opacity: hover === null || hover === i ? 1 : 0.5 }}
                  >
                    <span
                      className="absolute bottom-0 left-0 w-full rounded-b-sm"
                      style={{ height: revenueHeight, background: PALETTE.revenue }}
                    />
                    <span
                      className="absolute bottom-0 left-0 w-full rounded-b-sm"
                      style={{ height: profitHeight, background: PALETTE.profit }}
                    />
                  </span>
                )}
                <span
                  className="absolute right-0 bottom-0 left-0 truncate text-center text-[9px] text-muted-foreground"
                  style={{ height: axisBand, lineHeight: `${axisBand}px` }}
                >
                  {i % 2 === 0 ? dayLabel(p.date) : ""}
                </span>
              </button>
            );
          })}
        </div>

        {active && (
          <div
            className="pointer-events-none absolute z-10 rounded-md border bg-popover px-2.5 py-1.5 text-xs shadow-md"
            style={{
              left: `calc(2.5rem + ${((hover! + 0.5) / points.length) * 100}%)`,
              top: 0,
              transform: "translateX(-50%)",
            }}
          >
            <div className="mb-0.5 font-medium">{dayLabel(active.date)}</div>
            {active.revenue === null ? (
              <div className="text-muted-foreground">Closed</div>
            ) : (
              <>
                <Tip color={PALETTE.revenue} label="Revenue" value={money(active.revenue)} />
                <Tip
                  color={PALETTE.profit}
                  label="Net profit"
                  value={active.netProfit != null ? money(active.netProfit) : "—"}
                />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className="size-2.5 rounded-[2px]" style={{ background: color }} aria-hidden />
      {label}
    </span>
  );
}

function Tip({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="size-2 shrink-0 rounded-[2px]" style={{ background: color }} aria-hidden />
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular ml-auto font-medium">{value}</span>
    </div>
  );
}
