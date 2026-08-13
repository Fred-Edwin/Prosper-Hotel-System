"use client";

/**
 * New sale — the staff shell's till.
 *
 * Adapted from the design-reference worktree's locked round-two prototype
 * (`components/design/till/till-r2.tsx`, commit a977bea) rather than
 * invented — see docs/architecture.md's precedent table. Trimmed to what
 * ticket 07 built, then extended by ticket 11:
 *
 *   - Ticket 07 dropped the prototype's three-way mode switch (counter/
 *     delivery/credit) entirely — no customer selector, cash/M-Pesa only.
 *   - Ticket 11 (this one) brings back a two-way Counter/Delivery toggle,
 *     same pill-group styling and "customer required" copy as the
 *     prototype's mode switch, but only two options — credit stays a
 *     payment-line concern (ticket 08), not a fulfilment mode, so it isn't
 *     part of this toggle. Selecting Delivery requires a customer (reusing
 *     the same CustomerPicker credit already uses) and reveals an optional
 *     delivery fee input — new ground, no prototype precedent for the fee.
 *   - Category pills are dropped. The prototype's Category was fixture-only
 *     (food/drinks/snacks/...); the real Product has no such field, only
 *     `kind` (goods/cooked_food/service/packaging), which is not what a
 *     cashier searches by. Search alone covers the same need.
 *
 * Kept: product grid with large tap targets, live basket with qty steppers,
 * payment as typed lines (never a "split" step), running total/remaining,
 * "Complete sale" as the sole accent element owning the bottom edge.
 */

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyFirstUse, ErrorState } from "@/components/patterns/states";
import { Minus, Plus, Search, Trash2, X, ShoppingCart, Check, UserPlus, Store, Truck } from "lucide-react";
import { money } from "@/shared/money";
import type { StaffRole } from "@/components/layout/staff-nav";

type Product = {
  id: string;
  name: string;
  kind: "goods" | "cooked_food" | "service" | "packaging";
  priceMinor: number | null;
  active: boolean;
};

type Customer = { id: string; name: string; phone: string | null };

type PaymentMethod = "cash" | "mpesa" | "credit";

type Fulfilment = "counter" | "delivery";

type Line = { product: Product; qty: number };
type Pay = {
  id: number;
  method: PaymentMethod;
  amount: string;
  touched: boolean;
  customer: Customer | null;
};

export type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; products: Product[] };

async function fetchProducts(): Promise<LoadState> {
  try {
    const response = await fetch("/api/catalogue/products/active");
    if (!response.ok) return { status: "error" };
    const body = await response.json();
    if (!Array.isArray(body?.products)) return { status: "error" };
    return { status: "ready", products: body.products };
  } catch {
    return { status: "error" };
  }
}

async function fetchCustomers(): Promise<Customer[]> {
  try {
    const response = await fetch("/api/people/customers");
    if (!response.ok) return [];
    const body = await response.json();
    return Array.isArray(body?.customers) ? body.customers : [];
  } catch {
    return [];
  }
}

async function createCustomer(input: {
  name: string;
  phone?: string;
}): Promise<{ ok: true; customer: Customer } | { ok: false; error: string }> {
  try {
    const response = await fetch("/api/people/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      return { ok: false, error: body?.error ?? "unknown" };
    }
    const body = await response.json();
    return { ok: true, customer: body.customer };
  } catch {
    return { ok: false, error: "network" };
  }
}

