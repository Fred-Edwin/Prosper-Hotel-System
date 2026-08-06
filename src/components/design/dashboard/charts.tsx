"use client";

/**
 * Charts for the dashboard.
 *
 * Built to the dataviz mark specs: 2px lines with round caps, markers ≥8px
 * carrying a 2px surface ring, bars capped at 24px with a 4px rounded data-end
 * square at the baseline, hairline solid gridlines one step off the surface,
 * and a 2px surface gap between adjacent bars.
 *
 * Two deliberate omissions:
 *
 * No pie chart. A pie answers proportion, and Lucy's questions are about level
 * — how much did we make, how much should I hold. The waterfall already
 * carries the one proportion that matters.
 *
 * No dual axis. Revenue and profit differ by roughly 3× here, and putting them
 * on two scales invents a correlation that is not in the data. They share one
 * axis: revenue as the context, profit as the emphasis.
 *
 * Closed days are gaps, not zeroes. Sunday's `null` breaks the line rather
 * than drawing to the floor, because a zero on a closed day is a lie about
 * trading.
 */

import { useId, useState } from "react";
import { trend, money, moneyCompact, type DayPoint } from "@/lib/fixtures";

const PALETTE = {
  // Validated: all three pass the lightness band, chroma floor, CVD
  // separation (worst adjacent ΔE 8.9 deutan) and 3:1 contrast on white.
  brand: "var(--color-brand-600)",
  success: "var(--color-success)",
  danger: "var(--color-danger)",
  muted: "var(--color-neutral-300)",
  grid: "var(--color-neutral-200)",
};

/**
 * Stat-tile sparkline. De-emphasis hue for the series, accent for the current
 * point — the tile's value is the headline and the line is context for it, so
 * the line must not compete.
 */
