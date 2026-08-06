"use client";

/**
 * Dashboard R2-A — the P&L column.
 *
 * Layout answer: put the whole profit arithmetic in one tall left column,
 * read top to bottom as a statement, with cash and debts beside it. Everything
 * else stacks underneath.
 *
 * The argument: revenue → cost of goods → gross → running costs → net is a
 * sequence, and a sequence wants one column. Reading it downward gives cost of
 * goods sold and running costs their weight structurally — they are the two
 * subtraction steps, impossible to skip on the way to the number at the
 * bottom, which is what Edwin asked for when he said they "matter very much".
 *
 * What it risks: a tall column means net profit sits low on the page, and the
 * figure she probably wants first is the one furthest from her eye.
 */

import { dashboard, expenses, money } from "@/lib/fixtures";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  FigureBlock,
  Term,
  LedgerLink,
  ProvisionalNote,
  SectionHeader,
} from "./figures";
import {
  HandoverTable,
  Exceptions,
  LocationComparison,
  StockMovements,
  StoreMovements,
} from "./sections";

export function DashboardR2A() {
  const runningCostLines = expenses.filter((e) => e.category === "running");

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

      <div className="mb-5 grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        {/* The profit statement, read downward. */}
        <div className="rounded-lg border bg-card p-5">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-sm font-medium">Profit</h2>
            <Badge variant="outline" className="text-[10px] font-normal">
              partly provisional
            </Badge>
          </div>

          <FigureBlock label="Revenue" value={dashboard.revenue.total} size="lg">
            <div className="tabular mt-1 text-xs text-muted-foreground">
              Restaurant {money(dashboard.revenue.restaurant)} · Canteen{" "}
              {money(dashboard.revenue.canteen)}
            </div>
          </FigureBlock>

          <div className="mt-4 border-t pt-3">
            <div className="mb-1 text-xs font-medium text-muted-foreground">
              Cost of goods sold
            </div>
            <Term label="Restaurant — measured" value={9600} sign="−" muted />
            <Term
              label="Canteen — food from restaurant"
              value={2400}
              sign="−"
              muted
            />
            <Term
              label="Canteen — own goods"
              value={2880}
              sign="−"
              muted
              note="estimated"
            />
            <Term
              label="Cost of goods sold"
              value={dashboard.costOfGoods.total}
              sign="−"
              rule
              strong
            />
          </div>

          <div className="mt-3 border-t pt-3">
            <Term
              label="Gross profit"
              value={dashboard.grossProfit}
              strong
            />
          </div>

          <div className="mt-3 border-t pt-3">
            <div className="mb-1 text-xs font-medium text-muted-foreground">
              Running costs
            </div>
            {runningCostLines.map((e) => (
              <Term
                key={e.id}
                label={e.description}
                value={e.amount}
                sign="−"
                muted
                note={e.status === "pending" ? "pending" : undefined}
              />
            ))}
            <Term
              label="Running costs"
              value={dashboard.runningCosts}
              sign="−"
              rule
              strong
            />
          </div>

          <div className="mt-4 border-t-2 pt-3">
            <FigureBlock
              label="Net profit"
              value={dashboard.netProfit}
              size="xl"
              provisional
            />
            <LedgerLink />
          </div>
        </div>

        {/* Cash and what is owed. */}
        <div className="space-y-4">
          <div className="rounded-lg border bg-card p-5">
            <h2 className="mb-3 text-sm font-medium">Cash position</h2>
            <div className="grid grid-cols-2 gap-4">
              <FigureBlock
                label="Cash you should hold"
                value={dashboard.cash.expectedCash}
                size="lg"
              />
              <FigureBlock
                label="M-Pesa balance"
                value={dashboard.cash.expectedMpesa}
                size="lg"
              />
            </div>
            <div className="mt-3 border-t pt-2">
              <Term
                label="Handovers received"
                value={dashboard.cash.handoversReceived}
              />
              <Term
                label="Paid out"
                value={dashboard.cash.paidOut}
                sign="−"
                muted
              />
              <Term
                label="Expected cash"
                value={dashboard.cash.expectedCash}
                rule
                strong
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Never estimated. This is what a physical count is checked against.
            </p>
            <LedgerLink />
          </div>

          <div className="rounded-lg border bg-card p-5">
            <div className="grid grid-cols-2 gap-4">
              <FigureBlock
                label="Owed to you"
                value={dashboard.owedToBusiness}
                size="lg"
                sub="across both locations"
              />
              <FigureBlock
                label="Your drawings"
                value={dashboard.drawingsOutstanding}
                size="lg"
                sub="owed back to the business"
              />
            </div>
          </div>

          <div className="rounded-lg border bg-card p-4">
            <ProvisionalNote lastCount={dashboard.lastCanteenCount} />
          </div>
        </div>
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
