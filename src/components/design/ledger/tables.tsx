"use client";

/**
 * The ledger's four sub-ledgers.
 *
 * "Ledger" is the record; "table" is the component showing it. Each of these is
 * a sub-ledger in the accounting sense — the complete record of movements for
 * one class of thing over a period — and the stats bar is the summary they roll
 * up into.
 *
 * All four share one shape: **one row per subject, movement types as columns**,
 * opening on the left and closing on the right, so reading a row left to right
 * is doing the calculation. Product and store rows are one per item; cash rows
 * are one per day. That consistency is deliberate — an earlier cash version
 * listed one row per transaction and read as a different sort of record
 * entirely.
 *
 * A period is one row per subject, not thirty. These columns aggregate, so a
 * month reduces honestly; the chevron expands a row to its constituent days or
 * transactions for when the question moves from "what happened" to "when".
 *
 * Child rows carry a deliberate visual treatment: a spine down the left anchored
 * under the parent's chevron, recessive type, and a closing edge beneath the
 * last child. Without it an expanded block in the middle of a long table bleeds
 * into the next parent and the hierarchy is lost.
 *
 * Every sub-ledger is searchable and filterable, and the first column is frozen
 * so horizontal scrolling never costs the subject's identity.
 */

import { Fragment, useMemo, useState } from "react";
import {
  productLedger,
  storeLedger,
  nonSalesLedger,
  cashLedger,
  nonSalesCost,
  nonSalesReasonLabel,
  cashCategoryLabel,
  categories,
  money,
  type Location,
  type ProductLedgerRow,
  type NonSalesReason,
  type CashCategory,
} from "@/lib/fixtures";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronRight, Search, X, ArrowDownUp } from "lucide-react";

/* ------------------------------------------------------------- primitives -- */

/** Frozen first column: identity survives horizontal scrolling. */
const FROZEN = "sticky left-0 z-20 bg-card group-hover:bg-muted/40 border-r";
const FROZEN_HEAD = "sticky left-0 z-30 bg-muted/60 border-r";

/**
 * Child-row treatment. Subtle enough not to shout, distinct enough that an
 * expanded block never reads as a run of parents.
 */
const CHILD_ROW = "bg-muted/25 text-[12px]";
const CHILD_FROZEN = "sticky left-0 z-20 bg-muted/25 border-r";
const CHILD_LAST = "border-b-2 border-b-neutral-300";

/** The spine: anchored under the parent's chevron, tying children to it. */
function Spine({ label, muted }: { label: string; muted?: boolean }) {
  return (
    <span className="flex items-stretch gap-2 pl-[7px]">
      <span className="w-px shrink-0 bg-neutral-300" aria-hidden />
      <span className={`py-0.5 pl-2 ${muted ? "text-muted-foreground" : ""}`}>
        {label}
      </span>
    </span>
  );
}

