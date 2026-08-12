"use client";

/**
 * Dashboard's "Needs you" card (ticket 48) — adapted from the design-
 * reference worktree's `Exceptions` (`components/design/dashboard/sections.tsx`):
 * today's handover shortfalls and voided sales in one list, newest concerns
 * first, with a zero-state when nothing needs attention. The reference's
 * third source, pending-expense confirmation, has no equivalent here —
 * `Expense` has no submit-for-confirmation concept in this codebase's
 * schema, so that source is dropped rather than invented (see ticket 48's
 * file). Same fetching/LoadState/presentational split as the rest of the
 * Dashboard's cards. Action links go to the screen the record already
 * lives on (Ledger for a shortfall, Activity for a void) rather than any
 * new confirmation flow — out of this ticket's scope.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ErrorState, PermissionDenied } from "@/components/patterns/states";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Check, TriangleAlert, Ban } from "lucide-react";
import { money } from "@/shared/money";

export type ExceptionShortfall = {
  handoverId: string;
  staffName: string;
  locationCode: string;
  cashDiffMinor: number;
  mpesaDiffMinor: number;
  occurredAt: string;
};

export type ExceptionVoidedSale = {
  saleId: string;
  saleRef: string;
  voidedByName: string;
  totalMinor: number;
  locationCode: string;
  voidedAt: string;
};

export type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "denied" }
  | { status: "ready"; shortfalls: ExceptionShortfall[]; voidedSales: ExceptionVoidedSale[] };

async function fetchExceptions(): Promise<LoadState> {
  try {
    const response = await fetch("/api/dashboard/exceptions");
    if (response.status === 403) return { status: "denied" };
    if (!response.ok) return { status: "error" };
    const body = await response.json();
    return { status: "ready", shortfalls: body.shortfalls, voidedSales: body.voidedSales };
  } catch {
    return { status: "error" };
  }
}

export function DashboardExceptions() {
  const [attempt, setAttempt] = useState(0);
  return <DashboardExceptionsForAttempt key={attempt} onRetry={() => setAttempt((a) => a + 1)} />;
}

function DashboardExceptionsForAttempt({ onRetry }: { onRetry: () => void }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  useEffect(() => {
    fetchExceptions().then((result) => {
      if (!cancelledRef.current) setState(result);
    });
  }, []);

  return <DashboardExceptionsView state={state} onRetry={onRetry} />;
}

/** The presentational half, driven by state rather than fetching — what
 * Storybook mounts to show every state without a network. */
export function DashboardExceptionsView({
  state,
  onRetry = () => {},
}: {
  state: LoadState;
  onRetry?: () => void;
}) {
  if (state.status === "loading") {
    return (
      <div className="divide-y" data-testid="dashboard-exceptions-loading">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-2.5">
            <Skeleton className="size-4 rounded-full" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-48" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="h-7 w-20 shrink-0" />
          </div>
        ))}
      </div>
    );
  }

  if (state.status === "denied") {
    return (
      <div className="p-4">
        <PermissionDenied
          title="Needs you is owner-only"
          body="Handover shortfalls and voided sales are financial exceptions. Ask the owner if you need to see them."
        />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="p-4">
        <ErrorState what="today's exceptions" onRetry={onRetry} />
      </div>
    );
  }

  const { shortfalls, voidedSales } = state;
  const count = shortfalls.length + voidedSales.length;

  if (count === 0) {
    return (
      <div
        className="flex items-center gap-2 px-4 py-6 text-sm text-muted-foreground"
        data-testid="dashboard-exceptions-empty"
      >
        <Check className="size-4 text-success" />
        Everything agreed today. Nothing needs you.
      </div>
    );
  }

  return (
    <div className="divide-y" data-testid="dashboard-exceptions">
      {shortfalls.map((h) => {
        const details = [
          h.cashDiffMinor !== 0 && `Cash short ${money(Math.abs(h.cashDiffMinor))}`,
          h.mpesaDiffMinor !== 0 && `M-Pesa short ${money(Math.abs(h.mpesaDiffMinor))}`,
          h.locationCode,
        ].filter(Boolean);
        return (
          <ExceptionRow
            key={h.handoverId}
            icon={<TriangleAlert className="size-4 text-warning" />}
            title={`${h.staffName} handed over less than expected`}
            detail={details.join(" · ")}
            action="Look into it"
            href="/ledger"
          />
        );
      })}
      {voidedSales.map((s) => (
        <ExceptionRow
          key={s.saleId}
          icon={<Ban className="size-4 text-danger" />}
          title={`${s.voidedByName} voided sale ${s.saleRef}`}
          detail={`${money(s.totalMinor)} · ${s.locationCode}`}
          action="View"
          href="/activity"
        />
      ))}
    </div>
  );
}

function ExceptionRow({
  icon,
  title,
  detail,
  action,
  href,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
  action: string;
  href: string;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      {icon}
      <div className="min-w-0 flex-1">
        <div className="text-sm">{title}</div>
        <div className="tabular text-xs text-muted-foreground">{detail}</div>
      </div>
      <Button variant="outline" size="sm" className="h-7 shrink-0 text-xs" asChild>
        <Link href={href}>{action}</Link>
      </Button>
    </div>
  );
}
