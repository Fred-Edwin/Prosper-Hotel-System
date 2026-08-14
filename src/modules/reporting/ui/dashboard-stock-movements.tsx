"use client";

/**
 * Dashboard's "Stock movements" card (ticket 49) — adapted from the
 * design-reference worktree's `StockMovements`
 * (`components/design/dashboard/sections.tsx`): today's product movements
 * grouped by reason and location, wasted/consumed/given-away flagged in
 * danger tone. A thin regrouping of ticket 39's `getProductLedger` for
 * today, so the two always reconcile — see `getDashboardStockMovements`.
 * Same fetching/LoadState/presentational split as the rest of the
 * Dashboard's cards.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ErrorState, PermissionDenied } from "@/components/patterns/states";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowRight } from "lucide-react";
import { money } from "@/shared/money";

export type DashboardStockMovementRow = {
  reason: string;
  locationCode: string;
  qty: number;
  valueMinor: number;
};

export type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "denied" }
  | { status: "ready"; rows: DashboardStockMovementRow[] };

const DANGER_REASONS = new Set(["wasted", "consumed", "given_away"]);

const REASON_LABELS: Record<string, string> = {
  produced: "Produced",
  received: "Received",
  transferred_in: "Transferred in",
  transferred_out: "Transferred out",
  sold: "Sold",
  wasted: "Wasted",
  consumed: "Staff meals",
  given_away: "Complimentary",
};

async function fetchStockMovements(): Promise<LoadState> {
  try {
    const response = await fetch("/api/dashboard/stock-movements");
    if (response.status === 403) return { status: "denied" };
    if (!response.ok) return { status: "error" };
    const body = await response.json();
    return { status: "ready", rows: body.rows };
  } catch {
    return { status: "error" };
  }
}

export function DashboardStockMovements() {
  const [attempt, setAttempt] = useState(0);
  return <DashboardStockMovementsForAttempt key={attempt} onRetry={() => setAttempt((a) => a + 1)} />;
}

function DashboardStockMovementsForAttempt({ onRetry }: { onRetry: () => void }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  useEffect(() => {
    fetchStockMovements().then((result) => {
      if (!cancelledRef.current) setState(result);
    });
  }, []);

  return <DashboardStockMovementsView state={state} onRetry={onRetry} />;
}

/** The presentational half, driven by state rather than fetching — what
 * Storybook mounts to show every state without a network. */
export function DashboardStockMovementsView({
  state,
  onRetry = () => {},
}: {
  state: LoadState;
  onRetry?: () => void;
}) {
  if (state.status === "loading") {
    return (
      <div className="space-y-2 p-4" data-testid="dashboard-stock-movements-loading">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-6 w-full" />
        ))}
      </div>
    );
  }

  if (state.status === "denied") {
    return (
      <div className="p-4">
        <PermissionDenied
          title="Stock movements is owner-only"
          body="Today's product movements are financial data. Ask the owner if you need to see them."
        />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="p-4">
        <ErrorState what="today's stock movements" onRetry={onRetry} />
      </div>
    );
  }

  const { rows } = state;

  return (
    <div>
      <div className="flex justify-end px-4 pt-2">
        <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
          <Link href="/ledger">
            Open the ledger <ArrowRight className="size-3" />
          </Link>
        </Button>
      </div>
      {rows.length === 0 ? (
        <div
          className="px-4 py-6 text-sm text-muted-foreground"
          data-testid="dashboard-stock-movements-empty"
        >
          No stock movements today.
        </div>
      ) : (
        <Table data-testid="dashboard-stock-movements">
          <TableHeader>
            <TableRow>
              <TableHead>Reason</TableHead>
              <TableHead className="w-24">Location</TableHead>
              <TableHead className="w-20 text-right">Qty</TableHead>
              <TableHead className="w-28 text-right">Value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={`${row.reason}:${row.locationCode}`}>
                <TableCell className="font-medium">
                  {REASON_LABELS[row.reason] ?? row.reason}
                </TableCell>
                <TableCell className="capitalize text-muted-foreground">{row.locationCode}</TableCell>
                <TableCell className="tabular text-right">{row.qty}</TableCell>
                <TableCell
                  className={`tabular text-right ${DANGER_REASONS.has(row.reason) ? "text-danger" : ""}`}
                >
                  {money(row.valueMinor)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
