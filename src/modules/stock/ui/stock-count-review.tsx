"use client";

/**
 * Owner's stock count review/correct table — desktop-oriented, under the
 * admin Stock destination. Ticket 20.
 *
 * Shows the current/most recent count at a location: expected, counted and
 * difference per line, disagreeing lines flagged the same visual language
 * ticket 14 used for handover mismatches (dashboard-handovers.tsx —
 * `data-agreed` on the row, "Agreed" text vs. a highlighted destructive
 * figure).
 *
 * Correction is not a single tap. The owner investigates off-system, then
 * enters what she determines the actual correct quantity is — the input is
 * pre-filled with the counted value (the common case is "yes, the count
 * was right") but editable before submitting. No comparison-table-with-
 * inline-correction-input precedent exists in admin-stock-table.tsx or the
 * design-reference worktree (checked before building) — this is a new
 * composition, kept to the same Table primitives stock-count-detail.tsx
 * already used rather than RecordTable, because RecordTable's Column.cell
 * has no room for a stateful per-row input.
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
import { Input } from "@/components/ui/input";
import { LoadingTable, ErrorState, EmptyFirstUse } from "@/components/patterns/states";
import { ClipboardList } from "lucide-react";

export type ReviewLine = {
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
  | { status: "ready"; countId: string | null; lines: ReviewLine[] | null };

async function fetchLatestCount(locationId: string): Promise<LoadState> {
  try {
    const response = await fetch(`/api/stock/counts/latest/${locationId}`);
    if (!response.ok) return { status: "error" };
    const body = await response.json();
    return {
      status: "ready",
      countId: body.count?.id ?? null,
      lines: body.count?.lines ?? null,
    };
  } catch {
    return { status: "error" };
  }
}

async function submitCorrection(
  countId: string,
  lineId: string,
  correctedQuantity: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const response = await fetch(`/api/stock/counts/${countId}/correct`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lineId, correctedQuantity }),
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

export function StockCountReview({ locationId }: { locationId: string }) {
  const [attempt, setAttempt] = useState(0);
  return (
    <StockCountReviewForAttempt
      key={`${locationId}-${attempt}`}
      locationId={locationId}
      onRetry={() => setAttempt((a) => a + 1)}
    />
  );
}

function StockCountReviewForAttempt({
  locationId,
  onRetry,
}: {
  locationId: string;
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
    fetchLatestCount(locationId).then((result) => {
      if (!cancelledRef.current) setState(result);
    });
  }, [locationId]);

  const onCorrected = (lineId: string) => {
    setState((s) => {
      if (s.status !== "ready" || !s.lines) return s;
      return {
        ...s,
        lines: s.lines.map((l) =>
          l.id === lineId ? { ...l, correctedAt: new Date().toISOString() } : l,
        ),
      };
    });
  };

  return <StockCountReviewView state={state} onRetry={onRetry} onCorrected={onCorrected} />;
}

/** The presentational half — what Storybook mounts to show every state
 * without a network. `initialCorrectingId` exists only so Storybook can
 * show the correction input open without simulating a click — the
 * component drives this state itself in every real caller. */
export function StockCountReviewView({
  state,
  onRetry = () => {},
  onCorrected = () => {},
  onCorrect = submitCorrection,
  initialCorrectingId = null,
}: {
  state: LoadState;
  onRetry?: () => void;
  onCorrected?: (lineId: string) => void;
  onCorrect?: typeof submitCorrection;
  initialCorrectingId?: string | null;
}) {
  const [correctingId, setCorrectingId] = useState<string | null>(initialCorrectingId);
  const [draftQuantity, setDraftQuantity] = useState<string>(() => {
    if (!initialCorrectingId || state.status !== "ready" || !state.lines) return "";
    const line = state.lines.find((l) => l.id === initialCorrectingId);
    return line ? String(line.countedQuantity) : "";
  });
  const [correctError, setCorrectError] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  if (state.status === "loading") {
    return <LoadingTable summary={0} rows={6} columns={5} />;
  }

  if (state.status === "error") {
    return <ErrorState what="the latest stock count" onRetry={onRetry} />;
  }

  if (!state.lines || state.lines.length === 0) {
    return (
      <EmptyFirstUse
        icon={<ClipboardList className="size-4" />}
        title="No stock count recorded yet"
        body="Once a count is recorded here, expected, counted and any difference will be listed for review."
      />
    );
  }

  const lines = state.lines;
  const problems = lines.filter((l) => l.countedQuantity !== l.expectedQuantity);

  const startCorrecting = (line: ReviewLine) => {
    setCorrectingId(line.id);
    setDraftQuantity(String(line.countedQuantity));
    setCorrectError(null);
  };

  const cancelCorrecting = () => {
    setCorrectingId(null);
    setCorrectError(null);
  };

  const submit = async (lineId: string) => {
    if (!state.countId) return;
    const quantity = Number(draftQuantity);
    if (draftQuantity === "" || Number.isNaN(quantity) || quantity < 0) return;

    setSubmittingId(lineId);
    setCorrectError(null);
    const result = await onCorrect(state.countId, lineId, quantity);
    setSubmittingId(null);
    if (!result.ok) {
      setCorrectError(result.error);
      return;
    }
    setCorrectingId(null);
    onCorrected(lineId);
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-medium">Latest stock count</h2>
        </div>
        {problems.length > 0 ? (
          <Badge
            variant="outline"
            className="border-destructive/30 bg-destructive/10 text-destructive"
            data-testid="count-review-problem-badge"
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
        <p className="mb-2 text-[12px] text-destructive">
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
              <TableHead className="w-56 text-right">Correction</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.map((l) => {
              const diff = l.countedQuantity - l.expectedQuantity;
              const agreed = diff === 0;
              const isCorrecting = correctingId === l.id;
              return (
                <TableRow key={l.id} data-testid="count-review-row" data-agreed={agreed}>
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
                  <TableCell className="text-right">
                    {agreed ? null : l.correctedAt ? (
                      <span className="text-[11px] text-muted-foreground">Corrected</span>
                    ) : isCorrecting ? (
                      <div className="flex items-center justify-end gap-1.5">
                        <Input
                          inputMode="numeric"
                          value={draftQuantity}
                          onChange={(e) => setDraftQuantity(e.target.value)}
                          className="h-7 w-20 text-right text-[12px]"
                          data-testid={`count-review-input-${l.id}`}
                          autoFocus
                        />
                        <Button
                          size="sm"
                          className="h-7 text-[12px]"
                          disabled={submittingId === l.id}
                          onClick={() => submit(l.id)}
                          data-testid={`count-review-confirm-${l.id}`}
                        >
                          {submittingId === l.id ? "Saving…" : "Confirm"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-[12px]"
                          disabled={submittingId === l.id}
                          onClick={cancelCorrecting}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-[12px]"
                        onClick={() => startCorrecting(l)}
                        data-testid={`count-review-correct-${l.id}`}
                      >
                        Correct
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
