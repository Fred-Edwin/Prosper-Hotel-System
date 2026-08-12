"use client";

/**
 * Admin-shell stock table — on-hand quantities and value.
 *
 * Design's stock-body.tsx (in the design-reference worktree) is the full
 * valuation view: cost, value, low-stock, category/location filters. This
 * ticket (37) closes the value gap this file used to note as unbuilt, but
 * still deliberately stops short of stock-body.tsx's fuller shape — no
 * low-stock warnings, no category/location filters. Reuses RecordTable
 * rather than inventing a new table shape.
 */

import { useEffect, useState } from "react";
import {
  RecordTable,
  Num,
  Truncate,
  TotalsRow,
  ChildCell,
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
import type { ProductStockValue } from "../logic";

export type StockRow = StockLevel & {
  unitCostMinor: number | null;
  valueMinor: number | null;
  isEstimated: boolean;
};

export type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "denied" }
  | { status: "ready"; rows: StockRow[] };

function mergeStockAndValue(
  levels: StockLevel[],
  values: ProductStockValue[],
): StockRow[] {
  const valueById = new Map(values.map((v) => [v.productId, v]));
  return levels.map((level) => {
    const value = valueById.get(level.productId);
    return {
      ...level,
      unitCostMinor: value?.unitCostMinor ?? null,
      valueMinor: value?.valueMinor ?? null,
      isEstimated: value?.isEstimated ?? false,
    };
  });
}

async function fetchStock(locationId: string): Promise<LoadState> {
  try {
    const [levelsResponse, valuesResponse] = await Promise.all([
      fetch(`/api/stock/${locationId}`),
      fetch(`/api/stock/${locationId}/value`),
    ]);
    if (levelsResponse.status === 403 || valuesResponse.status === 403) {
      return { status: "denied" };
    }
    if (!levelsResponse.ok || !valuesResponse.ok) return { status: "error" };
    const levelsBody = await levelsResponse.json();
    const valuesBody = await valuesResponse.json();
    if (!Array.isArray(levelsBody?.levels) || !Array.isArray(valuesBody?.values)) {
      return { status: "error" };
    }
    return { status: "ready", rows: mergeStockAndValue(levelsBody.levels, valuesBody.values) };
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

const columns: Column<StockRow>[] = [
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
  {
    key: "value",
    header: "Value",
    cell: (row) => (
      <Num value={row.valueMinor} money suffix={row.isEstimated ? "est." : undefined} />
    ),
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
    return <LoadingTable summary={0} rows={8} columns={3} />;
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

  const totalMinor = state.rows.reduce((sum, row) => sum + (row.valueMinor ?? 0), 0);
  const anyEstimated = state.rows.some((row) => row.isEstimated);

  return (
    <RecordTable
      rows={state.rows}
      columns={columns}
      rowKey={(row) => row.productId}
      footer={
        state.rows.length > 0 ? (
          <TotalsRow>
            <ChildCell align="left">Total</ChildCell>
            <ChildCell />
            <ChildCell>
              <Num value={totalMinor} money suffix={anyEstimated ? "incl. est." : undefined} />
            </ChildCell>
          </TotalsRow>
        ) : undefined
      }
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
