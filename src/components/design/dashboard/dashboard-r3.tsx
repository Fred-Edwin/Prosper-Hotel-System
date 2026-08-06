"use client";

/**
 * Dashboard — round three. The hybrid Edwin specified.
 *
 *   Waterfall + tabs from R2C for revenue, cost of goods, running costs and
 *   net profit — "a very good visual representation of the data".
 *   Cash, M-Pesa, owed and drawings from R2B, which showed those better.
 *   Everything below from R2B's layout.
 *   Charts added, because the client wants the screen to be visually appealing.
 *
 * The premium treatment, which was the open question. R2C put each term in a
 * bordered box with a grey hover fill and a bar underneath — serviceable, and
 * it reads as four separate widgets. Four changes make it read as one
 * instrument instead:
 *
 *   One continuous track. The four terms sit in a single seamless band rather
 *   than four bordered boxes, so the eye follows the arithmetic left to right
 *   as one movement. Hairline dividers, no borders.
 *
 *   The bar is the surface, not an ornament under it. Each term's proportion
 *   is a full-width band at the foot of its cell, flush to the edges, so the
 *   bars form one continuous ribbon across the whole strip.
 *
 *   Selection is a raised surface with a top rule in the term's own colour,
 *   not a grey wash. Lifting rather than tinting is what separates considered
 *   software from a form control.
 *
 *   Operators between terms. A small −, −, = between the cells states the
 *   arithmetic explicitly, so the strip reads as a sentence rather than four
 *   figures that happen to be adjacent.
 *
 * Charts follow the dataviz method: stat tiles carry sparklines because the
 * form heuristic says a single value plus trend is a tile, not a chart; the
 * fourteen-day view is emphasis (profit in accent, revenue recessive) on one
 * axis, because two scales would invent a correlation. No pie — Lucy's
 * questions are about level, and the waterfall already carries the proportion.
 */

import { useState } from "react";
import { dashboard, expenses, trend, money } from "@/lib/fixtures";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { FigureBlock, Term, LedgerLink, ProvisionalNote } from "./figures";
import {
  HandoverTable,
  Exceptions,
  LocationComparison,
  StockMovements,
  StoreMovements,
} from "./sections";
import { Sparkline, RevenueProfitChart } from "./charts";

type TermKey = "revenue" | "cogs" | "running" | "net";

