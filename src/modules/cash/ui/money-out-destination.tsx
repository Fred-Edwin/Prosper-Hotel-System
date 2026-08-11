"use client";

/**
 * Money out — the admin destination. List (money-out-list.tsx) plus the
 * sheet record form, chosen at the ticket 16 checkpoint over a dialog and
 * an inline panel — matches how Catalogue's product/ingredient/recipe
 * forms already open, the least surprising shape to an owner who uses
 * both destinations.
 *
 * Split into content (no AdminShell) and destination (content + AdminShell)
 * the same way Catalogue splits CatalogueDestinationView from its tabs —
 * AdminShell's Sidebar calls next/navigation's useRouter(), which has no
 * app-router context in Storybook, so stories mount the content only.
 */

import { useEffect, useState } from "react";
import { AdminShell } from "@/components/layout/admin-shell";
import { getDestinations } from "@/components/layout/admin-nav";
import { TableToolbar } from "@/components/patterns/table-toolbar";
import { SummaryStrip } from "@/components/patterns/summary-strip";
import { LoadingTable, ErrorState, PermissionDenied } from "@/components/patterns/states";
import { Skeleton } from "@/components/ui/skeleton";
import { money } from "@/shared/money";
import { MoneyOutList, categoryLabel, type ExpenseView } from "./money-out-list";
import { RecordExpenseSheet } from "./record-expense-sheet";
import type { ReceiptOption } from "./expense-fields";

export type BalanceState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "denied" }
  | { status: "ready"; cashMinor: number; mpesaMinor: number };

async function fetchRunningBalance(): Promise<BalanceState> {
  try {
    const response = await fetch("/api/cash/running-balance");
    if (response.status === 403) return { status: "denied" };
    if (!response.ok) return { status: "error" };
    const body = await response.json();
    if (typeof body?.cashMinor !== "number" || typeof body?.mpesaMinor !== "number") {
      return { status: "error" };
    }
    return { status: "ready", cashMinor: body.cashMinor, mpesaMinor: body.mpesaMinor };
  } catch {
    return { status: "error" };
  }
}

/** The running cash/M-Pesa balance — formulas.md §9. Its own load/error
 * state, independent of the expense list, since one failing to load
 * shouldn't hide the other. */
function RunningBalanceStrip({
  state,
  onRetry,
}: {
  state: BalanceState;
  onRetry: () => void;
}) {
  if (state.status === "loading") {
    return (
      <div className="mb-4 grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="bg-card p-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-2 h-6 w-28" />
          </div>
        ))}
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="mb-4">
        <ErrorState what="the running balance" onRetry={onRetry} preserved="The list below is unaffected." />
      </div>
    );
  }

  // Owner-only same as the rest of this screen — PermissionDenied already
  // covers the whole destination when denied, so a denied balance never
  // renders on its own.
  if (state.status === "denied") return null;

  return (
    <div className="mb-4">
      <SummaryStrip
        columns={2}
        items={[
          { label: "Expected cash", value: money(state.cashMinor), sub: "handed over, minus paid out" },
          {
            label: "Expected M-Pesa",
            value: money(state.mpesaMinor),
            sub: "handed over, minus paid out",
          },
        ]}
      />
    </div>
  );
}

export type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "denied" }
  | { status: "ready"; expenses: ExpenseView[] };

async function fetchExpenses(): Promise<LoadState> {
  try {
    const response = await fetch("/api/cash/expenses");
    if (response.status === 403) return { status: "denied" };
    if (!response.ok) return { status: "error" };
    const body = await response.json();
    if (!Array.isArray(body?.expenses)) return { status: "error" };
    return { status: "ready", expenses: body.expenses };
  } catch {
    return { status: "error" };
  }
}

async function fetchReceipts(): Promise<ReceiptOption[]> {
  try {
    const response = await fetch("/api/cash/receipts");
    if (!response.ok) return [];
    const body = await response.json();
    return Array.isArray(body?.receipts) ? body.receipts : [];
  } catch {
    return [];
  }
}

async function submitExpense(input: {
  category: ExpenseView["category"];
  amountMinor: number;
  paymentMethod: ExpenseView["paymentMethod"];
  note: string | null;
  receiptId: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const response = await fetch("/api/cash/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
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

async function reverseExpenseRequest(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const response = await fetch(`/api/cash/expenses/${id}/reverse`, { method: "POST" });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      return { ok: false, error: body?.error ?? "unknown" };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "network" };
  }
}

export function MoneyOutDestination({ staffName }: { staffName: string }) {
  const [attempt, setAttempt] = useState(0);
  return (
    <MoneyOutDestinationForAttempt
      key={attempt}
      staffName={staffName}
      onRetry={() => setAttempt((a) => a + 1)}
    />
  );
}

function MoneyOutDestinationForAttempt({
  staffName,
  onRetry,
}: {
  staffName: string;
  onRetry: () => void;
}) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  const load = () => {
    fetchExpenses().then(setState);
  };

  useEffect(load, []);

  return (
    <MoneyOutDestinationView staffName={staffName} state={state} onRetry={onRetry} onChanged={load} />
  );
}

/** Content only — list, toolbar and record form, no AdminShell/Sidebar
 * around it. What Storybook mounts, and what the real page wraps. */
