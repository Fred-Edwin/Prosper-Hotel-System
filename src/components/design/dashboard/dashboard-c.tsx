"use client";

/**
 * Dashboard C — exceptions first.
 *
 * Inverts the page. Lucy is absent during trading and arrives to collect; the
 * first thing she needs is not a figure she already roughly knows, but
 * anything that went wrong while she was away. So the page opens with what
 * needs her attention, and the figures sit below it as reassurance.
 *
 * On a clean day the top of the page says so in one line and the figures move
 * up — which is also the empty state, and worth seeing whether it feels like a
 * reward or like a wasted screen.
 *
 * The risk this variant carries: a dashboard that leads with problems may read
 * as an accusation of her staff every morning, which is not the tone the
 * business wants. Worth judging directly.
 */

import { dashboard, handovers, expenses, sales, money } from "@/lib/fixtures";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { TriangleAlert, Check, ArrowRight, Info } from "lucide-react";

export function DashboardC() {
  const shortfalls = handovers.filter(
    (h) => h.cashActual !== h.cashExpected || h.mpesaActual !== h.mpesaExpected,
  );
  const voided = sales.filter((s) => s.voided);
  const pending = expenses.filter((e) => e.status === "pending");
  const count = shortfalls.length + voided.length + pending.length;

  return (
    <div className="mx-auto max-w-[1100px] p-6">
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Today</h1>
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

      {count === 0 ? (
        <div className="mb-5 flex items-center gap-2 rounded-md border border-success/30 bg-success-subtle px-4 py-3 text-sm">
          <Check className="size-4 text-success" />
          Everything agreed today. Nothing needs you.
        </div>
      ) : (
        <div className="mb-5 rounded-lg border bg-card">
          <div className="flex items-center gap-2 border-b px-5 py-3">
            <TriangleAlert className="size-4 text-warning" />
            <h2 className="font-medium">Needs you</h2>
            <Badge variant="secondary" className="tabular">
              {count}
            </Badge>
          </div>

          <div className="divide-y">
            {shortfalls.map((h) => {
              const cashDiff = h.cashActual - h.cashExpected;
              const mpesaDiff = h.mpesaActual - h.mpesaExpected;
              return (
                <div key={h.staffId} className="flex items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">
                      {h.staffName} handed over less than expected
                    </div>
                    <div className="tabular text-xs text-muted-foreground">
                      {cashDiff !== 0 && (
                        <>Cash short by {money(Math.abs(cashDiff))}</>
                      )}
                      {cashDiff !== 0 && mpesaDiff !== 0 && " · "}
                      {mpesaDiff !== 0 && (
                        <>M-Pesa short by {money(Math.abs(mpesaDiff))}</>
                      )}
                      {" · "}
                      <span className="capitalize">{h.location}</span>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="h-7">
                    Look into it <ArrowRight className="size-3" />
                  </Button>
                </div>
              );
            })}

            {pending.map((e) => (
              <div key={e.id} className="flex items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">
                    {e.recordedBy} recorded an expense for you to confirm
                  </div>
                  <div className="tabular text-xs text-muted-foreground">
                    {e.description} · {money(e.amount)}
                  </div>
                </div>
                <Button size="sm" className="h-7">
                  Confirm
                </Button>
              </div>
            ))}

            {voided.map((s) => (
              <div key={s.id} className="flex items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">
                    {s.voided!.by} voided sale {s.ref}
                  </div>
                  <div className="tabular text-xs text-muted-foreground">
                    {s.voided!.reason} · {money(s.total)} · {s.voided!.at}
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="h-7">
                  View
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-lg border bg-card">
        <div className="grid grid-cols-2 md:grid-cols-4">
          <Figure
            label="Revenue"
            value={dashboard.revenue.total}
            sub={`${money(dashboard.revenue.restaurant)} · ${money(dashboard.revenue.canteen)}`}
          />
          <Figure
            label="Net profit"
            value={dashboard.netProfit}
            sub="after cost of goods and running costs"
            provisional
          />
          <Figure
            label="Cash you should hold"
            value={dashboard.cash.expectedCash}
            sub={`M-Pesa ${money(dashboard.cash.expectedMpesa)}`}
          />
          <Figure
            label="Owed to you"
            value={dashboard.owedToBusiness}
            sub={`your drawings ${money(dashboard.drawingsOutstanding)}`}
          />
        </div>

        <Separator />

        <div className="px-5 py-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-medium">How the profit is reached</h3>
            <Button variant="ghost" size="sm" className="h-7 text-xs">
              Open the ledger <ArrowRight className="size-3" />
            </Button>
          </div>
          <table className="w-full max-w-md text-sm">
            <tbody>
              <tr>
                <td className="py-1">Revenue</td>
                <td className="tabular py-1 text-right">
                  {money(dashboard.revenue.total)}
                </td>
              </tr>
              <tr className="text-muted-foreground">
                <td className="py-1">
                  Cost of goods sold
                  <Badge variant="outline" className="ml-2 text-[10px] font-normal">
                    part estimated
                  </Badge>
                </td>
                <td className="tabular py-1 text-right">
                  −{money(dashboard.costOfGoods.total)}
                </td>
              </tr>
              <tr className="border-t font-medium">
                <td className="py-1 pt-2">Gross profit</td>
                <td className="tabular py-1 pt-2 text-right">
                  {money(dashboard.grossProfit)}
                </td>
              </tr>
              <tr className="text-muted-foreground">
                <td className="py-1">Running costs</td>
                <td className="tabular py-1 text-right">
                  −{money(dashboard.runningCosts)}
                </td>
              </tr>
              <tr className="border-t font-semibold">
                <td className="py-1 pt-2">Net profit</td>
                <td className="tabular py-1 pt-2 text-right">
                  {money(dashboard.netProfit)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Figure({
  label,
  value,
  sub,
  provisional,
}: {
  label: string;
  value: number;
  sub: string;
  provisional?: boolean;
}) {
  return (
    <div className="border-r border-b p-5 last:border-r-0 md:border-b-0">
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        {label}
        {provisional && (
          <span title="Canteen own-goods cost is estimated between counts">
            <Info className="size-3" />
          </span>
        )}
      </div>
      <div className="tabular mt-1 text-2xl font-semibold">{money(value)}</div>
      <div className="tabular mt-0.5 text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}
