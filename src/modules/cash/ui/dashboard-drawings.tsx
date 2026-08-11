"use client";

/**
 * Dashboard's "Your drawings" cell (ticket 33) — ticket 32's netted
 * `drawingDebtOwed` (debt minus unreversed repayments), read via the
 * existing `/api/cash/drawing-debt` route
 * (`drawing-repayment-card.tsx`'s `fetchDrawingDebt` fetches the same
 * endpoint on `money-out`). Same fetch/loading/error/denied shape as
 * `dashboard-owed-to-you.tsx`, no sparkline or ledger link for the same
 * reason those are absent there.
 */

import { useEffect, useRef, useState } from "react";
import { ErrorState, PermissionDenied } from "@/components/patterns/states";
import { Skeleton } from "@/components/ui/skeleton";
import { money } from "@/shared/money";

export type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "denied" }
  | { status: "ready"; outstandingMinor: number };

async function fetchDrawingsOutstanding(): Promise<LoadState> {
  try {
    const response = await fetch("/api/cash/drawing-debt");
    if (response.status === 403) return { status: "denied" };
    if (!response.ok) return { status: "error" };
    const body = await response.json();
    if (typeof body?.outstandingMinor !== "number") return { status: "error" };
    return { status: "ready", outstandingMinor: body.outstandingMinor };
  } catch {
    return { status: "error" };
  }
}

export function DashboardDrawingsView({
  state,
  onRetry = () => {},
}: {
  state: LoadState;
  onRetry?: () => void;
}) {
  if (state.status === "loading") {
    return (
      <div className="space-y-2 p-4" data-testid="dashboard-drawings-loading">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-6 w-24" />
      </div>
    );
  }

  if (state.status === "denied") {
    return (
      <div className="p-4">
        <PermissionDenied
          title="Your drawings is owner-only"
          body="This is the outstanding drawings balance. Ask the owner if you need to see it."
        />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="p-4">
        <ErrorState what="your drawings balance" onRetry={onRetry} />
      </div>
    );
  }

  return (
    <div className="p-4" data-testid="dashboard-drawings">
      <div className="text-xs text-muted-foreground">Your drawings</div>
      <div className="tabular mt-0.5 text-2xl font-semibold">{money(state.outstandingMinor)}</div>
    </div>
  );
}

function DashboardDrawingsForAttempt({ onRetry }: { onRetry: () => void }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  useEffect(() => {
    fetchDrawingsOutstanding().then((result) => {
      if (!cancelledRef.current) setState(result);
    });
  }, []);

  return <DashboardDrawingsView state={state} onRetry={onRetry} />;
}

export function DashboardDrawings() {
  const [attempt, setAttempt] = useState(0);
  return <DashboardDrawingsForAttempt key={attempt} onRetry={() => setAttempt((a) => a + 1)} />;
}