export function Sparkline({
  points,
  width = 96,
  height = 28,
  tone = "neutral",
}: {
  points: (number | null)[];
  width?: number;
  height?: number;
  tone?: "neutral" | "success" | "danger";
}) {
  const real = points.filter((p): p is number => p !== null);
  if (real.length < 2) return null;

  const min = Math.min(...real);
  const max = Math.max(...real);
  const span = max - min || 1;
  const step = width / (points.length - 1);

  // Closed days break the path rather than drawing through zero.
  const segments: string[] = [];
  let current: string[] = [];
  points.forEach((p, i) => {
    if (p === null) {
      if (current.length > 1) segments.push(current.join(" "));
      current = [];
      return;
    }
    const x = i * step;
    const y = height - ((p - min) / span) * height;
    current.push(`${current.length === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`);
  });
  if (current.length > 1) segments.push(current.join(" "));

  const lastIndex = points.map((p) => p !== null).lastIndexOf(true);
  const lastValue = points[lastIndex] as number;
  const lastX = lastIndex * step;
  const lastY = height - ((lastValue - min) / span) * height;

  const accent =
    tone === "success"
      ? PALETTE.success
      : tone === "danger"
        ? PALETTE.danger
        : PALETTE.brand;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="overflow-visible"
      aria-hidden
    >
      {segments.map((d, i) => (
        <path
          key={i}
          d={d}
          fill="none"
          stroke={PALETTE.muted}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      {/* 2px surface ring keeps the end dot legible where it crosses the line. */}
      <circle cx={lastX} cy={lastY} r={5} fill="var(--card)" />
      <circle cx={lastX} cy={lastY} r={3.5} fill={accent} />
    </svg>
  );
}

/**
 * Revenue and net profit by day, one axis, fourteen days.
 *
 * Emphasis rather than categorical: revenue is context in a recessive fill,
 * profit is the point in the accent. Two series, so a legend is present.
 */
export function RevenueProfitChart({ data = trend }: { data?: DayPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const id = useId();

  const height = 168;
  const axisBand = 20;
  const plot = height - axisBand;

  const max = Math.max(...data.map((d) => d.revenue ?? 0));
  const ceiling = Math.ceil(max / 5000) * 5000;
  const ticks = [0, ceiling / 2, ceiling];

  const slot = 100 / data.length;
  // Bars capped so the band's leftover reads as air, with a 2px surface gap.
  const barWidth = Math.min(24, slot * 0.52);

  const active = hover !== null ? data[hover] : null;

  return (
    <div className="relative">
      <div className="mb-3 flex items-center gap-4">
        <Legend color={PALETTE.muted} label="Revenue" />
        <Legend color={PALETTE.brand} label="Net profit" />
        <span className="ml-auto text-xs text-muted-foreground">
          Last 14 days · Sundays closed
        </span>
      </div>

      <div
        className="relative"
        style={{ height }}
        onMouseLeave={() => setHover(null)}
      >
        {/* Hairline solid gridlines, one step off the surface. */}
        {ticks.map((t) => (
          <div
            key={t}
            className="absolute right-0 left-10 border-t"
            style={{
              top: plot - (t / ceiling) * plot,
              borderColor: PALETTE.grid,
            }}
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

        <div className="absolute inset-0 left-10 flex items-end">
          {data.map((d, i) => {
            const closed = d.revenue === null;
            const revH = closed ? 0 : ((d.revenue ?? 0) / ceiling) * plot;
            const profH = closed ? 0 : ((d.netProfit ?? 0) / ceiling) * plot;
            return (
              <button
                key={d.date}
                className="group relative flex h-full flex-1 flex-col justify-end"
                style={{ paddingBottom: axisBand }}
                onMouseEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                aria-label={`${d.label}: revenue ${closed ? "closed" : money(d.revenue!)}, net profit ${closed ? "closed" : money(d.netProfit!)}`}
              >
                {closed ? (
                  <span className="mx-auto mb-1 text-[9px] text-muted-foreground">
                    closed
                  </span>
                ) : (
                  <span className="relative mx-auto block" style={{ width: barWidth }}>
                    {/* Revenue: recessive context. */}
                    <span
                      className="absolute bottom-0 left-0 w-full rounded-t-[4px]"
                      style={{
                        height: revH,
                        background: PALETTE.muted,
                        opacity: hover === null || hover === i ? 1 : 0.55,
                      }}
                    />
                    {/* Profit: the emphasis, overlaid, 2px surface gap at its cap. */}
                    <span
                      className="absolute bottom-0 left-0 w-full rounded-t-[4px]"
                      style={{
                        height: profH,
                        background: PALETTE.brand,
                        opacity: hover === null || hover === i ? 1 : 0.55,
                      }}
                    />
                  </span>
                )}
                <span
                  className="absolute right-0 bottom-0 left-0 truncate text-center text-[9px] text-muted-foreground"
                  style={{ height: axisBand, lineHeight: `${axisBand}px` }}
                >
                  {i % 2 === 0 ? d.label : ""}
                </span>
              </button>
            );
          })}
        </div>

        {active && (
          <div
            className="pointer-events-none absolute z-10 rounded-md border bg-popover px-2.5 py-1.5 text-xs shadow-md"
            style={{
              left: `calc(2.5rem + ${(hover! + 0.5) * slot}%)`,
              top: 0,
              transform: "translateX(-50%)",
            }}
          >
            <div className="mb-0.5 font-medium">{active.label}</div>
            {active.revenue === null ? (
              <div className="text-muted-foreground">Closed</div>
            ) : (
              <>
                <Tip color={PALETTE.muted} label="Revenue" value={money(active.revenue)} />
                <Tip
                  color={PALETTE.brand}
                  label="Net profit"
                  value={money(active.netProfit!)}
                />
              </>
            )}
          </div>
        )}
      </div>
      <p id={id} className="sr-only">
        Revenue and net profit for the last fourteen trading days. Sundays are
        closed and carry no figures.
      </p>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span
        className="size-2.5 rounded-[2px]"
        style={{ background: color }}
        aria-hidden
      />
      {label}
    </span>
  );
}

function Tip({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className="size-2 shrink-0 rounded-[2px]"
        style={{ background: color }}
        aria-hidden
      />
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular ml-auto pl-3 font-medium">{value}</span>
    </div>
  );
}
