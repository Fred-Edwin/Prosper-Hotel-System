"use client";

/**
 * Staff-shell stock list — "what's on hand at my location", read-only.
 *
 * No design-phase screen covered this (only the admin valuation table,
 * stock-body.tsx — in the prosper-hotel-design-reference worktree, not this
 * repo — existed) — this is a new composition built strictly from existing
 * primitives, confirmed with the user rather than invented. It differs from
 * the admin table on purpose: no table-toolbar chrome, no cost/value
 * columns (owner-only concerns), large tap-target rows per docs/design.md's
 * mobile rules rather than a dense record-table.
 *
 * 2026-08-13 canteen redesign, item 3: at the canteen only, a two-tab
 * filter — "My stock" (hers) vs "From restaurant" (arrived by transfer) —
 * per docs/scope.md's definition of done and docs/proposal.md §4 ("her
 * stock screen distinguishes the two only for her own reference... not
 * because they are recorded differently"). Same tab pattern as
 * receive-delivery.tsx's Ingredients/Products toggle, reused rather than
 * invented. Restaurant-only staff never see this — their stock is entirely
 * their own by definition.
 *
 * Ticket 53: the own/transferred-in classification now comes from
 * StockLevel.isOwn (Product.locationId === here), the same rule New Sale
 * and Credit Sale use to decide what's sellable — replacing an earlier
 * "received directly vs arrived by transfer" movement-history heuristic
 * and its dedicated by-source endpoint, superseded once Product.locationId
 * existed to answer the question directly. The tabbed interaction itself
 * (not a stacked-sections layout) is unchanged.
 */

import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import {
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

export function StockList({
  locationId,
  isCanteen = false,
}: {
  locationId: string;
  /** Only the canteen sources stock two ways — restaurant-only staff never
   * see the My stock / From restaurant split. */
  isCanteen?: boolean;
}) {
  const [attempt, setAttempt] = useState(0);
  return (
    <StockListForAttempt
      key={`${locationId}-${attempt}`}
      locationId={locationId}
      isCanteen={isCanteen}
      onRetry={() => setAttempt((a) => a + 1)}
    />
  );
}

function StockListForAttempt({
  locationId,
  isCanteen,
  onRetry,
}: {
  locationId: string;
  isCanteen: boolean;
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

  return <StockListView state={state} onRetry={onRetry} isCanteen={isCanteen} />;
}

type SourceFilter = "all" | "own" | "transferred";

/** The presentational half, driven by state rather than fetching — this is
 * what Storybook mounts to show every state without a network. */
export function StockListView({
  state,
  onRetry = () => {},
  isCanteen = false,
}: {
  state: LoadState;
  onRetry?: () => void;
  isCanteen?: boolean;
}) {
  const [filter, setFilter] = useState<SourceFilter>("all");

  if (state.status === "loading") {
    return (
      <div className="p-3" data-testid="stock-loading">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="mb-2 flex items-center gap-3 rounded-lg border bg-card p-3">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="ml-auto h-4 w-10" />
          </div>
        ))}
      </div>
    );
  }

  if (state.status === "denied") {
    return (
      <div className="p-3">
        <PermissionDenied
          title="You can only see your own location's stock"
          body="Ask the owner if you need to see stock at the other location."
        />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="p-3">
        <ErrorState what="stock" onRetry={onRetry} />
      </div>
    );
  }

  if (state.levels.length === 0) {
    return (
      <div className="p-3">
        <EmptyFirstUse
          icon={<PackageOpen className="size-4" />}
          title="No stock recorded yet"
          body="Once a delivery or count is recorded, what's on hand here will be listed."
        />
      </div>
    );
  }

  const shown = isCanteen
    ? state.levels.filter((level) => {
        if (filter === "all") return true;
        return filter === "own" ? level.isOwn : !level.isOwn;
      })
    : state.levels;

  return (
    <div className="p-3">
      {isCanteen && (
        <div
          className="mb-3 grid grid-cols-3 gap-1 rounded-lg bg-muted p-1"
          role="tablist"
          aria-label="Stock source"
        >
          {(
            [
              { key: "all" as const, label: "All" },
              { key: "own" as const, label: "My stock" },
              { key: "transferred" as const, label: "From restaurant" },
            ]
          ).map((tab) => (
            <button
              key={tab.key}
              role="tab"
              aria-selected={filter === tab.key}
              onClick={() => setFilter(tab.key)}
              data-testid={`stock-source-tab-${tab.key}`}
              className={`h-8 rounded-md text-[13px] font-medium transition-colors duration-100 ${
                filter === tab.key ? "bg-card shadow-sm" : "text-muted-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {shown.length === 0 ? (
        <div className="py-12 text-center" data-testid="stock-filtered-empty">
          <p className="text-sm text-muted-foreground">
            {filter === "own" ? "Nothing you've stocked directly yet." : "Nothing from the restaurant yet."}
          </p>
          <button
            className="mt-3 text-[13px] font-medium text-primary underline-offset-2 hover:underline"
            onClick={() => setFilter("all")}
          >
            Clear filter
          </button>
        </div>
      ) : (
        <div data-testid="stock-list">
          {shown.map((level) => (
            <div
              key={level.productId}
              className="mb-2 flex items-center justify-between gap-3 rounded-lg border bg-card p-3"
              data-testid="stock-row"
            >
              <span className="min-w-0 truncate text-[13px] font-medium">
                {level.productName}
              </span>
              <span className="shrink-0 text-[15px] font-semibold tabular-nums">
                {level.quantityOnHand}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