export function DashboardR3() {
  const [open, setOpen] = useState<TermKey | null>("cogs");
  const runningCostLines = expenses.filter((e) => e.category === "running");

  const max = dashboard.revenue.total;
  const pct = (n: number) => Math.max(0, (n / max) * 100);

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
      value: dashboard.revenue.total,
      width: 100,
      colour: "var(--color-neutral-400)",
    },
    {
      key: "cogs",
      label: "Cost of goods sold",
      value: dashboard.costOfGoods.total,
      width: pct(dashboard.costOfGoods.total),
      colour: "var(--color-danger)",
      provisional: true,
      operator: "−",
    },
    {
      key: "running",
      label: "Running costs",
      value: dashboard.runningCosts,
      width: pct(dashboard.runningCosts),
      colour: "var(--color-warning)",
      operator: "−",
    },
    {
      key: "net",
      label: "Net profit",
      value: dashboard.netProfit,
      width: pct(dashboard.netProfit),
      colour: "var(--color-success)",
      provisional: true,
      operator: "=",
    },
  ];

  return (
    <div className="mx-auto max-w-[1400px] p-6">
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">{dashboard.period}</p>
        </div>
        <Tabs defaultValue="day">
          <TabsList>
            <TabsTrigger value="day">Day</TabsTrigger>
            <TabsTrigger value="week">Week</TabsTrigger>
            <TabsTrigger value="month">Month</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* The waterfall — one continuous instrument, not four widgets. */}
      <div className="mb-4 overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="flex items-center justify-between px-5 pt-4 pb-3">
          <h2 className="text-sm font-medium">Profit</h2>
          <Badge variant="outline" className="text-[10px] font-normal">
            partly provisional
          </Badge>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4">
          {terms.map((t, i) => {
            const on = open === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setOpen(on ? null : t.key)}
                className={`group relative flex flex-col justify-between pt-3 pb-0 text-left transition-colors duration-100 ${
                  on ? "bg-card" : "bg-muted/25 hover:bg-muted/50"
                } ${i > 0 ? "border-l" : ""}`}
                aria-expanded={on}
              >
                {/* Selection lifts with a rule in the term's own colour. */}
                <span
                  className="absolute inset-x-0 top-0 h-0.5 transition-opacity duration-100"
                  style={{
                    background: t.colour,
                    opacity: on ? 1 : 0,
                  }}
                />

                <div className="px-5">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {t.operator && (
                      <span className="text-sm text-muted-foreground/60">
                        {t.operator}
                      </span>
                    )}
                    {t.label}
                  </div>
                  <div className="tabular mt-1 text-2xl font-semibold">
                    {money(t.value)}
                  </div>
                  <div className="tabular mt-0.5 mb-3 text-[11px] text-muted-foreground">
                    {t.key === "revenue"
                      ? "of takings"
                      : `${((t.value / max) * 100).toFixed(0)}% of revenue`}
                  </div>
                </div>

                {/* The bar is the surface — flush, so the strip reads as one ribbon. */}
                <div className="h-1.5 w-full bg-muted">
                  <div
                    className="h-full transition-[width] duration-200"
                    style={{ width: `${t.width}%`, background: t.colour }}
                  />
                </div>
              </button>
            );
          })}
        </div>

        {open && (
          <div className="border-t bg-muted/20 px-5 py-4">
            {open === "revenue" && (
              <Detail title="Where the revenue came from">
                <Term
                  label="Restaurant — each sale as recorded"
                  value={dashboard.revenue.restaurant}
                />
                <Term
                  label="Canteen — the day's declared takings"
                  value={dashboard.revenue.canteen}
                />
                <Term label="Revenue" value={dashboard.revenue.total} rule strong />
              </Detail>
            )}
            {open === "cogs" && (
              <Detail title="What stock was used up">
                <Term label="Opening ingredients" value={18000} muted />
                <Term label="Ingredients bought" value={9000} sign="+" muted />
                <Term label="Closing ingredients" value={15000} sign="−" muted />
                <Term label="Food sent to canteen" value={2400} sign="−" muted />
                <Term label="Restaurant cost" value={9600} rule strong />
                <div className="mt-3 border-t pt-2">
                  <Term label="Canteen — food from restaurant" value={2400} muted />
                  <Term
                    label={`Canteen — own goods, takings × ${dashboard.canteenCostRate * 100}%`}
                    value={2880}
                    muted
                    note="estimated"
                  />
                  <Term label="Canteen cost" value={5280} rule strong />
                </div>
                <div className="mt-3 border-t pt-2">
                  <Term
                    label="Cost of goods sold"
                    value={dashboard.costOfGoods.total}
                    strong
                  />
                </div>
                <div className="mt-3">
                  <ProvisionalNote lastCount={dashboard.lastCanteenCount} />
                </div>
              </Detail>
            )}
            {open === "running" && (
              <Detail title="What the business spent to keep running">
                {runningCostLines.map((e) => (
                  <Term
                    key={e.id}
                    label={`${e.description} · ${e.recordedBy}`}
                    value={e.amount}
                    muted
                    note={e.status === "pending" ? "pending" : undefined}
                  />
                ))}
                <Term
                  label="Running costs"
                  value={dashboard.runningCosts}
                  rule
                  strong
                />
                <p className="mt-3 text-xs text-muted-foreground">
                  Equipment and your drawings are not here — they reduce cash but
                  not profit.
                </p>
              </Detail>
            )}
            {open === "net" && (
              <Detail title="How the net profit is reached">
                <Term label="Revenue" value={dashboard.revenue.total} />
                <Term
                  label="Cost of goods sold"
                  value={dashboard.costOfGoods.total}
                  sign="−"
                  muted
                />
                <Term label="Gross profit" value={dashboard.grossProfit} rule strong />
                <Term
                  label="Running costs"
                  value={dashboard.runningCosts}
                  sign="−"
                  muted
                />
                <Term label="Net profit" value={dashboard.netProfit} rule strong />
              </Detail>
            )}
            <LedgerLink />
          </div>
        )}
      </div>

      {/* Cash — R2B's treatment, with trend added. */}
      <div className="mb-4 grid gap-px overflow-hidden rounded-lg border bg-border md:grid-cols-2 xl:grid-cols-4">
        <Panel>
          <div className="flex items-start justify-between gap-2">
            <FigureBlock
              label="Cash you should hold"
              value={dashboard.cash.expectedCash}
            />
            <Sparkline points={trend.map((d) => d.cash)} />
          </div>
          <div className="mt-3 border-t pt-2">
            <Term
              label="Handovers in"
              value={dashboard.cash.handoversReceived}
              muted
            />
            <Term label="Paid out" value={dashboard.cash.paidOut} sign="−" muted />
          </div>
          <LedgerLink label="See cash movements" />
        </Panel>

        <Panel>
          <div className="flex items-start justify-between gap-2">
            <FigureBlock
              label="M-Pesa balance"
              value={dashboard.cash.expectedMpesa}
            />
            <Sparkline points={trend.map((d) => d.mpesa)} />
          </div>
          <p className="mt-3 border-t pt-2 text-xs text-muted-foreground">
            Tracked separately from cash and never pooled. Verifiable against the
            paybill messages.
          </p>
        </Panel>

        <Panel>
          <div className="flex items-start justify-between gap-2">
            <FigureBlock
              label="Owed to you"
              value={dashboard.owedToBusiness}
              sub="credit extended, less repayments"
            />
            <Sparkline points={trend.map((d) => d.owed)} tone="danger" />
          </div>
          <LedgerLink label="See who owes" />
        </Panel>

        <Panel>
          <div className="flex items-start justify-between gap-2">
            <FigureBlock
              label="Your drawings"
              value={dashboard.drawingsOutstanding}
              sub="owed back to the business"
            />
            <Sparkline points={trend.map((d) => d.drawings)} />
          </div>
          <LedgerLink label="See drawings" />
        </Panel>
      </div>

      {/* Trend — the one thing a single figure cannot carry. */}
      <div className="mb-5 rounded-lg border bg-card p-5">
        <h2 className="mb-1 text-sm font-medium">Revenue and profit</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Whether today is normal.
        </p>
        <RevenueProfitChart />
      </div>

      <div className="mb-5 grid gap-4 lg:grid-cols-2">
        <Exceptions />
        <LocationComparison stacked />
      </div>

      <div className="mb-5">
        <HandoverTable />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <StockMovements />
        <StoreMovements />
      </div>
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="bg-card p-4">{children}</div>;
}

function Detail({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-medium text-muted-foreground">{title}</h3>
      <div className="max-w-lg">{children}</div>
    </div>
  );
}
