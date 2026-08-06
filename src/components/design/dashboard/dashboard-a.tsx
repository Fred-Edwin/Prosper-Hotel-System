"use client";

/**
 * Dashboard A — stat row, then tables.
 *
 * The conventional admin shape: a row of figures across the top, tables
 * stacked below. Seven stat tiles carrying everything Lucy asks for, then
 * handover, cash, profit and exceptions in sequence.
 *
 * What it is testing: whether "the important figures in the hero section"
 * survives being seven equally-weighted tiles. Seven things given equal
 * emphasis may be seven things given none — the squint test should show
 * whether anything actually stands out.
 */

import { dashboard, handovers, expenses, sales, money } from "@/lib/fixtures";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Info, TriangleAlert } from "lucide-react";

export function DashboardA() {
  const voided = sales.filter((s) => s.voided);
  const pending = expenses.filter((e) => e.status === "pending");

  return (
    <div className="mx-auto max-w-[1400px] p-6">
      <div className="mb-4 flex items-start justify-between">
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

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
        <Stat label="Revenue" value={dashboard.revenue.total} />
        <Stat label="Gross profit" value={dashboard.grossProfit} provisional />
        <Stat label="Net profit" value={dashboard.netProfit} provisional />
        <Stat label="Cash in hand" value={dashboard.cash.expectedCash} />
        <Stat label="M-Pesa" value={dashboard.cash.expectedMpesa} />
        <Stat label="Owed to me" value={dashboard.owedToBusiness} />
        <Stat label="Drawings out" value={dashboard.drawingsOutstanding} />
      </div>

      <div className="mb-5 rounded-md border bg-card">
        <div className="flex items-center justify-between border-b px-4 py-2.5">
          <h2 className="font-medium">Handover check</h2>
          <Badge variant="outline" className="border-danger/30 bg-danger-subtle text-danger">
            2 differences
          </Badge>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Person</TableHead>
              <TableHead className="w-28">Location</TableHead>
              <TableHead className="w-28 text-right">Cash due</TableHead>
              <TableHead className="w-28 text-right">Cash in</TableHead>
              <TableHead className="w-28 text-right">M-Pesa due</TableHead>
              <TableHead className="w-28 text-right">M-Pesa in</TableHead>
              <TableHead className="w-32 text-right">Difference</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {handovers.map((h) => {
              const diff =
                h.cashActual - h.cashExpected + (h.mpesaActual - h.mpesaExpected);
              return (
                <TableRow key={h.staffId}>
                  <TableCell className="font-medium">{h.staffName}</TableCell>
                  <TableCell className="capitalize text-muted-foreground">
                    {h.location}
                  </TableCell>
                  <TableCell className="tabular text-right">
                    {money(h.cashExpected)}
                  </TableCell>
                  <TableCell className="tabular text-right">
                    {money(h.cashActual)}
                  </TableCell>
                  <TableCell className="tabular text-right">
                    {money(h.mpesaExpected)}
                  </TableCell>
                  <TableCell className="tabular text-right">
                    {money(h.mpesaActual)}
                  </TableCell>
                  <TableCell className="tabular text-right">
                    {diff === 0 ? (
                      <span className="text-muted-foreground">Agreed</span>
                    ) : (
                      <span className="font-medium text-danger">
                        {diff > 0 ? "+" : "−"}
                        {money(Math.abs(diff))}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-md border bg-card">
          <div className="border-b px-4 py-2.5 font-medium">Profit</div>
          <table className="w-full p-4 text-sm">
            <tbody className="[&_td]:px-4 [&_td]:py-1.5">
              <tr>
                <td>Revenue</td>
                <td className="tabular text-right">
                  {money(dashboard.revenue.total)}
                </td>
              </tr>
              <tr>
                <td className="text-muted-foreground">Cost of goods sold</td>
                <td className="tabular text-right">
                  −{money(dashboard.costOfGoods.total)}
                </td>
              </tr>
              <tr className="border-t font-medium">
                <td className="pt-2">Gross profit</td>
                <td className="tabular pt-2 text-right">
                  {money(dashboard.grossProfit)}
                </td>
              </tr>
              <tr>
                <td className="text-muted-foreground">Running costs</td>
                <td className="tabular text-right">
                  −{money(dashboard.runningCosts)}
                </td>
              </tr>
              <tr className="border-t font-semibold">
                <td className="pt-2">Net profit</td>
                <td className="tabular pt-2 text-right">
                  {money(dashboard.netProfit)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="rounded-md border bg-card">
          <div className="border-b px-4 py-2.5 font-medium">Exceptions</div>
          <div className="divide-y">
            {voided.map((s) => (
              <div key={s.id} className="flex items-start gap-2 px-4 py-2.5">
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
                <div className="min-w-0 flex-1 text-sm">
                  <div>
                    Sale {s.ref} voided by {s.voided!.by}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {s.voided!.reason} · {money(s.total)}
                  </div>
                </div>
              </div>
            ))}
            {pending.map((e) => (
              <div key={e.id} className="flex items-start gap-2 px-4 py-2.5">
                <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1 text-sm">
                  <div>Expense awaiting your confirmation</div>
                  <div className="text-xs text-muted-foreground">
                    {e.description} · {money(e.amount)} · {e.recordedBy}
                  </div>
                </div>
                <Button size="sm" variant="outline" className="h-7">
                  Confirm
                </Button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  provisional,
}: {
  label: string;
  value: number;
  provisional?: boolean;
}) {
  return (
    <div className="rounded-md border bg-card p-3">
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        {label}
        {provisional && (
          <span title="Canteen own-goods cost is estimated between counts">
            <Info className="size-3" />
          </span>
        )}
      </div>
      <div className="tabular mt-1 text-lg font-semibold">{money(value)}</div>
      {provisional && (
        <Badge variant="outline" className="mt-1 text-[10px] font-normal">
          provisional
        </Badge>
      )}
    </div>
  );
}
