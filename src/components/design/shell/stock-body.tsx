"use client";

/**
 * Stock — a record table page, built from the templates.
 *
 * It carried the frame round because it is the honest stress case for a header:
 * a title, a period caveat, a search box, three filters, a row count and two
 * actions. The dashboard has two controls and would have let any header look
 * fine.
 *
 * Now that the patterns exist it composes them rather than carrying its own —
 * `SummaryStrip` for the figures, and the five states from
 * `components/patterns/states.tsx`. That is the test: nothing here decides
 * layout, only what goes in it.
 *
 * Two decisions worth naming:
 *
 *   **The summary states, and links where a link exists.** Stock on hand links
 *   to the product ledger, because a record there explains it. Low stock does
 *   not: it is this same table with a filter applied, so a link would point
 *   back here.
 *
 *   **Low stock is a filter chip, not a separate view.** "A filter is not a
 *   destination" was settled at setup; the chip makes it discoverable without
 *   becoming a nav link.
 */

import { useMemo, useState } from "react";
import {
  productLedger,
  categories,
  money,
  type ProductLedgerRow,
} from "@/lib/fixtures";
import { Button } from "@/components/ui/button";
import { TableToolbar } from "@/components/patterns/table-toolbar";
import { SummaryStrip } from "@/components/patterns/summary-strip";
import {
  RecordTable,
  Num,
  Truncate,
  type Column,
} from "@/components/patterns/record-table";
import {
  LoadingTable,
  ErrorState,
  PermissionDenied,
  EmptyFirstUse,
  EmptyFiltered,
} from "@/components/patterns/states";
import { TriangleAlert, PackageOpen, Plus } from "lucide-react";

export type PageState = "ready" | "loading" | "error" | "denied" | "first-use";

const LOW = 12;

/* ---------------------------------------------------------------- toolbar -- */

/** Stock's filters, in the shared toolbar. Nothing bespoke left here. */
export function StockToolbar({
  query,
  onQuery,
  location,
  onLocation,
  category,
  onCategory,
  low,
  onLow,
  lowCount,
  count,
  total,
  disabled,
}: {
  query: string;
  onQuery: (v: string) => void;
  location: string;
  onLocation: (v: string) => void;
  category: string;
  onCategory: (v: string) => void;
  low: boolean;
  onLow: (v: boolean) => void;
  lowCount: number;
  count: number;
  total: number;
  disabled?: boolean;
}) {
  return (
    <TableToolbar
      query={query}
      onQuery={onQuery}
      placeholder="Search stock"
      noun="items"
      count={count}
      total={total}
      disabled={disabled}
      filters={[
        {
          key: "location",
          value: location,
          onChange: onLocation,
          allLabel: "Both locations",
          options: [
            { value: "restaurant", label: "Restaurant" },
            { value: "canteen", label: "Canteen" },
          ],
        },
        {
          key: "category",
          value: category,
          onChange: onCategory,
          allLabel: "All categories",
          options: categories.map((c) => ({ value: c.key, label: c.label })),
          width: "8rem",
        },
      ]}
      toggles={[
        {
          key: "low",
          label: "Low stock",
          icon: TriangleAlert,
          on: low,
          onChange: onLow,
          count: lowCount,
        },
      ]}
    />
  );
}

/* -------------------------------------------------------------------- page -- */

