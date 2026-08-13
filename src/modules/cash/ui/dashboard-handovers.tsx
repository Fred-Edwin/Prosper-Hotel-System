"use client";

/**
 * Dashboard's Handover section (ticket 14) — the owner's comparison of what
 * each staff member handed over today against what their sales expected.
 * Adapted from the design-reference worktree's locked `HandoverTable`
 * (`components/design/dashboard/sections.tsx`, commit a977bea) — same
 * table shape, same "Agreed" vs. flagged-difference treatment — with
 * fetching and permission states added, since the prototype only ever
 * rendered fixture data.
 *
 * 2026-08-13 canteen redesign (docs/proposal.md §5): the canteen now
 * records real handovers too, checked as a single combined cash+M-Pesa
 * figure rather than the restaurant's two-currency split (a canteen sale
 * carries no payment method at entry, so the split isn't knowable — see
 * the `Handover.expectedMpesaMinor` schema comment). This section
 * originally excluded the canteen entirely (ticket 13 predates it); it now
 * shows both, in two separate tables, since the two checks aren't the
 * same shape and proposal.md's own worked example renders the canteen's
 * as three lines (Sales recorded / Cash + M-Pesa handed over /
 * Difference), not four columns. A row's `expectedMpesaMinor === null` is
 * the documented signal that it's a canteen (combined-check) row.
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
  // null means "combined figure, held in expectedCashMinor" — a canteen
  // row (docs/proposal.md §5) — not "expected zero M-Pesa."
  expectedMpesaMinor: number | null;
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
    const response = await fetch("/api/handovers/today-all");
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

  // expectedMpesaMinor === null is the schema's documented signal for a
  // canteen row (combined check) — see the header comment.
  const restaurantRows = state.handovers.filter((h) => h.expectedMpesaMinor !== null);
  const canteenRows = state.handovers.filter((h) => h.expectedMpesaMinor === null);

  const restaurantDiff = (h: DashboardHandoverRow) =>
    h.actualCashMinor - h.expectedCashMinor + (h.actualMpesaMinor - (h.expectedMpesaMinor ?? 0));
  const canteenDiff = (h: DashboardHandoverRow) =>
    h.actualCashMinor + h.actualMpesaMinor - h.expectedCashMinor;

  const problems =
    restaurantRows.filter((h) => restaurantDiff(h) !== 0).length +
    canteenRows.filter((h) => canteenDiff(h) !== 0).length;

  return (
    <div className="rounded-lg border bg-card">
      <SectionHeader
        title="Handover"
        badge={
          state.handovers.length === 0 ? undefined : problems > 0 ? (
            <Badge
              variant="outline"
              className="border-destructive/30 bg-destructive/10 text-destructive"
              data-testid="dashboard-handovers-problem-badge"
            >
              {problems} short
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
            body="Once staff record their handover, they'll appear here compared against what their sales expected."
          />
        </div>
      ) : (
        <>
          {restaurantRows.length > 0 && (
            <Table data-testid="dashboard-handovers-restaurant-table">
              <TableHeader>
                <TableRow>
                  <TableHead>Restaurant</TableHead>
                  <TableHead className="w-24 text-right">Cash due</TableHead>
                  <TableHead className="w-24 text-right">Cash in</TableHead>
                  <TableHead className="w-24 text-right">M-Pesa due</TableHead>
                  <TableHead className="w-24 text-right">M-Pesa in</TableHead>
                  <TableHead className="w-28 text-right">Difference</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {restaurantRows.map((h) => {
                  const diff = restaurantDiff(h);
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
                        {money(h.expectedMpesaMinor ?? 0)}
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

          {canteenRows.length > 0 && (
            <Table data-testid="dashboard-handovers-canteen-table">
              <TableHeader>
                <TableRow>
                  <TableHead>Canteen</TableHead>
                  <TableHead className="w-32 text-right">Sales recorded</TableHead>
                  <TableHead className="w-32 text-right">Cash + M-Pesa in</TableHead>
                  <TableHead className="w-28 text-right">Difference</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {canteenRows.map((h) => {
                  const diff = canteenDiff(h);
                  const agreed = diff === 0;
                  const actualCombined = h.actualCashMinor + h.actualMpesaMinor;
                  return (
                    <TableRow
                      key={h.id}
                      data-testid="dashboard-handover-row-canteen"
                      data-agreed={agreed}
                    >
                      <TableCell className="font-medium">{h.staffName}</TableCell>
                      <TableCell className="tabular-nums text-right">
                        {money(h.expectedCashMinor)}
                      </TableCell>
                      <TableCell className="tabular-nums text-right">
                        {money(actualCombined)}
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
        </>
      )}
    </div>
  );
}
