"use client";

/**
 * The Ledger's Non-sales tab (ticket 43) — adapted from the design-reference
 * worktree's locked `NonSalesLedgerTable` (`ledger/tables.tsx`): one row per
 * wastage/staff-meal/complimentary entry, reason filter, search by item or
 * recorded-by, a totals footer, and the "not deducted from profit twice"
 * caption. Same fetching/LoadState/presentational split as `store-ledger.tsx`.
 * Unlike Store, there is no day- or item-level rollup here — each entry is
 * already the unit of record, so one row per entry for the whole period is
 * the full shape.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ErrorState, PermissionDenied, EmptyFiltered, LoadingTable } from "@/components/patterns/states";
import { Search, X } from "lucide-react";
import { money } from "@/shared/money";

export type NonSalesReason = "wasted" | "consumed" | "given_away";

export const nonSalesReasonLabel: Record<NonSalesReason, string> = {
  wasted: "Wasted",
  consumed: "Staff meals",
  given_away: "Complimentary",
};

export type NonSalesLedgerRowData = {
  itemType: "product" | "ingredient";
  itemId: string;
  itemName: string;
  locationId: string;
  locationCode: string;
  occurredAt: string;
  reason: NonSalesReason;
  quantity: number;
  costBasisMinor: number | null;
  isEstimated: boolean | null;
  sellingValueMinor: number | null;
  recordedBy: string;
};

export type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "denied" }
  | { status: "ready"; rows: NonSalesLedgerRowData[] };

async function fetchNonSalesLedger(periodStart: string, periodEnd: string): Promise<LoadState> {
  try {
    const response = await fetch(
      `/api/ledger/non-sales?${new URLSearchParams({ periodStart, periodEnd }).toString()}`,
    );
    if (response.status === 403) return { status: "denied" };
    if (!response.ok) return { status: "error" };
    const body = await response.json();
    if (!Array.isArray(body?.rows)) return { status: "error" };
    return { status: "ready", rows: body.rows };
  } catch {
    return { status: "error" };
  }
}

export function NonSalesLedger({ periodStart, periodEnd }: { periodStart: string; periodEnd: string }) {
  const [attempt, setAttempt] = useState(0);
  return (
    <NonSalesLedgerForAttempt
      key={`${periodStart}:${periodEnd}:${attempt}`}
      periodStart={periodStart}
      periodEnd={periodEnd}
      onRetry={() => setAttempt((a) => a + 1)}
    />
  );
}

function NonSalesLedgerForAttempt({
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
    fetchNonSalesLedger(start, end).then((result) => {
      if (!cancelledRef.current) setState(result);
    });
    return () => {
      cancelledRef.current = true;
    };
  }, [periodStart, periodEnd]);

  return <NonSalesLedgerView state={state} onRetry={onRetry} />;
}

const FROZEN = "sticky left-0 z-20 bg-card group-hover:bg-muted/40 border-r";
const FROZEN_HEAD = "sticky left-0 z-30 bg-muted border-r";

function Num({ value, asMoney, muted }: { value: number; asMoney?: boolean; muted?: boolean }) {
  if (value === 0 && muted) return <span className="text-muted-foreground">—</span>;
  return <span className="tabular">{asMoney ? money(value) : value}</span>;
}

function Th({ children, align = "right" }: { children?: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th className={`px-2 py-2 font-medium whitespace-nowrap ${align === "right" ? "text-right" : "text-left"}`}>
      {children}
    </th>
  );
}

function Td({
  children,
  border,
  align = "right",
}: {
  children?: React.ReactNode;
  border?: boolean;
  align?: "left" | "right";
}) {
  return (
    <td
      className={`px-2 py-2 whitespace-nowrap ${align === "right" ? "text-right" : "text-left"} ${border ? "border-l" : ""}`}
    >
      {children}
    </td>
  );
}

export function NonSalesLedgerView({
  state,
  onRetry,
  initialQuery = "",
}: {
  state: LoadState;
  onRetry: () => void;
  /** Storybook only, for the "filtered to zero rows" state — the real page
   * always starts with an empty search. */
  initialQuery?: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [reason, setReason] = useState<NonSalesReason | "all">("all");

  const allRows = useMemo(() => (state.status === "ready" ? state.rows : []), [state]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allRows.filter(
      (r) =>
        (reason === "all" || r.reason === reason) &&
        (!q || r.itemName.toLowerCase().includes(q) || r.recordedBy.toLowerCase().includes(q)),
    );
  }, [allRows, query, reason]);

  const filtered = query !== "" || reason !== "all";
  const clear = () => {
    setQuery("");
    setReason("all");
  };

  const totals = rows.reduce(
    (a, r) => ({
      cost: a.cost + (r.costBasisMinor ?? 0),
      price: a.price + (r.sellingValueMinor ?? 0),
    }),
    { cost: 0, price: 0 },
  );

  if (state.status === "loading") {
    return (
      <div data-testid="non-sales-ledger-loading">
        <LoadingTable summary={0} rows={8} columns={8} />
      </div>
    );
  }

  if (state.status === "denied") {
    return (
      <div className="rounded-lg border bg-card p-4">
        <PermissionDenied
          title="The non-sales ledger is owner-only"
          body="Wastage and cost figures are financial. Ask the owner if you need to see them."
        />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="rounded-lg border bg-card p-4">
        <ErrorState what="the non-sales ledger" onRetry={onRetry} />
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card" data-testid="non-sales-ledger">
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
        <div className="relative min-w-48 flex-1">
          <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search items or people"
            className="h-8 pl-8 text-[13px]"
            data-testid="non-sales-ledger-search"
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
        <Select value={reason} onValueChange={(v) => setReason(v as NonSalesReason | "all")}>
          <SelectTrigger className="h-8 w-40 text-[13px]" data-testid="non-sales-ledger-reason-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All reasons</SelectItem>
            <SelectItem value="wasted">Wasted</SelectItem>
            <SelectItem value="consumed">Staff meals</SelectItem>
            <SelectItem value="given_away">Complimentary</SelectItem>
          </SelectContent>
        </Select>
        <span className="tabular ml-auto shrink-0 text-xs text-muted-foreground">
          {rows.length === allRows.length ? `${allRows.length} rows` : `${rows.length} of ${allRows.length}`}
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="px-4 py-10">
          {filtered ? (
            <EmptyFiltered onClear={clear} noun="entries" />
          ) : (
            <p className="text-center text-sm text-muted-foreground">No movements in this period.</p>
          )}
        </div>
      ) : (
        // No overflow-x-auto wrapper — see record-table.tsx's comment on
        // why that would break the thead's sticky positioning.
        <>
          <table className="w-full min-w-[720px] text-[13px]">
            <thead className="sticky top-0 z-10">
              <tr className="border-b bg-muted text-[11px] text-muted-foreground">
                <th className={`${FROZEN_HEAD} px-3 py-2 text-left font-medium`}>Item</th>
                <Th align="left">Date</Th>
                <Th align="left">Location</Th>
                <Th align="left">Reason</Th>
                <Th>Qty</Th>
                <Th>At cost</Th>
                <Th>At selling price</Th>
                <Th align="left">By</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const qty = Math.abs(r.quantity);
                return (
                  <tr
                    key={`${r.itemId}-${r.occurredAt}-${r.reason}-${i}`}
                    className="group border-b hover:bg-muted/40"
                    data-testid={`non-sales-ledger-row-${r.itemId}-${i}`}
                  >
                    <td className={`${FROZEN} px-3 py-2 font-medium`}>{r.itemName}</td>
                    <Td align="left">
                      <span className="text-muted-foreground">
                        {new Date(r.occurredAt).toLocaleDateString()}
                      </span>
                    </Td>
                    <Td align="left">
                      <span className="capitalize text-muted-foreground">{r.locationCode}</span>
                    </Td>
                    <Td align="left">
                      <Badge variant="outline" className="text-[10px] font-normal">
                        {nonSalesReasonLabel[r.reason]}
                      </Badge>
                    </Td>
                    <Td>
                      <Num value={qty} />
                    </Td>
                    <Td>
                      <span className="tabular">
                        {money(r.costBasisMinor ?? 0)}
                        {r.isEstimated && (
                          <span
                            className="ml-1 text-[10px] text-muted-foreground"
                            title="No recipe — estimated at 60% of selling price, for this report only"
                          >
                            est
                          </span>
                        )}
                      </span>
                    </Td>
                    <Td>
                      <Num value={r.sellingValueMinor ?? 0} asMoney muted />
                    </Td>
                    <Td align="left">
                      <span className="text-muted-foreground">{r.recordedBy}</span>
                    </Td>
                  </tr>
                );
              })}
              <tr className="bg-muted/40 font-medium">
                <td className={`${FROZEN} bg-muted/40 px-3 py-2`}>Total</td>
                <Td />
                <Td />
                <Td />
                <Td />
                <Td>
                  <Num value={totals.cost} asMoney />
                </Td>
                <Td>
                  <Num value={totals.price} asMoney />
                </Td>
                <Td />
              </tr>
            </tbody>
          </table>
        </>
      )}
      <p className="border-t px-3 py-2 text-[11px] text-muted-foreground">
        These amounts are not deducted from profit a second time — stock no longer present is already
        counted as used up in cost of goods sold. This shows where stock is going.
      </p>
    </div>
  );
}
