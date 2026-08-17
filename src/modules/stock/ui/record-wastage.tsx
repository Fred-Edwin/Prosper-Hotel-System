"use client";

/**
 * Non-sales — record stock that left without being sold: wasted, staff
 * meals, or complimentary (CONTEXT.md's Non-sales Stock Consumption).
 * Nav label and category copy renamed from "Wastage"/"Consumed"/"Given
 * away" so the tab doesn't read as wastage-only when staff meals are the
 * more frequent reason staff open it. Underlying StockMovementReason
 * values (consumed, given_away) and the "wastage" route/nav key are
 * unchanged — this is a display-copy rename only.
 *
 * Course-correction on receive-delivery.tsx's item-tile pattern (ticket
 * 12), simplified from a multi-line basket to a single item per entry —
 * this ticket's acceptance criteria describe one item/quantity/category
 * per record, not a batch. No design-reference precedent exists for a
 * dedicated wastage screen (checked — only a nav placeholder was ever
 * designed), so this composition was confirmed with the user rather than
 * invented, per docs/architecture.md's design-gap pattern.
 *
 * Category is a three-way pill group, same styling as New sale's
 * counter/delivery toggle — the screen's one accent element stays the
 * final "Record" action, not the pills.
 *
 * 2026-08-17 (blind picking): every tile now carries what is on hand, and
 * the quantity is capped at it. This screen read the catalogue — what
 * exists — so staff recorded a loss without being shown how much there
 * was to lose.
 *
 * A soft constraint, as on Issue to Kitchen: you cannot waste more than
 * you hold, so an over-quantity blocks the submit, but a zero-stock tile
 * stays enabled rather than vanishing from the picker.
 */

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyFirstUse, ErrorState } from "@/components/patterns/states";
import { Search, X, Trash2, Utensils, Gift, Check, PackageX } from "lucide-react";
import { money } from "@/shared/money";

type Product = {
  id: string;
  name: string;
  kind: "goods" | "cooked_food" | "service" | "packaging";
  priceMinor: number | null;
  active: boolean;
  /** From the movement ledger, not the catalogue — see the header note. */
  quantityOnHand: number;
};

type Ingredient = {
  id: string;
  name: string;
  unitOfMeasure: string;
  lastKnownCostMinor: number | null;
  active: boolean;
  quantityOnHand: number;
};

type Item =
  | { type: "product"; item: Product }
  | { type: "ingredient"; item: Ingredient };

type Category = "wasted" | "consumed" | "given_away";

/** An ingredient carries its own unit of measure; a product is counted in
 * bare units, so it has no word of its own. */
function unitFor(entry: Item): string {
  return entry.type === "ingredient" ? entry.item.unitOfMeasure : "";
}

export type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; products: Product[]; ingredients: Ingredient[] };

/**
 * Two sources, as on Receiving: the catalogue owns what an item is worth
 * (selling price, last-known cost — this screen values the loss), stock
 * owns how much of it is here. Merged by id rather than teaching the
 * catalogue about the ledger.
 */
async function fetchItems(locationId: string): Promise<LoadState> {
  try {
    const [productsRes, ingredientsRes, onHandRes] = await Promise.all([
      fetch(`/api/catalogue/products/active?locationId=${encodeURIComponent(locationId)}`),
      fetch("/api/catalogue/ingredients/active"),
      fetch("/api/stock/pickable-items?purpose=wastage"),
    ]);
    if (!productsRes.ok || !ingredientsRes.ok || !onHandRes.ok) return { status: "error" };
    const productsBody = await productsRes.json();
    const ingredientsBody = await ingredientsRes.json();
    const onHandBody = await onHandRes.json();
    if (
      !Array.isArray(productsBody?.products) ||
      !Array.isArray(ingredientsBody?.ingredients) ||
      !Array.isArray(onHandBody?.items)
    ) {
      return { status: "error" };
    }

    const quantityByItemId = new Map<string, number>(
      (onHandBody.items as { itemId: string; quantityOnHand: number }[]).map((item) => [
        item.itemId,
        item.quantityOnHand,
      ]),
    );
    const withQuantity = <T extends { id: string }>(item: T) => ({
      ...item,
      quantityOnHand: quantityByItemId.get(item.id) ?? 0,
    });

    return {
      status: "ready",
      products: productsBody.products.map(withQuantity),
      ingredients: ingredientsBody.ingredients.map(withQuantity),
    };
  } catch {
    return { status: "error" };
  }
}

