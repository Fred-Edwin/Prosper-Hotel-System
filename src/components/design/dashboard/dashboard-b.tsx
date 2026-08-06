"use client";

/**
 * Dashboard B — two questions, answered.
 *
 * Rejects the equal-weight stat row. Discovery has Lucy asking questions, not
 * requesting metrics, and the two she leads with are "am I making money" and
 * "how much cash should I be holding". So the page answers those two, large,
 * side by side — and everything else is subordinate detail beneath them.
 *
 * Profit and cash are deliberately given the same visual weight, because
 * proposal.md §10 makes the point that they are different questions and both
 * are needed: a business can be profitable and still short of cash.
 *
 * The risk: two hero figures may be too few. Debtors, drawings and stock value
 * are demoted to a strip, and if Lucy looks for those first, this is wrong.
 */

import { dashboard, handovers, money } from "@/lib/fixtures";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Info, ArrowRight } from "lucide-react";

export function DashboardB() {
  const problems = handovers.filter(
    (h) => h.cashActual !== h.cashExpected || h.mpesaActual !== h.mpesaExpected,
  );

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

      <div className="mb-5 grid gap-4 lg:grid-cols-2">
        {/* Am I making money */}
        <div className="rounded-lg border bg-card p-5">
          <div className="mb-1 flex items-center gap-2">
            <h2 className="text-sm font-medium text-muted-foreground">
              Am I making money?
            </h2>
            <Badge variant="outline" className="text-[10px] font-normal">
              provisional
            </Badge>
          </div>
          <div className="tabular mb-1 text-4xl font-semibold">
            {money(dashboard.netProfit)}
          </div>
          <p className="mb-4 text-xs text-muted-foreground">
            Net profit today. The canteen&apos;s own-goods cost is estimated
            until the next count.
          </p>

          <div className="space-y-1.5 border-t pt-3 text-sm">
            <Line label="Revenue" value={dashboard.revenue.total} />
            <Line
              label="Cost of goods sold"
              value={-dashboard.costOfGoods.total}
              muted
            />
            <Line label="Gross profit" value={dashboard.grossProfit} rule />
            <Line label="Running costs" value={-dashboard.runningCosts} muted />
          </div>

          <div className="mt-3 flex gap-4 border-t pt-3 text-xs">
            <span>
              <span className="text-muted-foreground">Restaurant </span>
              <span className="tabular font-medium">
                {money(dashboard.revenue.restaurant)}
              </span>
            </span>
            <span>
              <span className="text-muted-foreground">Canteen </span>
              <span className="tabular font-medium">
                {money(dashboard.revenue.canteen)}
              </span>
            </span>
          </div>
        </div>

        {/* Where is the money */}
        <div className="rounded-lg border bg-card p-5">
          <h2 className="mb-1 text-sm font-medium text-muted-foreground">
            How much should I be holding?
          </h2>
          <div className="mb-1 flex items-baseline gap-4">
            <div>
              <div className="tabular text-4xl font-semibold">
                {money(dashboard.cash.expectedCash)}
              </div>
              <div className="text-xs text-muted-foreground">Cash</div>
            </div>
            <div>
              <div className="tabular text-2xl font-medium">
                {money(dashboard.cash.expectedMpesa)}
              </div>
              <div className="text-xs text-muted-foreground">M-Pesa</div>
            </div>
          </div>
          <p className="mb-4 text-xs text-muted-foreground">
            What a physical count should find. Never estimated.
          </p>

          <div className="space-y-1.5 border-t pt-3 text-sm">
            <Line
              label="Handovers received"
              value={dashboard.cash.handoversReceived}
            />
            <Line label="Paid out" value={-dashboard.cash.paidOut} muted />
            <Line
              label="Expected cash"
              value={dashboard.cash.expectedCash}
              rule
            />
          </div>

          <div className="mt-3 flex gap-4 border-t pt-3 text-xs">
            <span>
              <span className="text-muted-foreground">Owed to me </span>
              <span className="tabular font-medium">
                {money(dashboard.owedToBusiness)}
              </span>
            </span>
            <span>
              <span className="text-muted-foreground">My drawings </span>
              <span className="tabular font-medium">
                {money(dashboard.drawingsOutstanding)}
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* Did today add up */}
      <div className="rounded-lg border bg-card">
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h2 className="font-medium">Did today add up?</h2>
          {problems.length > 0 && (
            <Badge
              variant="outline"
              className="border-danger/30 bg-danger-subtle text-danger"
            >
              {problems.length} to look at
            </Badge>
          )}
        </div>
        <div className="divide-y">
          {handovers.map((h) => {
            const cashDiff = h.cashActual - h.cashExpected;
            const mpesaDiff = h.mpesaActual - h.mpesaExpected;
            const ok = cashDiff === 0 && mpesaDiff === 0;
            return (
              <div
                key={h.staffId}
                className="flex items-center gap-4 px-5 py-3"
              >
                <div className="w-28">
                  <div className="font-medium">{h.staffName}</div>
                  <div className="text-xs capitalize text-muted-foreground">
                    {h.location}
                  </div>
                </div>

                <div className="flex flex-1 gap-6 text-sm">
                  <Pair
                    label="Cash"
                    expected={h.cashExpected}
                    actual={h.cashActual}
                  />
                  <Pair
                    label="M-Pesa"
                    expected={h.mpesaExpected}
                    actual={h.mpesaActual}
                  />
                </div>

                {ok ? (
                  <span className="text-sm text-muted-foreground">Agreed</span>
                ) : (
                  <Button variant="outline" size="sm" className="h-7">
                    Look into it <ArrowRight className="size-3" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Line({
  label,
  value,
  muted,
  rule,
}: {
  label: string;
  value: number;
  muted?: boolean;
  rule?: boolean;
}) {
  return (
    <div
      className={`flex justify-between ${rule ? "border-t pt-1.5 font-medium" : ""}`}
    >
      <span className={muted ? "text-muted-foreground" : ""}>{label}</span>
      <span className="tabular">
        {value < 0 ? "−" : ""}
        {money(Math.abs(value))}
      </span>
    </div>
  );
}

function Pair({
  label,
  expected,
  actual,
}: {
  label: string;
  expected: number;
  actual: number;
}) {
  const diff = actual - expected;
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="tabular">
        {money(actual)}
        {diff !== 0 && (
          <span className="ml-1.5 font-medium text-danger">
            {diff > 0 ? "+" : "−"}
            {money(Math.abs(diff))}
          </span>
        )}
      </div>
    </div>
  );
}
