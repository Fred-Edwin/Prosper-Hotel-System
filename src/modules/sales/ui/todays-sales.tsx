"use client";

/**
 * Staff-shell Today's summary (renamed from "Today's sales" 2026-08-13,
 * REQ-02 Part B) — a read-only list of sales this staff member recorded
 * today, at their location, newest first, expanding in place to show
 * lines, payment breakdown and (once ticket 10 lands) a void action.
 *
 * No design-phase precedent (confirmed against the design-reference
 * worktree — no sale-history screen exists anywhere in it). Built as three
 * structurally different compositions and reviewed live in Storybook; this
 * one — expand-in-place, richer row preview — was chosen over a full-screen
 * drill-down (too close a copy of the till's own confirmation screen) and a
 * Sheet overlay (extra chrome for what is, on a phone, effectively still a
 * one-column list).
 *
 * For the attendant only, a summary strip above the list — REQ-02 Part B's
 * expanded content (sales recorded today, transfers received/sent today,
 * closing stock). Cashier and store-manager content is unchanged. Composed
 * from data shapes already decided elsewhere (listTransfersAtLocation,
 * getCurrentStockAtLocationBySource) rather than a new read.
 *
 * 2026-08-15: the canteen no longer records sales individually — a stock
 * count writes them instead (docs/scope.md's 2026-08-15 entry). Each row
 * below is still a real Sale record either way, dated to whatever produced
 * it (a counter sale's own moment, or a count's occurredAt) — this list
 * reads the Sale table unchanged, so a count-derived sale shows up here the
 * same as any other, one row per count that produced a shortfall, its
 * lines being whichever products came up short in that count.
 */

import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/patterns/confirm-dialog";
import { SummaryStrip, type Summary } from "@/components/patterns/summary-strip";
import {
  EmptyFirstUse,
  ErrorState,
  PermissionDenied,
} from "@/components/patterns/states";
import { ChevronDown, Receipt } from "lucide-react";
import { money } from "@/shared/money";
import type { StaffRole } from "@/components/layout/staff-nav";
import type { TransferHistoryEntry, StockLevel } from "@/modules/stock";

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

async function fetchTransferHistory(): Promise<TransferHistoryEntry[] | null> {
  try {
    const response = await fetch("/api/stock/transfers");
    if (!response.ok) return null;
    const body = await response.json();
    if (!Array.isArray(body?.transfers)) return null;
    return body.transfers;
  } catch {
    return null;
  }
}

// Ticket 53: StockLevel always carries isOwn (Product.locationId) now, so
// the plain endpoint has everything the attendant summary needs — no more
// isCanteen-conditional by-source fetch.
async function fetchClosingStock(locationId: string): Promise<StockLevel[] | null> {
  try {
    const response = await fetch(`/api/stock/${locationId}`);
    if (!response.ok) return null;
    const body = await response.json();
    if (!Array.isArray(body?.levels)) return null;
    return body.levels;
  } catch {
    return null;
  }
}

export type AttendantSummaryState =
  | { status: "loading" }
  | { status: "ready"; transfers: TransferHistoryEntry[] | null; stockLevels: StockLevel[] | null };

export function TodaysSales({
  role,
  locationId,
  isCanteen = false,
  onOpen,
}: {
  /** Attendant gets the expanded REQ-02 Part B summary; cashier and
   * store-manager keep the unchanged sales-only view. */
  role?: StaffRole;
  /** Required to load the attendant summary's transfer/stock figures. */
  locationId?: string;
  isCanteen?: boolean;
  onOpen?: (destination: string) => void;
}) {
  const [attempt, setAttempt] = useState(0);
  return (
    <TodaysSalesForAttempt
      key={attempt}
      role={role}
      locationId={locationId}
      isCanteen={isCanteen}
      onOpen={onOpen}
      onRetry={() => setAttempt((a) => a + 1)}
    />
  );
}

