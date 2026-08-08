"use client";

/**
 * Staff-shell Today's sales — a read-only list of sales this staff member
 * recorded today, at their location, newest first, expanding in place to
 * show lines, payment breakdown and (once ticket 10 lands) a void action.
 *
 * No design-phase precedent (confirmed against the design-reference
 * worktree — no sale-history screen exists anywhere in it). Built as three
 * structurally different compositions and reviewed live in Storybook; this
 * one — expand-in-place, richer row preview — was chosen over a full-screen
 * drill-down (too close a copy of the till's own confirmation screen) and a
 * Sheet overlay (extra chrome for what is, on a phone, effectively still a
 * one-column list).
 */

import { useEffect, useRef, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/patterns/confirm-dialog";
import {
  EmptyFirstUse,
  ErrorState,
  PermissionDenied,
} from "@/components/patterns/states";
import { ChevronDown, Receipt } from "lucide-react";
import { money } from "@/shared/money";

export type SaleLineView = {
  id: string;
  productName: string;
  quantity: number;
  priceMinor: number;
};

export type PaymentLineView = {
  id: string;
  method: "cash" | "mpesa" | "credit";
  amountMinor: number;
  customerName: string | null;
};

export type SaleView = {
  id: string;
  fulfilment: "counter" | "delivery";
  customerName: string | null;
  totalMinor: number;
  deliveryFeeMinor: number | null;
  occurredAt: string;
  voided: boolean;
  staffMemberName: string;
  lines: SaleLineView[];
  paymentLines: PaymentLineView[];
};

export type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "denied" }
  | { status: "ready"; sales: SaleView[] };

async function fetchTodaysSales(): Promise<LoadState> {
  try {
    const response = await fetch("/api/sales/today");
    if (response.status === 403) return { status: "denied" };
    if (!response.ok) return { status: "error" };
    const body = await response.json();
    if (!Array.isArray(body?.sales)) return { status: "error" };
    return { status: "ready", sales: body.sales };
  } catch {
    return { status: "error" };
  }
}

async function voidSaleRequest(saleId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const response = await fetch(`/api/sales/${saleId}/void`, { method: "POST" });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      return { ok: false, error: body?.error ?? "unknown" };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "network" };
  }
}

export function TodaysSales() {
  const [attempt, setAttempt] = useState(0);
  return <TodaysSalesForAttempt key={attempt} onRetry={() => setAttempt((a) => a + 1)} />;
}

