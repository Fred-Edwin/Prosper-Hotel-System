"use client";

/**
 * The ledger's stats bar, as a waterfall.
 *
 * Six equal tiles was the same failing Edwin identified in the dashboard's
 * first round — no hierarchy among them, so nothing stood out and the
 * reconciliation had to be stated separately underneath. This states the
 * arithmetic instead: opening + purchases − closing = cost of goods sold, as
 * one continuous band, with the reconciliation folded in rather than appended.
 *
 * Same treatment as the dashboard's profit waterfall, so the two pages read as
 * one instrument. Clicking a term filters the sub-ledger below to what composes
 * it, which is the connection between summary and record that the ledger exists
 * to provide.
 */

import { money } from "@/lib/fixtures";
import { Badge } from "@/components/ui/badge";
import { Info } from "lucide-react";

export const ledgerTotals = {
  openingStockValue: 68420,
  purchases: 49770,
  closingStockValue: 71180,
  costOfGoodsSold: 47010,
  nonSalesAtCost: 1284,
  nonSalesAtPrice: 2140,
  salesValue: 63740,
  grossProfit: 16730,
};

export type StatTerm = "opening" | "purchases" | "closing" | "cogs";

const terms: {
  key: StatTerm;
  label: string;
  value: number;
  operator?: string;
  colour: string;
  sub: string;
  provisional?: boolean;
  /** Which sub-ledger explains this term. */
  explains: string;
}[] = [
  {
    key: "opening",
    label: "Opening stock",
    value: ledgerTotals.openingStockValue,
    colour: "var(--color-neutral-400)",
    sub: "at 2 August",
    explains: "products",
  },
  {
    key: "purchases",
    label: "Purchases",
    value: ledgerTotals.purchases,
    operator: "+",
    colour: "var(--color-brand-600)",
    sub: "stock and ingredients bought",
    explains: "store",
  },
  {
    key: "closing",
    label: "Closing stock",
    value: ledgerTotals.closingStockValue,
    operator: "−",
    colour: "var(--color-neutral-400)",
    sub: "at 6 August",
    explains: "products",
  },
  {
    key: "cogs",
    label: "Cost of goods sold",
    value: ledgerTotals.costOfGoodsSold,
    operator: "=",
    colour: "var(--color-danger)",
    sub: "the value of stock used up",
    provisional: true,
    explains: "products",
  },
];

export function LedgerStats({
  active,
  onSelect,
}: {
  active?: StatTerm | null;
  onSelect?: (t: StatTerm, explains: string) => void;
}) {
  const max = Math.max(...terms.map((t) => t.value));

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="flex items-center justify-between px-5 pt-4 pb-3">
        <div>
          <h2 className="text-sm font-medium">Cost of goods sold</h2>
          <p className="text-xs text-muted-foreground">
            What the stock movements below add up to.
          </p>
        </div>
        <Badge variant="outline" className="text-[10px] font-normal">
          partly provisional
        </Badge>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4">
        {terms.map((t, i) => {
          const on = active === t.key;
          return (
            <button
              key={t.key}
              onClick={() => onSelect?.(t.key, t.explains)}
              className={`group relative flex flex-col justify-between pt-3 pb-0 text-left transition-colors duration-100 ${
                on ? "bg-card" : "bg-muted/25 hover:bg-muted/50"
              } ${i > 0 ? "border-l" : ""}`}
              aria-pressed={on}
            >
              <span
                className="absolute inset-x-0 top-0 h-0.5 transition-opacity duration-100"
                style={{ background: t.colour, opacity: on ? 1 : 0 }}
              />
              <div className="px-5">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  {t.operator && (
                    <span className="text-sm text-muted-foreground/60">
                      {t.operator}
                    </span>
                  )}
                  {t.label}
                  {t.provisional && (
                    <span title="Canteen own-goods cost is estimated between counts">
                      <Info className="size-3" />
                    </span>
                  )}
                </div>
                <div className="tabular mt-1 text-2xl font-semibold">
                  {money(t.value)}
                </div>
                <div className="tabular mt-0.5 mb-3 text-[11px] text-muted-foreground">
                  {t.sub}
                </div>
              </div>
              <div className="h-1.5 w-full bg-muted">
                <div
                  className="h-full transition-[width] duration-200"
                  style={{
                    width: `${(t.value / max) * 100}%`,
                    background: t.colour,
                  }}
                />
              </div>
            </button>
          );
        })}
      </div>

      {/* What the arithmetic produced, and the caveat it carries. */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t bg-muted/20 px-5 py-3">
        <Piece label="Sales value" value={ledgerTotals.salesValue} />
        <Piece
          label="Gross profit"
          value={ledgerTotals.grossProfit}
          strong
        />
        <Piece
          label="Non-sales consumption"
          value={ledgerTotals.nonSalesAtCost}
          tone="danger"
          note={`${money(ledgerTotals.nonSalesAtPrice)} at selling price`}
        />
        <p className="ml-auto max-w-md text-[11px] text-muted-foreground">
          Non-sales consumption is already inside cost of goods sold — stock no
          longer present was counted as used up. It is shown to say where stock
          went, not deducted twice.
        </p>
      </div>
    </div>
  );
}

function Piece({
  label,
  value,
  strong,
  tone,
  note,
}: {
  label: string;
  value: number;
  strong?: boolean;
  tone?: "danger";
  note?: string;
}) {
  return (
    <span className="whitespace-nowrap">
      <span className="text-[11px] text-muted-foreground">{label} </span>
      <span
        className={`tabular text-[13px] ${strong ? "font-semibold" : ""} ${
          tone === "danger" ? "text-danger" : ""
        }`}
      >
        {money(value)}
      </span>
      {note && (
        <span className="tabular ml-1 text-[11px] text-muted-foreground">
          · {note}
        </span>
      )}
    </span>
  );
}