export function StockBody({
  state = "ready",
  query,
  location,
  category,
  low,
  onClear,
}: {
  state?: PageState;
  query: string;
  location: string;
  category: string;
  low: boolean;
  onClear: () => void;
}) {
  const [sortKey, setSortKey] = useState("item");
  const [sortDesc, setSortDesc] = useState(false);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const out = productLedger.filter(
      (r) =>
        (location === "all" || r.location === location) &&
        (category === "all" || r.category === category) &&
        (!low || r.closingQty <= LOW) &&
        (!q || r.item.toLowerCase().includes(q)),
    );
    return sortDesc ? [...out].reverse() : out;
  }, [query, location, category, low, sortDesc]);

  const columns: Column<ProductLedgerRow>[] = [
    {
      key: "item",
      header: "Item",
      align: "left",
      sortable: true,
      cell: (r) => <Truncate>{r.item}</Truncate>,
    },
    {
      key: "location",
      header: "Location",
      align: "left",
      cell: (r) => (
        <span className="text-muted-foreground capitalize">{r.location}</span>
      ),
    },
    {
      key: "category",
      header: "Category",
      align: "left",
      cell: (r) => (
        <span className="text-muted-foreground">
          {categories.find((c) => c.key === r.category)?.label ?? r.category}
        </span>
      ),
    },
    {
      key: "onHand",
      header: "On hand",
      group: true,
      sortable: true,
      cell: (r) => {
        const isLow = r.closingQty <= LOW;
        return (
          <>
            <Num value={r.closingQty} strong tone={isLow ? "warning" : undefined} />
            {isLow && (
              <TriangleAlert
                className="ml-1 inline size-3 text-warning"
                aria-label="Low stock"
              />
            )}
          </>
        );
      },
    },
    {
      key: "unitCost",
      header: "Unit cost",
      cell: (r) => <Num value={r.unitCost} money />,
    },
    {
      key: "value",
      header: "Value",
      cell: (r) => (
        <Num value={r.unitCost === null ? null : r.unitCost * r.closingQty} money />
      ),
    },
    {
      key: "sold",
      header: "Sold this week",
      group: true,
      cell: (r) => (
        <span className="text-muted-foreground">
          <Num value={r.sold} />
        </span>
      ),
    },
    {
      key: "cover",
      header: "Cover",
      cell: (r) => {
        const perDay = r.sold / 5;
        if (perDay <= 0) return <span className="text-muted-foreground">—</span>;
        const cover = r.closingQty / perDay;
        return (
          <span className={`tabular ${cover < 2 ? "text-warning" : ""}`}>
            {cover.toFixed(1)}d
          </span>
        );
      },
    },
  ];

  if (state === "loading") return <LoadingTable summary={4} rows={10} columns={8} />;

  if (state === "error") return <ErrorState what="stock" />;

  if (state === "denied")
    return (
      <PermissionDenied
        title="Stock valuation is owner-only"
        body="You can see quantities on hand from the till. What stock is worth is restricted to Lucy — ask her if you need it."
      />
    );

  if (state === "first-use")
    return (
      <EmptyFirstUse
        icon={<PackageOpen className="size-4" />}
        title="No stock recorded yet"
        body="Once you receive your first delivery or take an opening count, everything you hold will be listed here with what it is worth."
        action={
          <Button size="sm" className="h-8">
            <Plus className="size-3.5" /> Take an opening count
          </Button>
        }
      />
    );

  const totals = rows.reduce(
    (a, r) => {
      const value = r.unitCost === null ? 0 : r.unitCost * r.closingQty;
      return {
        value: a.value + value,
        lines: a.lines + 1,
        low: a.low + (r.closingQty <= LOW ? 1 : 0),
        unpriced: a.unpriced + (r.unitCost === null ? 1 : 0),
      };
    },
    { value: 0, lines: 0, low: 0, unpriced: 0 },
  );

  return (
    <>
      {/* States, and links where a record explains the figure. Stock on hand
          has one — the product ledger. Low stock does not: it is this same
          table with a filter, so a link would point back here. */}
      <div className="mb-4">
        <SummaryStrip
          items={[
            {
              label: "Stock on hand",
              value: money(totals.value),
              sub: `${totals.lines} items counted`,
              link: { label: "See movements", href: "/design/ledger" },
            },
            {
              label: "Low stock",
              value: String(totals.low),
              sub: `at or below ${LOW} units`,
              tone: totals.low > 0 ? "warning" : undefined,
            },
            {
              label: "Without a cost",
              value: String(totals.unpriced),
              sub: "no recipe, so no value",
            },
            {
              label: "Last counted",
              value: "5 Aug",
              sub: "restaurant store · Janiffer",
            },
          ]}
        />
      </div>

      <RecordTable
        rows={rows}
        columns={columns}
        rowKey={(r) => r.id}
        minWidth={820}
        sortKey={sortKey}
        onSort={(k) => {
          setSortKey(k);
          setSortDesc((v) => !v);
        }}
        empty={<EmptyFiltered onClear={onClear} noun="stock items" />}
      />
    </>
  );
}

export { LOW };
