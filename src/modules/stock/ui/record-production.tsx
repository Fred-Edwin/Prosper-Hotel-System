"use client";

/**
 * Production — record what the kitchen made from ingredients that
 * reached it. Ticket 19.
 *
 * Single product/quantity per entry, mirroring record-wastage.tsx's
 * item-then-quantity shape rather than issuing's multi-line basket — the
 * ticket's acceptance criteria describe one product and quantity per
 * record. The picker narrows to active cooked_food products (the only
 * kind recipes attach to, per catalogue) via the existing active-products
 * endpoint — no new catalogue endpoint added for this. A cooked_food
 * product can still lack a current recipe; the API's no_recipe rejection
 * is the real gate and surfaces as submitError below.
 */

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyFirstUse, ErrorState } from "@/components/patterns/states";
import { Search, X, Check, ChefHat } from "lucide-react";
import { money } from "@/shared/money";

type Product = {
  id: string;
  name: string;
  kind: "goods" | "cooked_food" | "service" | "packaging";
  priceMinor: number | null;
  active: boolean;
};

export type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; products: Product[] };

async function fetchProducibleProducts(): Promise<LoadState> {
  try {
    const response = await fetch("/api/catalogue/products/active");
    if (!response.ok) return { status: "error" };
    const body = await response.json();
    if (!Array.isArray(body?.products)) return { status: "error" };
    const producible = body.products.filter((p: Product) => p.kind === "cooked_food");
    return { status: "ready", products: producible };
  } catch {
    return { status: "error" };
  }
}

async function submitProduction(input: {
  productId: string;
  quantity: number;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const response = await fetch("/api/stock/produce", {
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

export function RecordProduction({ onDone }: { onDone?: () => void }) {
  const [attempt, setAttempt] = useState(0);
  return (
    <RecordProductionForAttempt
      key={attempt}
      onRetry={() => setAttempt((a) => a + 1)}
      onDone={onDone}
    />
  );
}

function RecordProductionForAttempt({
  onRetry,
  onDone,
}: {
  onRetry: () => void;
  onDone?: () => void;
}) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    fetchProducibleProducts().then((result) => {
      if (!cancelled) setState(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return <RecordProductionView state={state} onRetry={onRetry} onDone={onDone} />;
}

/** The presentational half — what Storybook mounts to show every state
 * without a network. */
export function RecordProductionView({
  state,
  onRetry = () => {},
  onDone = () => {},
  onSubmit = submitProduction,
}: {
  state: LoadState;
  onRetry?: () => void;
  onDone?: () => void;
  onSubmit?: typeof submitProduction;
}) {
  if (state.status === "loading") return <ProductionSkeleton />;
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
          icon={<ChefHat className="size-4" />}
          title="Nothing to produce yet"
          body="Once a product has a recipe set in the catalogue, it will appear here to record as produced."
        />
      </div>
    );
  }

  return <Production products={state.products} onDone={onDone} onSubmit={onSubmit} />;
}

function Production({
  products,
  onDone,
  onSubmit,
}: {
  products: Product[];
  onDone: () => void;
  onSubmit: typeof submitProduction;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<{ product: Product; quantity: string } | null>(null);

  const shown = query.trim()
    ? products.filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase()))
    : products;

  const canComplete = selected != null && Number(quantity) > 0 && !submitting;

  const complete = async () => {
    if (!selected) return;
    setSubmitting(true);
    setSubmitError(null);
    const result = await onSubmit({
      productId: selected.id,
      quantity: Number(quantity),
    });
    setSubmitting(false);
    if (!result.ok) {
      setSubmitError(result.error);
      return;
    }
    setConfirmed({ product: selected, quantity });
  };

  if (confirmed) {
    return <ProductionConfirmation entry={confirmed} onDone={onDone} />;
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
            data-testid="production-search"
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
          <div className="grid grid-cols-2 gap-2" data-testid="production-product-grid">
            {shown.map((p) => {
              const isSelected = selected?.id === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setSelected(p)}
                  title={p.name}
                  data-testid="production-product-tile"
                  className={`relative flex h-[64px] flex-col items-start justify-between rounded-lg border bg-card p-2 text-left transition-colors duration-100 ${
                    isSelected ? "border-neutral-400" : "active:bg-accent"
                  }`}
                >
                  <span className="line-clamp-2 text-[13px] leading-tight font-medium">
                    {p.name}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {p.priceMinor != null ? money(p.priceMinor) : "No price set"}
                  </span>
                  {isSelected && (
                    <span className="absolute top-1.5 right-1.5 flex size-5 items-center justify-center rounded-full bg-neutral-700 text-white">
                      <Check className="size-3" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="border-t bg-card">
        {selected && (
          <div className="flex items-center justify-between gap-3 border-b px-4 py-3" data-testid="production-detail">
            <span className="min-w-0 truncate text-[13px] font-medium">{selected.name}</span>
            <Input
              inputMode="numeric"
              placeholder="Qty"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="h-9 w-20 text-[13px]"
              data-testid="production-quantity"
            />
          </div>
        )}

        <div className="space-y-2.5 px-4 py-3">
          {submitError && (
            <p className="text-[11px] text-destructive">
              Couldn&apos;t record the production. Nothing was lost — check the details and try
              again.
            </p>
          )}

          <Button
            className="h-12 w-full text-[15px]"
            disabled={!canComplete}
            onClick={complete}
            data-testid="production-complete"
          >
            {submitting ? "Recording…" : "Record production"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ProductionConfirmation({
  entry,
  onDone,
}: {
  entry: { product: Product; quantity: string };
  onDone: () => void;
}) {
  return (
    <div className="flex min-h-full flex-col" data-testid="production-confirmation">
      <div className="flex-1 space-y-4 p-4">
        <div className="flex flex-col items-center rounded-lg border bg-card px-6 py-8 text-center">
          <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-success-subtle text-success">
            <Check className="size-5" />
          </div>
          <p className="text-sm font-medium">Production recorded</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {entry.quantity} {entry.product.name}
          </p>
        </div>
      </div>

      <div className="sticky bottom-0 border-t bg-card px-4 py-3">
        <Button className="h-12 w-full text-[15px]" onClick={onDone} data-testid="production-new">
          Record another
        </Button>
      </div>
    </div>
  );
}

function ProductionSkeleton() {
  return (
    <div className="p-3" data-testid="production-loading">
      <Skeleton className="mb-3 h-10 w-full rounded-lg" />
      <div className="grid grid-cols-2 gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-[64px] rounded-lg" />
        ))}
      </div>
    </div>
  );
}
