"use client";

/**
 * The Ledger's Product tab (ticket 39) — adapted from the design-reference
 * worktree's locked `ProductLedgerTable` (`ledger/tables.tsx`): one row per
 * product per location, opening/in/out/money/closing columns, search plus
 * location and category filters, day-expansion with the spine/recessive-
 * child treatment `docs/design.md` describes. Same fetching/LoadState/
 * presentational split as `ledger-shell.tsx`.
 *
 * Category is ticket 41's owner-managed Category, not the reference's fixed
 * food/drinks/snacks list — split out of this ticket during `/build`
 * (2026-08-12) once that field turned out to have no equivalent in this
 * codebase's domain model.
 */

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ErrorState, PermissionDenied, EmptyFiltered, LoadingTable } from "@/components/patterns/states";
import { ChevronRight, Search, X } from "lucide-react";
import { money } from "@/shared/money";

export type ProductLedgerDayData = {
  date: string;
  opening: number;
  produced: number;
  received: number;
  transferredIn: number;
  sold: number;
  transferredOut: number;
  nonSales: number;
  salesValueMinor: number;
  closing: number;
};

export type ProductLedgerRowData = {
  productId: string;
  productName: string;
  locationId: string;
  locationCode: string;
  categoryId: string | null;
  openingQty: number;
  produced: number;
  received: number;
  transferredIn: number;
  sold: number;
  transferredOut: number;
  nonSales: number;
  salesValueMinor: number;
  unitCostMinor: number | null;
  isEstimated: boolean;
  sellingPriceMinor: number | null;
  costOfSalesMinor: number | null;
  profitMinor: number | null;
  closingQty: number;
  closingValueMinor: number | null;
  days: ProductLedgerDayData[];
};

export type ProductLedgerFilterOption = { id: string; name: string };

export type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "denied" }
  | { status: "ready"; rows: ProductLedgerRowData[]; categories: ProductLedgerFilterOption[]; locations: ProductLedgerFilterOption[] };

async function fetchCategoriesAndLocations(): Promise<{
  categories: ProductLedgerFilterOption[];
  locations: ProductLedgerFilterOption[];
} | null> {
  try {
    const response = await fetch("/api/catalogue");
    if (!response.ok) return null;
    const body = await response.json();
    if (!Array.isArray(body?.categories) || !Array.isArray(body?.locations)) return null;
    return {
      categories: body.categories.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })),
      locations: body.locations.map((l: { id: string; name: string }) => ({ id: l.id, name: l.name })),
    };
  } catch {
    return null;
  }
}

async function fetchProductLedger(periodStart: string, periodEnd: string): Promise<LoadState> {
  try {
    const [rowsResponse, filters] = await Promise.all([
      fetch(
        `/api/ledger/product?${new URLSearchParams({ periodStart, periodEnd }).toString()}`,
      ),
      fetchCategoriesAndLocations(),
    ]);
    if (rowsResponse.status === 403) return { status: "denied" };
    if (!rowsResponse.ok || !filters) return { status: "error" };
    const body = await rowsResponse.json();
    if (!Array.isArray(body?.rows)) return { status: "error" };
    return { status: "ready", rows: body.rows, categories: filters.categories, locations: filters.locations };
  } catch {
    return { status: "error" };
  }
}

export function ProductLedger({ periodStart, periodEnd }: { periodStart: string; periodEnd: string }) {
  const [attempt, setAttempt] = useState(0);
  return (
    <ProductLedgerForAttempt
      key={`${periodStart}:${periodEnd}:${attempt}`}
      periodStart={periodStart}
      periodEnd={periodEnd}
      onRetry={() => setAttempt((a) => a + 1)}
    />
  );
}

function ProductLedgerForAttempt({
  periodStart,
  periodEnd,
  onRetry,
}: {
  periodStart: string;
  periodEnd: string;
  onRetry: () => void;
}) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    const start = new Date(`${periodStart}T00:00:00`).toISOString();
    const end = new Date(`${periodEnd}T23:59:59.999`).toISOString();
    fetchProductLedger(start, end).then((result) => {
      if (!cancelledRef.current) setState(result);
    });
    return () => {
      cancelledRef.current = true;
    };
  }, [periodStart, periodEnd]);

  return <ProductLedgerView state={state} onRetry={onRetry} />;
}

const FROZEN = "sticky left-0 z-20 bg-card group-hover:bg-muted/40 border-r";
const FROZEN_HEAD = "sticky left-0 z-30 bg-muted/60 border-r";
const CHILD_ROW = "bg-muted/25 text-[12px]";
const CHILD_FROZEN = "sticky left-0 z-20 bg-muted/25 border-r";
const CHILD_LAST = "border-b-2 border-b-neutral-300";

