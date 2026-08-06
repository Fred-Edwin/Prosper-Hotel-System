"use client";

/**
 * The ledger's stats bar.
 *
 * Every figure here reconciles to a table below it, which is the point: the
 * dashboard states figures, and the ledger is where they are shown to arise.
 * Same treatment as the dashboard's waterfall so the two pages read as one
 * system rather than two applications.
 */

import { money } from "@/lib/fixtures";
import { Badge } from "@/components/ui/badge";
import { Info } from "lucide-react";

export const ledgerTotals = {
  openingStockValue: 68420,
  closingStockValue: 71180,
  purchases: 49770,
  costOfGoodsSold: 47010,
  nonSalesAtCost: 1284,
  nonSalesAtPrice: 2140,
  salesValue: 63740,
  grossProfit: 16730,
  cashIn: 40030,
  cashOut: 62030,
  closingCash: 23200,
};

export function LedgerStats({ compact }: { compact?: boolean }) {
  const stats: {
    label: string;
    value: number;
    sub?: string;
    provisional?: boolean;
    tone?: "danger";
  }[] = [
    {
      label: "Opening stock",
      value: ledgerTotals.openingStockValue,
      sub: "at 2 August",
    },
    {
      label: "Purchases",
      value: ledgerTotals.purchases,
      sub: "stock and ingredients bought",
    },
    {
      label: "Closing stock",
      value: ledgerTotals.closingStockValue,
      sub: "at 6 August",
    },
    {
      label: "Cost of goods sold",
      value: ledgerTotals.costOfGoodsSold,
      sub: "opening + bought − closing",
      provisional: true,
    },
    {
      label: "Non-sales consumption",
      value: ledgerTotals.nonSalesAtCost,
      sub: `${money(ledgerTotals.nonSalesAtPrice)} at selling price`,
      tone: "danger",
    },
    {
      label: "Gross profit",
      value: ledgerTotals.grossProfit,
      sub: "sales less cost of goods",
      provisional: true,
    },
  ];

  return (
    <div
      className={`grid gap-px overflow-hidden rounded-lg border bg-border ${
        compact
          ? "grid-cols-2 lg:grid-cols-3"
          : "grid-cols-2 md:grid-cols-3 xl:grid-cols-6"
      }`}
    >
      {stats.map((s) => (
        <div key={s.label} className="bg-card p-3">
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            {s.label}
            {s.provisional && (
              <span title="Canteen own-goods cost is estimated between counts">
                <Info className="size-3" />
              </span>
            )}
          </div>
          <div
            className={`tabular mt-0.5 text-lg font-semibold ${
              s.tone === "danger" ? "text-danger" : ""
            }`}
          >
            {money(s.value)}
          </div>
          {s.sub && (
            <div className="tabular mt-0.5 text-[11px] text-muted-foreground">
              {s.sub}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function ReconciliationNote() {
  return (
    <div className="rounded-lg border bg-card px-4 py-3">
      <h3 className="mb-1.5 text-xs font-medium">How these reconcile</h3>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
        <Piece label="Opening stock" value={ledgerTotals.openingStockValue} />
        <Op>+</Op>
        <Piece label="Purchases" value={ledgerTotals.purchases} />
        <Op>−</Op>
        <Piece label="Closing stock" value={ledgerTotals.closingStockValue} />
        <Op>=</Op>
        <Piece
          label="Cost of goods sold"
          value={ledgerTotals.costOfGoodsSold}
          strong
        />
        <Badge variant="outline" className="ml-1 text-[10px] font-normal">
          partly provisional
        </Badge>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Non-sales consumption is already inside this figure — stock no longer
        present was counted as used up. It is reported separately to show where
        stock went, not deducted twice.
      </p>
    </div>
  );
}

function Piece({
  label,
  value,
  strong,
}: {
  label: string;
  value: number;
  strong?: boolean;
}) {
  return (
    <span className="whitespace-nowrap">
      <span className="text-muted-foreground">{label} </span>
      <span className={`tabular ${strong ? "font-semibold" : ""}`}>
        {money(value)}
      </span>
    </span>
  );
}

function Op({ children }: { children: React.ReactNode }) {
  return <span className="text-muted-foreground">{children}</span>;
}
