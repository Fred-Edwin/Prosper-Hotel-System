"use client";

/**
 * Stock count — record what's physically on hand. Ticket 20.
 *
 * Mirrors issue-to-kitchen.tsx's search/pick/quantity/confirm shape, the
 * closest existing precedent for a multi-line item-and-quantity entry —
 * with two differences: items may be either products or ingredients (this
 * is a location-generic mechanic per the ticket, not ingredient-only), and
 * confirming routes straight to the count's read view (StockCountDetail)
 * rather than a static "recorded" summary, since the count's whole point
 * is comparing counted against expected.
 */

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyFirstUse, ErrorState } from "@/components/patterns/states";
import { Search, Trash2, X, ClipboardList, Check } from "lucide-react";

type Item = {
  id: string;
  name: string;
  itemType: "product" | "ingredient";
  unit: string;
};

type Line = { item: Item; quantity: string };

export type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; items: Item[] };

async function fetchCountableItems(): Promise<LoadState> {
  try {
    const [productsRes, ingredientsRes] = await Promise.all([
      fetch("/api/catalogue/products/active"),
      fetch("/api/catalogue/ingredients/active"),
    ]);
    if (!productsRes.ok || !ingredientsRes.ok) return { status: "error" };
    const productsBody = await productsRes.json();
    const ingredientsBody = await ingredientsRes.json();
    if (!Array.isArray(productsBody?.products) || !Array.isArray(ingredientsBody?.ingredients)) {
      return { status: "error" };
    }
    const items: Item[] = [
      ...productsBody.products
        .filter((p: { kind: string }) => p.kind !== "service")
        .map((p: { id: string; name: string }) => ({
          id: p.id,
          name: p.name,
          itemType: "product" as const,
          unit: "unit",
        })),
      ...ingredientsBody.ingredients.map(
        (i: { id: string; name: string; unitOfMeasure: string }) => ({
          id: i.id,
          name: i.name,
          itemType: "ingredient" as const,
          unit: i.unitOfMeasure,
        }),
      ),
    ];
    return { status: "ready", items };
  } catch {
    return { status: "error" };
  }
}

async function submitCount(input: {
  lines: { itemType: "product" | "ingredient"; itemId: string; countedQuantity: number }[];
}): Promise<{ ok: true; countId: string } | { ok: false; error: string }> {
  try {
    const response = await fetch("/api/stock/counts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      return { ok: false, error: body?.error ?? "unknown" };
    }
    const body = await response.json();
    return { ok: true, countId: body.count.id };
  } catch {
    return { ok: false, error: "network" };
  }
}

export function RecordStockCount({ onRecorded }: { onRecorded?: (countId: string) => void }) {
  const [attempt, setAttempt] = useState(0);
  return (
    <RecordStockCountForAttempt
      key={attempt}
      onRetry={() => setAttempt((a) => a + 1)}
      onRecorded={onRecorded}
    />
  );
}

