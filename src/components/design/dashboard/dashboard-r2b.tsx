"use client";

/**
 * Dashboard R2-B — headline row, breakdowns beneath each.
 *
 * Layout answer: four headline figures across the top, and directly under each
 * one, its own arithmetic. Fixes A-from-round-one's failing — "all the stats
 * are in one row. There's no visual hierarchy among them... the breakdown is
 * not right next to the figures" — by keeping the row but attaching the
 * breakdown to its figure rather than putting it elsewhere on the page.
 *
 * Cost of goods sold and running costs are promoted from breakdown lines to
 * headline figures in their own right, each with its own composition beneath.
 * They are the two numbers Lucy can act on, so they get the same treatment as
 * revenue rather than living inside it.
 *
 * What it risks: six columns of figures is a lot of horizontal information,
 * and at 1280px the breakdowns get narrow.
 */

import { dashboard, expenses } from "@/lib/fixtures";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { FigureBlock, Term, LedgerLink, ProvisionalNote } from "./figures";
import {
  HandoverTable,
  Exceptions,
  LocationComparison,
  StockMovements,
  StoreMovements,
} from "./sections";

export function DashboardR2B() {
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

      {/* Trading — each figure carries its own arithmetic. */}
      <div className="mb-4 grid gap-px overflow-hidden rounded-lg border bg-border md:grid-cols-2 xl:grid-cols-4">
        <Panel>
          <FigureBlock label="Revenue" value={dashboard.revenue.total} />
          <div className="mt-3 border-t pt-2">
            <Term label="Restaurant" value={dashboard.revenue.restaurant} muted />
            <Term label="Canteen" value={dashboard.revenue.canteen} muted />
          </div>
          <LedgerLink label="See the sales" />
        </Panel>

        <Panel>
          <FigureBlock
            label="Cost of goods sold"
            value={dashboard.costOfGoods.total}
            provisional
          />
          <div className="mt-3 border-t pt-2">
            <Term label="Restaurant" value={9600} muted />
            <Term label="Canteen — food" value={2400} muted />
            <Term label="Canteen — own goods" value={2880} muted note="est" />
          </div>
          <LedgerLink label="See what was used" />
        </Panel>

        <Panel>
          <FigureBlock label="Running costs" value={dashboard.runningCosts} />
          <div className="mt-3 border-t pt-2">
            {runningCostLines.slice(0, 3).map((e) => (
              <Term
                key={e.id}
                label={e.description}
                value={e.amount}
                muted
                note={e.status === "pending" ? "pending" : undefined}
              />
            ))}
          </div>
          <LedgerLink label="See all expenses" />
        </Panel>

        <Panel>
          <FigureBlock
            label="Net profit"
            value={dashboard.netProfit}
            provisional
          />
          <div className="mt-3 border-t pt-2">
            <Term label="Revenue" value={dashboard.revenue.total} muted />
            <Term
              label="Cost of goods"
              value={dashboard.costOfGoods.total}
              sign="−"
              muted
            />
            <Term label="Gross profit" value={dashboard.grossProfit} />
            <Term
              label="Running costs"
              value={dashboard.runningCosts}
              sign="−"
              muted
            />
          </div>
          <LedgerLink />
        </Panel>
      </div>

      {/* Cash — a separate question from profit, so a separate row. */}
      <div className="mb-4 grid gap-px overflow-hidden rounded-lg border bg-border md:grid-cols-2 xl:grid-cols-4">
        <Panel>
          <FigureBlock
            label="Cash you should hold"
            value={dashboard.cash.expectedCash}
          />
          <div className="mt-3 border-t pt-2">
            <Term
              label="Handovers in"
              value={dashboard.cash.handoversReceived}
              muted
            />
            <Term
              label="Paid out"
              value={dashboard.cash.paidOut}
              sign="−"
              muted
            />
          </div>
          <LedgerLink label="See cash movements" />
        </Panel>

        <Panel>
          <FigureBlock
            label="M-Pesa balance"
            value={dashboard.cash.expectedMpesa}
          />
          <p className="mt-3 border-t pt-2 text-xs text-muted-foreground">
            Tracked separately from cash and never pooled. Verifiable against
            the paybill messages.
          </p>
        </Panel>

        <Panel>
          <FigureBlock
            label="Owed to you"
            value={dashboard.owedToBusiness}
            sub="credit extended, less repayments"
          />
          <LedgerLink label="See who owes" />
        </Panel>

        <Panel>
          <FigureBlock
            label="Your drawings"
            value={dashboard.drawingsOutstanding}
            sub="owed back to the business"
          />
          <LedgerLink label="See drawings" />
        </Panel>
      </div>

      <div className="mb-5 rounded-lg border bg-card px-4 py-2.5">
        <div className="flex items-start gap-2">
          <Badge variant="outline" className="mt-0.5 shrink-0 text-[10px] font-normal">
            provisional
          </Badge>
          <ProvisionalNote lastCount={dashboard.lastCanteenCount} />
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

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="bg-card p-4">{children}</div>;
}
