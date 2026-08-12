"use client";

/**
 * Dashboard's "Restaurant store" card (ticket 49) — adapted from the
 * design-reference worktree's `StoreMovements`
 * (`components/design/dashboard/sections.tsx`): today's per-ingredient
 * received/to-kitchen/to-canteen/closing quantities, restaurant only. A
 * thin reshape of ticket 42's `getStoreLedger` for today, scoped to the
 * restaurant — see `getDashboardStoreMovements`. Same fetching/LoadState/
 * presentational split as the rest of the Dashboard's cards.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ErrorState, PermissionDenied } from "@/components/patterns/states";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowRight } from "lucide-react";

export type DashboardStoreMovementRow = {
  ingredientName: string;
  unitOfMeasure: string;
  received: number;
  issuedToKitchen: number;
  transferredOut: number;
  closingQty: number;
};

export type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "denied" }
  | { status: "ready"; rows: DashboardStoreMovementRow[] };

async function fetchStoreMovements(): Promise<LoadState> {
  try {
    const response = await fetch("/api/dashboard/store-movements");
    if (response.status === 403) return { status: "denied" };
    if (!response.ok) return { status: "error" };
    const body = await response.json();
    return { status: "ready", rows: body.rows };
  } catch {
    return { status: "error" };
  }
}

export function DashboardStoreMovements() {
  const [attempt, setAttempt] = useState(0);
  return <DashboardStoreMovementsForAttempt key={attempt} onRetry={() => setAttempt((a) => a + 1)} />;
}

function DashboardStoreMovementsForAttempt({ onRetry }: { onRetry: () => void }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  useEffect(() => {
    fetchStoreMovements().then((result) => {
      if (!cancelledRef.current) setState(result);
    });
  }, []);

  return <DashboardStoreMovementsView state={state} onRetry={onRetry} />;
}

/** The presentational half, driven by state rather than fetching — what
 * Storybook mounts to show every state without a network. */
export function DashboardStoreMovementsView({
  state,
  onRetry = () => {},
}: {
  state: LoadState;
  onRetry?: () => void;
}) {
  if (state.status === "loading") {
    return (
      <div className="space-y-2 p-4" data-testid="dashboard-store-movements-loading">
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
          title="Store movements is owner-only"
          body="Today's ingredient movements are financial data. Ask the owner if you need to see them."
        />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="p-4">
        <ErrorState what="today's store movements" onRetry={onRetry} />
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
          data-testid="dashboard-store-movements-empty"
        >
          No store movements today.
        </div>
      ) : (
        <Table data-testid="dashboard-store-movements">
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead className="w-24 text-right">Received</TableHead>
              <TableHead className="w-24 text-right">To kitchen</TableHead>
              <TableHead className="w-24 text-right">To canteen</TableHead>
              <TableHead className="w-24 text-right">Closing</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.ingredientName}>
                <TableCell className="font-medium">{row.ingredientName}</TableCell>
                <TableCell className="tabular text-right">
                  {row.received || <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell className="tabular text-right">
                  {row.issuedToKitchen || <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell className="tabular text-right">
                  {row.transferredOut || <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell className="tabular text-right font-medium">
                  {row.closingQty} {row.unitOfMeasure}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