function Toolbar({
  query,
  onQuery,
  placeholder,
  count,
  total,
  children,
}: {
  query: string;
  onQuery: (v: string) => void;
  placeholder: string;
  count: number;
  total: number;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
      <div className="relative min-w-48 flex-1">
        <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder={placeholder}
          className="h-8 pl-8 text-[13px]"
        />
        {query && (
          <button
            onClick={() => onQuery("")}
            className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground"
            aria-label="Clear search"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>
      {children}
      <span className="tabular ml-auto shrink-0 text-xs text-muted-foreground">
        {count === total ? `${total} rows` : `${count} of ${total}`}
      </span>
    </div>
  );
}

function Empty({ onClear, filtered }: { onClear: () => void; filtered: boolean }) {
  return (
    <div className="px-4 py-10 text-center">
      <p className="text-sm text-muted-foreground">
        {filtered
          ? "Nothing matches these filters."
          : "No movements in this period."}
      </p>
      {filtered && (
        <Button variant="outline" size="sm" className="mt-3" onClick={onClear}>
          Clear filters
        </Button>
      )}
    </div>
  );
}

function Num({
  value,
  money: asMoney,
  muted,
  tone,
  strong,
}: {
  value: number | null;
  money?: boolean;
  muted?: boolean;
  tone?: "danger" | "success";
  strong?: boolean;
}) {
  if (value === null) return <span className="text-muted-foreground">—</span>;
  if (value === 0 && muted) return <span className="text-muted-foreground">—</span>;
  const cls =
    tone === "danger" ? "text-danger" : tone === "success" ? "text-success" : "";
  return (
    <span className={`tabular ${cls} ${strong ? "font-medium" : ""}`}>
      {asMoney ? money(value) : value}
    </span>
  );
}

function Th({
  children,
  border,
  align = "right",
}: {
  children?: React.ReactNode;
  border?: boolean;
  align?: "left" | "right";
}) {
  return (
    <th
      className={`px-2 py-2 font-medium whitespace-nowrap ${
        align === "right" ? "text-right" : "text-left"
      } ${border ? "border-l" : ""}`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  border,
  align = "right",
  muted,
}: {
  children?: React.ReactNode;
  border?: boolean;
  align?: "left" | "right";
  muted?: boolean;
}) {
  return (
    <td
      className={`px-2 py-2 whitespace-nowrap ${
        align === "right" ? "text-right" : "text-left"
      } ${border ? "border-l" : ""} ${muted ? "text-muted-foreground" : ""}`}
    >
      {children}
    </td>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <ChevronRight
      className={`size-3.5 shrink-0 text-muted-foreground transition-transform duration-100 ${
        open ? "rotate-90" : ""
      }`}
    />
  );
}

/* ---------------------------------------------------------- product ledger -- */

export function ProductLedgerTable() {
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState<Location | "all">("all");
  const [category, setCategory] = useState<string>("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return productLedger.filter(
      (r) =>
        (location === "all" || r.location === location) &&
        (category === "all" || r.category === category) &&
        (!q || r.item.toLowerCase().includes(q)),
    );
  }, [query, location, category]);

  const filtered = query !== "" || location !== "all" || category !== "all";
  const clear = () => {
    setQuery("");
    setLocation("all");
    setCategory("all");
  };

  const costOfSales = (r: ProductLedgerRow) =>
    r.unitCost === null ? null : r.unitCost * r.sold;

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <Toolbar
        query={query}
        onQuery={setQuery}
        placeholder="Search products"
        count={rows.length}
        total={productLedger.length}
      >
        <Select value={location} onValueChange={(v) => setLocation(v as never)}>
          <SelectTrigger className="h-8 w-36 text-[13px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Both locations</SelectItem>
            <SelectItem value="restaurant">Restaurant</SelectItem>
            <SelectItem value="canteen">Canteen</SelectItem>
          </SelectContent>
        </Select>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="h-8 w-32 text-[13px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.key} value={c.key}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Toolbar>

      {rows.length === 0 ? (
        <Empty onClear={clear} filtered={filtered} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] text-[13px]">
            <thead>
              <tr className="border-b bg-muted/60 text-[11px] text-muted-foreground">
                <th className={`${FROZEN_HEAD} px-3 py-1.5 text-left font-medium`}>
                  Item
                </th>
                <th className="border-l px-2 py-1.5 text-center font-medium" colSpan={2}>
                  Opening
                </th>
                <th className="border-l px-2 py-1.5 text-center font-medium" colSpan={3}>
                  In
                </th>
                <th className="border-l px-2 py-1.5 text-center font-medium" colSpan={3}>
                  Out
                </th>
                <th className="border-l px-2 py-1.5 text-center font-medium" colSpan={5}>
                  Money
                </th>
                <th className="border-l px-2 py-1.5 text-center font-medium" colSpan={2}>
                  Closing
                </th>
              </tr>
              <tr className="border-b text-[11px] text-muted-foreground">
                <th className={`${FROZEN_HEAD} px-3 py-2 text-left font-medium`}>
                  <button className="flex items-center gap-1 hover:text-foreground">
                    Product <ArrowDownUp className="size-3" />
                  </button>
                </th>
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
                const p = cos === null ? null : r.salesValue - cos;
                const margin =
                  p === null || r.salesValue === 0 ? null : (p / r.salesValue) * 100;
                const open = expanded === r.id;
                return (
                  <Fragment key={r.id}>
                    <tr className="group border-b hover:bg-muted/40">
                      <td className={`${FROZEN} px-3 py-2`}>
                        <button
                          onClick={() => setExpanded(open ? null : r.id)}
                          className="flex items-center gap-1.5 text-left"
                          aria-expanded={open}
                        >
                          <Chevron open={open} />
                          <span>
                            <span className="font-medium">{r.item}</span>
                            <span className="block text-[11px] capitalize text-muted-foreground">
                              {r.location}
                            </span>
                          </span>
                        </button>
                      </td>
                      <Td border><Num value={r.openingQty} /></Td>
                      <Td><Num value={r.openingValue} money muted /></Td>
                      <Td border><Num value={r.produced} muted /></Td>
                      <Td><Num value={r.received} muted /></Td>
                      <Td><Num value={r.transferredIn} muted /></Td>
                      <Td border><Num value={r.sold} strong /></Td>
                      <Td><Num value={r.transferredOut} muted /></Td>
                      <Td><Num value={r.nonSales} muted tone="danger" /></Td>
                      <Td border><Num value={r.salesValue} money strong /></Td>
                      <Td><Num value={r.unitCost} money /></Td>
                      <Td><Num value={r.sellingPrice} money /></Td>
                      <Td><Num value={cos} money /></Td>
                      <Td>
                        {p === null ? (
                          <span
                            className="text-muted-foreground"
                            title="No recipe — per-unit cost unknown, so profit cannot be stated"
                          >
                            —
                          </span>
                        ) : (
                          <span className="tabular font-medium">
                            {money(p)}
                            <span className="ml-1 text-[11px] text-muted-foreground">
                              {margin!.toFixed(0)}%
                            </span>
                          </span>
                        )}
                      </Td>
                      <Td border><Num value={r.closingQty} strong /></Td>
                      <Td>
                        <Num
                          value={r.unitCost === null ? null : r.unitCost * r.closingQty}
                          money
                        />
                      </Td>
                    </tr>

                    {open &&
                      r.days.map((d, i) => {
                        const last = i === r.days.length - 1;
                        return (
                          <tr
                            key={`${r.id}-${d.date}`}
                            className={`${CHILD_ROW} ${last ? CHILD_LAST : "border-b"}`}
                          >
                            <td className={`${CHILD_FROZEN} py-1.5 pr-3 pl-3`}>
                              <Spine label={d.date} muted />
                            </td>
                            <Td border><Num value={d.opening} muted /></Td>
                            <Td />
                            <Td border><Num value={d.produced} muted /></Td>
                            <Td><Num value={d.received} muted /></Td>
                            <Td><Num value={d.transferredIn} muted /></Td>
                            <Td border><Num value={d.sold} /></Td>
                            <Td><Num value={d.transferredOut} muted /></Td>
                            <Td><Num value={d.nonSales} muted tone="danger" /></Td>
                            <Td border>
                              <Num value={d.sold * r.sellingPrice} money muted />
                            </Td>
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

/* ------------------------------------------------------------ store ledger -- */

export function StoreLedgerTable() {
  const [query, setQuery] = useState("");
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return storeLedger.filter((r) => !q || r.item.toLowerCase().includes(q));
  }, [query]);

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <Toolbar
        query={query}
        onQuery={setQuery}
        placeholder="Search ingredients and supplies"
        count={rows.length}
        total={storeLedger.length}
      />
      {rows.length === 0 ? (
        <Empty onClear={() => setQuery("")} filtered />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-[13px]">
            <thead>
              <tr className="border-b bg-muted/60 text-[11px] text-muted-foreground">
                <th className={`${FROZEN_HEAD} px-3 py-1.5 text-left font-medium`}>
                  Item
                </th>
                <th className="border-l px-2 py-1.5 text-center font-medium" colSpan={2}>
                  Opening
                </th>
                <th className="border-l px-2 py-1.5 text-center font-medium" colSpan={3}>
                  Purchased
                </th>
                <th className="border-l px-2 py-1.5 text-center font-medium" colSpan={3}>
                  Out
                </th>
                <th className="border-l px-2 py-1.5 text-center font-medium" colSpan={2}>
                  Closing
                </th>
              </tr>
              <tr className="border-b text-[11px] text-muted-foreground">
                <th className={`${FROZEN_HEAD} px-3 py-2 text-left font-medium`}>
                  Ingredient
                </th>
                <Th border>Qty</Th>
                <Th>Value</Th>
                <Th border>Qty</Th>
                <Th>Value</Th>
                <Th>Unit cost</Th>
                <Th border>To kitchen</Th>
                <Th>Transferred</Th>
                <Th>Spoilage</Th>
                <Th border>Qty</Th>
                <Th>Value</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const costMoved = r.unitCost - r.previousUnitCost;
                return (
                  <tr key={r.id} className="group border-b hover:bg-muted/40">
                    <td className={`${FROZEN} px-3 py-2`}>
                      <span className="font-medium">{r.item}</span>
                      <span className="block text-[11px] text-muted-foreground">
                        per {r.unit}
                      </span>
                    </td>
                    <Td border><Num value={r.openingQty} /></Td>
                    <Td>
                      <Num value={r.openingQty * r.previousUnitCost} money muted />
                    </Td>
                    <Td border><Num value={r.purchasedQty} muted /></Td>
                    <Td><Num value={r.purchasedValue} money muted /></Td>
                    <Td>
                      <span className="tabular">
                        {money(r.unitCost)}
                        {costMoved !== 0 && (
                          <span
                            className={`ml-1 text-[11px] ${costMoved > 0 ? "text-danger" : "text-success"}`}
                            title={`Weighted average moved from ${money(r.previousUnitCost)}`}
                          >
                            {costMoved > 0 ? "↑" : "↓"}
                            {money(Math.abs(costMoved))}
                          </span>
                        )}
                      </span>
                    </Td>
                    <Td border><Num value={r.issuedToKitchen} strong /></Td>
                    <Td><Num value={r.transferredOut} muted /></Td>
                    <Td><Num value={r.spoilage} muted tone="danger" /></Td>
                    <Td border><Num value={r.closingQty} strong /></Td>
                    <Td><Num value={r.closingQty * r.unitCost} money strong /></Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------- non-sales ledger -- */

export function NonSalesLedgerTable() {
  const [query, setQuery] = useState("");
  const [reason, setReason] = useState<NonSalesReason | "all">("all");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return nonSalesLedger.filter(
      (r) =>
        (reason === "all" || r.reason === reason) &&
        (!q ||
          r.item.toLowerCase().includes(q) ||
          r.recordedBy.toLowerCase().includes(q)),
    );
  }, [query, reason]);

  const totals = rows.reduce(
    (a, r) => {
      const c = nonSalesCost(r);
      return { cost: a.cost + c.value, price: a.price + r.sellingPrice * r.qty };
    },
    { cost: 0, price: 0 },
  );

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <Toolbar
        query={query}
        onQuery={setQuery}
        placeholder="Search items or people"
        count={rows.length}
        total={nonSalesLedger.length}
      >
        <Select value={reason} onValueChange={(v) => setReason(v as never)}>
          <SelectTrigger className="h-8 w-40 text-[13px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All reasons</SelectItem>
            <SelectItem value="wasted">Wasted</SelectItem>
            <SelectItem value="consumed">Staff meals</SelectItem>
            <SelectItem value="given-away">Complimentary</SelectItem>
          </SelectContent>
        </Select>
      </Toolbar>

      {rows.length === 0 ? (
        <Empty
          onClear={() => {
            setQuery("");
            setReason("all");
          }}
          filtered
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-[13px]">
            <thead>
              <tr className="border-b bg-muted/60 text-[11px] text-muted-foreground">
                <th className={`${FROZEN_HEAD} px-3 py-2 text-left font-medium`}>
                  Item
                </th>
                <Th align="left">Date</Th>
                <Th align="left">Location</Th>
                <Th align="left">Reason</Th>
                <Th>Qty</Th>
                <Th border>At cost</Th>
                <Th>At selling price</Th>
                <Th align="left">By</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const c = nonSalesCost(r);
                return (
                  <tr key={r.id} className="group border-b hover:bg-muted/40">
                    <td className={`${FROZEN} px-3 py-2 font-medium`}>{r.item}</td>
                    <Td align="left" muted>{r.date}</Td>
                    <Td align="left" muted>
                      <span className="capitalize">{r.location}</span>
                    </Td>
                    <Td align="left">
                      <Badge variant="outline" className="text-[10px] font-normal">
                        {nonSalesReasonLabel[r.reason]}
                      </Badge>
                    </Td>
                    <Td><Num value={r.qty} /></Td>
                    <Td border>
                      <span className="tabular">
                        {money(c.value)}
                        {c.estimated && (
                          <span
                            className="ml-1 text-[10px] text-muted-foreground"
                            title="No recipe — estimated at 60% of selling price, for this report only"
                          >
                            est
                          </span>
                        )}
                      </span>
                    </Td>
                    <Td><Num value={r.sellingPrice * r.qty} money muted /></Td>
                    <Td align="left" muted>{r.recordedBy}</Td>
                  </tr>
                );
              })}
              <tr className="bg-muted/40 font-medium">
                <td className={`${FROZEN} bg-muted/40 px-3 py-2`}>Total</td>
                <Td /><Td /><Td /><Td />
                <Td border><Num value={totals.cost} money strong /></Td>
                <Td><Num value={totals.price} money strong /></Td>
                <Td />
              </tr>
            </tbody>
          </table>
        </div>
      )}
      <p className="border-t px-3 py-2 text-[11px] text-muted-foreground">
        These amounts are not deducted from profit a second time — stock no
        longer present is already counted as used up in cost of goods sold. This
        shows where stock is going.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------- cash ledger -- */

/**
 * One row per day, categories as columns — the same shape as the product and
 * store ledgers, so all three read as one kind of record. Expanding a day gives
 * its individual transactions.
 */
export function CashLedgerTable() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CashCategory | "all">("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q && category === "all") return cashLedger;
    return cashLedger.filter((d) =>
      d.transactions.some(
        (t) =>
          (category === "all" || t.category === category) &&
          (!q ||
            t.description.toLowerCase().includes(q) ||
            t.recordedBy.toLowerCase().includes(q)),
      ),
    );
  }, [query, category]);

  const filtered = query !== "" || category !== "all";
  const clear = () => {
    setQuery("");
    setCategory("all");
  };

  const totals = rows.reduce(
    (a, d) => ({
      handovers: a.handovers + d.handovers,
      repayments: a.repayments + d.repayments,
      stock: a.stock + d.stock,
      running: a.running + d.running,
      assets: a.assets + d.assets,
      drawings: a.drawings + d.drawings,
    }),
    { handovers: 0, repayments: 0, stock: 0, running: 0, assets: 0, drawings: 0 },
  );

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <Toolbar
        query={query}
        onQuery={setQuery}
        placeholder="Search descriptions or people"
        count={rows.length}
        total={cashLedger.length}
      >
        <Select value={category} onValueChange={(v) => setCategory(v as never)}>
          <SelectTrigger className="h-8 w-40 text-[13px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {(Object.keys(cashCategoryLabel) as CashCategory[]).map((k) => (
              <SelectItem key={k} value={k}>
                {cashCategoryLabel[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Toolbar>

      {rows.length === 0 ? (
        <Empty onClear={clear} filtered={filtered} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-[13px]">
            <thead>
              <tr className="border-b bg-muted/60 text-[11px] text-muted-foreground">
                <th className={`${FROZEN_HEAD} px-3 py-1.5 text-left font-medium`}>
                  Day
                </th>
                <th className="border-l px-2 py-1.5 text-center font-medium">
                  Opening
                </th>
                <th className="border-l px-2 py-1.5 text-center font-medium" colSpan={2}>
                  In
                </th>
                <th className="border-l px-2 py-1.5 text-center font-medium" colSpan={4}>
                  Out
                </th>
                <th className="border-l px-2 py-1.5 text-center font-medium">
                  Closing
                </th>
              </tr>
              <tr className="border-b text-[11px] text-muted-foreground">
                <th className={`${FROZEN_HEAD} px-3 py-2 text-left font-medium`}>
                  Date
                </th>
                <Th border>Balance</Th>
                <Th border>Handovers</Th>
                <Th>Repayments</Th>
                <Th border>Stock</Th>
                <Th>Running</Th>
                <Th>Assets</Th>
                <Th>Drawings</Th>
                <Th border>Balance</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => {
                const open = expanded === d.date;
                const shown = d.transactions.filter(
                  (t) =>
                    (category === "all" || t.category === category) &&
                    (!query.trim() ||
                      t.description.toLowerCase().includes(query.trim().toLowerCase()) ||
                      t.recordedBy.toLowerCase().includes(query.trim().toLowerCase())),
                );
                return (
                  <Fragment key={d.date}>
                    <tr className="group border-b hover:bg-muted/40">
                      <td className={`${FROZEN} px-3 py-2`}>
                        <button
                          onClick={() => setExpanded(open ? null : d.date)}
                          className="flex items-center gap-1.5 text-left"
                          aria-expanded={open}
                        >
                          <Chevron open={open} />
                          <span>
                            <span className="font-medium">{d.date}</span>
                            <span className="block text-[11px] text-muted-foreground">
                              {d.transactions.length} entries
                            </span>
                          </span>
                        </button>
                      </td>
                      <Td border><Num value={d.opening} money /></Td>
                      <Td border><Num value={d.handovers} money muted tone="success" /></Td>
                      <Td><Num value={d.repayments} money muted tone="success" /></Td>
                      <Td border><Num value={d.stock} money muted tone="danger" /></Td>
                      <Td><Num value={d.running} money muted tone="danger" /></Td>
                      <Td><Num value={d.assets} money muted tone="danger" /></Td>
                      <Td><Num value={d.drawings} money muted tone="danger" /></Td>
                      <Td border><Num value={d.closing} money strong /></Td>
                    </tr>

                    {open &&
                      shown.map((t, i) => {
                        const last = i === shown.length - 1;
                        return (
                          <tr
                            key={t.id}
                            className={`${CHILD_ROW} ${last ? CHILD_LAST : "border-b"}`}
                          >
                            <td className={`${CHILD_FROZEN} py-1.5 pr-3 pl-3`}>
                              <Spine label={t.description} />
                            </td>
                            <Td border muted>
                              {t.method === "mpesa" ? "M-Pesa" : "Cash"}
                            </Td>
                            <Td border>
                              <Num
                                value={t.category === "handover" ? t.in : 0}
                                money
                                muted
                              />
                            </Td>
                            <Td>
                              <Num
                                value={t.category === "repayment" ? t.in : 0}
                                money
                                muted
                              />
                            </Td>
                            <Td border>
                              <Num
                                value={t.category === "stock" ? t.out : 0}
                                money
                                muted
                              />
                            </Td>
                            <Td>
                              <Num
                                value={t.category === "running" ? t.out : 0}
                                money
                                muted
                              />
                            </Td>
                            <Td>
                              <Num
                                value={t.category === "asset" ? t.out : 0}
                                money
                                muted
                              />
                            </Td>
                            <Td>
                              <Num
                                value={t.category === "drawing" ? t.out : 0}
                                money
                                muted
                              />
                            </Td>
                            <Td border muted>
                              {t.recordedBy}
                            </Td>
                          </tr>
                        );
                      })}
                  </Fragment>
                );
              })}

              <tr className="bg-muted/40 font-medium">
                <td className={`${FROZEN} bg-muted/40 px-3 py-2`}>Period</td>
                <Td border><Num value={rows[0]?.opening ?? 0} money /></Td>
                <Td border><Num value={totals.handovers} money tone="success" /></Td>
                <Td><Num value={totals.repayments} money tone="success" /></Td>
                <Td border><Num value={totals.stock} money tone="danger" /></Td>
                <Td><Num value={totals.running} money tone="danger" /></Td>
                <Td><Num value={totals.assets} money muted tone="danger" /></Td>
                <Td><Num value={totals.drawings} money tone="danger" /></Td>
                <Td border>
                  <Num value={rows[rows.length - 1]?.closing ?? 0} money strong />
                </Td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
      <p className="border-t px-3 py-2 text-[11px] text-muted-foreground">
        Cash and M-Pesa carry their own balances and are never pooled. Assets and
        drawings reduce this balance but not profit — the money has genuinely
        left.
      </p>
    </div>
  );
}
