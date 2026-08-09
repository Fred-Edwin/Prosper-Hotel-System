"use client";

/**
 * Dashboard's Handover section (ticket 14) — the owner's comparison of what
 * each restaurant staff member handed over today against what their sales
 * expected. Adapted from the design-reference worktree's locked
 * `HandoverTable` (`components/design/dashboard/sections.tsx`, commit
 * a977bea) — same table shape, same "Agreed" vs. flagged-difference
 * treatment — with fetching and permission states added, since the
 * prototype only ever rendered fixture data.
 *
 * Restaurant only: the canteen has no handover concept yet (ticket 13),
 * so there is no location column here — every row is already known to be
 * the restaurant, and showing one would imply canteen coverage that
 * doesn't exist. The design-reference table's Location column is dropped
 * for that reason, not carried over as `compact`.
 *
 * Staff who haven't handed over today are simply absent — not shown as a
 * "not yet" row. The acceptance criteria offered either choice; absence
 * was chosen to keep this ticket to its existing seam (cash's interface)
 * without pulling in people's staff roster to diff against.
 */

import { useEffect, useRef, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { SectionHeader, ErrorState, PermissionDenied, EmptyFirstUse } from "@/components/patterns/states";
import { Skeleton } from "@/components/ui/skeleton";
import { Users } from "lucide-react";
import { money } from "@/shared/money";

export type DashboardHandoverRow = {
  id: string;
  staffName: string;
  expectedCashMinor: number;
  expectedMpesaMinor: number;
  actualCashMinor: number;
  actualMpesaMinor: number;
};

export type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "denied" }
  | { status: "ready"; handovers: DashboardHandoverRow[] };

async function fetchTodaysHandovers(): Promise<LoadState> {
  try {
    const response = await fetch("/api/handovers/today-at-restaurant");
    if (response.status === 403) return { status: "denied" };
    if (!response.ok) return { status: "error" };
    const body = await response.json();
    return { status: "ready", handovers: body.handovers ?? [] };
  } catch {
    return { status: "error" };
  }
}

export function DashboardHandovers() {
  const [attempt, setAttempt] = useState(0);
  return <DashboardHandoversForAttempt key={attempt} onRetry={() => setAttempt((a) => a + 1)} />;
}

function DashboardHandoversForAttempt({ onRetry }: { onRetry: () => void }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  useEffect(() => {
    fetchTodaysHandovers().then((result) => {
      if (!cancelledRef.current) setState(result);
    });
  }, []);

  return <DashboardHandoversView state={state} onRetry={onRetry} />;
}

/** The presentational half, driven by state rather than fetching — what
 * Storybook mounts to show every state without a network. */
export function DashboardHandoversView({
  state,
  onRetry = () => {},
}: {
  state: LoadState;
  onRetry?: () => void;
}) {
  if (state.status === "loading") {
    return (
      <div className="rounded-lg border bg-card">
        <SectionHeader title="Handover" />
        <div className="space-y-2 p-4" data-testid="dashboard-handovers-loading">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      </div>
    );
  }

  if (state.status === "denied") {
    return (
      <div className="rounded-lg border bg-card">
        <SectionHeader title="Handover" />
        <div className="p-4">
          <PermissionDenied
            title="Handover is owner-only"
            body="This compares what each person handed over against what the till expected. Ask the owner if you need to see it."
          />
        </div>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="rounded-lg border bg-card">
        <SectionHeader title="Handover" />
        <div className="p-4">
          <ErrorState what="today's handovers" onRetry={onRetry} />
        </div>
      </div>
    );
  }

  const problems = state.handovers.filter(
    (h) => h.actualCashMinor !== h.expectedCashMinor || h.actualMpesaMinor !== h.expectedMpesaMinor,
  );

  return (
    <div className="rounded-lg border bg-card">
      <SectionHeader
        title="Handover"
        badge={
          state.handovers.length === 0 ? undefined : problems.length > 0 ? (
            <Badge
              variant="outline"
              className="border-destructive/30 bg-destructive/10 text-destructive"
              data-testid="dashboard-handovers-problem-badge"
            >
              {problems.length} short
            </Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground">
              All agreed
            </Badge>
          )
        }
      />
      {state.handovers.length === 0 ? (
        <div className="p-4">
          <EmptyFirstUse
            icon={<Users className="size-4" />}
            title="No handovers recorded yet today"
            body="Once restaurant staff record their handover, they'll appear here compared against what their sales expected."
          />
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Person</TableHead>
              <TableHead className="w-24 text-right">Cash due</TableHead>
              <TableHead className="w-24 text-right">Cash in</TableHead>
              <TableHead className="w-24 text-right">M-Pesa due</TableHead>
              <TableHead className="w-24 text-right">M-Pesa in</TableHead>
              <TableHead className="w-28 text-right">Difference</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {state.handovers.map((h) => {
              const diff =
                h.actualCashMinor -
                h.expectedCashMinor +
                (h.actualMpesaMinor - h.expectedMpesaMinor);
              const agreed = diff === 0;
              return (
                <TableRow key={h.id} data-testid="dashboard-handover-row" data-agreed={agreed}>
                  <TableCell className="font-medium">{h.staffName}</TableCell>
                  <TableCell className="tabular-nums text-right">
                    {money(h.expectedCashMinor)}
                  </TableCell>
                  <TableCell className="tabular-nums text-right">
                    {money(h.actualCashMinor)}
                  </TableCell>
                  <TableCell className="tabular-nums text-right">
                    {money(h.expectedMpesaMinor)}
                  </TableCell>
                  <TableCell className="tabular-nums text-right">
                    {money(h.actualMpesaMinor)}
                  </TableCell>
                  <TableCell className="tabular-nums text-right">
                    {agreed ? (
                      <span className="text-muted-foreground">Agreed</span>
                    ) : (
                      <span className="font-medium text-destructive">
                        {diff > 0 ? "+" : "−"}
                        {money(Math.abs(diff))}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
