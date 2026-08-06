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
  const gradientId = useId();
  const real = points.filter((p): p is number => p !== null);
  if (real.length < 2) return null;

  const min = Math.min(...real);
  const max = Math.max(...real);
  const span = max - min || 1;
  const step = width / (points.length - 1);

  // Closed days break the path rather than drawing through zero.
  const segments: { line: string; fill: string }[] = [];
  let current: { x: number; y: number }[] = [];

  const flush = () => {
    if (current.length > 1) {
      const line = current
        .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
        .join(" ");
      const first = current[0];
      const last = current[current.length - 1];
      segments.push({
        line,
        fill: `${line} L${last.x.toFixed(1)},${height} L${first.x.toFixed(1)},${height} Z`,
      });
    }
    current = [];
  };

  points.forEach((p, i) => {
    if (p === null) return flush();
    current.push({ x: i * step, y: height - ((p - min) / span) * height });
  });
  flush();

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
      <defs>
        {/* A wash, never a saturated block — ~14% at the line, transparent at the floor. */}
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={accent} stopOpacity={0.14} />
          <stop offset="100%" stopColor={accent} stopOpacity={0} />
        </linearGradient>
      </defs>
      {segments.map((s, i) => (
        <path key={`f-${i}`} d={s.fill} fill={`url(#${gradientId})`} stroke="none" />
      ))}
      {segments.map((s, i) => (
        <path
          key={`l-${i}`}
          d={s.line}
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
 * The series a fourteen-day view can plot.
 *
 * Every option keeps both measures on ONE axis, which is the constraint that
 * decides membership. Revenue against cost of goods is legitimate — same units,
 * comparable magnitude. Revenue against transaction count would not be, and no
 * amount of wanting it makes two y-scales honest: the alignment between them is
 * arbitrary, so the chart invents a correlation the data does not contain.
 */
export type SeriesKey =
  | "revenue-profit"
  | "revenue-cogs"
  | "cash-mpesa"
  | "owed"
  | "locations";

export const seriesOptions: {
  key: SeriesKey;
  label: string;
  question: string;
  a: { label: string; pick: (d: DayPoint) => number | null; colour: string };
  b?: { label: string; pick: (d: DayPoint) => number | null; colour: string };
}[] = [
  {
    key: "revenue-profit",
    label: "Revenue & profit",
    question: "Is today normal?",
    a: { label: "Revenue", pick: (d) => d.revenue, colour: PALETTE.muted },
    b: { label: "Net profit", pick: (d) => d.netProfit, colour: PALETTE.brand },
  },
  {
    key: "revenue-cogs",
    label: "Revenue & cost",
    question: "Is my buying getting worse?",
    a: { label: "Revenue", pick: (d) => d.revenue, colour: PALETTE.muted },
    b: {
      label: "Cost of goods",
      pick: (d) => (d.revenue === null ? null : d.revenue - (d.netProfit ?? 0)),
      colour: PALETTE.danger,
    },
  },
  {
    key: "cash-mpesa",
    label: "Cash & M-Pesa",
    question: "How is the payment mix shifting?",
    a: { label: "Cash", pick: (d) => d.cash, colour: PALETTE.muted },
    b: { label: "M-Pesa", pick: (d) => d.mpesa, colour: PALETTE.brand },
  },
  {
    key: "owed",
    label: "Owed to you",
    question: "Is credit getting out of hand?",
    a: { label: "Owed", pick: (d) => d.owed, colour: PALETTE.brand },
  },
  {
    key: "locations",
    label: "By location",
    question: "Which one is carrying the business?",
    a: {
      label: "Restaurant",
      pick: (d) => (d.revenue === null ? null : Math.round(d.revenue * 0.775)),
      colour: PALETTE.muted,
    },
    b: {
      label: "Canteen",
      pick: (d) => (d.revenue === null ? null : Math.round(d.revenue * 0.225)),
      colour: PALETTE.brand,
    },
  },
];

/**
 * Fourteen days, one axis, a selectable pair.
 *
 * Emphasis rather than categorical: the first series is context in a recessive
 * fill, the second is the point in the accent. Two series, so a legend is
 * always present; a single series carries none, because the title names it.
 */
export function RevenueProfitChart({ data = trend }: { data?: DayPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const [series, setSeries] = useState<SeriesKey>("revenue-profit");
  const id = useId();

  const option = seriesOptions.find((s) => s.key === series)!;

  const height = 168;
  const axisBand = 20;
  const plot = height - axisBand;

  const values = data.flatMap((d) =>
    [option.a.pick(d), option.b?.pick(d)].filter(
      (v): v is number => v !== null && v !== undefined,
    ),
  );
  const max = Math.max(...values, 0);
  const magnitude = Math.pow(10, Math.floor(Math.log10(max || 1)));
  const ceiling = Math.ceil(max / (magnitude / 2)) * (magnitude / 2);
  const ticks = [0, ceiling / 2, ceiling];

  const active = hover !== null ? data[hover] : null;

  return (
    <div className="relative">
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {seriesOptions.map((s) => (
          <button
            key={s.key}
            onClick={() => setSeries(s.key)}
            className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors duration-100 ${
              series === s.key
                ? "border-neutral-800 bg-neutral-800 text-white"
                : "bg-card text-muted-foreground hover:bg-accent"
            }`}
            aria-pressed={series === s.key}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="mb-3 flex items-center gap-4">
        <Legend color={option.a.colour} label={option.a.label} />
        {option.b && <Legend color={option.b.colour} label={option.b.label} />}
        <span className="ml-auto text-xs text-muted-foreground">
          {option.question}
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

        {/* Tight intervals, square caps. What makes a trend readable is the gap
            between days, not the width of the bars — narrow marks close together
            read as one shape; the same marks spaced apart read as fourteen
            separate objects. Square tops because a rounded cap adds a couple of
            pixels of ambiguity to where the value actually sits, which matters
            when the eye is comparing heights across a series. */}
        <div className="absolute inset-0 left-10 flex items-end gap-[2px]">
          {data.map((d, i) => {
            const av = option.a.pick(d);
            const bv = option.b?.pick(d) ?? null;
            const closed = av === null;
            const aH = closed ? 0 : (av / ceiling) * plot;
            const bH = bv === null ? 0 : (bv / ceiling) * plot;
            return (
              <button
                key={d.date}
                className="group relative flex h-full flex-1 flex-col justify-end"
                style={{ paddingBottom: axisBand }}
                onMouseEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                aria-label={
                  closed
                    ? `${d.label}: closed`
                    : `${d.label}: ${option.a.label} ${money(av)}${
                        option.b && bv !== null
                          ? `, ${option.b.label} ${money(bv)}`
                          : ""
                      }`
                }
              >
                {closed ? (
                  <span className="mx-auto mb-1 text-[9px] text-muted-foreground">
                    closed
                  </span>
                ) : (
                  <span
                    className="relative mx-auto block w-full"
                    style={{ maxWidth: 14 }}
                  >
                    <span
                      className="absolute bottom-0 left-0 w-full"
                      style={{
                        height: aH,
                        background: option.a.colour,
                        opacity: hover === null || hover === i ? 1 : 0.5,
                      }}
                    />
                    {option.b && (
                      <span
                        className="absolute bottom-0 left-0 w-full"
                        style={{
                          height: bH,
                          background: option.b.colour,
                          opacity: hover === null || hover === i ? 1 : 0.5,
                        }}
                      />
                    )}
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
              left: `calc(2.5rem + ${((hover! + 0.5) / data.length) * 100}%)`,
              top: 0,
              transform: "translateX(-50%)",
            }}
          >
            <div className="mb-0.5 font-medium">{active.label}</div>
            {option.a.pick(active) === null ? (
              <div className="text-muted-foreground">Closed</div>
            ) : (
              <>
                <Tip
                  color={option.a.colour}
                  label={option.a.label}
                  value={money(option.a.pick(active)!)}
                />
                {option.b && option.b.pick(active) !== null && (
                  <Tip
                    color={option.b.colour}
                    label={option.b.label}
                    value={money(option.b.pick(active)!)}
                  />
                )}
              </>
            )}
          </div>
        )}
      </div>
      <p id={id} className="sr-only">
        {option.a.label}
        {option.b ? ` and ${option.b.label}` : ""} for the last fourteen trading
        days. Sundays are closed and carry no figures.
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
