"use client";

/**
 * Receiving — record a delivery into the store.
 *
 * Mirrors New sale's line-entry pattern per ticket 12: search/pick an
 * item, add it as a line, enter quantity and price paid per unit,
 * confirm. Simpler than the till in one respect — there's no payment
 * step here (that's a separate Cash Movement the owner records, per
 * architecture.md: "recording a receipt is not paying for it") — so a
 * line is complete as soon as quantity and price are filled in.
 *
 * Ticket 22: a delivery may include ingredients, products, or both in one
 * visit (e.g. the canteen receiving printer paper and airtime scratch
 * cards together) — an Ingredients/Products toggle filters which picker
 * is shown, but lines from both kinds can sit together in one delivery.
 */

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyFirstUse, ErrorState } from "@/components/patterns/states";
import { Search, Trash2, X, PackagePlus, Check } from "lucide-react";
import { money } from "@/shared/money";

type Ingredient = {
  id: string;
  name: string;
  unitOfMeasure: string;
  lastKnownCostMinor: number | null;
  active: boolean;
};

type Product = {
  id: string;
  name: string;
  lastKnownCostMinor: number | null;
  active: boolean;
};

type Item =
  | { itemType: "ingredient"; ingredient: Ingredient }
  | { itemType: "product"; product: Product };

type Line = {
  itemType: "product" | "ingredient";
  itemId: string;
  name: string;
  unit: string;
  lastKnownCostMinor: number | null;
  quantity: string;
  unitCostMinor: string;
};

export type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; ingredients: Ingredient[]; products: Product[] };

async function fetchIngredientsAndProducts(locationId: string): Promise<LoadState> {
  try {
    const [ingredientsResponse, productsResponse] = await Promise.all([
      fetch("/api/catalogue/ingredients/active"),
      fetch(`/api/catalogue/products/active?locationId=${encodeURIComponent(locationId)}`),
    ]);
    if (!ingredientsResponse.ok || !productsResponse.ok) return { status: "error" };
    const ingredientsBody = await ingredientsResponse.json();
    const productsBody = await productsResponse.json();
    if (!Array.isArray(ingredientsBody?.ingredients) || !Array.isArray(productsBody?.products)) {
      return { status: "error" };
    }
    return {
      status: "ready",
      ingredients: ingredientsBody.ingredients,
      products: productsBody.products,
    };
  } catch {
    return { status: "error" };
  }
}

