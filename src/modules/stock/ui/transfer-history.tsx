"use client";

import { useEffect, useState } from "react";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { EmptyFirstUse, ErrorState, PermissionDenied } from "@/components/patterns/states";
import { Skeleton } from "@/components/ui/skeleton";
import type { TransferHistoryEntry } from "../index";

export type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "denied" }
  | { status: "ready"; transfers: TransferHistoryEntry[] };

async function fetchTransfers(): Promise<LoadState> {
  try {
    const response = await fetch("/api/stock/transfers");
    if (response.status === 403) return { status: "denied" };
    if (!response.ok) return { status: "error" };
    const body = await response.json();
    if (!Array.isArray(body?.transfers)) return { status: "error" };
    return { status: "ready", transfers: body.transfers };
  } catch {
    return { status: "error" };
  }
}

export function TransferHistoryView() {
  const [attempt, setAttempt] = useState(0);
  return <TransferHistoryViewForAttempt key={attempt} onRetry={() => setAttempt((value) => value + 1)} />;
}

function TransferHistoryViewForAttempt({ onRetry }: { onRetry: () => void }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    fetchTransfers().then((result) => {
      if (!cancelled) setState(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const reverse = async (transferId: string) => {
    const response = await fetch(`/api/stock/transfers/${transferId}/reverse`, { method: "POST" });
    if (!response.ok) {
      toast.error("Couldn't record the reversal", { description: "Nothing changed — try again." });
      return;
    }
    toast.success("Reversal recorded", { description: "Stock has moved back and the original transfer remains visible." });
    onRetry();
  };

  const cancel = async (transferId: string) => {
    const response = await fetch(`/api/stock/transfers/${transferId}/cancel`, { method: "POST" });
    if (!response.ok) {
      toast.error("Couldn't cancel the transfer", { description: "Nothing changed — try again." });
      return;
    }
    toast.success("Transfer cancelled", { description: "Your stock is back — it never left." });
    onRetry();
  };

  return <TransferHistoryViewForState state={state} onRetry={onRetry} onReverse={reverse} onCancel={cancel} />;
}

/** The presentational half, driven by state rather than fetching — this is
 * what Storybook mounts to show every state without a network. */
export function TransferHistoryViewForState({
  state,
  onRetry = () => {},
  onReverse = async () => {},
  onCancel = async () => {},
}: {
  state: LoadState;
  onRetry?: () => void;
  onReverse?: (transferId: string) => Promise<void>;
  onCancel?: (transferId: string) => Promise<void>;
}) {
  const [pendingAction, setPendingAction] = useState<{ entry: TransferHistoryEntry; kind: "cancel" | "reverse" } | null>(null);
  const [detail, setDetail] = useState<TransferHistoryEntry | null>(null);

  if (state.status === "loading") {
    return (
      <div className="space-y-2 p-3" data-testid="transfer-history-loading">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="flex items-center gap-3 rounded-lg border bg-card p-3">
            <Skeleton className="size-9 shrink-0 rounded-full" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-3 w-12 shrink-0" />
          </div>
        ))}
      </div>
    );
  }

  if (state.status === "denied") {
    return (
      <div className="p-3">
        <PermissionDenied
          title="You can't view stock transfers"
          body="Ask the owner if you need access to transfer history."
        />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="p-3">
        <ErrorState what="transfers" onRetry={onRetry} preserved="Nothing was lost." />
      </div>
    );
  }

  if (state.transfers.length === 0) {
    return (
      <div className="p-3">
        <EmptyFirstUse
          icon={<ArrowLeftRight className="size-4" />}
          title="No transfers yet"
          body="Once stock moves between locations, it will be listed here."
        />
      </div>
    );
  }

  if (detail) {
    return (
      <TransferDetail
        entry={detail}
        onBack={() => setDetail(null)}
        onCancel={() => setPendingAction({ entry: detail, kind: "cancel" })}
        onUndo={() => setPendingAction({ entry: detail, kind: "reverse" })}
      />
    );
  }

  return (
    <div className="flex min-h-full flex-col" data-testid="transfer-history">
      <section className="border-b bg-card p-3">
        <p className="text-sm font-medium">Transfers involving your location</p>
        <p className="mt-1 text-xs text-muted-foreground">Sent and received stock, pending, confirmed or cancelled.</p>
      </section>
      <section className="flex-1 p-3">
        <div className="divide-y rounded-lg border bg-card" data-testid="transfer-history-list">
          {state.transfers.map((entry) => (
            <HistoryRow
              key={entry.transferId}
              entry={entry}
              onOpen={() => setDetail(entry)}
              onCancel={() => setPendingAction({ entry, kind: "cancel" })}
              onUndo={() => setPendingAction({ entry, kind: "reverse" })}
            />
          ))}
        </div>
      </section>
      <ActionSheet
        selected={pendingAction}
        onClose={() => setPendingAction(null)}
        onConfirm={async () => {
          if (!pendingAction) return;
          if (pendingAction.kind === "cancel") await onCancel(pendingAction.entry.transferId);
          else await onReverse(pendingAction.entry.transferId);
          setPendingAction(null);
          setDetail(null);
        }}
      />
    </div>
  );
}

function summarize(entry: TransferHistoryEntry): string {
  return entry.lines.map((line) => `${line.quantity} ${line.unit} ${line.name}`).join(", ");
}

function counterpartLabel(entry: TransferHistoryEntry): string {
  return entry.direction === "sent" ? `Sent to ${entry.counterpartLocationName}` : `Received from ${entry.counterpartLocationName}`;
}