export function MoneyOutContentView({
  state,
  onRetry = () => {},
  onChanged = () => {},
  fetchReceiptsFn = fetchReceipts,
  fetchBalanceFn = fetchRunningBalance,
  onSubmit = submitExpense,
  onReverseRequest = reverseExpenseRequest,
}: {
  state: LoadState;
  onRetry?: () => void;
  onChanged?: () => void;
  fetchReceiptsFn?: () => Promise<ReceiptOption[]>;
  fetchBalanceFn?: () => Promise<BalanceState>;
  onSubmit?: typeof submitExpense;
  onReverseRequest?: typeof reverseExpenseRequest;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [receipts, setReceipts] = useState<ReceiptOption[]>([]);
  const [receiptsLoading, setReceiptsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | undefined>();
  const [reversingId, setReversingId] = useState<string | null>(null);
  const [balanceState, setBalanceState] = useState<BalanceState>({ status: "loading" });

  useEffect(() => {
    fetchReceiptsFn().then((r) => {
      setReceipts(r);
      setReceiptsLoading(false);
    });
  }, [fetchReceiptsFn]);

  useEffect(() => {
    fetchBalanceFn().then(setBalanceState);
  }, [fetchBalanceFn]);

  const loadBalance = () => {
    setBalanceState({ status: "loading" });
    fetchBalanceFn().then(setBalanceState);
  };

  const clear = () => {
    setQuery("");
    setCategory("all");
  };

  async function handleSave(input: {
    category: ExpenseView["category"];
    amountMinor: number;
    paymentMethod: ExpenseView["paymentMethod"];
    note: string | null;
    receiptId: string | null;
  }): Promise<{ ok: boolean }> {
    setSaving(true);
    setSaveError(undefined);
    const result = await onSubmit(input);
    setSaving(false);
    if (!result.ok) {
      setSaveError(result.error);
      return { ok: false };
    }
    onChanged();
    loadBalance();
    return { ok: true };
  }

  async function handleReverse(id: string) {
    setReversingId(id);
    await onReverseRequest(id);
    setReversingId(null);
    onChanged();
    loadBalance();
  }

  const expenses = state.status === "ready" ? state.expenses : [];
  const filtered = expenses.filter(
    (e) =>
      (category === "all" || e.category === category) &&
      (!query.trim() ||
        (e.note ?? "").toLowerCase().includes(query.trim().toLowerCase()) ||
        e.staffMemberName.toLowerCase().includes(query.trim().toLowerCase())),
  );

  if (state.status === "loading") return <LoadingTable summary={3} rows={8} columns={8} />;
  if (state.status === "error") return <ErrorState what="money out" onRetry={onRetry} />;
  if (state.status === "denied")
    return (
      <PermissionDenied
        title="Money out is owner-only"
        body="Only the owner records what the business pays out."
      />
    );

  return (
    <div>
      <RunningBalanceStrip state={balanceState} onRetry={loadBalance} />

      <div className="mb-3 flex items-center justify-between gap-2">
        <TableToolbar
          query={query}
          onQuery={setQuery}
          placeholder="Search what for, or who recorded it"
          noun="payments"
          count={filtered.length}
          total={expenses.length}
          filters={[
            {
              key: "category",
              value: category,
              onChange: setCategory,
              allLabel: "All categories",
              options: (Object.keys(categoryLabel) as ExpenseView["category"][]).map((k) => ({
                value: k,
                label: categoryLabel[k],
              })),
              width: "10rem",
            },
          ]}
        />
        <div className="shrink-0">
          <RecordExpenseSheet
            receipts={receipts}
            receiptsLoading={receiptsLoading}
            saving={saving}
            error={saveError}
            onSave={handleSave}
          />
        </div>
      </div>

      <MoneyOutList
        expenses={expenses}
        filtered={filtered}
        onClearFilters={clear}
        onReverse={handleReverse}
        reversingId={reversingId}
      />
    </div>
  );
}

/** Content + AdminShell — what the real page mounts. Not used directly by
 * Storybook (see MoneyOutContentView). */
export function MoneyOutDestinationView({
  staffName,
  state,
  onRetry,
  onChanged,
  fetchReceiptsFn,
  fetchBalanceFn,
  onSubmit,
  onReverseRequest,
}: {
  staffName: string;
  state: LoadState;
  onRetry?: () => void;
  onChanged?: () => void;
  fetchReceiptsFn?: () => Promise<ReceiptOption[]>;
  fetchBalanceFn?: () => Promise<BalanceState>;
  onSubmit?: typeof submitExpense;
  onReverseRequest?: typeof reverseExpenseRequest;
}) {
  return (
    <AdminShell
      destinations={getDestinations()}
      active="money-out"
      staffName={staffName}
      title="Money out"
      subtitle="Purchases, running costs, assets, drawings"
    >
      <MoneyOutContentView
        state={state}
        onRetry={onRetry}
        onChanged={onChanged}
        fetchReceiptsFn={fetchReceiptsFn}
        fetchBalanceFn={fetchBalanceFn}
        onSubmit={onSubmit}
        onReverseRequest={onReverseRequest}
      />
    </AdminShell>
  );
}
