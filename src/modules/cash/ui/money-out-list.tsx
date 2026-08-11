"use client";

/**
 * The shared list half of Money out — RecordTable + SummaryStrip, same
 * shape as the design-reference prototype (money-out/page.tsx) minus the
 * pending/confirm workflow, which isn't part of ticket 16 (no confirmation
 * lifecycle exists for an Expense — create then optionally reverse only).
 *
 * The three record-form variants (sheet, dialog, inline panel) all sit on
 * top of this same list — what varies between them is only how a new
 * payment gets recorded, not how the list reads.
 */

import { useState } from "react";
import { SummaryStrip } from "@/components/patterns/summary-strip";
import { RecordTable, Num, Truncate, RowAction, type Column } from "@/components/patterns/record-table";
import { EmptyFiltered, EmptyFirstUse } from "@/components/patterns/states";
import { ConfirmDialog } from "@/components/patterns/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { money } from "@/shared/money";
import { BanknoteArrowDown } from "lucide-react";

export type ExpenseView = {
  id: string;
  category: "stock" | "running" | "asset" | "drawing";
  amountMinor: number;
  paymentMethod: "cash" | "mpesa";
  note: string | null;
  occurredAt: string;
  staffMemberName: string;
  reversed: boolean;
};

export const categoryLabel: Record<ExpenseView["category"], string> = {
  stock: "Stock",
  running: "Running cost",
  asset: "Asset",
  drawing: "Drawing",
};

/** Which categories reduce profit — CONTEXT.md's Expense categories. */
const reducesProfit: Record<ExpenseView["category"], boolean> = {
  stock: true,
  running: true,
  asset: false,
  drawing: false,
};

function date(iso: string) {
  return new Date(iso).toLocaleDateString("en-KE", { day: "numeric", month: "short" });
}

/** The list half only — summary strip + table. Filtering/search lives in
 * the page's toolbar (AdminShell's toolbar slot), same split as Catalogue. */
export function MoneyOutList({
  expenses,
  filtered,
  onClearFilters,
  onReverse,
  reversingId,
}: {
  /** Everything at this location, for the summary totals. */
  expenses: ExpenseView[];
  /** After search/category filtering — what the table actually renders. */
  filtered: ExpenseView[];
  onClearFilters: () => void;
  onReverse?: (id: string) => void;
  reversingId?: string | null;
}) {
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const rows = filtered;
  const active = expenses.filter((e) => !e.reversed);
  const confirming = expenses.find((e) => e.id === confirmingId) ?? null;
  const totals = active.reduce(
    (a, e) => ({
      all: a.all + e.amountMinor,
      profit: a.profit + (reducesProfit[e.category] ? e.amountMinor : 0),
      cashOnly: a.cashOnly + (reducesProfit[e.category] ? 0 : e.amountMinor),
    }),
    { all: 0, profit: 0, cashOnly: 0 },
  );

  const columns: Column<ExpenseView>[] = [
    {
      key: "note",
      header: "What for",
      align: "left",
      cell: (e) => <Truncate>{e.note ?? categoryLabel[e.category]}</Truncate>,
    },
    {
      key: "category",
      header: "Category",
      align: "left",
      cell: (e) => <span className="text-muted-foreground">{categoryLabel[e.category]}</span>,
    },
    {
      key: "date",
      header: "Date",
      align: "left",
      cell: (e) => <span className="tabular text-muted-foreground">{date(e.occurredAt)}</span>,
    },
    {
      key: "by",
      header: "Recorded by",
      align: "left",
      cell: (e) => <span className="text-muted-foreground">{e.staffMemberName}</span>,
    },
    {
      key: "amount",
      header: "Amount",
      group: true,
      cell: (e) => <Num value={e.amountMinor} money strong muted={e.reversed} />,
    },
    {
      key: "effect",
      header: "Reduces",
      align: "left",
      cell: (e) => (
        <span className="text-[11px] text-muted-foreground">
          {reducesProfit[e.category] ? "profit and cash" : "cash only"}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      align: "left",
      group: true,
      cell: (e) =>
        e.reversed ? (
          <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">
            Reversed
          </Badge>
        ) : null,
    },
    {
      key: "action",
      header: "",
      cell: (e) =>
        !e.reversed && onReverse ? (
          <RowAction
            label={reversingId === e.id ? "Reversing…" : "Reverse"}
            onClick={() => setConfirmingId(e.id)}
          />
        ) : null,
    },
  ];

  return (
    <>
      <div className="mb-4">
        <SummaryStrip
          columns={3}
          items={[
            { label: "Paid out", value: money(totals.all), sub: `${active.length} entries` },
            { label: "Reduced profit", value: money(totals.profit), sub: "stock and running costs" },
            {
              label: "Reduced cash only",
              value: money(totals.cashOnly),
              sub: "assets and drawings — the money left, the profit did not",
            },
          ]}
        />
      </div>

      <RecordTable
        rows={rows}
        columns={columns}
        rowKey={(e) => e.id}
        minWidth={880}
        footnote="Assets and drawings reduce cash but not profit — you still own the equipment, and a drawing is owed back to the business. Only stock and running costs reduce what the business made."
        empty={
          expenses.length === 0 ? (
            <EmptyFirstUse
              icon={<BanknoteArrowDown className="size-4" />}
              title="Nothing paid out yet"
              body="Every stock purchase, running cost, asset and drawing you record will be listed here with what it reduced."
            />
          ) : (
            <EmptyFiltered onClear={onClearFilters} noun="payments" />
          )
        }
      />

      {confirming && (
        <ConfirmDialog
          open={true}
          onOpenChange={(v) => {
            if (!v) setConfirmingId(null);
          }}
          title={`Reverse this payment (${money(confirming.amountMinor)})?`}
          description="The original stays visible, marked reversed, and is excluded from the totals above. This cannot be undone."
          confirmLabel="Reverse payment"
          destructive
          onConfirm={() => {
            const id = confirming.id;
            setConfirmingId(null);
            onReverse?.(id);
          }}
        />
      )}
    </>
  );
}
