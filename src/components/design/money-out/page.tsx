"use client";

/**
 * Money out — the proof that the record table template holds.
 *
 * Nothing here is new. `AdminShell` + `PageHeader` + `TableToolbar` +
 * `SummaryStrip` + `RecordTable` + the five states, composed. If this page had
 * needed a pattern that did not exist, the templates would be incomplete and
 * the vacuum the whole design phase exists to close would still be open.
 *
 * It is the honest test rather than a friendly one, because it differs from
 * Stock in three ways that could each have broken the template:
 *
 *   **A status column.** Staff record expenses; Lucy confirms them. Pending is
 *   a real state with a real action attached, which Stock has nothing like.
 *
 *   **A row action.** Confirming happens on the row, not on a detail page —
 *   which tests that a table can carry an action without every row becoming an
 *   accent element. `RowAction` is outline for exactly that reason.
 *
 *   **Four categories that behave differently.** Stock and running costs reduce
 *   profit; assets and drawings reduce cash but not profit. The page has to say
 *   so without a paragraph, because getting this wrong is the single most
 *   common misunderstanding in the domain.
 */

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AccentSwitcher } from "@/components/design/accent-switcher";
import { AdminShell } from "@/components/design/shell/admin-shell";
import { SummaryStrip } from "@/components/patterns/summary-strip";
import { TableToolbar } from "@/components/patterns/table-toolbar";
import {
  RecordTable,
  Num,
  Truncate,
  RowAction,
  type Column,
} from "@/components/patterns/record-table";
import {
  LoadingTable,
  ErrorState,
  PermissionDenied,
  EmptyFirstUse,
  EmptyFiltered,
} from "@/components/patterns/states";
import { expenses, money, type Expense } from "@/lib/fixtures";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Download, BanknoteArrowDown, Clock } from "lucide-react";

type State = "ready" | "loading" | "error" | "denied" | "first-use";
const states: State[] = ["ready", "loading", "error", "denied", "first-use"];

const categoryLabel: Record<Expense["category"], string> = {
  stock: "Stock",
  running: "Running",
  asset: "Equipment",
  drawing: "Your drawings",
};

/** Which categories reduce profit, and which only reduce cash. */
const reducesProfit: Record<Expense["category"], boolean> = {
  stock: true,
  running: true,
  asset: false,
  drawing: false,
};

