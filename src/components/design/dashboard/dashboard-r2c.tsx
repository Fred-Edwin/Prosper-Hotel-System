"use client";

/**
 * Dashboard R2-C — the waterfall, and everything else in tabs.
 *
 * Layout answer: one wide band at the top showing profit as a horizontal
 * waterfall — revenue, then each subtraction, then what survives — with the
 * detail of each term directly beneath it. Below that, a single tabbed panel
 * holds handover, locations, stock and store, so the page never scrolls far.
 *
 * The waterfall makes the two terms Edwin singled out impossible to miss: cost
 * of goods sold and running costs are the visible bites out of the bar, sized
 * by how much they take. Their weight is proportional rather than typographic,
 * which is harder to ignore than a heavier font.
 *
 * What it risks: tabs hide things. Everything below the fold is one click away
 * rather than present, and if Lucy wants handover *and* locations at once she
 * cannot have them. Worth judging against A and B, which show everything but
 * scroll a long way.
 */

import { useState } from "react";
import { dashboard, expenses } from "@/lib/fixtures";
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

export function DashboardR2C() {
  const [open, setOpen] = useState<string | null>("cogs");
  const runningCostLines = expenses.filter((e) => e.category === "running");

  const max = dashboard.revenue.total;
  const pct = (n: number) => `${(n / max) * 100}%`;

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

      {/* Profit as a waterfall. Each term is clickable and explains itself. */}
      <div className="mb-4 rounded-lg border bg-card p-5">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-sm font-medium">Profit</h2>
          <Badge variant="outline" className="text-[10px] font-normal">
            partly provisional
          </Badge>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <button
            onClick={() => setOpen(open === "revenue" ? null : "revenue")}
            className="rounded-md border p-3 text-left transition-colors duration-100 hover:bg-accent"
          >
            <FigureBlock label="Revenue" value={dashboard.revenue.total} />
            <Bar width="100%" tone="neutral" />
          </button>
          <button
            onClick={() => setOpen(open === "cogs" ? null : "cogs")}
            className={`rounded-md border p-3 text-left transition-colors duration-100 hover:bg-accent ${
              open === "cogs" ? "bg-accent" : ""
            }`}
          >
            <FigureBlock
              label="Cost of goods sold"
              value={dashboard.costOfGoods.total}
              provisional
            />
            <Bar width={pct(dashboard.costOfGoods.total)} tone="danger" />
          </button>
          <button
            onClick={() => setOpen(open === "running" ? null : "running")}
            className={`rounded-md border p-3 text-left transition-colors duration-100 hover:bg-accent ${
              open === "running" ? "bg-accent" : ""
            }`}
          >
            <FigureBlock label="Running costs" value={dashboard.runningCosts} />
            <Bar width={pct(dashboard.runningCosts)} tone="danger" />
          </button>
          <button
            onClick={() => setOpen(open === "net" ? null : "net")}
            className={`rounded-md border p-3 text-left transition-colors duration-100 hover:bg-accent ${
              open === "net" ? "bg-accent" : ""
            }`}
          >
            <FigureBlock
              label="Net profit"
              value={dashboard.netProfit}
              provisional
            />
            <Bar width={pct(dashboard.netProfit)} tone="success" />
          </button>
        </div>

        {open && (
          <div className="rounded-md border bg-background p-4">
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
                <Term
                  label="Revenue"
                  value={dashboard.revenue.total}
                  rule
                  strong
                />
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
                <Term
                  label="Gross profit"
                  value={dashboard.grossProfit}
                  rule
                  strong
                />
                <Term
                  label="Running costs"
                  value={dashboard.runningCosts}
                  sign="−"
                  muted
                />
                <Term
                  label="Net profit"
                  value={dashboard.netProfit}
                  rule
                  strong
                />
              </Detail>
            )}
            <LedgerLink />
          </div>
        )}
      </div>

      {/* Cash — the other question. */}
      <div className="mb-4 grid gap-4 lg:grid-cols-4">
        <Card>
          <FigureBlock
            label="Cash you should hold"
            value={dashboard.cash.expectedCash}
            sub="never estimated"
          />
        </Card>
        <Card>
          <FigureBlock
            label="M-Pesa balance"
            value={dashboard.cash.expectedMpesa}
            sub="tracked separately"
          />
        </Card>
        <Card>
          <FigureBlock
            label="Owed to you"
            value={dashboard.owedToBusiness}
            sub="across both locations"
          />
        </Card>
        <Card>
          <FigureBlock
            label="Your drawings"
            value={dashboard.drawingsOutstanding}
            sub="owed back to the business"
          />
        </Card>
      </div>

      <div className="mb-4">
        <Exceptions />
      </div>

      {/* Everything else, one click away rather than a long scroll. */}
      <Tabs defaultValue="handover">
        <TabsList>
          <TabsTrigger value="handover">Handover</TabsTrigger>
          <TabsTrigger value="locations">By location</TabsTrigger>
          <TabsTrigger value="stock">Stock movements</TabsTrigger>
          <TabsTrigger value="store">Restaurant store</TabsTrigger>
        </TabsList>
        <TabsContent value="handover" className="mt-3">
          <HandoverTable />
        </TabsContent>
        <TabsContent value="locations" className="mt-3">
          <LocationComparison />
        </TabsContent>
        <TabsContent value="stock" className="mt-3">
          <StockMovements />
        </TabsContent>
        <TabsContent value="store" className="mt-3">
          <StoreMovements />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Bar({
  width,
  tone,
}: {
  width: string;
  tone: "neutral" | "danger" | "success";
}) {
  const bg =
    tone === "danger"
      ? "bg-danger/70"
      : tone === "success"
        ? "bg-success/70"
        : "bg-neutral-400";
  return (
    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
      <div className={`h-full rounded-full ${bg}`} style={{ width }} />
    </div>
  );
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

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border bg-card p-4">{children}</div>;
}
