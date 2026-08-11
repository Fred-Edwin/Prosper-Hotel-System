"use client";

/**
 * Dashboard's "Owed to you" cell (ticket 33) — the sum across all
 * customers, both locations (formulas.md §11), from ticket 33's own
 * `getTotalCustomerBalance`. Same fetch/loading/error/denied shape as
 * cash's `dashboard-cash-figures.tsx`, no sparkline or ledger link for the
 * same reason those are absent there (no trend history, no new nav
 * destination — out of scope).
 */

import { useEffect, useRef, useState } from "react";
import { ErrorState, PermissionDenied } from "@/components/patterns/states";
import { Skeleton } from "@/components/ui/skeleton";
import { money } from "@/shared/money";

export type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "denied" }
  | { status: "ready"; totalMinor: number };

async function fetchOwedToYou(): Promise<LoadState> {
  try {
    const response = await fetch("/api/dashboard/owed-to-you");
    if (response.status === 403) return { status: "denied" };
    if (!response.ok) return { status: "error" };
    const body = await response.json();
    if (typeof body?.totalMinor !== "number") return { status: "error" };
    return { status: "ready", totalMinor: body.totalMinor };
  } catch {
    return { status: "error" };
  }
}

export function DashboardOwedToYouView({
  state,
  onRetry = () => {},
}: {
  state: LoadState;
  onRetry?: () => void;
}) {
  if (state.status === "loading") {
    return (
      <div className="space-y-2 p-4" data-testid="dashboard-owed-to-you-loading">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-6 w-24" />
      </div>
    );
  }

  if (state.status === "denied") {
    return (
      <div className="p-4">
        <PermissionDenied
          title="Owed to you is owner-only"
          body="This is what customers owe on credit. Ask the owner if you need to see it."
        />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="p-4">
        <ErrorState what="what customers owe" onRetry={onRetry} />
      </div>
    );
  }

  return (
    <div className="p-4" data-testid="dashboard-owed-to-you">
      <div className="text-xs text-muted-foreground">Owed to you</div>
      <div className="tabular mt-0.5 text-2xl font-semibold">{money(state.totalMinor)}</div>
    </div>
  );
}

function DashboardOwedToYouForAttempt({ onRetry }: { onRetry: () => void }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  useEffect(() => {
    fetchOwedToYou().then((result) => {
      if (!cancelledRef.current) setState(result);
    });
  }, []);

  return <DashboardOwedToYouView state={state} onRetry={onRetry} />;
}

export function DashboardOwedToYou() {
  const [attempt, setAttempt] = useState(0);
  return <DashboardOwedToYouForAttempt key={attempt} onRetry={() => setAttempt((a) => a + 1)} />;
}
