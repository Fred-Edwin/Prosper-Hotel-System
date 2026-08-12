"use client";

/**
 * Ticket 32 — the outstanding drawings balance, a "Record repayment"
 * action, and a short reversible list of past repayments. Sits below
 * RunningBalanceStrip on the money-out screen, secondary to the main
 * expense list — the same destination, not a new nav entry.
 */

import { useState } from "react";
import { EditSheet } from "@/components/patterns/detail-page";
import { ConfirmDialog } from "@/components/patterns/confirm-dialog";
import { ErrorState } from "@/components/patterns/states";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Field } from "@/components/patterns/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { money } from "@/shared/money";
import { Plus, Undo2 } from "lucide-react";

export type DrawingRepaymentPaymentMethod = "cash" | "mpesa";

const paymentMethodLabel: Record<DrawingRepaymentPaymentMethod, string> = {
  cash: "Cash",
  mpesa: "M-Pesa",
};

export type DrawingRepaymentView = {
  id: string;
  amountMinor: number;
  paymentMethod: DrawingRepaymentPaymentMethod;
  occurredAt: string;
  reversed: boolean;
};

export type BalanceState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "denied" }
  | { status: "ready"; outstandingMinor: number };

export type RepaymentListState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "denied" }
  | { status: "ready"; repayments: DrawingRepaymentView[] };

async function fetchDrawingDebt(): Promise<BalanceState> {
  try {
    const response = await fetch("/api/cash/drawing-debt");
    if (response.status === 403) return { status: "denied" };
    if (!response.ok) return { status: "error" };
    const body = await response.json();
    if (typeof body?.outstandingMinor !== "number") return { status: "error" };
    return { status: "ready", outstandingMinor: body.outstandingMinor };
  } catch {
    return { status: "error" };
  }
}

async function fetchDrawingRepayments(): Promise<RepaymentListState> {
  try {
    const response = await fetch("/api/cash/drawing-repayments");
    if (response.status === 403) return { status: "denied" };
    if (!response.ok) return { status: "error" };
    const body = await response.json();
    if (!Array.isArray(body?.repayments)) return { status: "error" };
    return { status: "ready", repayments: body.repayments };
  } catch {
    return { status: "error" };
  }
}

async function submitDrawingRepayment(
  amountMinor: number,
  paymentMethod: DrawingRepaymentPaymentMethod,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const response = await fetch("/api/cash/drawing-repayments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amountMinor, paymentMethod }),
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

async function reverseDrawingRepaymentRequest(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const response = await fetch(`/api/cash/drawing-repayments/${id}/reverse`, { method: "POST" });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      return { ok: false, error: body?.error ?? "unknown" };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "network" };
  }
}

const repaymentErrorLabel: Record<string, string> = {
  invalid_amount: "Enter an amount greater than zero.",
  exceeds_outstanding: "That's more than what's currently owed.",
};

