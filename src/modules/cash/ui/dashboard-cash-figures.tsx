"use client";

/**
 * Dashboard's Cash position and M-Pesa balance cells (ticket 33) — both
 * read ticket 31's `getRunningCashBalance` in a single fetch (same figure,
 * two fields), matching `money-out-destination.tsx`'s existing
 * `RunningBalanceStrip` for the underlying call. One fetch, two cells:
 * `useDashboardCashBalance` is shared so the two grid cells never issue
 * duplicate requests for the same figure. No sparkline or ledger link:
 * those need trend history and a new nav destination respectively, both
 * explicitly out of scope for tickets 31/33. Loading/error/denied states
 * follow `dashboard-profit.tsx`'s per-slot convention.
 */

import { useEffect, useRef, useState } from "react";
import { ErrorState, PermissionDenied } from "@/components/patterns/states";
import { Skeleton } from "@/components/ui/skeleton";
import { money } from "@/shared/money";

export type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "denied" }
  | { status: "ready"; cashMinor: number; mpesaMinor: number };

async function fetchRunningBalance(): Promise<LoadState> {
  try {
    const response = await fetch("/api/cash/running-balance");
    if (response.status === 403) return { status: "denied" };
    if (!response.ok) return { status: "error" };
    const body = await response.json();
    if (typeof body?.cashMinor !== "number" || typeof body?.mpesaMinor !== "number") {
      return { status: "error" };
    }
    return { status: "ready", cashMinor: body.cashMinor, mpesaMinor: body.mpesaMinor };
  } catch {
    return { status: "error" };
  }
}

function useRunningBalanceFetch(): LoadState {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  useEffect(() => {
    fetchRunningBalance().then((result) => {
      if (!cancelledRef.current) setState(result);
    });
  }, []);

  return state;
}

function Figure({ label, value }: { label: string; value: number }) {
  return (
    <div className="p-4" data-testid="dashboard-cash-figure">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="tabular mt-0.5 text-2xl font-semibold">{money(value)}</div>
    </div>
  );
}

function Loading() {
  return (
    <div className="space-y-2 p-4" data-testid="dashboard-cash-figure-loading">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-6 w-24" />
    </div>
  );
}

function Denied({ what }: { what: string }) {
  return (
    <div className="p-4">
      <PermissionDenied
        title={`${what} is owner-only`}
        body="This is a cash figure. Ask the owner if you need to see it."
      />
    </div>
  );
}

/** Presentational — driven by state rather than fetching, for Storybook. */
export function DashboardCashPositionView({
  state,
  onRetry = () => {},
}: {
  state: LoadState;
  onRetry?: () => void;
}) {
  if (state.status === "loading") return <Loading />;
  if (state.status === "denied") return <Denied what="Cash position" />;
  if (state.status === "error") {
    return (
      <div className="p-4">
        <ErrorState what="the cash position" onRetry={onRetry} />
      </div>
    );
  }
  return <Figure label="Cash position" value={state.cashMinor} />;
}

/** Presentational — driven by state rather than fetching, for Storybook. */
export function DashboardMpesaBalanceView({
  state,
  onRetry = () => {},
}: {
  state: LoadState;
  onRetry?: () => void;
}) {
  if (state.status === "loading") return <Loading />;
  if (state.status === "denied") return <Denied what="M-Pesa balance" />;
  if (state.status === "error") {
    return (
      <div className="p-4">
        <ErrorState what="the M-Pesa balance" onRetry={onRetry} />
      </div>
    );
  }
  return <Figure label="M-Pesa balance" value={state.mpesaMinor} />;
}

function DashboardCashFiguresForAttempt({
  onRetry,
  children,
}: {
  onRetry: () => void;
  children: (state: LoadState, retry: () => void) => React.ReactNode;
}) {
  const state = useRunningBalanceFetch();
  return children(state, onRetry);
}

/** One fetch, both cells — mounted once by `dashboard-body.tsx` and
 * passed down so Cash position and M-Pesa balance never double-fetch the
 * same `getRunningCashBalance` figure. Remounts on retry (the `key`
 * trick `DashboardProfit`/`DashboardHandovers` use) rather than resetting
 * state inside an effect. */
export function DashboardCashFigures({
  children,
}: {
  children: (state: LoadState, retry: () => void) => React.ReactNode;
}) {
  const [attempt, setAttempt] = useState(0);
  return (
    <DashboardCashFiguresForAttempt key={attempt} onRetry={() => setAttempt((a) => a + 1)}>
      {children}
    </DashboardCashFiguresForAttempt>
  );
}
