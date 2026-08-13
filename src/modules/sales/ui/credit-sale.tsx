"use client";

/**
 * Credit sale — the canteen attendant's only sale-recording entry point.
 *
 * Trimmed from `new-sale.tsx`'s `Till`, not a reuse of it (ticket 26):
 * proposal.md §4 says individual sales aren't recorded at the point of sale
 * at the canteen — only credit sales are. So this screen drops the
 * fulfilment toggle (always `counter`) and the cash/M-Pesa payment-method
 * selector entirely. A customer is always required, and there is exactly
 * one payment line: `credit`, for the full total. Kept: product grid with
 * search, live basket with qty steppers, and `CustomerPicker` (imported
 * from `new-sale.tsx`, unchanged).
 */

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyFirstUse, ErrorState } from "@/components/patterns/states";
import { Minus, Plus, Search, Trash2, X, HandCoins, Check } from "lucide-react";
import { money } from "@/shared/money";

type Product = {
  id: string;
  name: string;
  kind: "goods" | "cooked_food" | "service" | "packaging";
  priceMinor: number | null;
  active: boolean;
  locationId: string;
};

type Customer = { id: string; name: string; phone: string | null };

type Line = { product: Product; qty: number };

export type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; products: Product[] };

async function fetchProducts(locationId: string): Promise<LoadState> {
  try {
    const response = await fetch(
      `/api/catalogue/products/active?locationId=${encodeURIComponent(locationId)}`,
    );
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

async function submitCreditSale(input: {
  customerId: string;
  lines: { productId: string; quantity: number }[];
  totalMinor: number;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const response = await fetch("/api/sales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fulfilment: "counter",
        lines: input.lines,
        paymentLines: [
          { method: "credit", amountMinor: input.totalMinor, customerId: input.customerId },
        ],
      }),
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

export function CreditSale({
  onDone,
  locationId,
}: {
  onDone?: () => void;
  locationId: string;
}) {
  const [attempt, setAttempt] = useState(0);
  return (
    <CreditSaleForAttempt
      key={attempt}
      onRetry={() => setAttempt((a) => a + 1)}
      onDone={onDone}
      locationId={locationId}
    />
  );
}

function CreditSaleForAttempt({
  onRetry,
  onDone,
  locationId,
}: {
  onRetry: () => void;
  onDone?: () => void;
  locationId: string;
}) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    fetchProducts(locationId).then((result) => {
      if (!cancelled) setState(result);
    });
    return () => {
      cancelled = true;
    };
  }, [locationId]);

  return (
    <CreditSaleView state={state} onRetry={onRetry} onDone={onDone} locationId={locationId} />
  );
}

/** The presentational half, driven by state rather than fetching — what
 * Storybook mounts to show every state without a network. */
export function CreditSaleView({
  state,
  onRetry = () => {},
  onDone = () => {},
  onSubmit = submitCreditSale,
  onLoadCustomers = fetchCustomers,
  onCreateCustomer = createCustomer,
  locationId,
}: {
  state: LoadState;
  onRetry?: () => void;
  onDone?: () => void;
  onSubmit?: typeof submitCreditSale;
  onLoadCustomers?: typeof fetchCustomers;
  onCreateCustomer?: typeof createCustomer;
  locationId?: string;
}) {
  if (state.status === "loading") return <CreditSaleSkeleton />;
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
          icon={<HandCoins className="size-4" />}
          title="No products to sell yet"
          body="Once products are added in the catalogue, they will appear here to sell on credit."
        />
      </div>
    );
  }

  return (
    <CreditTill
      products={state.products}
      onDone={onDone}
      onSubmit={onSubmit}
      onLoadCustomers={onLoadCustomers}
      onCreateCustomer={onCreateCustomer}
      locationId={locationId}
    />
  );
}

/** One tap-target product tile — mirrors new-sale.tsx's ProductTile, kept
 * separate per this file's own not-a-reuse convention (see header comment). */
function CreditProductTile({
  product,
  inBasket,
  onAdd,
  badge,
}: {
  product: Product;
  inBasket?: Line;
  onAdd: () => void;
  badge?: string;
}) {
  return (
    <button
      onClick={onAdd}
      title={product.name}
      data-testid="credit-sale-product-tile"
      className={`relative flex h-[76px] flex-col items-start justify-between rounded-lg border bg-card p-2 text-left transition-colors duration-100 active:bg-accent ${
        inBasket ? "border-neutral-400" : ""
      }`}
    >
      <span className="line-clamp-2 text-[13px] leading-tight font-medium">{product.name}</span>
      <div className="flex w-full items-center justify-between gap-1">
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {money(product.priceMinor ?? 0)}
        </span>
        {badge && (
          <Badge variant="outline" className="shrink-0 text-[10px] font-normal">
            {badge}
          </Badge>
        )}
      </div>
      {inBasket && (
        <span className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-neutral-700 text-[11px] font-semibold text-white tabular-nums">
          {inBasket.qty}
        </span>
      )}
    </button>
  );
}

/** Own-stock / transferred-in product grid for one tab — same split
 * new-sale.tsx's Till uses. */
