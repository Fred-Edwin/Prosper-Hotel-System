"use client";

/**
 * Stock count detail — the read view of a recorded count: expected,
 * counted and difference per line, with the owner's correct action on a
 * disagreeing line. Ticket 20.
 *
 * Difference flagging reuses ticket 14's dashboard-handovers.tsx pattern —
 * `data-agreed` on the row, "Agreed" text vs. a highlighted destructive
 * figure — the same visual language for the same idea (does a recorded
 * figure match what was expected), just per stock line instead of per
 * person's handover.
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
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState, PermissionDenied } from "@/components/patterns/states";
import { ClipboardList } from "lucide-react";

export type CountLine = {
  id: string;
  itemType: "product" | "ingredient";
  itemName: string;
  countedQuantity: number;
  expectedQuantity: number;
  correctedAt: string | null;
};

export type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "denied" }
  | { status: "ready"; lines: CountLine[] };

async function fetchStockCount(countId: string): Promise<LoadState> {
  try {
    const response = await fetch(`/api/stock/counts/${countId}`);
    if (response.status === 403) return { status: "denied" };
    if (!response.ok) return { status: "error" };
    const body = await response.json();
    return { status: "ready", lines: body.count.lines };
  } catch {
    return { status: "error" };
  }
}

async function submitCorrection(
  countId: string,
  lineId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const response = await fetch(`/api/stock/counts/${countId}/correct`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lineId }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      return { ok: false, error: body?.error ?? "unknown" };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "network" };
  }
}

export function StockCountDetail({
  countId,
  isOwner,
}: {
  countId: string;
  isOwner: boolean;
}) {
  const [attempt, setAttempt] = useState(0);
  return (
    <StockCountDetailForAttempt
      key={attempt}
      countId={countId}
      isOwner={isOwner}
      onRetry={() => setAttempt((a) => a + 1)}
    />
  );
}

function StockCountDetailForAttempt({
  countId,
  isOwner,
  onRetry,
}: {
  countId: string;
  isOwner: boolean;
  onRetry: () => void;
}) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  useEffect(() => {
    fetchStockCount(countId).then((result) => {
      if (!cancelledRef.current) setState(result);
    });
  }, [countId]);

  const onCorrected = (lineId: string) => {
    setState((s) => {
      if (s.status !== "ready") return s;
      return {
        status: "ready",
        lines: s.lines.map((l) =>
          l.id === lineId ? { ...l, correctedAt: new Date().toISOString() } : l,
        ),
      };
    });
  };

  return (
    <StockCountDetailView
      countId={countId}
      isOwner={isOwner}
      state={state}
      onRetry={onRetry}
      onCorrected={onCorrected}
    />
  );
}

/** The presentational half — what Storybook mounts to show every state
 * without a network. */
export function StockCountDetailView({
  countId,
  isOwner,
  state,
  onRetry = () => {},
  onCorrected = () => {},
  onCorrect = submitCorrection,
}: {
  countId: string;
  isOwner: boolean;
  state: LoadState;
  onRetry?: () => void;
  onCorrected?: (lineId: string) => void;
  onCorrect?: typeof submitCorrection;
}) {
  const [correctingId, setCorrectingId] = useState<string | null>(null);
  const [correctError, setCorrectError] = useState<string | null>(null);

  if (state.status === "loading") {
    return (
      <div className="space-y-2 p-4" data-testid="count-detail-loading">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  if (state.status === "denied") {
    return (
      <div className="p-4">
        <PermissionDenied
          title="You can't see this count"
          body="This count was taken at a location you don't have access to. Ask the owner if you need to see it."
        />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="p-4">
        <ErrorState what="this stock count" onRetry={onRetry} />
      </div>
    );
  }

  const problems = state.lines.filter((l) => l.countedQuantity !== l.expectedQuantity);

  const correct = async (lineId: string) => {
    setCorrectingId(lineId);
    setCorrectError(null);
    const result = await onCorrect(countId, lineId);
    setCorrectingId(null);
    if (!result.ok) {
      setCorrectError(result.error);
      return;
    }
    onCorrected(lineId);
  };

  return (
    <div className="p-3">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-medium">Stock count</h2>
        </div>
        {problems.length > 0 ? (
          <Badge
            variant="outline"
            className="border-destructive/30 bg-destructive/10 text-destructive"
            data-testid="count-problem-badge"
          >
            {problems.length} {problems.length === 1 ? "difference" : "differences"}
          </Badge>
        ) : (
          <Badge variant="outline" className="text-muted-foreground">
            All agreed
          </Badge>
        )}
      </div>

      {correctError && (
        <p className="mb-2 text-[11px] text-destructive">
          Couldn&apos;t apply the correction. Try again.
        </p>
      )}

      <div className="overflow-hidden rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead className="w-24 text-right">Expected</TableHead>
              <TableHead className="w-24 text-right">Counted</TableHead>
              <TableHead className="w-28 text-right">Difference</TableHead>
              {isOwner && <TableHead className="w-28 text-right">Action</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {state.lines.map((l) => {
              const diff = l.countedQuantity - l.expectedQuantity;
              const agreed = diff === 0;
              return (
                <TableRow key={l.id} data-testid="count-detail-row" data-agreed={agreed}>
                  <TableCell className="font-medium">{l.itemName}</TableCell>
                  <TableCell className="tabular-nums text-right">{l.expectedQuantity}</TableCell>
                  <TableCell className="tabular-nums text-right">{l.countedQuantity}</TableCell>
                  <TableCell className="tabular-nums text-right">
                    {agreed ? (
                      <span className="text-muted-foreground">Agreed</span>
                    ) : (
                      <span className="font-medium text-destructive">
                        {diff > 0 ? "+" : "−"}
                        {Math.abs(diff)}
                      </span>
                    )}
                  </TableCell>
                  {isOwner && (
                    <TableCell className="text-right">
                      {!agreed &&
                        (l.correctedAt ? (
                          <span className="text-[11px] text-muted-foreground">Corrected</span>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-[12px]"
                            disabled={correctingId === l.id}
                            onClick={() => correct(l.id)}
                            data-testid={`count-correct-${l.id}`}
                          >
                            {correctingId === l.id ? "Correcting…" : "Correct"}
                          </Button>
                        ))}
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
