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

export function StockList({ locationId }: { locationId: string }) {
  const [attempt, setAttempt] = useState(0);
  return (
    <StockListForAttempt
      key={`${locationId}-${attempt}`}
      locationId={locationId}
      onRetry={() => setAttempt((a) => a + 1)}
    />
  );
}

function StockListForAttempt({
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

  return <StockListView state={state} onRetry={onRetry} />;
}

/** The presentational half, driven by state rather than fetching — this is
 * what Storybook mounts to show every state without a network. */
export function StockListView({
  state,
  onRetry = () => {},
}: {
  state: LoadState;
  onRetry?: () => void;
}) {
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

  const own = state.levels.filter((l) => l.isOwn);
  const transferredIn = state.levels.filter((l) => !l.isOwn);

  return (
    <div className="p-3" data-testid="stock-list">
      {own.length > 0 && (
        <StockLevelGroup title="My stock" levels={own} testIdPrefix="own" />
      )}
      {transferredIn.length > 0 && (
        <StockLevelGroup
          title="From another location"
          levels={transferredIn}
          testIdPrefix="transferred"
          className={own.length > 0 ? "mt-4" : undefined}
        />
      )}
    </div>
  );
}

/** A titled section of stock rows — "My stock" / "From another location",
 * docs/architecture.md's required split between a location's own products
 * and items on hand there only via a confirmed transfer. Mirrors new-sale.tsx's
 * ProductTileGroup split, applied to rows instead of tiles. */
function StockLevelGroup({
  title,
  levels,
  testIdPrefix,
  className,
}: {
  title: string;
  levels: StockLevel[];
  testIdPrefix: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <h3 className="mb-1.5 px-0.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {title}
      </h3>
      {levels.map((level) => (
        <div
          key={level.productId}
          className="mb-2 flex items-center justify-between gap-3 rounded-lg border bg-card p-3"
          data-testid="stock-row"
          data-source={testIdPrefix}
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
  );
}