function CreditProductTileGroup({
  products,
  lines,
  onAdd,
  testIdPrefix,
  badge,
  className,
}: {
  products: Product[];
  lines: Line[];
  onAdd: (p: Product) => void;
  testIdPrefix: string;
  badge?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="grid grid-cols-3 gap-2" data-testid={`credit-sale-product-grid-${testIdPrefix}`}>
        {products.map((p) => (
          <CreditProductTile
            key={p.id}
            product={p}
            inBasket={lines.find((l) => l.product.id === p.id)}
            onAdd={() => onAdd(p)}
            badge={badge}
          />
        ))}
      </div>
    </div>
  );
}

function CreditTill({
  products,
  onDone,
  onSubmit,
  onLoadCustomers,
  onCreateCustomer,
  locationId,
}: {
  products: Product[];
  onDone: () => void;
  onSubmit: typeof submitCreditSale;
  onLoadCustomers: typeof fetchCustomers;
  onCreateCustomer: typeof createCustomer;
  locationId?: string;
}) {
  const [query, setQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState<"all" | "own" | "transferred">("all");
  const [lines, setLines] = useState<Line[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<{
    lines: Line[];
    total: number;
    customer: Customer;
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

  // docs/scope.md's "Product home location" note: same own/transferred-in
  // split as new-sale.tsx's Till — credit sales share the same picker
  // concerns.
  const ownProducts = shown.filter((p) => p.locationId === locationId);
  const transferredProducts = shown.filter((p) => p.locationId !== locationId);

  const total = lines.reduce((s, l) => s + (l.product.priceMinor ?? 0) * l.qty, 0);

  const add = (p: Product) =>
    setLines((ls) => {
      const hit = ls.find((l) => l.product.id === p.id);
      return hit
        ? ls.map((l) => (l.product.id === p.id ? { ...l, qty: l.qty + 1 } : l))
        : [...ls, { product: p, qty: 1 }];
    });

  const bump = (id: string, d: number) =>
    setLines((ls) =>
      ls.map((l) => (l.product.id === id ? { ...l, qty: l.qty + d } : l)).filter((l) => l.qty > 0),
    );

  const canComplete = lines.length > 0 && customer !== null && !submitting;

  const complete = async () => {
    if (!customer) return;
    setSubmitting(true);
    setSubmitError(null);
    const result = await onSubmit({
      customerId: customer.id,
      lines: lines.map((l) => ({ productId: l.product.id, quantity: l.qty })),
      totalMinor: total,
    });
    setSubmitting(false);
    if (!result.ok) {
      setSubmitError(result.error);
      return;
    }
    setConfirmed({ lines, total, customer });
  };

  if (confirmed) {
    return <CreditSaleConfirmation sale={confirmed} onDone={onDone} />;
  }

  return (
    <div className="flex min-h-full flex-col">
      <div className="border-b bg-card px-3 pt-2 pb-2">
        <div className="relative">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products"
            className="h-10 pl-8"
            data-testid="credit-sale-search"
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
        ) : locationId ? (
          transferredProducts.length === 0 ? (
            <CreditProductTileGroup
              products={ownProducts}
              lines={lines}
              onAdd={add}
              testIdPrefix="own"
            />
          ) : (
            <>
              <div
                className="mb-3 grid grid-cols-2 gap-1 rounded-lg bg-muted p-1"
                role="tablist"
                aria-label="Stock source"
              >
                {(
                  [
                    { key: "own" as const, label: "My stock" },
                    { key: "transferred" as const, label: "From restaurant" },
                  ]
                ).map((tab) => (
                  <button
                    key={tab.key}
                    role="tab"
                    aria-selected={sourceFilter === tab.key || (sourceFilter === "all" && tab.key === "own")}
                    onClick={() => setSourceFilter(tab.key)}
                    data-testid={`credit-sale-source-tab-${tab.key}`}
                    className={`h-8 rounded-md text-[13px] font-medium transition-colors duration-100 ${
                      sourceFilter === tab.key || (sourceFilter === "all" && tab.key === "own")
                        ? "bg-card shadow-sm"
                        : "text-muted-foreground"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              {sourceFilter === "transferred" ? (
                <CreditProductTileGroup
                  products={transferredProducts}
                  lines={lines}
                  onAdd={add}
                  testIdPrefix="transferred"
                  badge="Transferred in"
                />
              ) : (
                <CreditProductTileGroup
                  products={ownProducts}
                  lines={lines}
                  onAdd={add}
                  testIdPrefix="own"
                />
              )}
            </>
          )
        ) : (
          <div className="grid grid-cols-3 gap-2" data-testid="credit-sale-product-grid">
            {shown.map((p) => {
              const inBasket = lines.find((l) => l.product.id === p.id);
              return (
                <CreditProductTile key={p.id} product={p} inBasket={inBasket} onAdd={() => add(p)} />
              );
            })}
          </div>
        )}
      </div>

      <div className="border-t bg-card">
        {lines.length > 0 && (
          <div className="max-h-40 overflow-y-auto px-4 py-1.5" data-testid="credit-sale-basket">
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
          <CustomerPicker
            customers={customers}
            selected={customer}
            onCreateCustomer={onCreateCustomer}
            onSelect={setCustomer}
            onCreated={(c) => {
              setCustomers((cs) => [...cs, c].sort((a, b) => a.name.localeCompare(b.name)));
              setCustomer(c);
            }}
          />

          <div className="space-y-1 border-t pt-2">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="text-xl font-semibold tabular-nums">{money(total)}</span>
            </div>
          </div>

          {submitError && (
            <p className="text-[11px] text-destructive">
              Couldn&apos;t record the sale. Nothing was lost — check and try again.
            </p>
          )}

          <Button
            className="h-12 w-full text-[15px]"
            disabled={!canComplete}
            onClick={complete}
            data-testid="credit-sale-complete"
          >
            {submitting ? "Recording…" : "Record credit sale"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Search the existing customer list or create one inline, without leaving
 * the sale. Same pattern as `new-sale.tsx`'s CustomerPicker, kept as a
 * separate copy since this screen's customer is always required (no
 * optional/credit-line branching to share). */
function CustomerPicker({
  customers,
  selected,
  onSelect,
  onCreated,
  onCreateCustomer,
}: {
  customers: Customer[];
  selected: Customer | null;
  onSelect: (customer: Customer | null) => void;
  onCreated: (customer: Customer) => void;
  onCreateCustomer: typeof createCustomer;
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
        data-testid="credit-sale-customer-selected"
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
    <div data-testid="credit-sale-customer-picker">
      <label className="text-[11px] font-medium text-muted-foreground">
        Customer — required for credit
      </label>
      <div className="mt-1 rounded-md border">
        <div className="relative border-b">
          <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setCreating(false);
            }}
            placeholder="Search or add a customer"
            className="h-9 rounded-none border-0 pl-7 shadow-none focus-visible:ring-0"
            data-testid="credit-sale-customer-search"
          />
        </div>
        {!creating && (
          <div className="max-h-40 overflow-y-auto">
            {matches.length === 0 && query.trim() === "" && (
              <p className="px-3 py-2 text-[12px] text-muted-foreground">
                Type a name to search or add a customer.
              </p>
            )}
            {matches.map((c) => (
              <button
                key={c.id}
                onClick={() => onSelect(c)}
                data-testid="credit-sale-customer-option"
                className="flex w-full items-center justify-between px-3 py-2 text-left text-[13px] hover:bg-accent"
              >
                {c.name}
                {c.phone && <span className="text-xs text-muted-foreground">{c.phone}</span>}
              </button>
            ))}
            {query.trim() !== "" && (
              <button
                onClick={() => setCreating(true)}
                data-testid="credit-sale-customer-create"
                className="flex w-full items-center gap-2 border-t px-3 py-2 text-left text-[13px] hover:bg-accent"
              >
                Add &ldquo;{query.trim()}&rdquo; as a new customer
              </button>
            )}
          </div>
        )}
      </div>

      {creating && (
        <div className="mt-1.5 space-y-1.5 rounded-md border p-2" data-testid="credit-sale-customer-new">
          <div className="text-[12px] font-medium">New customer</div>
          <Input value={query.trim()} disabled className="h-8 text-[13px]" />
          <Input
            placeholder="Phone (optional)"
            value={newPhone}
            onChange={(e) => setNewPhone(e.target.value)}
            className="h-8 text-[13px]"
            data-testid="credit-sale-customer-phone"
          />
          {error && <p className="text-[11px] text-destructive">Couldn&apos;t add customer, try again.</p>}
          <div className="flex gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="h-8 flex-1 text-[12px]"
              disabled={saving}
              onClick={startCreate}
              data-testid="credit-sale-customer-save"
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

function CreditSaleConfirmation({
  sale,
  onDone,
}: {
  sale: { lines: Line[]; total: number; customer: Customer };
  onDone: () => void;
}) {
  return (
    <div className="flex min-h-full flex-col" data-testid="credit-sale-confirmation">
      <div className="flex-1 space-y-4 p-4">
        <div className="flex flex-col items-center rounded-lg border bg-card px-6 py-8 text-center">
          <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-success-subtle text-success">
            <Check className="size-5" />
          </div>
          <p className="text-sm font-medium">Credit sale recorded</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{money(sale.total)}</p>
          <p className="mt-2 text-[13px] text-muted-foreground">{sale.customer.name}</p>
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
        </div>
      </div>

      <div className="sticky bottom-0 border-t bg-card px-4 py-3">
        <Button className="h-12 w-full text-[15px]" onClick={onDone} data-testid="credit-sale-new">
          Record another
        </Button>
      </div>
    </div>
  );
}

function CreditSaleSkeleton() {
  return (
    <div className="p-3" data-testid="credit-sale-loading">
      <Skeleton className="mb-3 h-10 w-full rounded-lg" />
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 9 }).map((_, i) => (
          <Skeleton key={i} className="h-[76px] rounded-lg" />
        ))}
      </div>
    </div>
  );
}