export function MoneyOutPage() {
  const params = useSearchParams();
  const state = (params.get("state") as State) ?? "ready";

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [pendingOnly, setPendingOnly] = useState(false);

  const clear = () => {
    setQuery("");
    setCategory("all");
    setPendingOnly(false);
  };

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return expenses.filter(
      (e) =>
        (category === "all" || e.category === category) &&
        (!pendingOnly || e.status === "pending") &&
        (!q ||
          e.description.toLowerCase().includes(q) ||
          e.recordedBy.toLowerCase().includes(q)),
    );
  }, [query, category, pendingOnly]);

  const pending = expenses.filter((e) => e.status === "pending");
  const totals = expenses.reduce(
    (a, e) => ({
      all: a.all + e.amount,
      profit: a.profit + (reducesProfit[e.category] ? e.amount : 0),
      cashOnly: a.cashOnly + (reducesProfit[e.category] ? 0 : e.amount),
    }),
    { all: 0, profit: 0, cashOnly: 0 },
  );

  const columns: Column<Expense>[] = [
    {
      key: "description",
      header: "What for",
      align: "left",
      sortable: true,
      cell: (e) => <Truncate>{e.description}</Truncate>,
    },
    {
      key: "category",
      header: "Category",
      align: "left",
      cell: (e) => (
        <span className="text-muted-foreground">{categoryLabel[e.category]}</span>
      ),
    },
    {
      key: "date",
      header: "Date",
      align: "left",
      sortable: true,
      cell: (e) => <span className="tabular text-muted-foreground">{e.date}</span>,
    },
    {
      key: "by",
      header: "Recorded by",
      align: "left",
      cell: (e) => <span className="text-muted-foreground">{e.recordedBy}</span>,
    },
    {
      key: "amount",
      header: "Amount",
      group: true,
      sortable: true,
      cell: (e) => <Num value={e.amount} money strong />,
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
        e.status === "pending" ? (
          <Badge
            variant="outline"
            className="border-warning/40 bg-warning-subtle text-[10px] font-normal text-warning"
          >
            <Clock className="size-2.5" /> Pending
          </Badge>
        ) : (
          <span className="text-[11px] text-muted-foreground">Confirmed</span>
        ),
    },
    {
      key: "action",
      header: "",
      cell: (e) =>
        e.status === "pending" ? <RowAction label="Confirm" /> : null,
    },
  ];

  const body = () => {
    if (state === "loading")
      return <LoadingTable summary={3} rows={8} columns={8} />;
    if (state === "error") return <ErrorState what="money out" />;
    if (state === "denied")
      return (
        <PermissionDenied
          title="Money out is owner-only"
          body="You can record an expense from your own shell, and it will wait here for Lucy to confirm. What the business has paid out is restricted to her."
        />
      );
    if (state === "first-use")
      return (
        <EmptyFirstUse
          icon={<BanknoteArrowDown className="size-4" />}
          title="Nothing paid out yet"
          body="Every purchase, running cost, piece of equipment and drawing you record will be listed here with what it reduced."
          action={
            <Button size="sm" className="h-8">
              <Plus className="size-3.5" /> Record money out
            </Button>
          }
        />
      );

    return (
      <>
        <div className="mb-4">
          <SummaryStrip
            columns={3}
            items={[
              {
                label: "Paid out this period",
                value: money(totals.all),
                sub: `${expenses.length} entries`,
                link: { label: "See cash movements", href: "/design/ledger" },
              },
              {
                label: "Reduced profit",
                value: money(totals.profit),
                sub: "stock and running costs",
              },
              {
                label: "Reduced cash only",
                value: money(totals.cashOnly),
                sub: "equipment and drawings — the money left, the profit did not",
              },
            ]}
          />
        </div>

        <RecordTable
          rows={rows}
          columns={columns}
          rowKey={(e) => e.id}
          minWidth={880}
          footnote="Equipment and your drawings reduce cash but not profit — you still own the freezer, and a drawing is owed back to the business. Only stock and running costs reduce what the business made."
          empty={<EmptyFiltered onClear={clear} noun="payments" />}
        />
      </>
    );
  };

  return (
    <>
      <AdminShell
        active="money-out"
        title="Money out"
        subtitle="Purchases, running costs, equipment and drawings"
        actions={
          <>
            <Button variant="outline" size="sm" className="h-8">
              <Download className="size-3.5" /> Export
            </Button>
            <Button size="sm" className="h-8">
              <Plus className="size-3.5" /> Record money out
            </Button>
          </>
        }
        toolbar={
          state === "denied" || state === "first-use" ? undefined : (
            <TableToolbar
              query={query}
              onQuery={setQuery}
              placeholder="Search what for, or who recorded it"
              noun="payments"
              count={rows.length}
              total={expenses.length}
              disabled={state !== "ready"}
              filters={[
                {
                  key: "category",
                  value: category,
                  onChange: setCategory,
                  allLabel: "All categories",
                  options: (
                    Object.keys(categoryLabel) as Expense["category"][]
                  ).map((k) => ({ value: k, label: categoryLabel[k] })),
                  width: "10rem",
                },
              ]}
              toggles={[
                {
                  key: "pending",
                  label: "Waiting for you",
                  icon: Clock,
                  on: pendingOnly,
                  onChange: setPendingOnly,
                  count: pending.length,
                },
              ]}
            />
          )
        }
      >
        {body()}
      </AdminShell>

      <AccentSwitcher />
      <StateSwitcher current={state} />
    </>
  );
}

function StateSwitcher({ current }: { current: State }) {
  if (process.env.NODE_ENV === "production") return null;
  return (
    <div
      style={{
        position: "fixed",
        top: 48,
        right: 12,
        zIndex: 9999,
        display: "flex",
        gap: 2,
        padding: 4,
        borderRadius: 999,
        background: "#18181b",
        border: "2px dashed #52525b",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        fontSize: 11,
        color: "#fafafa",
      }}
    >
      <span style={{ padding: "0 4px 0 6px", opacity: 0.6 }}>state</span>
      {states.map((s) => (
        <a
          key={s}
          href={`?state=${s}`}
          style={{
            padding: "3px 7px",
            borderRadius: 999,
            textDecoration: "none",
            background: current === s ? "#fafafa" : "#3f3f46",
            color: current === s ? "#18181b" : "#fafafa",
          }}
        >
          {s === "first-use" ? "empty" : s}
        </a>
      ))}
    </div>
  );
}
