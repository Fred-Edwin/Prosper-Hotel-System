"use client";

/**
 * The Ledger's Store tab (ticket 42) — adapted from the design-reference
 * worktree's locked `StoreLedgerTable` (`ledger/tables.tsx`): one row per
 * ingredient per location, opening/purchased/out/closing columns, the
 * running-average cost-move indicator, search. Same fetching/LoadState/
 * presentational split as `product-ledger.tsx`, minus day-expansion — the
 * reference's Store ledger has no chevron, one row per ingredient for the
 * whole period is the full shape here.
 *
 * The reference shows no location split ("no location split shown in the
 * reference" per the ticket) but this codebase's ingredients can exist at
 * either location (transfers move them across), so a location filter is
 * added here, matching the Product ledger's pattern rather than the
 * reference verbatim.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
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

export type StoreLedgerRowData = {
  ingredientId: string;
  ingredientName: string;
  unitOfMeasure: string;
  locationId: string;
  locationCode: string;
  openingQty: number;
  purchasedQty: number;
  purchasedValueMinor: number;
  issuedToKitchen: number;
  transferredOut: number;
  spoilage: number;
  closingQty: number;
  closingValueMinor: number;
  unitCostMinor: number;
  previousUnitCostMinor: number;
};

export type StoreLedgerFilterOption = { id: string; name: string };

export type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "denied" }
  | { status: "ready"; rows: StoreLedgerRowData[]; locations: StoreLedgerFilterOption[] };

async function fetchLocations(): Promise<StoreLedgerFilterOption[] | null> {
  try {
    const response = await fetch("/api/catalogue");
    if (!response.ok) return null;
    const body = await response.json();
    if (!Array.isArray(body?.locations)) return null;
    return body.locations.map((l: { id: string; name: string }) => ({ id: l.id, name: l.name }));
  } catch {
    return null;
  }
}

async function fetchStoreLedger(periodStart: string, periodEnd: string): Promise<LoadState> {
  try {
    const [rowsResponse, locations] = await Promise.all([
      fetch(`/api/ledger/store?${new URLSearchParams({ periodStart, periodEnd }).toString()}`),
      fetchLocations(),
    ]);
    if (rowsResponse.status === 403) return { status: "denied" };
    if (!rowsResponse.ok || !locations) return { status: "error" };
    const body = await rowsResponse.json();
    if (!Array.isArray(body?.rows)) return { status: "error" };
    return { status: "ready", rows: body.rows, locations };
  } catch {
    return { status: "error" };
  }
}

export function StoreLedger({ periodStart, periodEnd }: { periodStart: string; periodEnd: string }) {
  const [attempt, setAttempt] = useState(0);
  return (
    <StoreLedgerForAttempt
      key={`${periodStart}:${periodEnd}:${attempt}`}
      periodStart={periodStart}
      periodEnd={periodEnd}
      onRetry={() => setAttempt((a) => a + 1)}
    />
  );
}

function StoreLedgerForAttempt({
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
    fetchStoreLedger(start, end).then((result) => {
      if (!cancelledRef.current) setState(result);
    });
    return () => {
      cancelledRef.current = true;
    };
  }, [periodStart, periodEnd]);

  return <StoreLedgerView state={state} onRetry={onRetry} />;
}

const FROZEN = "sticky left-0 z-20 bg-card group-hover:bg-muted/40 border-r";
const FROZEN_HEAD = "sticky left-0 z-30 bg-muted/60 border-r";

function Num({
  value,
  asMoney,
  muted,
  tone,
  strong,
}: {
  value: number;
  asMoney?: boolean;
  muted?: boolean;
  tone?: "danger";
  strong?: boolean;
}) {
  if (value === 0 && muted) return <span className="text-muted-foreground">—</span>;
  const cls = tone === "danger" ? "text-danger" : "";
  return (
    <span className={`tabular ${cls} ${strong ? "font-medium" : ""}`}>{asMoney ? money(value) : value}</span>
  );
}

function Th({ children, border }: { children?: React.ReactNode; border?: boolean }) {
  return (
    <th className={`px-2 py-2 text-right font-medium whitespace-nowrap ${border ? "border-l" : ""}`}>
      {children}
    </th>
  );
}

function Td({ children, border }: { children?: React.ReactNode; border?: boolean }) {
  return (
    <td className={`px-2 py-2 text-right whitespace-nowrap ${border ? "border-l" : ""}`}>{children}</td>
  );
}

export function StoreLedgerView({
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
  const [locationId, setLocationId] = useState<string>("all");

  const allRows = useMemo(() => (state.status === "ready" ? state.rows : []), [state]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allRows.filter(
      (r) =>
        (locationId === "all" || r.locationId === locationId) &&
        (!q || r.ingredientName.toLowerCase().includes(q)),
    );
  }, [allRows, query, locationId]);

  const filtered = query !== "" || locationId !== "all";
  const clear = () => {
    setQuery("");
    setLocationId("all");
  };

  if (state.status === "loading") {
    return (
      <div data-testid="store-ledger-loading">
        <LoadingTable summary={0} rows={8} columns={7} />
      </div>
    );
  }

  if (state.status === "denied") {
    return (
      <div className="rounded-lg border bg-card p-4">
        <PermissionDenied
          title="The store ledger is owner-only"
          body="Ingredient cost and value are financial figures. Ask the owner if you need to see them."
        />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="rounded-lg border bg-card p-4">
        <ErrorState what="the store ledger" onRetry={onRetry} />
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-card" data-testid="store-ledger">
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
        <div className="relative min-w-48 flex-1">
          <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search ingredients and supplies"
            className="h-8 pl-8 text-[13px]"
            data-testid="store-ledger-search"
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
          <SelectTrigger className="h-8 w-36 text-[13px]" data-testid="store-ledger-location-filter">
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
        <span className="tabular ml-auto shrink-0 text-xs text-muted-foreground">
          {rows.length === allRows.length ? `${allRows.length} rows` : `${rows.length} of ${allRows.length}`}
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="px-4 py-10">
          {filtered ? (
            <EmptyFiltered onClear={clear} noun="ingredients" />
          ) : (
            <p className="text-center text-sm text-muted-foreground">No movements in this period.</p>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-[13px]">
            <thead>
              <tr className="border-b bg-muted/60 text-[11px] text-muted-foreground">
                <th className={`${FROZEN_HEAD} px-3 py-1.5 text-left font-medium`}>Item</th>
                <th className="border-l px-2 py-1.5 text-center font-medium" colSpan={2}>Opening</th>
                <th className="border-l px-2 py-1.5 text-center font-medium" colSpan={3}>Purchased</th>
                <th className="border-l px-2 py-1.5 text-center font-medium" colSpan={3}>Out</th>
                <th className="border-l px-2 py-1.5 text-center font-medium" colSpan={2}>Closing</th>
              </tr>
              <tr className="border-b text-[11px] text-muted-foreground">
                <th className={`${FROZEN_HEAD} px-3 py-2 text-left font-medium`}>Ingredient</th>
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
                const rowKey = `${r.ingredientId}:${r.locationId}`;
                const costMoved = r.unitCostMinor - r.previousUnitCostMinor;
                return (
                  <tr key={rowKey} className="group border-b hover:bg-muted/40" data-testid={`store-ledger-row-${rowKey}`}>
                    <td className={`${FROZEN} px-3 py-2`}>
                      <span className="font-medium">{r.ingredientName}</span>
                      <span className="block text-[11px] text-muted-foreground">
                        per {r.unitOfMeasure}
                      </span>
                    </td>
                    <Td border><Num value={r.openingQty} /></Td>
                    <Td>
                      <Num value={r.openingQty * r.previousUnitCostMinor} asMoney muted />
                    </Td>
                    <Td border><Num value={r.purchasedQty} muted /></Td>
                    <Td><Num value={r.purchasedValueMinor} asMoney muted /></Td>
                    <Td>
                      <span className="tabular">
                        {money(r.unitCostMinor)}
                        {costMoved !== 0 && (
                          <span
                            className={`ml-1 text-[11px] ${costMoved > 0 ? "text-danger" : "text-success"}`}
                            title={`Weighted average moved from ${money(r.previousUnitCostMinor)}`}
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
                    <Td><Num value={r.closingValueMinor} asMoney strong /></Td>
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
