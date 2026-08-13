"use client";

/**
 * Sent transfers — reconciliation view, staff shell. New nav destination.
 *
 * 2026-08-13 canteen redesign, item 4 (store-manager mirror): "visibility
 * into whether the canteen's receipt reconciled cleanly (no shortfall) —
 * this could be as simple as showing confirmed transfers she sent, with
 * their confirmed-vs-sent quantities, somewhere she already looks."
 * Confirmed with Edwinfred not to invent a bigger screen for this — reuses
 * confirm-transfer.tsx's receipt-card visual language (same green/warning
 * treatment) rather than a new pattern, since it's the same fact ("did what
 * arrived match what left") viewed from the other side.
 *
 * transfer-history.tsx isn't reused here because it reconstructs from
 * movements, which don't yet reflect the two-sided Transfer model fully
 * (item 5's flagged gap) — this reads getConfirmedTransfersSentFromLocation
 * directly, the same Transfer-model source confirm-transfer.tsx uses.
 */

import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyFirstUse, ErrorState, PermissionDenied } from "@/components/patterns/states";
import { ArrowUpRight, Check, AlertTriangle } from "lucide-react";
import type { PendingTransferForReader } from "../index";

export type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "denied" }
  | { status: "ready"; transfers: PendingTransferForReader[] };

async function fetchConfirmedSentTransfers(): Promise<LoadState> {
  try {
    const response = await fetch("/api/stock/transfers/sent-confirmed");
    if (response.status === 403) return { status: "denied" };
    if (!response.ok) return { status: "error" };
    const body = await response.json();
    if (!Array.isArray(body?.transfers)) return { status: "error" };
    return { status: "ready", transfers: body.transfers };
  } catch {
    return { status: "error" };
  }
}

export function SentTransfers() {
  const [attempt, setAttempt] = useState(0);
  return <SentTransfersForAttempt key={attempt} onRetry={() => setAttempt((a) => a + 1)} />;
}

function SentTransfersForAttempt({ onRetry }: { onRetry: () => void }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    fetchConfirmedSentTransfers().then((result) => {
      if (!cancelled) setState(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return <SentTransfersView state={state} onRetry={onRetry} />;
}

/** The presentational half, driven by state rather than fetching — what
 * Storybook mounts to show every state without a network. */
export function SentTransfersView({
  state,
  onRetry = () => {},
}: {
  state: LoadState;
  onRetry?: () => void;
}) {
  if (state.status === "loading") {
    return (
      <div className="space-y-2 p-3" data-testid="sent-transfers-loading">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-lg" />
        ))}
      </div>
    );
  }

  if (state.status === "denied") {
    return (
      <div className="p-3">
        <PermissionDenied
          title="You can't view sent transfers"
          body="Ask the owner if you need access to transfer reconciliation."
        />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="p-3">
        <ErrorState what="sent transfers" onRetry={onRetry} />
      </div>
    );
  }

  if (state.transfers.length === 0) {
    return (
      <div className="p-3">
        <EmptyFirstUse
          icon={<ArrowUpRight className="size-4" />}
          title="Nothing confirmed yet"
          body="Once the other location confirms a transfer you sent, it will appear here so you can see whether it matched."
        />
      </div>
    );
  }

  const withShortfall = state.transfers.filter((t) => (t.confirmedQuantity ?? 0) < t.sentQuantity);

  return (
    <div className="p-3" data-testid="sent-transfers">
      <p className="mb-2 text-[13px] text-muted-foreground">
        {withShortfall.length > 0
          ? `${withShortfall.length} of ${state.transfers.length} recent transfers didn't fully reconcile.`
          : `Last ${state.transfers.length} confirmed — all reconciled.`}
      </p>
      <div className="space-y-2">
        {state.transfers.map((transfer) => {
          const confirmed = transfer.confirmedQuantity ?? 0;
          const shortfall = transfer.sentQuantity - confirmed;
          const reconciled = shortfall <= 0;
          return (
            <div
              key={transfer.id}
              className={`rounded-lg border p-3 ${
                reconciled ? "bg-card" : "border-warning/30 bg-warning-subtle"
              }`}
              data-testid="sent-transfer-card"
            >
              <div className="flex items-center gap-2">
                <div
                  className={`flex size-8 shrink-0 items-center justify-center rounded-full ${
                    reconciled ? "bg-success/15 text-success" : "bg-warning/15 text-warning"
                  }`}
                >
                  {reconciled ? <Check className="size-4" /> : <AlertTriangle className="size-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium">{transfer.itemName}</p>
                  <p className="text-[11px] text-muted-foreground">
                    Sent {transfer.sentQuantity}, confirmed {confirmed}
                    {transfer.confirmedAt && ` · ${new Date(transfer.confirmedAt).toLocaleDateString()}`}
                  </p>
                </div>
              </div>
              {!reconciled && (
                <p className="mt-1.5 text-[11px] text-foreground" data-testid="sent-transfer-shortfall">
                  {shortfall} short — recorded as a discrepancy at the receiving end.
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