function TodaysSalesForAttempt({ onRetry }: { onRetry: () => void }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const cancelledRef = useRef(false);

  useEffect(() => {
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  const load = () => {
    fetchTodaysSales().then((result) => {
      if (!cancelledRef.current) setState(result);
    });
  };

  useEffect(load, []);

  return <TodaysSalesView state={state} onRetry={onRetry} onVoided={load} />;
}

function methodLabel(m: PaymentLineView["method"]) {
  if (m === "mpesa") return "M-Pesa";
  if (m === "credit") return "Credit";
  return "Cash";
}

function time(iso: string) {
  return new Date(iso).toLocaleTimeString("en-KE", { hour: "numeric", minute: "2-digit" });
}

/** The presentational half, driven by state rather than fetching — what
 * Storybook mounts to show every state without a network. */
export function TodaysSalesView({
  state,
  onRetry = () => {},
  onVoided = () => {},
  onVoid = voidSaleRequest,
}: {
  state: LoadState;
  onRetry?: () => void;
  /** Called after a void succeeds, so the caller can reload the list. */
  onVoided?: () => void;
  /** Overridable for Storybook, which has no API route to call. */
  onVoid?: (saleId: string) => Promise<{ ok: true } | { ok: false; error: string }>;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [confirmingVoidId, setConfirmingVoidId] = useState<string | null>(null);
  const [voidingId, setVoidingId] = useState<string | null>(null);
  const [voidErrorId, setVoidErrorId] = useState<string | null>(null);

  async function handleConfirmVoid(saleId: string) {
    setVoidingId(saleId);
    setVoidErrorId(null);
    const result = await onVoid(saleId);
    setVoidingId(null);
    if (!result.ok) {
      setVoidErrorId(saleId);
      return;
    }
    onVoided();
  }

  if (state.status === "loading") {
    return (
      <div className="p-3" data-testid="todays-sales-loading">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="mb-2 rounded-lg border bg-card p-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-2 h-3 w-40" />
          </div>
        ))}
      </div>
    );
  }

  if (state.status === "denied") {
    return (
      <div className="p-3">
        <PermissionDenied
          title="You can only see your own sales"
          body="Ask the owner if you need to see sales recorded by someone else."
        />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="p-3">
        <ErrorState what="today's sales" onRetry={onRetry} />
      </div>
    );
  }

  if (state.sales.length === 0) {
    return (
      <div className="p-3">
        <EmptyFirstUse
          icon={<Receipt className="size-4" />}
          title="No sales recorded yet"
          body="Sales you record today will appear here, newest first."
        />
      </div>
    );
  }

  return (
    <div className="p-3" data-testid="todays-sales-list">
      {state.sales.map((sale) => {
        const open = expanded === sale.id;
        const preview = sale.lines.map((l) => `${l.quantity}× ${l.productName}`).join(", ");

        return (
          <div
            key={sale.id}
            className={`mb-2 overflow-hidden rounded-lg border bg-card ${sale.voided ? "opacity-60" : ""}`}
            data-testid="todays-sales-row"
          >
            <button
              onClick={() => setExpanded(open ? null : sale.id)}
              className="flex w-full items-start gap-3 p-3 text-left"
              aria-expanded={open}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[15px] font-semibold tabular-nums">
                    {money(sale.totalMinor)}
                  </span>
                  {sale.fulfilment === "delivery" && (
                    <Badge variant="secondary" className="text-[10px]" data-testid="todays-sales-delivery-badge">
                      Delivery
                    </Badge>
                  )}
                  {sale.voided && (
                    <Badge variant="destructive" className="text-[10px]" data-testid="todays-sales-voided-badge">
                      Voided
                    </Badge>
                  )}
                  <span className="ml-auto text-[11px] text-muted-foreground">
                    {time(sale.occurredAt)}
                  </span>
                </div>
                <div className="mt-0.5 truncate text-[12px] text-muted-foreground">
                  {preview}
                  {sale.fulfilment === "delivery" && sale.customerName && ` · ${sale.customerName}`}
                </div>
              </div>
              <ChevronDown
                className={`mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform duration-100 ${
                  open ? "rotate-180" : ""
                }`}
              />
            </button>

            {open && (
              <div className="border-t bg-muted/25 p-3" data-testid="todays-sales-detail">
                <div className="space-y-1">
                  {sale.lines.map((l) => (
                    <div key={l.id} className="flex justify-between gap-3 text-[13px]">
                      <span className="min-w-0 truncate">
                        {l.quantity} × {l.productName}
                      </span>
                      <span className="shrink-0 tabular-nums">{money(l.quantity * l.priceMinor)}</span>
                    </div>
                  ))}
                  {sale.fulfilment === "delivery" && sale.deliveryFeeMinor != null && (
                    <div
                      className="flex justify-between gap-3 border-t pt-1 text-[13px]"
                      data-testid="todays-sales-delivery-fee"
                    >
                      <span className="min-w-0 truncate text-muted-foreground">Delivery fee</span>
                      <span className="shrink-0 tabular-nums">{money(sale.deliveryFeeMinor)}</span>
                    </div>
                  )}
                </div>
                {sale.fulfilment === "delivery" && sale.customerName && (
                  <p className="mt-2 text-[12px] text-muted-foreground" data-testid="todays-sales-delivery-customer">
                    Delivered to {sale.customerName}
                  </p>
                )}
                <div className="mt-2 space-y-1 border-t pt-2">
                  {sale.paymentLines.map((p) => (
                    <div key={p.id} className="flex justify-between gap-3 text-[13px]">
                      <span className="capitalize">
                        {methodLabel(p.method)}
                        {p.customerName && (
                          <span className="text-muted-foreground"> — {p.customerName}</span>
                        )}
                      </span>
                      <span className="tabular-nums">{money(p.amountMinor)}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Recorded by {sale.staffMemberName}
                </p>
                {!sale.voided && (
                  <div className="mt-3 border-t pt-3">
                    <Button
                      variant="destructive"
                      size="sm"
                      className="h-8 text-[12px]"
                      disabled={voidingId === sale.id}
                      onClick={() => setConfirmingVoidId(sale.id)}
                      data-testid="todays-sales-void-button"
                    >
                      {voidingId === sale.id ? "Voiding…" : "Void"}
                    </Button>
                    {voidErrorId === sale.id && (
                      <p className="mt-2 text-[12px] text-destructive" data-testid="todays-sales-void-error">
                        Couldn&apos;t void this sale. Try again.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {confirmingVoidId && (
        <ConfirmDialog
          open={true}
          onOpenChange={(v) => {
            if (!v) setConfirmingVoidId(null);
          }}
          title={`Void this sale (${money(
            state.sales.find((s) => s.id === confirmingVoidId)?.totalMinor ?? 0,
          )})?`}
          description="Stock and payment lines are reversed. The original sale stays visible, marked void. This cannot be undone."
          confirmLabel="Void sale"
          destructive
          onConfirm={() => {
            const id = confirmingVoidId;
            setConfirmingVoidId(null);
            handleConfirmVoid(id);
          }}
        />
      )}
    </div>
  );
}