async function submitReceipt(input: {
  lines: {
    itemType: "product" | "ingredient";
    itemId: string;
    quantity: number;
    unitCostMinor: number;
  }[];
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const response = await fetch("/api/stock/receive", {
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

export function ReceiveDelivery({
  onDone,
  locationId,
}: {
  onDone?: () => void;
  locationId: string;
}) {
  const [attempt, setAttempt] = useState(0);
  return (
    <ReceiveDeliveryForAttempt
      key={attempt}
      onRetry={() => setAttempt((a) => a + 1)}
      onDone={onDone}
      locationId={locationId}
    />
  );
}

function ReceiveDeliveryForAttempt({
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
    fetchIngredientsAndProducts(locationId).then((result) => {
      if (!cancelled) setState(result);
    });
    return () => {
      cancelled = true;
    };
  }, [locationId]);

  return <ReceiveDeliveryView state={state} onRetry={onRetry} onDone={onDone} />;
}

/** The presentational half — what Storybook mounts to show every state
 * without a network. */
export function ReceiveDeliveryView({
  state,
  onRetry = () => {},
  onDone = () => {},
  onSubmit = submitReceipt,
}: {
  state: LoadState;
  onRetry?: () => void;
  onDone?: () => void;
  onSubmit?: typeof submitReceipt;
}) {
  if (state.status === "loading") return <ReceivingSkeleton />;
  if (state.status === "error") {
    return (
      <div className="p-3">
        <ErrorState what="items" onRetry={onRetry} />
      </div>
    );
  }
  if (state.ingredients.length === 0 && state.products.length === 0) {
    return (
      <div className="p-3">
        <EmptyFirstUse
          icon={<PackagePlus className="size-4" />}
          title="Nothing to receive yet"
          body="Once ingredients or products are added in the catalogue, they will appear here to record a delivery against."
        />
      </div>
    );
  }

  return (
    <Receiving
      ingredients={state.ingredients}
      products={state.products}
      onDone={onDone}
      onSubmit={onSubmit}
    />
  );
}

function Receiving({
  ingredients,
  products,
  onDone,
  onSubmit,
}: {
  ingredients: Ingredient[];
  products: Product[];
  onDone: () => void;
  onSubmit: typeof submitReceipt;
}) {
  const [tab, setTab] = useState<"ingredient" | "product">(
    ingredients.length === 0 && products.length > 0 ? "product" : "ingredient",
  );
  const [query, setQuery] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<Line[] | null>(null);

  const items: Item[] =
    tab === "ingredient"
      ? ingredients.map((ingredient) => ({ itemType: "ingredient" as const, ingredient }))
      : products.map((product) => ({ itemType: "product" as const, product }));

  const shown = query.trim()
    ? items.filter((i) => {
        const name = i.itemType === "ingredient" ? i.ingredient.name : i.product.name;
        return name.toLowerCase().includes(query.trim().toLowerCase());
      })
    : items;

  const add = (item: Item) => {
    const itemId = item.itemType === "ingredient" ? item.ingredient.id : item.product.id;
    setLines((ls) => {
      if (ls.some((l) => l.itemId === itemId)) return ls;
      const name = item.itemType === "ingredient" ? item.ingredient.name : item.product.name;
      const lastKnownCostMinor =
        item.itemType === "ingredient" ? item.ingredient.lastKnownCostMinor : item.product.lastKnownCostMinor;
      return [
        ...ls,
        {
          itemType: item.itemType,
          itemId,
          name,
          unit: item.itemType === "ingredient" ? item.ingredient.unitOfMeasure : "unit",
          lastKnownCostMinor,
          quantity: "",
          unitCostMinor: lastKnownCostMinor != null ? String(lastKnownCostMinor) : "",
        },
      ];
    });
  };

  const remove = (itemId: string) => setLines((ls) => ls.filter((l) => l.itemId !== itemId));

  const setQuantity = (itemId: string, quantity: string) =>
    setLines((ls) => ls.map((l) => (l.itemId === itemId ? { ...l, quantity } : l)));

  const setUnitCost = (itemId: string, unitCostMinor: string) =>
    setLines((ls) => ls.map((l) => (l.itemId === itemId ? { ...l, unitCostMinor } : l)));

  const linesComplete =
    lines.length > 0 &&
    lines.every((l) => Number(l.quantity) > 0 && Number(l.unitCostMinor) >= 0 && l.unitCostMinor !== "");
  const canComplete = linesComplete && !submitting;

  // Not a payment step — architecture.md: "recording a receipt is not
  // paying for it," the money leaving is a separate Cash Movement. This
  // total is a sanity check before submitting, not a figure that gates
  // completion the way New sale's remaining-balance does.
  const total = lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unitCostMinor) || 0), 0);

  const complete = async () => {
    setSubmitting(true);
    setSubmitError(null);
    const result = await onSubmit({
      lines: lines.map((l) => ({
        itemType: l.itemType,
        itemId: l.itemId,
        quantity: Number(l.quantity),
        unitCostMinor: Number(l.unitCostMinor),
      })),
    });
    setSubmitting(false);
    if (!result.ok) {
      setSubmitError(result.error);
      return;
    }
    setConfirmed(lines);
  };

  if (confirmed) {
    return <ReceiptConfirmation lines={confirmed} onDone={onDone} />;
  }

  return (
    <div className="flex min-h-full flex-col">
      <div className="border-b bg-card px-3 pt-2 pb-2">
        <div
          className="mb-2 grid grid-cols-2 gap-1 rounded-lg bg-muted p-1"
          role="tablist"
          aria-label="Item type"
        >
          <button
            role="tab"
            aria-selected={tab === "ingredient"}
            onClick={() => setTab("ingredient")}
            data-testid="receive-tab-ingredient"
            className={`h-8 rounded-md text-[13px] font-medium transition-colors duration-100 ${
              tab === "ingredient" ? "bg-card shadow-sm" : "text-muted-foreground"
            }`}
          >
            Ingredients
          </button>
          <button
            role="tab"
            aria-selected={tab === "product"}
            onClick={() => setTab("product")}
            data-testid="receive-tab-product"
            className={`h-8 rounded-md text-[13px] font-medium transition-colors duration-100 ${
              tab === "product" ? "bg-card shadow-sm" : "text-muted-foreground"
            }`}
          >
            Products
          </button>
        </div>
        <div className="relative">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tab === "ingredient" ? "Search ingredients" : "Search products"}
            className="h-10 pl-8"
            data-testid="receive-search"
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
        {items.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-muted-foreground">
              No {tab === "ingredient" ? "ingredients" : "products"} to receive yet.
            </p>
          </div>
        ) : shown.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-muted-foreground">
              Nothing matches &ldquo;{query}&rdquo;.
            </p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => setQuery("")}>
              Clear search
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2" data-testid="receive-item-grid">
            {shown.map((item) => {
              const itemId = item.itemType === "ingredient" ? item.ingredient.id : item.product.id;
              const name = item.itemType === "ingredient" ? item.ingredient.name : item.product.name;
              const lastKnownCostMinor =
                item.itemType === "ingredient"
                  ? item.ingredient.lastKnownCostMinor
                  : item.product.lastKnownCostMinor;
              const unit = item.itemType === "ingredient" ? item.ingredient.unitOfMeasure : "unit";
              const inLines = lines.some((l) => l.itemId === itemId);
              return (
                <button
                  key={itemId}
                  onClick={() => add(item)}
                  title={name}
                  disabled={inLines}
                  data-testid="receive-item-tile"
                  className={`relative flex h-[64px] flex-col items-start justify-between rounded-lg border bg-card p-2 text-left transition-colors duration-100 disabled:opacity-50 ${
                    inLines ? "border-neutral-400" : "active:bg-accent"
                  }`}
                >
                  <span className="line-clamp-2 text-[13px] leading-tight font-medium">{name}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {unit}
                    {lastKnownCostMinor != null && ` · last ${money(lastKnownCostMinor)}`}
                  </span>
                  {inLines && (
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
        {lines.length > 0 && (
          <div className="max-h-64 overflow-y-auto px-4 py-1.5" data-testid="receive-lines">
            {lines.map((l) => (
              <div key={l.itemId} className="flex items-center gap-2 border-b py-2 last:border-0">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium">{l.name}</div>
                  <div className="mt-1 flex items-center gap-1.5">
                    <Input
                      inputMode="numeric"
                      placeholder="Qty"
                      value={l.quantity}
                      onChange={(e) => setQuantity(l.itemId, e.target.value)}
                      className="h-8 w-20 text-[13px]"
                      data-testid={`receive-quantity-${l.itemId}`}
                    />
                    <span className="text-[11px] text-muted-foreground">{l.unit}</span>
                    <span className="text-[11px] text-muted-foreground">@</span>
                    <Input
                      inputMode="decimal"
                      placeholder="Price/unit"
                      value={l.unitCostMinor}
                      onChange={(e) => setUnitCost(l.itemId, e.target.value)}
                      className="h-8 w-24 text-[13px]"
                      data-testid={`receive-unitcost-${l.itemId}`}
                    />
                  </div>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7 shrink-0 text-muted-foreground"
                  onClick={() => remove(l.itemId)}
                  aria-label={`Remove ${l.name}`}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-2.5 border-t px-4 py-3">
          {lines.length > 0 && (
            <div className="flex items-baseline justify-between border-b pb-2">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="text-xl font-semibold tabular-nums" data-testid="receive-total">
                {money(total)}
              </span>
            </div>
          )}

          {submitError && (
            <p className="text-[11px] text-destructive">
              Couldn&apos;t record the delivery. Nothing was lost — check the lines and try
              again.
            </p>
          )}

          <Button
            className="h-12 w-full text-[15px]"
            disabled={!canComplete}
            onClick={complete}
            data-testid="receive-complete"
          >
            {submitting ? "Recording…" : "Record delivery"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ReceiptConfirmation({ lines, onDone }: { lines: Line[]; onDone: () => void }) {
  const total = lines.reduce((s, l) => s + Number(l.quantity) * Number(l.unitCostMinor), 0);

  return (
    <div className="flex min-h-full flex-col" data-testid="receive-confirmation">
      <div className="flex-1 space-y-4 p-4">
        <div className="flex flex-col items-center rounded-lg border bg-card px-6 py-8 text-center">
          <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-success-subtle text-success">
            <Check className="size-5" />
          </div>
          <p className="text-sm font-medium">Delivery recorded</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{money(total)}</p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {lines.length} {lines.length === 1 ? "item" : "items"} added to stock
          </p>
        </div>

        <div className="rounded-lg border bg-card p-3">
          {lines.map((l) => (
            <div key={l.itemId} className="flex justify-between gap-3 py-1.5 text-[13px]">
              <span className="min-w-0 truncate">
                {l.quantity} {l.unit} × {l.name}
              </span>
              <span className="shrink-0 tabular-nums">{money(Number(l.unitCostMinor))} / unit</span>
            </div>
          ))}
        </div>
      </div>

      <div className="sticky bottom-0 border-t bg-card px-4 py-3">
        <Button className="h-12 w-full text-[15px]" onClick={onDone} data-testid="receive-new">
          Record another delivery
        </Button>
      </div>
    </div>
  );
}

function ReceivingSkeleton() {
  return (
    <div className="p-3" data-testid="receive-loading">
      <Skeleton className="mb-3 h-10 w-full rounded-lg" />
      <div className="grid grid-cols-2 gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-[64px] rounded-lg" />
        ))}
      </div>
    </div>
  );
}
