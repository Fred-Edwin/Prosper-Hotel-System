"use client";

/**
 * The dashboard's non-figure sections, shared across the round-two variants.
 *
 * Content settled after round one: handover table, exceptions, location
 * comparison, stock movements, store movements. The variants differ in how
 * these are arranged, not in what they contain.
 *
 * Each is a summary with a way through to the ledger. The dashboard shows
 * today; the ledger holds the history and the filtering. Without that line the
 * two pages converge and one becomes redundant.
 */

import {
  handovers,
  expenses,
  sales,
  locationPerformance,
  stockFlow,
  storeFlow,
  money,
} from "@/lib/fixtures";
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
import { SectionHeader } from "./figures";
import { ArrowRight, Check, TriangleAlert } from "lucide-react";

export function HandoverTable({ compact }: { compact?: boolean }) {
  const problems = handovers.filter(
    (h) => h.cashActual !== h.cashExpected || h.mpesaActual !== h.mpesaExpected,
  );

  return (
    <div className="rounded-lg border bg-card">
      <SectionHeader
        title="Handover"
        badge={
          problems.length > 0 ? (
            <Badge
              variant="outline"
              className="border-danger/30 bg-danger-subtle text-danger"
            >
              {problems.length} short
            </Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground">
              All agreed
            </Badge>
          )
        }
        action={
          <Button variant="ghost" size="sm" className="h-7 text-xs">
            Open the ledger <ArrowRight className="size-3" />
          </Button>
        }
      />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Person</TableHead>
            {!compact && <TableHead className="w-24">Location</TableHead>}
            <TableHead className="w-24 text-right">Cash due</TableHead>
            <TableHead className="w-24 text-right">Cash in</TableHead>
            <TableHead className="w-24 text-right">M-Pesa due</TableHead>
            <TableHead className="w-24 text-right">M-Pesa in</TableHead>
            <TableHead className="w-28 text-right">Difference</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {handovers.map((h) => {
            const diff =
              h.cashActual - h.cashExpected + (h.mpesaActual - h.mpesaExpected);
            return (
              <TableRow key={h.staffId}>
                <TableCell className="font-medium">{h.staffName}</TableCell>
                {!compact && (
                  <TableCell className="capitalize text-muted-foreground">
                    {h.location}
                  </TableCell>
                )}
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
  );
}

export function Exceptions() {
  const shortfalls = handovers.filter(
    (h) => h.cashActual !== h.cashExpected || h.mpesaActual !== h.mpesaExpected,
  );
  const voided = sales.filter((s) => s.voided);
  const pending = expenses.filter((e) => e.status === "pending");
  const count = shortfalls.length + voided.length + pending.length;

  return (
    <div className="rounded-lg border bg-card">
      <SectionHeader
        title="Needs you"
        badge={
          count > 0 ? (
            <Badge variant="secondary" className="tabular">
              {count}
            </Badge>
          ) : undefined
        }
      />
      {count === 0 ? (
        <div className="flex items-center gap-2 px-4 py-6 text-sm text-muted-foreground">
          <Check className="size-4 text-success" />
          Everything agreed today. Nothing needs you.
        </div>
      ) : (
        <div className="divide-y">
          {shortfalls.map((h) => {
            const cashDiff = h.cashActual - h.cashExpected;
            const mpesaDiff = h.mpesaActual - h.mpesaExpected;
            return (
              <Row
                key={h.staffId}
                icon={<TriangleAlert className="size-4 text-warning" />}
                title={`${h.staffName} handed over less than expected`}
                detail={[
                  cashDiff !== 0 && `Cash short ${money(Math.abs(cashDiff))}`,
                  mpesaDiff !== 0 &&
                    `M-Pesa short ${money(Math.abs(mpesaDiff))}`,
                  h.location,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                action="Look into it"
              />
            );
          })}
          {pending.map((e) => (
            <Row
              key={e.id}
              title={`${e.recordedBy} recorded an expense for you to confirm`}
              detail={`${e.description} · ${money(e.amount)}`}
              action="Confirm"
              primary
            />
          ))}
          {voided.map((s) => (
            <Row
              key={s.id}
              title={`${s.voided!.by} voided sale ${s.ref}`}
              detail={`${s.voided!.reason} · ${money(s.total)} · ${s.voided!.at}`}
              action="View"
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Row({
  icon,
  title,
  detail,
  action,
  primary,
}: {
  icon?: React.ReactNode;
  title: string;
  detail: string;
  action: string;
  primary?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      {icon}
      <div className="min-w-0 flex-1">
        <div className="text-sm">{title}</div>
        <div className="tabular text-xs text-muted-foreground">{detail}</div>
      </div>
      <Button
        variant={primary ? "default" : "outline"}
        size="sm"
        className="h-7 shrink-0 text-xs"
      >
        {action}
      </Button>
    </div>
  );
}

export function LocationComparison({ stacked }: { stacked?: boolean }) {
  const totals = locationPerformance.reduce(
    (a, l) => ({
      revenue: a.revenue + l.revenue,
      netProfit: a.netProfit + l.netProfit,
    }),
    { revenue: 0, netProfit: 0 },
  );

  return (
    <div className="rounded-lg border bg-card">
      <SectionHeader
        title="By location"
        action={
          <Button variant="ghost" size="sm" className="h-7 text-xs">
            Open the ledger <ArrowRight className="size-3" />
          </Button>
        }
      />
      {stacked ? (
        <div className="divide-y">
          {locationPerformance.map((l) => (
            <div key={l.location} className="px-4 py-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium capitalize">
                  {l.location}
                </span>
                {l.provisional && (
                  <Badge variant="outline" className="text-[10px] font-normal">
                    provisional
                  </Badge>
                )}
              </div>
              <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-neutral-700"
                  style={{ width: `${(l.revenue / totals.revenue) * 100}%` }}
                />
              </div>
              <div className="grid grid-cols-4 gap-2 text-xs">
                <Cell label="Revenue" value={money(l.revenue)} />
                <Cell label="Cost of goods" value={money(l.costOfGoods)} />
                <Cell label="Running costs" value={money(l.runningCosts)} />
                <Cell
                  label="Net profit"
                  value={
                    l.netProfit < 0
                      ? `−${money(Math.abs(l.netProfit))}`
                      : money(l.netProfit)
                  }
                  tone={l.netProfit < 0 ? "danger" : undefined}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Location</TableHead>
              <TableHead className="text-right">Revenue</TableHead>
              <TableHead className="text-right">Cost of goods</TableHead>
              <TableHead className="text-right">Gross profit</TableHead>
              <TableHead className="text-right">Running costs</TableHead>
              <TableHead className="text-right">Net profit</TableHead>
              <TableHead className="text-right">Margin</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {locationPerformance.map((l) => (
              <TableRow key={l.location}>
                <TableCell className="font-medium capitalize">
                  {l.location}
                  {l.provisional && (
                    <Badge
                      variant="outline"
                      className="ml-1.5 text-[10px] font-normal"
                    >
                      provisional
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="tabular text-right">
                  {money(l.revenue)}
                </TableCell>
                <TableCell className="tabular text-right">
                  {money(l.costOfGoods)}
                </TableCell>
                <TableCell className="tabular text-right">
                  {money(l.grossProfit)}
                </TableCell>
                <TableCell className="tabular text-right">
                  {money(l.runningCosts)}
                </TableCell>
                <TableCell
                  className={`tabular text-right font-medium ${
                    l.netProfit < 0 ? "text-danger" : ""
                  }`}
                >
                  {l.netProfit < 0
                    ? `−${money(Math.abs(l.netProfit))}`
                    : money(l.netProfit)}
                </TableCell>
                <TableCell className="tabular text-right text-muted-foreground">
                  {(l.margin * 100).toFixed(1)}%
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function Cell({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "danger";
}) {
  return (
    <div>
      <div className="text-muted-foreground">{label}</div>
      <div
        className={`tabular font-medium ${tone === "danger" ? "text-danger" : ""}`}
      >
        {value}
      </div>
    </div>
  );
}

export function StockMovements() {
  return (
    <div className="rounded-lg border bg-card">
      <SectionHeader
        title="Stock movements"
        action={
          <Button variant="ghost" size="sm" className="h-7 text-xs">
            Open the ledger <ArrowRight className="size-3" />
          </Button>
        }
      />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Reason</TableHead>
            <TableHead className="w-24">Location</TableHead>
            <TableHead className="w-20 text-right">Qty</TableHead>
            <TableHead className="w-28 text-right">Value</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {stockFlow.map((s) => (
            <TableRow key={s.reason}>
              <TableCell className="font-medium">{s.reason}</TableCell>
              <TableCell className="capitalize text-muted-foreground">
                {s.location}
              </TableCell>
              <TableCell className="tabular text-right">{s.qty}</TableCell>
              <TableCell
                className={`tabular text-right ${
                  ["Wasted", "Consumed", "Given away"].includes(s.reason)
                    ? "text-danger"
                    : ""
                }`}
              >
                {money(s.value)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function StoreMovements() {
  return (
    <div className="rounded-lg border bg-card">
      <SectionHeader
        title="Restaurant store"
        action={
          <Button variant="ghost" size="sm" className="h-7 text-xs">
            Open the ledger <ArrowRight className="size-3" />
          </Button>
        }
      />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Item</TableHead>
            <TableHead className="w-24 text-right">Received</TableHead>
            <TableHead className="w-24 text-right">To kitchen</TableHead>
            <TableHead className="w-24 text-right">To canteen</TableHead>
            <TableHead className="w-24 text-right">Closing</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {storeFlow.map((s) => (
            <TableRow key={s.item}>
              <TableCell className="font-medium">{s.item}</TableCell>
              <TableCell className="tabular text-right">
                {s.received || <span className="text-muted-foreground">—</span>}
              </TableCell>
              <TableCell className="tabular text-right">
                {s.issued || <span className="text-muted-foreground">—</span>}
              </TableCell>
              <TableCell className="tabular text-right">
                {s.transferred || (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="tabular text-right font-medium">
                {s.closing}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
