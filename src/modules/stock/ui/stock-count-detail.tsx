"use client";

/**
 * Stock count detail — the staff read view of a recorded count. Ticket 20.
 *
 * Counted quantity only. No expected figure, no difference, no agree/flag
 * language — showing the system's expected figure to whoever did the
 * physical count would anchor her count to what the system already
 * believes, undermining the count's value as an independent check. This
 * is true for a store manager viewing her own just-recorded count too, not
 * just someone else's.
 *
 * getStockCount strips expectedQuantity from the response for a non-owner
 * caller (stock/logic.ts) — this view never receives the comparison at
 * all, rather than receiving it and choosing not to render it. The owner's
 * comparison table is a separate component (stock-count-review.tsx),
 * desktop-oriented, under the admin Stock destination.
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
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState, PermissionDenied } from "@/components/patterns/states";
import { ClipboardList } from "lucide-react";

export type CountLine = {
  id: string;
  itemType: "product" | "ingredient";
  itemName: string;
  countedQuantity: number;
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

export function StockCountDetail({ countId }: { countId: string }) {
  const [attempt, setAttempt] = useState(0);
  return (
    <StockCountDetailForAttempt
      key={attempt}
      countId={countId}
      onRetry={() => setAttempt((a) => a + 1)}
    />
  );
}

function StockCountDetailForAttempt({
  countId,
  onRetry,
}: {
  countId: string;
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

  return <StockCountDetailView state={state} onRetry={onRetry} />;
}

/** The presentational half — what Storybook mounts to show every state
 * without a network. */
export function StockCountDetailView({
  state,
  onRetry = () => {},
}: {
  state: LoadState;
  onRetry?: () => void;
}) {
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

  return (
    <div className="p-3">
      <div className="mb-3 flex items-center gap-2">
        <ClipboardList className="size-4 text-muted-foreground" />
        <h2 className="text-sm font-medium">Stock count</h2>
      </div>

      <div className="overflow-hidden rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead className="w-24 text-right">Counted</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {state.lines.map((l) => (
              <TableRow key={l.id} data-testid="count-detail-row">
                <TableCell className="font-medium">{l.itemName}</TableCell>
                <TableCell className="tabular-nums text-right">{l.countedQuantity}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
