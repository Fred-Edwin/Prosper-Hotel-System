"use client";

/**
 * Confirm transfer — new nav destination, staff shell.
 *
 * 2026-08-13 canteen redesign (REQ-02 Part A). No design precedent existed
 * for "what was sent, enter what arrived, see the discrepancy" — confirmed
 * with Edwinfred not to be blind (unlike the handover count): the sent
 * quantity shows upfront, since this isn't a cash-handling control and
 * proposal.md §4 doesn't ask for it to be blind.
 *
 * Each pending transfer is a single item/quantity (Transfer has one itemId,
 * one sentQuantity — not a multi-line delivery), so this is a list of cards,
 * one confirm action per card, rather than a line-entry form like
 * receive-delivery.tsx. Reachable from the staff-shell pending-transfer
 * banner and from transfer-history.
 *
 * A short receipt on each confirmed card, including the shortfall if any —
 * proposal.md §4: "the gap is recorded as its own discrepancy... auto-
 * recorded" — the person confirming must see that happened, not a silent
 * write.
 */

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyFirstUse, ErrorState, PermissionDenied } from "@/components/patterns/states";
import { ArrowDownLeft, Check, AlertTriangle } from "lucide-react";
import type { PendingTransferForReader } from "../index";

export type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "denied" }
  | { status: "ready"; transfers: PendingTransferForReader[] };

async function fetchPendingTransfers(): Promise<LoadState> {
  try {
    const response = await fetch("/api/stock/transfers/pending");
    if (response.status === 403) return { status: "denied" };
    if (!response.ok) return { status: "error" };
    const body = await response.json();
    if (!Array.isArray(body?.transfers)) return { status: "error" };
    return { status: "ready", transfers: body.transfers };
  } catch {
    return { status: "error" };
  }
}

async function submitConfirm(
  transferId: string,
  confirmedQuantity: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const response = await fetch(`/api/stock/transfers/${transferId}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmedQuantity }),
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

export function ConfirmTransfer() {
  const [attempt, setAttempt] = useState(0);
  return <ConfirmTransferForAttempt key={attempt} onRetry={() => setAttempt((a) => a + 1)} />;
}

function ConfirmTransferForAttempt({ onRetry }: { onRetry: () => void }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    fetchPendingTransfers().then((result) => {
      if (!cancelled) setState(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return <ConfirmTransferView state={state} onRetry={onRetry} />;
}

type ConfirmedReceipt = { transferId: string; confirmedQuantity: number; shortfall: number };

/** The presentational half, driven by state rather than fetching — what
 * Storybook mounts to show every state without a network. */
export function ConfirmTransferView({
  state,
  onRetry = () => {},
  onConfirm = submitConfirm,
}: {
  state: LoadState;
  onRetry?: () => void;
  onConfirm?: typeof submitConfirm;
}) {
  const [receipts, setReceipts] = useState<Record<string, ConfirmedReceipt>>({});

  if (state.status === "loading") {
    return (
      <div className="space-y-2 p-3" data-testid="confirm-transfer-loading">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-lg" />
        ))}
      </div>
    );
  }

  if (state.status === "denied") {
    return (
      <div className="p-3">
        <PermissionDenied
          title="You can't confirm transfers"
          body="Ask the owner if you need access to receiving transfers."
        />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="p-3">
        <ErrorState what="pending transfers" onRetry={onRetry} />
      </div>
    );
  }

  const outstanding = state.transfers.filter((t) => !receipts[t.id]);

  if (state.transfers.length === 0) {
    return (
      <div className="p-3">
        <EmptyFirstUse
          icon={<ArrowDownLeft className="size-4" />}
          title="Nothing waiting to be confirmed"
          body="When stock is sent to your location, it will appear here for you to confirm what actually arrived."
        />
      </div>
    );
  }

  return (
    <div className="p-3" data-testid="confirm-transfer">
      {outstanding.length > 0 && (
        <p className="mb-2 text-[13px] text-muted-foreground">
          {outstanding.length} {outstanding.length === 1 ? "item" : "items"} waiting for you to
          confirm.
        </p>
      )}
      <div className="space-y-2">
        {state.transfers.map((transfer) =>
          receipts[transfer.id] ? (
            <ConfirmedCard key={transfer.id} transfer={transfer} receipt={receipts[transfer.id]} />
          ) : (
            <PendingCard
              key={transfer.id}
              transfer={transfer}
              onConfirm={onConfirm}
              onConfirmed={(receipt) =>
                setReceipts((r) => ({ ...r, [transfer.id]: receipt }))
              }
            />
          ),
        )}
      </div>
    </div>
  );
}

function PendingCard({
  transfer,
  onConfirm,
  onConfirmed,
}: {
  transfer: PendingTransferForReader;
  onConfirm: typeof submitConfirm;
  onConfirmed: (receipt: ConfirmedReceipt) => void;
}) {
  const [received, setReceived] = useState(String(transfer.sentQuantity));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const quantity = Number(received);
  const canConfirm = received !== "" && Number.isFinite(quantity) && quantity >= 0 && !submitting;

  const confirm = async () => {
    setSubmitting(true);
    setError(null);
    const result = await onConfirm(transfer.id, quantity);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onConfirmed({
      transferId: transfer.id,
      confirmedQuantity: quantity,
      shortfall: Math.max(0, transfer.sentQuantity - quantity),
    });
  };

  return (
    <div className="rounded-lg border bg-card p-3" data-testid="confirm-transfer-card">
      <div className="flex items-center gap-2">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <ArrowDownLeft className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium">{transfer.itemName}</p>
          <p className="text-[11px] text-muted-foreground">
            Sent {transfer.sentQuantity} · {new Date(transfer.sentAt).toLocaleString()}
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <label className="text-[11px] font-medium text-muted-foreground" htmlFor={`confirm-qty-${transfer.id}`}>
          You received
        </label>
        <Input
          id={`confirm-qty-${transfer.id}`}
          inputMode="numeric"
          value={received}
          onChange={(e) => setReceived(e.target.value)}
          className="h-9 w-24 text-right tabular-nums"
          data-testid={`confirm-transfer-quantity-${transfer.id}`}
        />
        <Button
          size="sm"
          className="ml-auto h-9"
          disabled={!canConfirm}
          onClick={confirm}
          data-testid={`confirm-transfer-submit-${transfer.id}`}
        >
          {submitting ? "Confirming…" : "Confirm"}
        </Button>
      </div>

      {error && (
        <p className="mt-2 text-[11px] text-destructive">
          Couldn&apos;t confirm. Nothing was lost — check the quantity and try again.
        </p>
      )}
    </div>
  );
}

function ConfirmedCard({
  transfer,
  receipt,
}: {
  transfer: PendingTransferForReader;
  receipt: ConfirmedReceipt;
}) {
  return (
    <div
      className="rounded-lg border border-success/30 bg-success-subtle p-3"
      data-testid="confirm-transfer-receipt"
    >
      <div className="flex items-center gap-2">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
          <Check className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium">{transfer.itemName} confirmed</p>
          <p className="text-[11px] text-muted-foreground">
            Sent {transfer.sentQuantity}, received {receipt.confirmedQuantity}
          </p>
        </div>
      </div>
      {receipt.shortfall > 0 && (
        <div
          className="mt-2 flex items-start gap-1.5 rounded-md border border-warning/40 bg-warning-subtle px-2 py-1.5"
          data-testid="confirm-transfer-shortfall"
        >
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" />
          <p className="text-[11px] text-foreground">
            {receipt.shortfall} short of what was sent — recorded as a discrepancy, separate from
            wastage.
          </p>
        </div>
      )}
    </div>
  );
}
