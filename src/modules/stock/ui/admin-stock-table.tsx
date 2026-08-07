"use client";

/**
 * Admin-shell stock table — on-hand quantities only, no cost/value/filters.
 *
 * Design's stock-body.tsx (in the design-reference worktree) is the full
 * valuation view: cost, value, low-stock, category/location filters. It
 * can't be built yet — the stock module exposes quantities only, not
 * per-unit cost. This is deliberately the minimal slice that fits what
 * getCurrentStockAtLocation actually returns, reusing RecordTable rather
 * than inventing a new table shape.
 */

import { useEffect, useState } from "react";
import {
  RecordTable,
  Num,
  Truncate,
  type Column,
} from "@/components/patterns/record-table";
import {
  LoadingTable,
  EmptyFirstUse,
  ErrorState,
  PermissionDenied,
} from "@/components/patterns/states";
import { PackageOpen } from "lucide-react";
import type { StockLevel } from "../schema";

export type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "denied" }
  | { status: "ready"; levels: StockLevel[] };

async function fetchStock(locationId: string): Promise<LoadState> {
  try {
    const response = await fetch(`/api/stock/${locationId}`);
    if (response.status === 403) return { status: "denied" };
    if (!response.ok) return { status: "error" };
    const body = await response.json();
    if (!Array.isArray(body?.levels)) return { status: "error" };
    return { status: "ready", levels: body.levels };
  } catch {
    return { status: "error" };
  }
}

export function AdminStockTable({ locationId }: { locationId: string }) {
  const [attempt, setAttempt] = useState(0);
  return (
    <AdminStockTableForAttempt
      key={`${locationId}-${attempt}`}
      locationId={locationId}
      onRetry={() => setAttempt((a) => a + 1)}
    />
  );
}

function AdminStockTableForAttempt({
  locationId,
  onRetry,
}: {
  locationId: string;
  onRetry: () => void;
}) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    fetchStock(locationId).then((result) => {
      if (!cancelled) setState(result);
    });
    return () => {
      cancelled = true;
    };
  }, [locationId]);

  return <AdminStockTableView state={state} onRetry={onRetry} />;
}

const columns: Column<StockLevel>[] = [
  {
    key: "item",
    header: "Item",
    align: "left",
    cell: (row) => <Truncate>{row.productName}</Truncate>,
  },
  {
    key: "onHand",
    header: "On hand",
    cell: (row) => <Num value={row.quantityOnHand} />,
  },
];

/** The presentational half, driven by state rather than fetching — this is
 * what Storybook mounts to show every state without a network. */
export function AdminStockTableView({
  state,
  onRetry = () => {},
}: {
  state: LoadState;
  onRetry?: () => void;
}) {
  if (state.status === "loading") {
    return <LoadingTable summary={0} rows={8} columns={2} />;
  }

  if (state.status === "denied") {
    return (
      <PermissionDenied
        title="You can only see your own location's stock"
        body="Ask the owner if you need to see stock at the other location."
      />
    );
  }

  if (state.status === "error") {
    return <ErrorState what="stock" onRetry={onRetry} />;
  }

  return (
    <RecordTable
      rows={state.levels}
      columns={columns}
      rowKey={(row) => row.productId}
      empty={
        <EmptyFirstUse
          icon={<PackageOpen className="size-4" />}
          title="No stock recorded yet"
          body="Once a delivery or count is recorded, what's on hand here will be listed."
        />
      }
    />
  );
}