async function submitSale(input: {
  fulfilment: Fulfilment;
  customerId?: string;
  deliveryFeeMinor?: number;
  lines: { productId: string; quantity: number }[];
  paymentLines: { method: PaymentMethod; amountMinor: number; customerId?: string }[];
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const response = await fetch("/api/sales", {
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

export function NewSale({ onDone, role }: { onDone?: () => void; role?: StaffRole }) {
  const [attempt, setAttempt] = useState(0);
  return (
    <NewSaleForAttempt
      key={attempt}
      onRetry={() => setAttempt((a) => a + 1)}
      onDone={onDone}
      role={role}
    />
  );
}

function NewSaleForAttempt({
  onRetry,
  onDone,
  role,
}: {
  onRetry: () => void;
  onDone?: () => void;
  role?: StaffRole;
}) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    fetchProducts().then((result) => {
      if (!cancelled) setState(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return <NewSaleView state={state} onRetry={onRetry} onDone={onDone} role={role} />;
}

/** The presentational half, driven by state rather than fetching — what
 * Storybook mounts to show every state without a network. */
export function NewSaleView({
  state,
  onRetry = () => {},
  onDone = () => {},
  onSubmit = submitSale,
  onLoadCustomers = fetchCustomers,
  onCreateCustomer = createCustomer,
  role,
}: {
  state: LoadState;
  onRetry?: () => void;
  onDone?: () => void;
  onSubmit?: typeof submitSale;
  onLoadCustomers?: typeof fetchCustomers;
  onCreateCustomer?: typeof createCustomer;
  role?: StaffRole;
}) {
  if (state.status === "loading") return <TillSkeleton />;
  if (state.status === "error") {
    return (
      <div className="p-3">
        <ErrorState what="products" onRetry={onRetry} />
      </div>
    );
  }
  if (state.products.length === 0) {
    return (
      <div className="p-3">
        <EmptyFirstUse
          icon={<ShoppingCart className="size-4" />}
          title="No products to sell yet"
          body="Once products are added in the catalogue, they will appear here to sell."
        />
      </div>
    );
  }

  return (
    <Till
      products={state.products}
      onDone={onDone}
      onSubmit={onSubmit}
      onLoadCustomers={onLoadCustomers}
      onCreateCustomer={onCreateCustomer}
      role={role}
    />
  );
}

function Till({
  products,
  onDone,
  onSubmit,
  onLoadCustomers,
  onCreateCustomer,
  role,
}: {
  products: Product[];
  onDone: () => void;
  onSubmit: typeof submitSale;
  onLoadCustomers: typeof fetchCustomers;
  onCreateCustomer: typeof createCustomer;
  role?: StaffRole;
}) {
  // proposal.md §2: the store manager records delivery orders only, never
  // counter sales — see sales/logic.ts's forbidden check. Defaulting to
  // delivery and disabling Counter keeps that role from ever hitting it by
  // accident (BUG-04).
  const counterDisabledForRole = role === "store-manager";
  const [query, setQuery] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [fulfilment, setFulfilment] = useState<Fulfilment>(
    counterDisabledForRole ? "delivery" : "counter",
  );
  const [deliveryCustomer, setDeliveryCustomer] = useState<Customer | null>(null);
  const [deliveryFee, setDeliveryFee] = useState("");
  // Most sales are paid one way. One line by default — pre-filled with the
  // whole total — keeps that common case friction-free; a second line is
  // added deliberately, only for the rarer split payment.
  const [pays, setPays] = useState<Pay[]>([
    { id: 1, method: "cash", amount: "", touched: false, customer: null },
  ]);
  const [nextPayId, setNextPayId] = useState(2);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<{
    lines: Line[];
    total: number;
    pays: Pay[];
    fulfilment: Fulfilment;
    deliveryCustomer: Customer | null;
    deliveryFeeMinor: number;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    onLoadCustomers().then((result) => {
      if (!cancelled) setCustomers(result);
    });
    return () => {
      cancelled = true;
    };
  }, [onLoadCustomers]);

  const shown = query.trim()
    ? products.filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase()))
    : products;

  const deliveryFeeMinor = fulfilment === "delivery" ? Number(deliveryFee) || 0 : 0;
  const productTotal = lines.reduce((s, l) => s + (l.product.priceMinor ?? 0) * l.qty, 0);
  const total = productTotal + deliveryFeeMinor;
  const paid = pays.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const remaining = total - paid;

  // Splitting a payment is typing the second box, not a "split" step — so
  // an untouched line always holds what's left to pay. Recomputed against
  // whatever the total is at the moment, so it stays right whether the
  // trigger was editing a payment line or changing the basket.
  const fillUntouched = (ps: Pay[], nextTotal: number): Pay[] => {
    const touchedTotal = ps
      .filter((p) => p.touched)
      .reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const balance = nextTotal - touchedTotal;
    const amount = balance > 0 ? String(balance) : "";
    return ps.map((p) => (p.touched ? p : { ...p, amount }));
  };

  const totalFor = (ls: Line[]) =>
    ls.reduce((s, l) => s + (l.product.priceMinor ?? 0) * l.qty, 0) + deliveryFeeMinor;

  const add = (p: Product) =>
    setLines((ls) => {
      const hit = ls.find((l) => l.product.id === p.id);
      const next = hit
        ? ls.map((l) => (l.product.id === p.id ? { ...l, qty: l.qty + 1 } : l))
        : [...ls, { product: p, qty: 1 }];
      setPays((ps) => fillUntouched(ps, totalFor(next)));
      return next;
    });

  const bump = (id: string, d: number) =>
    setLines((ls) => {
      const next = ls
        .map((l) => (l.product.id === id ? { ...l, qty: l.qty + d } : l))
        .filter((l) => l.qty > 0);
      setPays((ps) => fillUntouched(ps, totalFor(next)));
      return next;
    });

  const setDeliveryFeeAmount = (amount: string) => {
    setDeliveryFee(amount);
    const fee = Number(amount) || 0;
    setPays((ps) => fillUntouched(ps, productTotal + fee));
  };

  const setFulfilmentMode = (mode: Fulfilment) => {
    setFulfilment(mode);
    if (mode === "counter") {
      setDeliveryCustomer(null);
      setDeliveryFee("");
      setPays((ps) => fillUntouched(ps, productTotal));
    }
  };

  const setPayAmount = (id: number, amount: string) =>
    setPays((ps) => {
      const edited = ps.map((x) => (x.id === id ? { ...x, amount, touched: true } : x));
      return fillUntouched(edited, total);
    });

  // The rare split-payment case: a second (or third) line, added on request
  // rather than shown by default. A method not already in use, so the
  // cashier isn't nudged toward duplicating one that's already there.
  const addPay = () =>
    setPays((ps) => {
      const used = new Set(ps.map((p) => p.method));
      const method = (["cash", "mpesa", "credit"] as PaymentMethod[]).find((m) => !used.has(m)) ?? "cash";
      const next = [...ps, { id: nextPayId, method, amount: "", touched: false, customer: null }];
      setNextPayId((n) => n + 1);
      return fillUntouched(next, total);
    });

  const removePay = (id: number) =>
    setPays((ps) => {
      const next = ps.filter((p) => p.id !== id);
      return fillUntouched(next, total);
    });

  const activePays = pays.filter((p) => Number(p.amount) > 0);
  const creditNeedsCustomer = activePays.some((p) => p.method === "credit" && !p.customer);
  const deliveryNeedsCustomer = fulfilment === "delivery" && !deliveryCustomer;
  const canComplete =
    lines.length > 0 &&
    remaining === 0 &&
    !creditNeedsCustomer &&
    !deliveryNeedsCustomer &&
    !submitting;

  const complete = async () => {
    setSubmitting(true);
    setSubmitError(null);
    const result = await onSubmit({
      fulfilment,
      ...(fulfilment === "delivery" && deliveryCustomer ? { customerId: deliveryCustomer.id } : {}),
      ...(fulfilment === "delivery" && deliveryFeeMinor > 0 ? { deliveryFeeMinor } : {}),
      lines: lines.map((l) => ({ productId: l.product.id, quantity: l.qty })),
      paymentLines: activePays.map((p) => ({
        method: p.method,
        amountMinor: Number(p.amount),
        ...(p.method === "credit" && p.customer ? { customerId: p.customer.id } : {}),
      })),
    });
    setSubmitting(false);
    if (!result.ok) {
      setSubmitError(result.error);
      return;
    }
    setConfirmed({ lines, total, pays, fulfilment, deliveryCustomer, deliveryFeeMinor });
  };

  if (confirmed) {
    return <SaleConfirmation sale={confirmed} onDone={onDone} />;
  }

  return (
    <div className="flex min-h-full flex-col">
      {/* Fulfilment. Selection is a neutral fill — "chosen", not "do this
          next" — same discipline as the design-reference prototype's mode
          switch, per docs/design.md's one-accent-per-screen rule. */}
      <div className="border-b bg-card px-3 py-2">
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          {(
            [
              { key: "counter" as const, label: "Counter", icon: Store },
              { key: "delivery" as const, label: "Delivery", icon: Truck },
            ]
          ).map((m) => {
            const Icon = m.icon;
            const on = fulfilment === m.key;
            const disabled = m.key === "counter" && counterDisabledForRole;
            return (
              <button
                key={m.key}
                onClick={() => !disabled && setFulfilmentMode(m.key)}
                disabled={disabled}
                title={disabled ? "Store managers record delivery orders, not counter sales" : undefined}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 text-[13px] font-medium transition-colors duration-100 ${
                  on ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                } ${disabled ? "cursor-not-allowed opacity-40" : ""}`}
                aria-pressed={on}
                data-testid={`till-fulfilment-${m.key}`}
              >
                <Icon className="size-3.5" />
                {m.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="border-b bg-card px-3 pt-2 pb-2">
        <div className="relative">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products"
            className="h-10 pl-8"
            data-testid="till-search"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground"
              aria-label="Clear search"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {shown.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-muted-foreground">
              Nothing matches &ldquo;{query}&rdquo;.
            </p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => setQuery("")}>
              Clear search
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2" data-testid="till-product-grid">
            {shown.map((p) => {
              const inBasket = lines.find((l) => l.product.id === p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => add(p)}
                  title={p.name}
                  data-testid="till-product-tile"
                  className={`relative flex h-[76px] flex-col items-start justify-between rounded-lg border bg-card p-2 text-left transition-colors duration-100 active:bg-accent ${
                    inBasket ? "border-neutral-400" : ""
                  }`}
                >
                  <span className="line-clamp-2 text-[13px] leading-tight font-medium">
                    {p.name}
                  </span>
                  <span className="text-[11px] text-muted-foreground tabular-nums">
                    {money(p.priceMinor ?? 0)}
                  </span>
                  {inBasket && (
                    <span className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-neutral-700 text-[11px] font-semibold text-white tabular-nums">
                      {inBasket.qty}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="border-t bg-card">
        {lines.length > 0 && (
          <div className="max-h-40 overflow-y-auto px-4 py-1.5" data-testid="till-basket">
            {lines.map((l) => (
              <div
                key={l.product.id}
                className="flex items-center gap-2 border-b py-1.5 last:border-0"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium">{l.product.name}</div>
                  <div className="text-[11px] text-muted-foreground tabular-nums">
                    {money(l.product.priceMinor ?? 0)} each
                  </div>
                </div>
                <Button
                  size="icon"
                  variant="outline"
                  className="size-8 shrink-0"
                  onClick={() => bump(l.product.id, -1)}
                  aria-label={`One fewer ${l.product.name}`}
                >
                  <Minus className="size-3.5" />
                </Button>
                <span className="w-6 text-center text-sm font-medium tabular-nums">{l.qty}</span>
                <Button
                  size="icon"
                  variant="outline"
                  className="size-8 shrink-0"
                  onClick={() => bump(l.product.id, 1)}
                  aria-label={`One more ${l.product.name}`}
                >
                  <Plus className="size-3.5" />
                </Button>
                <span className="w-16 shrink-0 text-right text-[13px] font-medium tabular-nums">
                  {money((l.product.priceMinor ?? 0) * l.qty)}
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7 shrink-0 text-muted-foreground"
                  onClick={() => bump(l.product.id, -l.qty)}
                  aria-label={`Remove ${l.product.name}`}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-2.5 border-t px-4 py-3">
          {fulfilment === "delivery" && (
            <div className="space-y-2.5">
              <CustomerPicker
                customers={customers}
                selected={deliveryCustomer}
                onCreateCustomer={onCreateCustomer}
                onSelect={setDeliveryCustomer}
                onCreated={(customer) => {
                  setCustomers((cs) =>
                    [...cs, customer].sort((a, b) => a.name.localeCompare(b.name)),
                  );
                  setDeliveryCustomer(customer);
                }}
                label="Customer — required for delivery"
                testIdPrefix="till-delivery-customer"
              />
              <div>
                <label className="text-[11px] font-medium text-muted-foreground">
                  Delivery fee (optional)
                </label>
                <Input
                  inputMode="numeric"
                  placeholder="0"
                  value={deliveryFee}
                  onChange={(e) => setDeliveryFeeAmount(e.target.value)}
                  className="mt-1 h-10 text-right tabular-nums"
                  data-testid="till-delivery-fee"
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            {pays.map((p) => (
              <div key={p.id} className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Select
                    value={p.method}
                    onValueChange={(v) =>
                      setPays((ps) =>
                        ps.map((x) =>
                          x.id === p.id
                            ? { ...x, method: v as PaymentMethod, customer: null }
                            : x,
                        ),
                      )
                    }
                  >
                    <SelectTrigger className="h-10 w-28 shrink-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="mpesa">M-Pesa</SelectItem>
                      <SelectItem value="credit">Credit</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    inputMode="numeric"
                    placeholder="0"
                    value={p.amount}
                    onChange={(e) => setPayAmount(p.id, e.target.value)}
                    className="h-10 flex-1 text-right tabular-nums"
                    data-testid={`till-pay-${p.method}`}
                  />
                  {pays.length > 1 && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-8 shrink-0 text-muted-foreground"
                      onClick={() => removePay(p.id)}
                      aria-label="Remove payment method"
                    >
                      <X className="size-3.5" />
                    </Button>
                  )}
                </div>
                {p.method === "credit" && Number(p.amount) > 0 && (
                  <CustomerPicker
                    customers={customers}
                    selected={p.customer}
                    onCreateCustomer={onCreateCustomer}
                    onSelect={(customer) =>
                      setPays((ps) => ps.map((x) => (x.id === p.id ? { ...x, customer } : x)))
                    }
                    onCreated={(customer) => {
                      setCustomers((cs) =>
                        [...cs, customer].sort((a, b) => a.name.localeCompare(b.name)),
                      );
                      setPays((ps) => ps.map((x) => (x.id === p.id ? { ...x, customer } : x)));
                    }}
                  />
                )}
              </div>
            ))}
          </div>

          {pays.length < 3 && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-[12px]"
              onClick={addPay}
              data-testid="till-add-payment-method"
            >
              <Plus className="size-3.5" />
              Add payment method
            </Button>
          )}

          <div className="space-y-1 border-t pt-2">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="text-xl font-semibold tabular-nums">{money(total)}</span>
            </div>
            {remaining !== 0 && lines.length > 0 && (
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">
                  {remaining > 0 ? "Still to pay" : "Change"}
                </span>
                <Badge variant={remaining > 0 ? "destructive" : "secondary"}>
                  <span className="tabular-nums">{money(Math.abs(remaining))}</span>
                </Badge>
              </div>
            )}
          </div>

          {submitError && (
            <p className="text-[11px] text-destructive">
              {submitError === "forbidden" && fulfilment === "counter"
                ? "Store managers record delivery orders, not counter sales."
                : "Couldn't complete the sale. Nothing was lost — check payment and try again."}
            </p>
          )}

          <Button
            className="h-12 w-full text-[15px]"
            disabled={!canComplete}
            onClick={complete}
            data-testid="till-complete"
          >
            {submitting ? "Completing…" : "Complete sale"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** A credit line's or a delivery sale's customer — search the existing list
 * or create one inline, without leaving the sale. Renders a plain
 * result/query if a customer is already selected, so it doesn't compete
 * with the row above it. `label`/`testIdPrefix` distinguish the credit and
 * delivery call sites without duplicating this component. */
function CustomerPicker({
  customers,
  selected,
  onSelect,
  onCreated,
  onCreateCustomer,
  label = "Customer — required for credit",
  testIdPrefix = "till-credit-customer",
}: {
  customers: Customer[];
  selected: Customer | null;
  onSelect: (customer: Customer | null) => void;
  onCreated: (customer: Customer) => void;
  onCreateCustomer: typeof createCustomer;
  label?: string;
  testIdPrefix?: string;
}) {
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [newPhone, setNewPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (selected) {
    return (
      <div
        className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2"
        data-testid={`${testIdPrefix}-selected`}
      >
        <span className="text-[13px] font-medium">{selected.name}</span>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-[12px] text-muted-foreground"
          onClick={() => onSelect(null)}
        >
          Change
        </Button>
      </div>
    );
  }

  const matches = customers.filter((c) => c.name.toLowerCase().includes(query.trim().toLowerCase()));

  const startCreate = async () => {
    setSaving(true);
    setError(null);
    const result = await onCreateCustomer({ name: query.trim(), phone: newPhone.trim() || undefined });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onCreated(result.customer);
  };

  return (
    <div data-testid={`${testIdPrefix}-picker`}>
      <label className="text-[11px] font-medium text-muted-foreground">{label}</label>
      <Command className="mt-1 rounded-md border" shouldFilter={false}>
        <CommandInput
          placeholder="Search or add a customer"
          value={query}
          onValueChange={(v) => {
            setQuery(v);
            setCreating(false);
          }}
          data-testid={`${testIdPrefix}-search`}
        />
        <CommandList>
          {!creating && (
            <>
              {matches.length === 0 && query.trim() === "" && (
                <CommandEmpty>Type a name to search or add a customer.</CommandEmpty>
              )}
              {matches.length > 0 && (
                <CommandGroup>
                  {matches.map((c) => (
                    <CommandItem
                      key={c.id}
                      value={c.id}
                      onSelect={() => onSelect(c)}
                      data-testid={`${testIdPrefix}-option`}
                    >
                      {c.name}
                      {c.phone && (
                        <span className="ml-auto text-xs text-muted-foreground">{c.phone}</span>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {query.trim() !== "" && (
                <CommandGroup>
                  <CommandItem
                    value={`__create__${query}`}
                    onSelect={() => setCreating(true)}
                    data-testid={`${testIdPrefix}-create`}
                  >
                    <UserPlus className="size-4" />
                    Add &ldquo;{query.trim()}&rdquo; as a new customer
                  </CommandItem>
                </CommandGroup>
              )}
            </>
          )}
        </CommandList>
      </Command>

      {creating && (
        <div className="mt-1.5 space-y-1.5 rounded-md border p-2" data-testid={`${testIdPrefix}-new`}>
          <div className="text-[12px] font-medium">New customer</div>
          <Input value={query.trim()} disabled className="h-8 text-[13px]" />
          <Input
            placeholder="Phone (optional)"
            value={newPhone}
            onChange={(e) => setNewPhone(e.target.value)}
            className="h-8 text-[13px]"
            data-testid={`${testIdPrefix}-phone`}
          />
          {error && <p className="text-[11px] text-destructive">Couldn&apos;t add customer, try again.</p>}
          <div className="flex gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="h-8 flex-1 text-[12px]"
              disabled={saving}
              onClick={startCreate}
              data-testid={`${testIdPrefix}-save`}
            >
              {saving ? "Adding…" : "Add customer"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-[12px]"
              onClick={() => setCreating(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function SaleConfirmation({
  sale,
  onDone,
}: {
  sale: {
    lines: Line[];
    total: number;
    pays: Pay[];
    fulfilment: Fulfilment;
    deliveryCustomer: Customer | null;
    deliveryFeeMinor: number;
  };
  onDone: () => void;
}) {
  return (
    <div className="flex min-h-full flex-col" data-testid="till-confirmation">
      <div className="flex-1 space-y-4 p-4">
        <div className="flex flex-col items-center rounded-lg border bg-card px-6 py-8 text-center">
          <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-success-subtle text-success">
            <Check className="size-5" />
          </div>
          <p className="text-sm font-medium">Sale recorded</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{money(sale.total)}</p>
          <Badge variant="secondary" className="mt-2" data-testid="till-confirmation-fulfilment">
            {sale.fulfilment === "delivery" ? "Delivery" : "Counter"}
            {sale.fulfilment === "delivery" && sale.deliveryCustomer && (
              <span> — {sale.deliveryCustomer.name}</span>
            )}
          </Badge>
        </div>

        <div className="rounded-lg border bg-card p-3">
          {sale.lines.map((l) => (
            <div key={l.product.id} className="flex justify-between gap-3 py-1.5 text-[13px]">
              <span className="min-w-0 truncate">
                {l.qty} × {l.product.name}
              </span>
              <span className="shrink-0 tabular-nums">
                {money((l.product.priceMinor ?? 0) * l.qty)}
              </span>
            </div>
          ))}
          {sale.fulfilment === "delivery" && sale.deliveryFeeMinor > 0 && (
            <div
              className="flex justify-between gap-3 border-t py-1.5 text-[13px]"
              data-testid="till-confirmation-delivery-fee"
            >
              <span className="min-w-0 truncate text-muted-foreground">Delivery fee</span>
              <span className="shrink-0 tabular-nums">{money(sale.deliveryFeeMinor)}</span>
            </div>
          )}
        </div>

        <div className="rounded-lg border bg-card p-3">
          {sale.pays
            .filter((p) => Number(p.amount) > 0)
            .map((p) => (
              <div key={p.id} className="flex justify-between gap-3 py-1.5 text-[13px]">
                <span className="capitalize">
                  {p.method === "mpesa" ? "M-Pesa" : p.method}
                  {p.method === "credit" && p.customer && (
                    <span className="text-muted-foreground"> — {p.customer.name}</span>
                  )}
                </span>
                <span className="tabular-nums">{money(Number(p.amount))}</span>
              </div>
            ))}
        </div>
      </div>

      <div className="sticky bottom-0 border-t bg-card px-4 py-3">
        <Button className="h-12 w-full text-[15px]" onClick={onDone} data-testid="till-new-sale">
          Start next sale
        </Button>
      </div>
    </div>
  );
}

function TillSkeleton() {
  return (
    <div className="p-3" data-testid="till-loading">
      <Skeleton className="mb-3 h-10 w-full rounded-lg" />
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 9 }).map((_, i) => (
          <Skeleton key={i} className="h-[76px] rounded-lg" />
        ))}
      </div>
    </div>
  );
}