function RecordStockCountForAttempt({
  onRetry,
  onRecorded,
}: {
  onRetry: () => void;
  onRecorded?: (countId: string) => void;
}) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    fetchCountableItems().then((result) => {
      if (!cancelled) setState(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return <RecordStockCountView state={state} onRetry={onRetry} onRecorded={onRecorded} />;
}

/** The presentational half — what Storybook mounts to show every state
 * without a network. */
export function RecordStockCountView({
  state,
  onRetry = () => {},
  onRecorded = () => {},
  onSubmit = submitCount,
}: {
  state: LoadState;
  onRetry?: () => void;
  onRecorded?: (countId: string) => void;
  onSubmit?: typeof submitCount;
}) {
  if (state.status === "loading") return <CountingSkeleton />;
  if (state.status === "error") {
    return (
      <div className="p-3">
        <ErrorState what="items to count" onRetry={onRetry} />
      </div>
    );
  }
  if (state.items.length === 0) {
    return (
      <div className="p-3">
        <EmptyFirstUse
          icon={<ClipboardList className="size-4" />}
          title="Nothing to count yet"
          body="Once products or ingredients are added in the catalogue, they will appear here to count."
        />
      </div>
    );
  }

  return <Counting items={state.items} onRecorded={onRecorded} onSubmit={onSubmit} />;
}

function Counting({
  items,
  onRecorded,
  onSubmit,
}: {
  items: Item[];
  onRecorded: (countId: string) => void;
  onSubmit: typeof submitCount;
}) {
  const [query, setQuery] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const shown = query.trim()
    ? items.filter((i) => i.name.toLowerCase().includes(query.trim().toLowerCase()))
    : items;

  const add = (item: Item) =>
    setLines((ls) => {
      if (ls.some((l) => l.item.id === item.id)) return ls;
      return [...ls, { item, quantity: "" }];
    });

  const remove = (id: string) => setLines((ls) => ls.filter((l) => l.item.id !== id));

  const setQuantity = (id: string, quantity: string) =>
    setLines((ls) => ls.map((l) => (l.item.id === id ? { ...l, quantity } : l)));

  const linesComplete = lines.length > 0 && lines.every((l) => Number(l.quantity) >= 0 && l.quantity !== "");
  const canComplete = linesComplete && !submitting;

  const complete = async () => {
    setSubmitting(true);
    setSubmitError(null);
    const result = await onSubmit({
      lines: lines.map((l) => ({
        itemType: l.item.itemType,
        itemId: l.item.id,
        countedQuantity: Number(l.quantity),
      })),
    });
    setSubmitting(false);
    if (!result.ok) {
      setSubmitError(result.error);
      return;
    }
    onRecorded(result.countId);
  };

  return (
    <div className="flex min-h-full flex-col">
      <div className="border-b bg-card px-3 pt-2 pb-2">
        <div className="relative">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products or ingredients"
            className="h-10 pl-8"
            data-testid="count-search"
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
          <div className="grid grid-cols-2 gap-2" data-testid="count-item-grid">
            {shown.map((i) => {
              const inLines = lines.some((l) => l.item.id === i.id);
              return (
                <button
                  key={i.id}
                  onClick={() => add(i)}
                  title={i.name}
                  disabled={inLines}
                  data-testid="count-item-tile"
                  className={`relative flex h-[64px] flex-col items-start justify-between rounded-lg border bg-card p-2 text-left transition-colors duration-100 disabled:opacity-50 ${
                    inLines ? "border-neutral-400" : "active:bg-accent"
                  }`}
                >
                  <span className="line-clamp-2 text-[13px] leading-tight font-medium">
                    {i.name}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {i.itemType === "ingredient" ? i.unit : "product"}
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
          <div className="max-h-64 overflow-y-auto px-4 py-1.5" data-testid="count-lines">
            {lines.map((l) => (
              <div key={l.item.id} className="flex items-center gap-2 border-b py-2 last:border-0">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium">{l.item.name}</div>
                  <div className="mt-1 flex items-center gap-1.5">
                    <Input
                      inputMode="numeric"
                      placeholder="Qty"
                      value={l.quantity}
                      onChange={(e) => setQuantity(l.item.id, e.target.value)}
                      className="h-8 w-20 text-[13px]"
                      data-testid={`count-quantity-${l.item.id}`}
                    />
                    <span className="text-[11px] text-muted-foreground">
                      {l.item.itemType === "ingredient" ? l.item.unit : "units"}
                    </span>
                  </div>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7 shrink-0 text-muted-foreground"
                  onClick={() => remove(l.item.id)}
                  aria-label={`Remove ${l.item.name}`}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-2.5 border-t px-4 py-3">
          {submitError && (
            <p className="text-[11px] text-destructive">
              Couldn&apos;t record the count. Nothing was lost — check the lines and try again.
            </p>
          )}

          <Button
            className="h-12 w-full text-[15px]"
            disabled={!canComplete}
            onClick={complete}
            data-testid="count-complete"
          >
            {submitting ? "Recording…" : "Record count"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function CountingSkeleton() {
  return (
    <div className="p-3" data-testid="count-loading">
      <Skeleton className="mb-3 h-10 w-full rounded-lg" />
      <div className="grid grid-cols-2 gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-[64px] rounded-lg" />
        ))}
      </div>
    </div>
  );
}
