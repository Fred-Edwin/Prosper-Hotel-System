"use client";

/**
 * Admin-shell stock table — on-hand quantities and value, for both
 * products and ingredients, at whichever location the owner is viewing.
 *
 * Ticket 44 closes the two gaps ticket 37's note used to list as unbuilt:
 * ingredient rows, and low stock. Low stock stays a filter chip, not a
 * separate view — design-reference stock-body.tsx's "a filter is not a
 * destination" — and the basis differs by location: restaurant compares
 * live on-hand, canteen compares the most recent count (canteen stock is
 * provisional between counts, formulas.md §10.4), shown with the count's
 * date when the filter is active.
 */

import { useEffect, useMemo, useState } from "react";
import {
  RecordTable,
  Num,
  Truncate,
  TotalsRow,
  ChildCell,
  type Column,
} from "@/components/patterns/record-table";
import { TableToolbar } from "@/components/patterns/table-toolbar";
import {
  LoadingTable,
  EmptyFirstUse,
  EmptyFiltered,
  ErrorState,
  PermissionDenied,
} from "@/components/patterns/states";
import { PackageOpen, TriangleAlert } from "lucide-react";
import type { LowStockItem } from "../schema";
import type { ProductStockValue, IngredientStockValue } from "../logic";

export type StockRow = {
  itemType: "product" | "ingredient";
  itemId: string;
  itemName: string;
  quantityOnHand: number;
  unitCostMinor: number | null;
  valueMinor: number | null;
  isEstimated: boolean;
  lowStockLevel: number | null;
  isLow: boolean;
  /** Set only when this row's quantity comes from a count, not live on-hand. */
  asOf: Date | null;
};

export type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "denied" }
  | { status: "ready"; rows: StockRow[] };

function mergeRows(
  productLevels: { productId: string; productName: string; quantityOnHand: number }[],
  productValues: ProductStockValue[],
  ingredientLevels: { ingredientId: string; ingredientName: string; quantityOnHand: number }[],
  ingredientValues: IngredientStockValue[],
  lowStockItems: LowStockItem[],
): StockRow[] {
  const productValueById = new Map(productValues.map((v) => [v.productId, v]));
  const ingredientValueById = new Map(ingredientValues.map((v) => [v.ingredientId, v]));
  const lowById = new Map(lowStockItems.map((i) => [`${i.itemType}:${i.itemId}`, i]));

  const productRows: StockRow[] = productLevels.map((level) => {
    const value = productValueById.get(level.productId);
    const low = lowById.get(`product:${level.productId}`);
    return {
      itemType: "product",
      itemId: level.productId,
      itemName: level.productName,
      quantityOnHand: level.quantityOnHand,
      unitCostMinor: value?.unitCostMinor ?? null,
      valueMinor: value?.valueMinor ?? null,
      isEstimated: value?.isEstimated ?? false,
      lowStockLevel: low?.lowStockLevel ?? null,
      isLow: low !== undefined,
      asOf: low?.asOf ?? null,
    };
  });

  const ingredientRows: StockRow[] = ingredientLevels.map((level) => {
    const value = ingredientValueById.get(level.ingredientId);
    const low = lowById.get(`ingredient:${level.ingredientId}`);
    return {
      itemType: "ingredient",
      itemId: level.ingredientId,
      itemName: level.ingredientName,
      quantityOnHand: level.quantityOnHand,
      unitCostMinor: value?.unitCostMinor ?? null,
      valueMinor: value?.valueMinor ?? null,
      isEstimated: value?.isEstimated ?? false,
      lowStockLevel: low?.lowStockLevel ?? null,
      isLow: low !== undefined,
      asOf: low?.asOf ?? null,
    };
  });

  return [...productRows, ...ingredientRows].sort((a, b) => a.itemName.localeCompare(b.itemName));
}