function TodaysSalesForAttempt({
  role,
  locationId,
  isCanteen,
  onOpen,
  onRetry,
}: {
  role?: StaffRole;
  locationId?: string;
  isCanteen: boolean;
  onOpen?: (destination: string) => void;
  onRetry: () => void;
}) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [summary, setSummary] = useState<AttendantSummaryState>({ status: "loading" });

  // A per-call closure flag rather than a shared ref (BUG-03) — a ref set
  // true by StrictMode's dev-only mount/unmount/remount cycle stays true
  // across the remount, since useRef's value (unlike useState/useEffect)
  // isn't reset by that cycle, permanently discarding every future load()
  // result including retries.
  const load = () => {
    let cancelled = false;
    fetchTodaysSales().then((result) => {
      if (!cancelled) setState(result);
    });
    return () => {
      cancelled = true;
    };
  };

  useEffect(load, []);

  useEffect(() => {
    if (role !== "attendant" || !locationId) return;
    let cancelled = false;
    Promise.all([fetchTransferHistory(), fetchClosingStock(locationId)]).then(([transfers, stockLevels]) => {
      if (!cancelled) setSummary({ status: "ready", transfers, stockLevels });
    });
    return () => {
      cancelled = true;
    };
  }, [role, locationId, isCanteen]);

  return (
    <TodaysSalesView
      state={state}
      onRetry={onRetry}
      onVoided={load}
      attendantSummary={role === "attendant" ? summary : undefined}
      onOpen={onOpen}
    />
  );
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
  attendantSummary,
  onOpen,
}: {
  state: LoadState;
  onRetry?: () => void;
  /** Called after a void succeeds, so the caller can reload the list. */
  onVoided?: () => void;
  /** Overridable for Storybook, which has no API route to call. */
  onVoid?: (saleId: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  /** Present only for the attendant — REQ-02 Part B's expanded summary. */
  attendantSummary?: AttendantSummaryState;
  onOpen?: (destination: string) => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [confirmingVoidId, setConfirmingVoidId] = useState<string | null>(null);
  const [voidingId, setVoidingId] = useState<string | null>(null);
  const [voidErrorId, setVoidErrorId] = useState<string | null>(null);
  const [voidError, setVoidError] = useState<string | null>(null);

  async function handleConfirmVoid(saleId: string) {
    setVoidingId(saleId);
    setVoidErrorId(null);
    setVoidError(null);
    const result = await onVoid(saleId);
    setVoidingId(null);
    if (!result.ok) {
      setVoidErrorId(saleId);
      setVoidError(result.error);
      return;
    }
    onVoided();
  }

  const summaryStrip = attendantSummary && (
    <AttendantSummary
      summary={attendantSummary}
      salesTotalMinor={state.status === "ready" ? soldTotalMinor(state.sales) : 0}
      onOpen={onOpen}
    />
  );

  if (state.status === "loading") {
    return (
      <div className="p-3" data-testid="todays-sales-loading">
        {summaryStrip}
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
        {summaryStrip}
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
      {summaryStrip}
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
                        {voidError === "day_closed"
                          ? "This day is closed — ask the owner."
                          : "Couldn't void this sale. Try again."}
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

/** Cash + M-Pesa combined, excluding credit — the till figure a cashier
 * cares about, not the invoiced total. Voided sales excluded.
 *
 * A canteen sale carries no payment line at all (CONTEXT.md's Sale entry —
 * true whether it was individually recorded, in the retired 2026-08-13
 * model, or count-derived now): reconciled against the day's handover total
 * instead, not split at the point of sale. Falling back to totalMinor for
 * the no-payment-line case is what makes this figure include those sales
 * at all; filtering only on paymentLines would leave every canteen sale
 * silently uncounted here. */
function soldTotalMinor(sales: SaleView[]): number {
  return sales
    .filter((sale) => !sale.voided)
    .reduce((sum, sale) => {
      if (sale.paymentLines.length === 0) return sum + sale.totalMinor;
      const cashAndMpesa = sale.paymentLines
        .filter((line) => line.method === "cash" || line.method === "mpesa")
        .reduce((lineSum, line) => lineSum + line.amountMinor, 0);
      return sum + cashAndMpesa;
    }, 0);
}

function isToday(occurredAt: Date): boolean {
  const now = new Date();
  return (
    occurredAt.getFullYear() === now.getFullYear() &&
    occurredAt.getMonth() === now.getMonth() &&
    occurredAt.getDate() === now.getDate()
  );
}

/** REQ-02 Part B's expanded attendant view: sales recorded today (stated
 * above, from her own sale list — this strip states the rest), transfers
 * received/sent today, and current closing stock. A summary strip states,
 * and links where a link exists (docs/design.md) — each figure links to the
 * screen that explains it, since transfer-history and stock are both real
 * records, not just this same data re-filtered. */
function AttendantSummary({
  summary,
  salesTotalMinor,
  onOpen,
}: {
  summary: AttendantSummaryState;
  salesTotalMinor: number;
  onOpen?: (destination: string) => void;
}) {
  if (summary.status === "loading") {
    return (
      <div className="mb-3 grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-card p-4">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="mt-2 h-6 w-12" />
          </div>
        ))}
      </div>
    );
  }

  const todaysTransfers = (summary.transfers ?? []).filter((t) => isToday(new Date(t.occurredAt)));
  const receivedToday = todaysTransfers.filter((t) => t.direction === "received" && t.status === "confirmed");
  const sentToday = todaysTransfers.filter((t) => t.direction === "sent" && t.status === "confirmed");
  const closingStockUnits = (summary.stockLevels ?? []).reduce((sum, level) => sum + level.quantityOnHand, 0);

  const items: Summary[] = [
    { label: "Sales today", value: money(salesTotalMinor), sub: "Cash + M-Pesa" },
    {
      label: "Received today",
      value: String(receivedToday.length),
      sub: receivedToday.length === 1 ? "transfer confirmed" : "transfers confirmed",
    },
    {
      label: "Sent today",
      value: String(sentToday.length),
      sub: sentToday.length === 1 ? "transfer confirmed" : "transfers confirmed",
    },
    {
      label: "Closing stock",
      value: summary.stockLevels === null ? "—" : String(closingStockUnits),
      sub: "units on hand",
    },
  ];

  return (
    <div className="mb-3">
      <SummaryStrip items={items} />
      {onOpen && (
        <div className="mt-2 flex gap-3 px-1 text-xs">
          <button className="text-primary underline-offset-2 hover:underline" onClick={() => onOpen("transfer-history")}>
            See transfers
          </button>
          <button className="text-primary underline-offset-2 hover:underline" onClick={() => onOpen("stock")}>
            See stock
          </button>
        </div>
      )}
    </div>
  );
}