function statusLabel(entry: TransferHistoryEntry): string {
  if (entry.status === "pending") return "Awaiting confirmation";
  if (entry.status === "cancelled") return "Cancelled";
  if (entry.confirmedQuantity !== null && entry.confirmedQuantity < entry.lines[0]?.quantity) {
    return `Confirmed short — ${entry.confirmedQuantity} of ${entry.lines[0]?.quantity}`;
  }
  return "Confirmed";
}

function canCancel(entry: TransferHistoryEntry): boolean {
  return entry.direction === "sent" && entry.status === "pending";
}

function canUndo(entry: TransferHistoryEntry): boolean {
  return entry.direction === "sent" && entry.status === "confirmed" && !entry.reversed;
}

function HistoryRow({
  entry,
  onOpen,
  onCancel,
  onUndo,
}: {
  entry: TransferHistoryEntry;
  onOpen: () => void;
  onCancel: () => void;
  onUndo: () => void;
}) {
  const Icon = entry.direction === "sent" ? ArrowUpRight : ArrowDownLeft;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => event.key === "Enter" && onOpen()}
      className="flex cursor-pointer items-center gap-3 p-3 transition-colors duration-100 hover:bg-muted"
      data-testid="transfer-history-row"
    >
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{counterpartLabel(entry)}</p>
        <p className="truncate text-xs text-muted-foreground">
          {entry.lines.length} {entry.lines.length === 1 ? "item" : "items"} · {summarize(entry)}
        </p>
        <p className="truncate text-xs text-muted-foreground">{statusLabel(entry)}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className="text-xs text-muted-foreground">{new Date(entry.occurredAt).toLocaleString()}</span>
        {canCancel(entry) && (
          <Button
            variant="ghost"
            size="xs"
            onClick={(event) => {
              event.stopPropagation();
              onCancel();
            }}
          >
            Cancel
          </Button>
        )}
        {canUndo(entry) && (
          <Button
            variant="ghost"
            size="xs"
            onClick={(event) => {
              event.stopPropagation();
              onUndo();
            }}
          >
            <RotateCcw /> Undo
          </Button>
        )}
      </div>
    </div>
  );
}

function TransferDetail({
  entry,
  onBack,
  onCancel,
  onUndo,
}: {
  entry: TransferHistoryEntry;
  onBack: () => void;
  onCancel: () => void;
  onUndo: () => void;
}) {
  return (
    <div className="flex min-h-full flex-col" data-testid="transfer-detail">
      <section className="border-b bg-card p-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          Back to transfers
        </Button>
        <div className="mt-3 flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 p-3">
          <div>
            <p className="text-xs text-muted-foreground">
              {entry.direction === "sent" ? `You → ${entry.counterpartLocationName}` : `${entry.counterpartLocationName} → You`}
            </p>
            <p className="mt-1 text-sm font-medium">{counterpartLabel(entry)}</p>
            <p className="mt-1 text-xs text-muted-foreground">{statusLabel(entry)}</p>
          </div>
          <span className="text-xs text-muted-foreground">{new Date(entry.occurredAt).toLocaleString()}</span>
        </div>
      </section>
      <section className="flex-1 p-3">
        <p className="mb-2 text-xs font-medium text-muted-foreground">ITEMS TRANSFERRED</p>
        <div className="divide-y rounded-lg border bg-card">
          {entry.lines.map((line) => (
            <div key={line.itemId} className="flex items-center justify-between gap-3 p-3">
              <span className="text-sm font-medium">{line.name}</span>
              <span className="shrink-0 text-sm font-medium tabular-nums">
                {line.quantity} {line.unit}
              </span>
            </div>
          ))}
        </div>
      </section>
      {canCancel(entry) && (
        <div className="border-t bg-card p-3">
          <Button className="h-12 w-full" variant="outline" onClick={onCancel}>
            Cancel transfer
          </Button>
        </div>
      )}
      {canUndo(entry) && (
        <div className="border-t bg-card p-3">
          <Button className="h-12 w-full" onClick={onUndo}>
            <RotateCcw /> Undo transfer
          </Button>
        </div>
      )}
    </div>
  );
}

function ActionSheet({
  selected,
  onClose,
  onConfirm,
}: {
  selected: { entry: TransferHistoryEntry; kind: "cancel" | "reverse" } | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const entry = selected?.entry ?? null;
  const isCancel = selected?.kind === "cancel";
  return (
    <Sheet open={selected !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="rounded-t-xl">
        <SheetHeader>
          <SheetTitle>
            {isCancel ? "Cancel" : "Undo"} transfer of {entry ? summarize(entry) : "this transfer"}?
          </SheetTitle>
          <SheetDescription>
            {isCancel
              ? "This location never sent it — the stock stays here. The original send remains in the history."
              : "This records a new reversing transfer. The original remains in the history."}
          </SheetDescription>
        </SheetHeader>
        {entry && (
          <div className="mx-4 rounded-lg border bg-muted/40 p-3">
            <p className="text-sm font-medium">{summarize(entry)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {isCancel
                ? "Nothing left this location — cancelling just marks the send void."
                : `Stock will return from ${entry.counterpartLocationName} immediately.`}
            </p>
          </div>
        )}
        <SheetFooter>
          <Button className="h-12" onClick={onConfirm}>
            {isCancel ? "Cancel transfer" : "Record reversal"}
          </Button>
          <Button variant="outline" className="h-12" onClick={onClose}>
            Keep transfer
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