async function fetchStock(locationId: string): Promise<LoadState> {
  try {
    const [levelsRes, valuesRes, ingredientValuesRes, lowStockRes] = await Promise.all([
      fetch(`/api/stock/${locationId}`),
      fetch(`/api/stock/${locationId}/value`),
      fetch(`/api/stock/${locationId}/ingredient-value`),
      fetch(`/api/stock/${locationId}/low-stock`),
    ]);
    if (
      levelsRes.status === 403 ||
      valuesRes.status === 403 ||
      ingredientValuesRes.status === 403 ||
      lowStockRes.status === 403
    ) {
      return { status: "denied" };
    }
    if (!levelsRes.ok || !valuesRes.ok || !ingredientValuesRes.ok || !lowStockRes.ok) {
      return { status: "error" };
    }
    const levelsBody = await levelsRes.json();
    const valuesBody = await valuesRes.json();
    const ingredientValuesBody = await ingredientValuesRes.json();
    const lowStockBody = await lowStockRes.json();
    if (
      !Array.isArray(levelsBody?.levels) ||
      !Array.isArray(valuesBody?.values) ||
      !Array.isArray(ingredientValuesBody?.values) ||
      !Array.isArray(lowStockBody?.items)
    ) {
      return { status: "error" };
    }

    // Ingredient on-hand quantity rides along on the value response —
    // getIngredientStockValuesAtLocation excludes ingredients with no
    // known cost, so an uncosted ingredient in stock currently has no row
    // here at all. Acceptable for this ticket: the same "no basis" logic
    // the low-stock filter already applies to an unpriced item.
    const ingredientLevels = ingredientValuesBody.values.map(
      (v: IngredientStockValue) => ({
        ingredientId: v.ingredientId,
        ingredientName: v.ingredientName,
        quantityOnHand: v.quantityOnHand,
      }),
    );

    return {
      status: "ready",
      rows: mergeRows(
        levelsBody.levels,
        valuesBody.values,
        ingredientLevels,
        ingredientValuesBody.values,
        lowStockBody.items,
      ),
    };
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

function formatAsOf(date: Date): string {
  return new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

const columns: Column<StockRow>[] = [
  {
    key: "item",
    header: "Item",
    align: "left",
    cell: (row) => <Truncate>{row.itemName}</Truncate>,
  },
  {
    key: "type",
    header: "Type",
    cell: (row) => (
      <span className="text-muted-foreground capitalize">{row.itemType}</span>
    ),
  },
  {
    key: "onHand",
    header: "On hand",
    cell: (row) => (
      <>
        <Num value={row.quantityOnHand} tone={row.isLow ? "warning" : undefined} strong={row.isLow} />
        {row.isLow && (
          <TriangleAlert className="ml-1 inline size-3 text-warning" aria-label="Low stock" />
        )}
        {row.isLow && row.asOf && (
          <div className="text-[11px] text-muted-foreground">as at {formatAsOf(row.asOf)}</div>
        )}
      </>
    ),
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
  const [query, setQuery] = useState("");
  const [itemType, setItemType] = useState("all");
  const [lowOnly, setLowOnly] = useState(false);

  const rows = useMemo(() => {
    if (state.status !== "ready") return [];
    const q = query.trim().toLowerCase();
    return state.rows.filter(
      (r) =>
        (itemType === "all" || r.itemType === itemType) &&
        (!lowOnly || r.isLow) &&
        (!q || r.itemName.toLowerCase().includes(q)),
    );
  }, [state, query, itemType, lowOnly]);

  if (state.status === "loading") {
    return <LoadingTable summary={0} rows={8} columns={4} />;
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

  if (state.rows.length === 0) {
    return (
      <EmptyFirstUse
        icon={<PackageOpen className="size-4" />}
        title="No stock recorded yet"
        body="Once a delivery or count is recorded, what's on hand here will be listed."
      />
    );
  }

  const totalMinor = rows.reduce((sum, row) => sum + (row.valueMinor ?? 0), 0);
  const anyEstimated = rows.some((row) => row.isEstimated);
  const lowCount = state.rows.filter((r) => r.isLow).length;

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <TableToolbar
          query={query}
          onQuery={setQuery}
          placeholder="Search stock"
          noun="items"
          count={rows.length}
          total={state.rows.length}
          filters={[
            {
              key: "itemType",
              value: itemType,
              onChange: setItemType,
              allLabel: "All items",
              options: [
                { value: "product", label: "Products" },
                { value: "ingredient", label: "Ingredients" },
              ],
              width: "9rem",
            },
          ]}
          toggles={[
            {
              key: "low",
              label: "Low stock",
              icon: TriangleAlert,
              on: lowOnly,
              onChange: setLowOnly,
              count: lowCount,
            },
          ]}
        />
      </div>

      <RecordTable
        rows={rows}
        columns={columns}
        rowKey={(row) => `${row.itemType}-${row.itemId}`}
        footer={
          rows.length > 0 ? (
            <TotalsRow>
              <ChildCell align="left">Total</ChildCell>
              <ChildCell />
              <ChildCell />
              <ChildCell>
                <Num value={totalMinor} money suffix={anyEstimated ? "incl. est." : undefined} />
              </ChildCell>
            </TotalsRow>
          ) : undefined
        }
        empty={<EmptyFiltered onClear={() => { setQuery(""); setItemType("all"); setLowOnly(false); }} noun="stock items" />}
      />
    </>
  );
}
