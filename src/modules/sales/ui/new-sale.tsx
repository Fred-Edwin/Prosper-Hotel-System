"use client";

/**
 * New sale — the staff shell's till.
 *
 * Adapted from the design-reference worktree's locked round-two prototype
 * (`components/design/till/till-r2.tsx`, commit a977bea) rather than
 * invented — see docs/architecture.md's precedent table. Trimmed to what
 * this ticket builds:
 *
 *   - Counter fulfilment only. The prototype's mode switch (counter/
 *     delivery/credit) is dropped; delivery and credit are separate
 *     tickets and this screen never offers them.
 *   - Cash and M-Pesa payment lines only, no credit line and therefore no
 *     customer selector — the prototype's "no customer field in the
 *     counter flow" correction holds by construction here.
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
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyFirstUse, ErrorState } from "@/components/patterns/states";
import { Minus, Plus, Search, Trash2, X, ShoppingCart, Check } from "lucide-react";
import { money } from "@/shared/money";

type Product = {
  id: string;
  name: string;
  kind: "goods" | "cooked_food" | "service" | "packaging";
  priceMinor: number | null;
  active: boolean;
};

type PaymentMethod = "cash" | "mpesa";

type Line = { product: Product; qty: number };
type Pay = { id: number; method: PaymentMethod; amount: string };

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

async function submitSale(input: {
  lines: { productId: string; quantity: number }[];
  paymentLines: { method: PaymentMethod; amountMinor: number }[];
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

export function NewSale({ onDone }: { onDone?: () => void }) {
  const [attempt, setAttempt] = useState(0);
  return (
    <NewSaleForAttempt
      key={attempt}
      onRetry={() => setAttempt((a) => a + 1)}
      onDone={onDone}
    />
  );
}

function NewSaleForAttempt({
  onRetry,
  onDone,
}: {
  onRetry: () => void;
  onDone?: () => void;
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

  return <NewSaleView state={state} onRetry={onRetry} onDone={onDone} />;
}

/** The presentational half, driven by state rather than fetching — what
 * Storybook mounts to show every state without a network. */
export function NewSaleView({
  state,
  onRetry = () => {},
  onDone = () => {},
  onSubmit = submitSale,
}: {
  state: LoadState;
  onRetry?: () => void;
  onDone?: () => void;
  onSubmit?: typeof submitSale;
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

  return <Till products={state.products} onDone={onDone} onSubmit={onSubmit} />;
}

function Till({
  products,
  onDone,
  onSubmit,
}: {
  products: Product[];
  onDone: () => void;
  onSubmit: typeof submitSale;
}) {
  const [query, setQuery] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [pays, setPays] = useState<Pay[]>([
    { id: 1, method: "cash", amount: "" },
    { id: 2, method: "mpesa", amount: "" },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<{ lines: Line[]; total: number; pays: Pay[] } | null>(
    null,
  );

  const shown = query.trim()
    ? products.filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase()))
    : products;

  const total = lines.reduce((s, l) => s + (l.product.priceMinor ?? 0) * l.qty, 0);
  const paid = pays.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const remaining = total - paid;

  const add = (p: Product) =>
    setLines((ls) => {
      const hit = ls.find((l) => l.product.id === p.id);
      return hit
        ? ls.map((l) => (l.product.id === p.id ? { ...l, qty: l.qty + 1 } : l))
        : [...ls, { product: p, qty: 1 }];
    });

  const bump = (id: string, d: number) =>
    setLines((ls) =>
      ls
        .map((l) => (l.product.id === id ? { ...l, qty: l.qty + d } : l))
        .filter((l) => l.qty > 0),
    );

  const canComplete = lines.length > 0 && remaining === 0 && !submitting;

  const complete = async () => {
    setSubmitting(true);
    setSubmitError(null);
    const result = await onSubmit({
      lines: lines.map((l) => ({ productId: l.product.id, quantity: l.qty })),
      paymentLines: pays
        .filter((p) => Number(p.amount) > 0)
        .map((p) => ({ method: p.method, amountMinor: Number(p.amount) })),
    });
    setSubmitting(false);
    if (!result.ok) {
      setSubmitError(result.error);
      return;
    }
    setConfirmed({ lines, total, pays });
  };

  if (confirmed) {
    return <SaleConfirmation sale={confirmed} onDone={onDone} />;
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
          <div className="space-y-1.5">
            {pays.map((p) => (
              <div key={p.id} className="flex items-center gap-2">
                <Select
                  value={p.method}
                  onValueChange={(v) =>
                    setPays((ps) =>
                      ps.map((x) => (x.id === p.id ? { ...x, method: v as PaymentMethod } : x)),
                    )
                  }
                >
                  <SelectTrigger className="h-10 w-28 shrink-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="mpesa">M-Pesa</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  inputMode="numeric"
                  placeholder="0"
                  value={p.amount}
                  onChange={(e) =>
                    setPays((ps) =>
                      ps.map((x) => (x.id === p.id ? { ...x, amount: e.target.value } : x)),
                    )
                  }
                  className="h-10 flex-1 text-right tabular-nums"
                  data-testid={`till-pay-${p.method}`}
                />
              </div>
            ))}
          </div>

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
              Couldn&apos;t complete the sale. Nothing was lost — check payment and try again.
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

function SaleConfirmation({
  sale,
  onDone,
}: {
  sale: { lines: Line[]; total: number; pays: Pay[] };
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

        <div className="rounded-lg border bg-card p-3">
          {sale.pays
            .filter((p) => Number(p.amount) > 0)
            .map((p) => (
              <div key={p.id} className="flex justify-between gap-3 py-1.5 text-[13px]">
                <span className="capitalize">{p.method === "mpesa" ? "M-Pesa" : p.method}</span>
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