function Spine({ label }: { label: string }) {
  return (
    <span className="flex items-stretch gap-2 pl-[7px]">
      <span className="w-px shrink-0 bg-neutral-300" aria-hidden />
      <span className="py-0.5 pl-2 text-muted-foreground">{label}</span>
    </span>
  );
}

function Num({
  value,
  asMoney,
  muted,
  tone,
  strong,
}: {
  value: number | null;
  asMoney?: boolean;
  muted?: boolean;
  tone?: "danger";
  strong?: boolean;
}) {
  if (value === null) return <span className="text-muted-foreground">—</span>;
  if (value === 0 && muted) return <span className="text-muted-foreground">—</span>;
  const cls = tone === "danger" ? "text-danger" : "";
  return (
    <span className={`tabular ${cls} ${strong ? "font-medium" : ""}`}>{asMoney ? money(value) : value}</span>
  );
}

function Th({ children, border, align = "right" }: { children?: React.ReactNode; border?: boolean; align?: "left" | "right" }) {
  return (
    <th className={`px-2 py-2 font-medium whitespace-nowrap ${align === "right" ? "text-right" : "text-left"} ${border ? "border-l" : ""}`}>
      {children}
    </th>
  );
}

function Td({ children, border, align = "right" }: { children?: React.ReactNode; border?: boolean; align?: "left" | "right" }) {
  return (
    <td className={`px-2 py-2 whitespace-nowrap ${align === "right" ? "text-right" : "text-left"} ${border ? "border-l" : ""}`}>
      {children}
    </td>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <ChevronRight
      className={`size-3.5 shrink-0 text-muted-foreground transition-transform duration-100 ${open ? "rotate-90" : ""}`}
    />
  );
}