async function submitWastage(input: {
  itemType: "product" | "ingredient";
  itemId: string;
  quantity: number;
  category: Category;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const response = await fetch("/api/stock/wastage", {
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

export function RecordWastage({
  onDone,
  locationId,
}: {
  onDone?: () => void;
  locationId: string;
}) {
  const [attempt, setAttempt] = useState(0);
  return (
    <RecordWastageForAttempt
      key={attempt}
      onRetry={() => setAttempt((a) => a + 1)}
      onDone={onDone}
      locationId={locationId}
    />
  );
}

function RecordWastageForAttempt({
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
    fetchItems(locationId).then((result) => {
      if (!cancelled) setState(result);
    });
    return () => {
      cancelled = true;
    };
  }, [locationId]);

  return <RecordWastageView state={state} onRetry={onRetry} onDone={onDone} />;
}

/** The presentational half — what Storybook mounts to show every state
 * without a network. */
export function RecordWastageView({
  state,
  onRetry = () => {},
  onDone = () => {},
  onSubmit = submitWastage,
}: {
  state: LoadState;
  onRetry?: () => void;
  onDone?: () => void;
  onSubmit?: typeof submitWastage;
}) {
  if (state.status === "loading") return <WastageSkeleton />;
  if (state.status === "error") {
    return (
      <div className="p-3">
        <ErrorState what="items" onRetry={onRetry} />
      </div>
    );
  }
  if (state.products.length === 0 && state.ingredients.length === 0) {
    return (
      <div className="p-3">
        <EmptyFirstUse
          icon={<PackageX className="size-4" />}
          title="Nothing to record yet"
          body="Once products or ingredients exist in the catalogue, they will appear here to record as wasted, staff meals or complimentary."
        />
      </div>
    );
  }

  return (
    <Wastage
      products={state.products}
      ingredients={state.ingredients}
      onDone={onDone}
      onSubmit={onSubmit}
    />
  );
}

const categories: { key: Category; label: string; icon: typeof Trash2 }[] = [
  { key: "wasted", label: "Wasted", icon: Trash2 },
  { key: "consumed", label: "Staff meals", icon: Utensils },
  { key: "given_away", label: "Complimentary", icon: Gift },
];

function Wastage({
  products,
  ingredients,
  onDone,
  onSubmit,
}: {
  products: Product[];
  ingredients: Ingredient[];
  onDone: () => void;
  onSubmit: typeof submitWastage;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Item | null>(null);
  const [quantity, setQuantity] = useState("");
  const [category, setCategory] = useState<Category>("wasted");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<{ item: Item; quantity: string; category: Category } | null>(
    null,
  );

  const items: Item[] = [
    ...products.map((item): Item => ({ type: "product", item })),
    ...ingredients.map((item): Item => ({ type: "ingredient", item })),
  ];

  const shown = query.trim()
    ? items.filter((i) => i.item.name.toLowerCase().includes(query.trim().toLowerCase()))
    : items;

  // As on Issue to Kitchen: an over-quantity blocks the submit rather than
  // being silently clamped, so staff see the figure they typed and decide.
  const overStock = selected != null && Number(quantity) > selected.item.quantityOnHand;

  const canComplete =
    selected != null && Number(quantity) > 0 && !overStock && !submitting;

  const complete = async () => {
    if (!selected) return;
    setSubmitting(true);
    setSubmitError(null);
    const result = await onSubmit({
      itemType: selected.type,
      itemId: selected.item.id,
      quantity: Number(quantity),
      category,
    });
    setSubmitting(false);
    if (!result.ok) {
      setSubmitError(result.error);
      return;
    }
    setConfirmed({ item: selected, quantity, category });
  };

  if (confirmed) {
    return <WastageConfirmation entry={confirmed} onDone={onDone} />;
  }

  return (
    <div className="flex min-h-full flex-col">
      <div className="border-b bg-card px-3 pt-2 pb-2">
        <div className="relative">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products and ingredients"
            className="h-10 pl-8"
            data-testid="wastage-search"
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
          <div className="grid grid-cols-2 gap-2" data-testid="wastage-item-grid">
            {shown.map((entry) => {
              const isSelected = selected?.item.id === entry.item.id && selected?.type === entry.type;
              const subtitle =
                entry.type === "product"
                  ? entry.item.priceMinor != null
                    ? money(entry.item.priceMinor)
                    : "No price set"
                  : entry.item.unitOfMeasure;
              return (
                <button
                  key={`${entry.type}-${entry.item.id}`}
                  onClick={() => setSelected(entry)}
                  title={entry.item.name}
                  data-testid="wastage-item-tile"
                  className={`relative flex h-[76px] flex-col items-start justify-between rounded-lg border bg-card p-2 text-left transition-colors duration-100 ${
                    isSelected ? "border-neutral-400" : "active:bg-accent"
                  }`}
                >
                  <span className="line-clamp-2 text-[13px] leading-tight font-medium">
                    {entry.item.name}
                  </span>
                  {/* Zero stays enabled and unstyled — information, not a
                      warning. The over-quantity guard below does the work. */}
                  <span className="text-[11px] text-muted-foreground">
                    {subtitle}
                    {" · "}
                    <span data-testid="wastage-item-onhand">
                      {entry.item.quantityOnHand > 0
                        ? [entry.item.quantityOnHand, unitFor(entry), "left"]
                            .filter(Boolean)
                            .join(" ")
                        : "none left"}
                    </span>
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
          <div className="space-y-3 border-b px-4 py-3" data-testid="wastage-detail">
            <div className="flex items-center justify-between gap-3">
              <span className="min-w-0 truncate text-[13px] font-medium">{selected.item.name}</span>
              <Input
                inputMode="numeric"
                placeholder="Qty"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="h-9 w-20 text-[13px]"
                data-testid="wastage-quantity"
              />
            </div>

            {overStock && (
              <p className="text-[11px] text-destructive" data-testid="wastage-overstock">
                Only{" "}
                {[selected.item.quantityOnHand, unitFor(selected)].filter(Boolean).join(" ")} in
                stock.
              </p>
            )}

            <div className="flex gap-1 rounded-lg bg-muted p-1">
              {categories.map((c) => {
                const Icon = c.icon;
                const on = category === c.key;
                return (
                  <button
                    key={c.key}
                    onClick={() => setCategory(c.key)}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 text-[13px] font-medium transition-colors duration-100 ${
                      on ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                    }`}
                    aria-pressed={on}
                    data-testid={`wastage-category-${c.key}`}
                  >
                    <Icon className="size-3.5" />
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="space-y-2.5 px-4 py-3">
          {submitError && (
            <p className="text-[11px] text-destructive">
              Couldn&apos;t record the entry. Nothing was lost — check the details and try again.
            </p>
          )}

          <Button
            className="h-12 w-full text-[15px]"
            disabled={!canComplete}
            onClick={complete}
            data-testid="wastage-complete"
          >
            {submitting ? "Recording…" : "Record"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function WastageConfirmation({
  entry,
  onDone,
}: {
  entry: { item: Item; quantity: string; category: Category };
  onDone: () => void;
}) {
  const categoryLabel = categories.find((c) => c.key === entry.category)?.label ?? entry.category;
  const unit = unitFor(entry.item);

  return (
    <div className="flex min-h-full flex-col" data-testid="wastage-confirmation">
      <div className="flex-1 space-y-4 p-4">
        <div className="flex flex-col items-center rounded-lg border bg-card px-6 py-8 text-center">
          <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-success-subtle text-success">
            <Check className="size-5" />
          </div>
          <p className="text-sm font-medium">Recorded as {categoryLabel.toLowerCase()}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {entry.quantity} {unit} {entry.item.item.name}
          </p>
        </div>
      </div>

      <div className="sticky bottom-0 border-t bg-card px-4 py-3">
        <Button className="h-12 w-full text-[15px]" onClick={onDone} data-testid="wastage-new">
          Record another
        </Button>
      </div>
    </div>
  );
}

function WastageSkeleton() {
  return (
    <div className="p-3" data-testid="wastage-loading">
      <Skeleton className="mb-3 h-10 w-full rounded-lg" />
      <div className="grid grid-cols-2 gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-[76px] rounded-lg" />
        ))}
      </div>
    </div>
  );
}
