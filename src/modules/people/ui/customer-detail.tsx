"use client";

/**
 * A customer, on the detail template. Adapted from the design-reference's
 * `customer-page.tsx` — the balance shown as an arithmetic (credit
 * extended less repayments), never a stored figure, with "Take a
 * repayment" wired to sales's `recordRepayment` rather than left inert.
 *
 * Reuses `DetailPage`/`DetailCard`/`FactList`, same pattern
 * `days-worked-tab.tsx` already settled for a People sub-record — no new
 * composition invented here.
 */

import { useEffect, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, ChevronLeft } from "lucide-react";
import { DetailPage, DetailCard, FactList } from "@/components/patterns/detail-page";
import { ErrorState, LoadingDetail } from "@/components/patterns/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { money } from "@/shared/money";
import type { CustomerHistoryState, CustomerWithBalance, CreditHistoryEntry } from "./customer-data";

export function CustomerDetail({
  customer,
  onBack,
  onFetchHistory,
  onRecordRepayment,
}: {
  customer: CustomerWithBalance;
  onBack: () => void;
  onFetchHistory: () => Promise<CustomerHistoryState>;
  onRecordRepayment: (amountMinor: number) => Promise<{ ok: boolean; reason?: string }>;
}) {
  const [state, setState] = useState<CustomerHistoryState>({ status: "loading" });
  const [repaying, setRepaying] = useState(false);
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function refresh() {
    setState(await onFetchHistory());
  }

  useEffect(() => {
    let cancelled = false;
    onFetchHistory().then((result) => {
      if (!cancelled) setState(result);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer.id]);

  async function handleRepay() {
    const amountMinor = Math.round(Number(amount) * 100);
    if (!amountMinor || amountMinor <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }
    setSaving(true);
    setError(undefined);
    const result = await onRecordRepayment(amountMinor);
    setSaving(false);
    if (!result.ok) {
      setError(
        result.reason === "exceeds_balance"
          ? "That's more than they owe."
          : "Couldn't record the repayment — try again.",
      );
      return;
    }
    setAmount("");
    setRepaying(false);
    await refresh();
  }

  const credit =
    state.status === "ready"
      ? state.entries.filter((e) => e.kind === "credit").reduce((s, e) => s + e.amountMinor, 0)
      : 0;
  const repaid =
    state.status === "ready"
      ? state.entries.filter((e) => e.kind === "repayment").reduce((s, e) => s + e.amountMinor, 0)
      : 0;

  return (
    <div>
      <Button variant="ghost" size="sm" className="mb-3 h-7 gap-1 text-xs" onClick={onBack}>
        <ChevronLeft className="size-3.5" /> All customers
      </Button>

      {state.status === "loading" ? (
        <LoadingDetail />
      ) : state.status === "error" ? (
        <ErrorState what="this customer's history" onRetry={refresh} />
      ) : (
        <DetailPage
          identity={
            <>
              <DetailCard
                title="Owes the business"
                footnote="A balance is never edited directly. It is what credit less repayments comes to."
              >
                <div className="tabular text-3xl font-semibold">{money(customer.balanceMinor)}</div>
                <div className="mt-3 space-y-1 border-t pt-2 text-[13px]">
                  <Line label="Credit extended" value={credit} />
                  <Line label="Repaid" value={repaid} sign="−" />
                </div>
                {customer.balanceMinor > 0 && !repaying && (
                  <Button size="sm" className="mt-4 h-8 w-full" onClick={() => setRepaying(true)}>
                    Take a repayment
                  </Button>
                )}
                {repaying && (
                  <div className="mt-4 space-y-2 border-t pt-3">
                    <Input
                      type="number"
                      inputMode="decimal"
                      placeholder="Amount (KSh)"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="h-9"
                      disabled={saving}
                    />
                    {error && <p className="text-[12px] text-danger">{error}</p>}
                    <div className="flex gap-2">
                      <Button size="sm" className="h-8 flex-1" onClick={handleRepay} disabled={saving}>
                        {saving ? "Saving…" : "Record repayment"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8"
                        disabled={saving}
                        onClick={() => {
                          setRepaying(false);
                          setAmount("");
                          setError(undefined);
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </DetailCard>

              <DetailCard title="Details" flush>
                <div className="py-2">
                  <FactList
                    facts={[
                      { label: "Phone", value: customer.phone ?? "—", tabular: !!customer.phone },
                      {
                        label: "Status",
                        value:
                          customer.balanceMinor > 0 ? (
                            <Badge
                              variant="outline"
                              className="border-warning/40 bg-warning-subtle font-normal text-warning"
                            >
                              Owing
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">
                              Settled
                            </Badge>
                          ),
                      },
                    ]}
                  />
                </div>
              </DetailCard>
            </>
          }
          history={
            <DetailCard
              title="Credit and repayments"
              flush
              badge={
                <span className="tabular text-xs text-muted-foreground">
                  {state.entries.length} entries
                </span>
              }
            >
              {state.entries.length === 0 ? (
                <p className="px-4 py-8 text-center text-[13px] text-muted-foreground">
                  Nothing recorded yet. Credit taken at the till will appear here.
                </p>
              ) : (
                <div className="divide-y">
                  {state.entries.map((entry, i) => (
                    <HistoryRow key={i} entry={entry} />
                  ))}
                </div>
              )}
            </DetailCard>
          }
        />
      )}
    </div>
  );
}

function HistoryRow({ entry }: { entry: CreditHistoryEntry }) {
  const out = entry.kind === "credit";
  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      {out ? (
        <ArrowUpRight className="size-4 shrink-0 text-muted-foreground" />
      ) : (
        <ArrowDownLeft className="size-4 shrink-0 text-success" />
      )}
      <div className="min-w-0 flex-1">
        <div className="text-[13px]">{out ? "Credit given" : "Repayment"}</div>
        <div className="tabular text-[11px] text-muted-foreground">
          {new Date(entry.occurredAt).toLocaleDateString()}
        </div>
      </div>
      <span className={`tabular shrink-0 text-[13px] font-medium ${out ? "" : "text-success"}`}>
        {out ? "+" : "−"}
        {money(entry.amountMinor)}
      </span>
    </div>
  );
}

function Line({ label, value, sign }: { label: string; value: number; sign?: "−" }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular">
        {sign === "−" ? "−" : ""}
        {money(value)}
      </span>
    </div>
  );
}