export function ProductLedgerView({
  state,
  onRetry,
  initialExpandedRowKey = null,
  initialQuery = "",
}: {
  state: LoadState;
  onRetry: () => void;
  /** Storybook only, for the "row expanded" state — the real page always
   * starts collapsed. */
  initialExpandedRowKey?: string | null;
  /** Storybook only, for the "filtered to zero rows" state — the real page
   * always starts with an empty search. */
  initialQuery?: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [locationId, setLocationId] = useState<string>("all");
  const [categoryId, setCategoryId] = useState<string>("all");
  const [expanded, setExpanded] = useState<string | null>(initialExpandedRowKey);

  const allRows = useMemo(() => (state.status === "ready" ? state.rows : []), [state]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allRows.filter(
      (r) =>
        (locationId === "all" || r.locationId === locationId) &&
        (categoryId === "all" || r.categoryId === categoryId) &&
        (!q || r.productName.toLowerCase().includes(q)),
    );
  }, [allRows, query, locationId, categoryId]);

  const filtered = query !== "" || locationId !== "all" || categoryId !== "all";
  const clear = () => {
    setQuery("");
    setLocationId("all");
    setCategoryId("all");
  };

  if (state.status === "loading") {
    return (
      <div data-testid="product-ledger-loading">
        <LoadingTable summary={0} rows={8} columns={9} />
      </div>
    );
  }

  if (state.status === "denied") {
    return (
      <div className="rounded-lg border bg-card p-4">
        <PermissionDenied
          title="The product ledger is owner-only"
          body="Cost of sales and profit are financial figures. Ask the owner if you need to see them."
        />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="rounded-lg border bg-card p-4">
        <ErrorState what="the product ledger" onRetry={onRetry} />
      </div>
    );
  }

  const costOfSales = (r: ProductLedgerRowData) => r.costOfSalesMinor;

  return (
    <div className="overflow-hidden rounded-lg border bg-card" data-testid="product-ledger">
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
        <div className="relative min-w-48 flex-1">
          <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products"
            className="h-8 pl-8 text-[13px]"
            data-testid="product-ledger-search"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground"
              aria-label="Clear search"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
        <Select value={locationId} onValueChange={setLocationId}>
          <SelectTrigger className="h-8 w-36 text-[13px]" data-testid="product-ledger-location-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Both locations</SelectItem>
            {state.locations.map((l) => (
              <SelectItem key={l.id} value={l.id}>
                {l.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger className="h-8 w-32 text-[13px]" data-testid="product-ledger-category-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {state.categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="tabular ml-auto shrink-0 text-xs text-muted-foreground">
          {rows.length === allRows.length ? `${allRows.length} rows` : `${rows.length} of ${allRows.length}`}
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="px-4 py-10">
          {filtered ? (
            <EmptyFiltered onClear={clear} noun="products" />
          ) : (
            <p className="text-center text-sm text-muted-foreground">No movements in this period.</p>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] text-[13px]">
            <thead>
              <tr className="border-b bg-muted/60 text-[11px] text-muted-foreground">
                <th className={`${FROZEN_HEAD} px-3 py-1.5 text-left font-medium`}>Item</th>
                <th className="border-l px-2 py-1.5 text-center font-medium" colSpan={2}>Opening</th>
                <th className="border-l px-2 py-1.5 text-center font-medium" colSpan={3}>In</th>
                <th className="border-l px-2 py-1.5 text-center font-medium" colSpan={3}>Out</th>
                <th className="border-l px-2 py-1.5 text-center font-medium" colSpan={5}>Money</th>
                <th className="border-l px-2 py-1.5 text-center font-medium" colSpan={2}>Closing</th>
              </tr>
              <tr className="border-b text-[11px] text-muted-foreground">
                <th className={`${FROZEN_HEAD} px-3 py-2 text-left font-medium`}>Product</th>
                <Th border>Qty</Th>
                <Th>Value</Th>
                <Th border>Produced</Th>
                <Th>Received</Th>
                <Th>Transf. in</Th>
                <Th border>Sold</Th>
                <Th>Transf. out</Th>
                <Th>Non-sales</Th>
                <Th border>Sales value</Th>
                <Th>Unit cost</Th>
                <Th>Price</Th>
                <Th>Cost of sales</Th>
                <Th>Profit</Th>
                <Th border>Qty</Th>
                <Th>Value</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const cos = costOfSales(r);
                const p = r.profitMinor;
                const rowKey = `${r.productId}:${r.locationId}`;
                const open = expanded === rowKey;
                return (
                  <Fragment key={rowKey}>
                    <tr className="group border-b hover:bg-muted/40">
                      <td className={`${FROZEN} px-3 py-2`}>
                        <button
                          onClick={() => setExpanded(open ? null : rowKey)}
                          className="flex items-center gap-1.5 text-left"
                          aria-expanded={open}
                          data-testid={`product-ledger-row-${rowKey}`}
                        >
                          <Chevron open={open} />
                          <span>
                            <span className="font-medium">{r.productName}</span>
                            <span className="block text-[11px] capitalize text-muted-foreground">{r.locationCode}</span>
                          </span>
                        </button>
                      </td>
                      <Td border><Num value={r.openingQty} /></Td>
                      <Td>
                        <Num value={r.unitCostMinor === null ? null : r.unitCostMinor * r.openingQty} asMoney muted />
                      </Td>
                      <Td border><Num value={r.produced} muted /></Td>
                      <Td><Num value={r.received} muted /></Td>
                      <Td><Num value={r.transferredIn} muted /></Td>
                      <Td border><Num value={r.sold} strong /></Td>
                      <Td><Num value={r.transferredOut} muted /></Td>
                      <Td><Num value={r.nonSales} muted tone="danger" /></Td>
                      <Td border><Num value={r.salesValueMinor} asMoney strong /></Td>
                      <Td>
                        <span className="tabular">
                          {r.unitCostMinor === null ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            <>
                              {money(r.unitCostMinor)}
                              {r.isEstimated && (
                                <span className="ml-1 text-[10px] text-muted-foreground" title="Estimated at 60% of selling price">
                                  est
                                </span>
                              )}
                            </>
                          )}
                        </span>
                      </Td>
                      <Td><Num value={r.sellingPriceMinor} asMoney /></Td>
                      <Td><Num value={cos} asMoney /></Td>
                      <Td>
                        {p === null ? (
                          <span className="text-muted-foreground" title="No recipe — per-unit cost unknown, so profit cannot be stated">
                            —
                          </span>
                        ) : (
                          <span className="tabular font-medium">{money(p)}</span>
                        )}
                      </Td>
                      <Td border><Num value={r.closingQty} strong /></Td>
                      <Td><Num value={r.closingValueMinor} asMoney /></Td>
                    </tr>

                    {open &&
                      r.days.map((d, i) => {
                        const last = i === r.days.length - 1;
                        return (
                          <tr key={`${rowKey}-${d.date}`} className={`${CHILD_ROW} ${last ? CHILD_LAST : "border-b"}`}>
                            <td className={`${CHILD_FROZEN} py-1.5 pr-3 pl-3`}>
                              <Spine label={d.date} />
                            </td>
                            <Td border><Num value={d.opening} muted /></Td>
                            <Td />
                            <Td border><Num value={d.produced} muted /></Td>
                            <Td><Num value={d.received} muted /></Td>
                            <Td><Num value={d.transferredIn} muted /></Td>
                            <Td border><Num value={d.sold} /></Td>
                            <Td><Num value={d.transferredOut} muted /></Td>
                            <Td><Num value={d.nonSales} muted tone="danger" /></Td>
                            <Td border><Num value={d.salesValueMinor} asMoney muted /></Td>
                            <Td /><Td /><Td /><Td />
                            <Td border><Num value={d.closing} /></Td>
                            <Td />
                          </tr>
                        );
                      })}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