function RecordRepaymentSheet({
  outstandingMinor,
  onSave,
}: {
  outstandingMinor: number;
  onSave: (
    amountMinor: number,
    paymentMethod: DrawingRepaymentPaymentMethod,
  ) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<DrawingRepaymentPaymentMethod>("cash");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const reset = () => {
    setAmount("");
    setPaymentMethod("cash");
    setError(undefined);
  };

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="h-8"
        onClick={() => setOpen(true)}
        data-testid="record-drawing-repayment-open"
      >
        <Plus className="size-3.5" /> Record repayment
      </Button>

      <EditSheet
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) reset();
        }}
        title="Record a drawings repayment"
        description={`Currently owed: ${money(outstandingMinor)}.`}
        saveLabel="Record repayment"
        saving={saving}
        formId="record-drawing-repayment-form"
      >
        <form
          id="record-drawing-repayment-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setSaving(true);
            setError(undefined);
            const result = await onSave(Number(amount), paymentMethod);
            setSaving(false);
            if (result.ok) {
              setOpen(false);
              reset();
            } else {
              setError(result.error);
            }
          }}
        >
          <Field label="Amount" required>
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              max={outstandingMinor}
              required
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="h-9"
              data-testid="drawing-repayment-amount"
            />
          </Field>
          <Field label="Received via" required>
            <Select
              value={paymentMethod}
              onValueChange={(v) => setPaymentMethod(v as DrawingRepaymentPaymentMethod)}
            >
              <SelectTrigger className="h-9 w-full" data-testid="drawing-repayment-method">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(paymentMethodLabel) as DrawingRepaymentPaymentMethod[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {paymentMethodLabel[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {error && (
            <p className="mt-3 text-xs text-destructive" data-testid="record-drawing-repayment-error">
              {repaymentErrorLabel[error] ?? "Couldn't record this repayment. Try again."}
            </p>
          )}
        </form>
      </EditSheet>
    </>
  );
}

function date(iso: string) {
  return new Date(iso).toLocaleDateString("en-KE", { day: "numeric", month: "short" });
}

export function DrawingRepaymentCard({
  balanceState,
  listState,
  onRetryBalance,
  onRetryList,
  onSave,
  onReverse,
  reversingId,
}: {
  balanceState: BalanceState;
  listState: RepaymentListState;
  onRetryBalance: () => void;
  onRetryList: () => void;
  onSave: (
    amountMinor: number,
    paymentMethod: DrawingRepaymentPaymentMethod,
  ) => Promise<{ ok: boolean; error?: string }>;
  onReverse: (id: string) => void;
  reversingId: string | null;
}) {
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  if (balanceState.status === "denied") return null;

  const repayments = listState.status === "ready" ? listState.repayments : [];
  const confirming = repayments.find((r) => r.id === confirmingId) ?? null;

  return (
    <div className="mb-4 rounded-lg border p-4" data-testid="drawing-repayment-card">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-muted-foreground">Owner&apos;s drawings owed</p>
          {balanceState.status === "loading" && (
            <>
              <Skeleton className="mt-2 h-6 w-28" />
            </>
          )}
          {balanceState.status === "error" && (
            <p className="mt-1 text-xs text-destructive">Couldn&apos;t load the outstanding balance.</p>
          )}
          {balanceState.status === "ready" && (
            <p className="mt-1 text-lg font-semibold tabular" data-testid="drawing-debt-outstanding">
              {money(balanceState.outstandingMinor)}
            </p>
          )}
        </div>
        {balanceState.status === "ready" && balanceState.outstandingMinor > 0 && (
          <RecordRepaymentSheet outstandingMinor={balanceState.outstandingMinor} onSave={onSave} />
        )}
        {balanceState.status === "error" && (
          <Button size="sm" variant="outline" className="h-8" onClick={onRetryBalance}>
            Retry
          </Button>
        )}
      </div>

      {balanceState.status === "ready" && balanceState.outstandingMinor === 0 && repayments.length === 0 && (
        <p className="mt-2 text-xs text-muted-foreground" data-testid="drawing-debt-empty">
          No drawings debt outstanding.
        </p>
      )}

      {listState.status === "error" && (
        <div className="mt-3">
          <ErrorState what="repayment history" onRetry={onRetryList} />
        </div>
      )}

      {repayments.length > 0 && (
        <ul className="mt-3 space-y-1.5 border-t pt-3">
          {repayments.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2 text-xs">
              <span className={r.reversed ? "text-muted-foreground line-through" : "text-foreground"}>
                {money(r.amountMinor)} — {paymentMethodLabel[r.paymentMethod]} — {date(r.occurredAt)}
              </span>
              {!r.reversed && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 gap-1 text-[11px] text-muted-foreground"
                  disabled={reversingId === r.id}
                  onClick={() => setConfirmingId(r.id)}
                >
                  <Undo2 className="size-3" />
                  {reversingId === r.id ? "Reversing…" : "Reverse"}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {confirming && (
        <ConfirmDialog
          open={true}
          onOpenChange={(v) => {
            if (!v) setConfirmingId(null);
          }}
          title={`Reverse this repayment (${money(confirming.amountMinor)})?`}
          description="The original stays visible, marked reversed, and the outstanding balance goes back up. This cannot be undone."
          confirmLabel="Reverse repayment"
          destructive
          onConfirm={() => {
            const id = confirming.id;
            setConfirmingId(null);
            onReverse(id);
          }}
        />
      )}
    </div>
  );
}

export { fetchDrawingDebt, fetchDrawingRepayments, submitDrawingRepayment, reverseDrawingRepaymentRequest };
