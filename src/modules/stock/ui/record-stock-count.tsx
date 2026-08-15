"use client";

/**
 * Stock count — record what's physically on hand. Ticket 20.
 *
 * Mirrors issue-to-kitchen.tsx's search/pick/quantity/confirm shape, the
 * closest existing precedent for a multi-line item-and-quantity entry —
 * with two differences: items may be either products or ingredients (this
 * is a location-generic mechanic per the ticket, not ingredient-only), and
 * confirming routes to the count's read view (StockCountDetail) rather than
 * a static "recorded" summary, since the count's whole point is comparing
 * counted against expected.
 *
 * 2026-08-15 canteen count-derived sales pass: at the canteen, a count now
 * writes a real sale for any product line short of expected (docs/scope.md's
 * 2026-08-15 entry) — a side effect too consequential to be silent. Two
 * canteen-only additions, gated on the `isCanteen` prop staff-page-client.tsx
 * already threads through for other screens (stock-list.tsx, todays-sales.tsx):
 *
 *   - Expected quantity shown per product line while counting, not just
 *     after. This deliberately drops the "blind count" protection the
 *     restaurant keeps (stock-count-detail.tsx) — Edwinfred asked for the
 *     canteen attendant to see it, since she counts far more often and the
 *     independent-check value that protection buys the restaurant doesn't
 *     apply the same way here. Backed by stock/logic.ts's getStockCount and
 *     recordStockCount, which now only strip expectedQuantity for a
 *     non-owner restaurant submitter, not a canteen one.
 *   - A review step between "Record count" and the read view: for any
 *     product line short of expected, show what the count implies was
 *     sold (product, quantity, value) before she leaves the screen. Not a
 *     true pre-commit gate — the count is already written by the time this
 *     renders, same as every other screen's submit-then-confirm shape
 *     (handover.tsx's "done" step) — but nothing is silent.
 *
 * Ingredients are never sold, so the review step only ever lists product
 * lines. The restaurant's count is unaffected — no expected-quantity display
 * while counting, no review step, straight to StockCountDetail, exactly as
 * before.
 */

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyFirstUse, ErrorState } from "@/components/patterns/states";
import { Search, Trash2, X, ClipboardList, Check, TrendingUp } from "lucide-react";
import { money } from "@/shared/money";

type Item = {
  id: string;
  name: string;
  itemType: "product" | "ingredient";
  unit: string;
  /** Canteen only — the live expected quantity, fetched alongside items so
   * she sees it while counting, not just in the post-submit review. */
  expectedQuantity?: number;
  /** Canteen only — needed to value a short line in the review step. */
  priceMinor?: number | null;
  /** Product lines only — Product.locationId, the same field stock-list.tsx
   * and new-sale.tsx already use to split "My stock" from "From restaurant".
   * Absent for an ingredient line (canteen never counts ingredients — it has
   * none of its own — so the split is product-only, same as those screens). */
  locationId?: string;
};

type Line = { item: Item; quantity: string };

type Location = { id: string; code: string; name: string };

export type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; items: Item[] };

async function fetchCountableItems(locationId: string, isCanteen: boolean): Promise<LoadState> {
  try {
    // The canteen sells products only — no ingredients of its own, and it
    // never counts the restaurant's kitchen ingredients either (Edwinfred,
    // 2026-08-15: canteen count screen was showing every restaurant
    // ingredient, e.g. Cabbage, Cooking oil, with no expected quantity for
    // any of them since that concept doesn't apply to ingredients at all).
    const [productsRes, ingredientsRes] = await Promise.all([
      fetch(`/api/catalogue/products/active?locationId=${encodeURIComponent(locationId)}`),
      isCanteen ? null : fetch("/api/catalogue/ingredients/active"),
    ]);
    if (!productsRes.ok || (ingredientsRes && !ingredientsRes.ok)) return { status: "error" };
    const productsBody = await productsRes.json();
    const ingredientsBody = ingredientsRes ? await ingredientsRes.json() : { ingredients: [] };
    if (
      !Array.isArray(productsBody?.products) ||
      !Array.isArray(ingredientsBody?.ingredients)
    ) {
      return { status: "error" };
    }
    const items: Item[] = [
      ...productsBody.products
        .filter((p: { kind: string }) => p.kind !== "service")
        .map(
          (p: {
            id: string;
            name: string;
            onHand: number;
            priceMinor: number | null;
            locationId: string;
          }) => ({
            id: p.id,
            name: p.name,
            itemType: "product" as const,
            unit: "unit",
            locationId: p.locationId,
            // getSellableProductsAtLocation already returns onHand/priceMinor
            // for every caller — not the count-record comparison the blind-
            // count rule protects, just the live stock level new-sale.tsx
            // shows staff too. Restaurant ignores both fields; only the
            // canteen path below reads them.
            ...(isCanteen ? { expectedQuantity: p.onHand, priceMinor: p.priceMinor } : {}),
          }),
        ),
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

type SubmittedLine = { itemType: "product" | "ingredient"; itemId: string; countedQuantity: number; expectedQuantity?: number };

async function submitCount(input: {
  locationId: string;
  lines: { itemType: "product" | "ingredient"; itemId: string; countedQuantity: number }[];
}): Promise<{ ok: true; countId: string; lines: SubmittedLine[] } | { ok: false; error: string }> {
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
    return { ok: true, countId: body.count.id, lines: body.count.lines ?? [] };
  } catch {
    return { ok: false, error: "network" };
  }
}

async function fetchLocations(): Promise<Location[]> {
  try {
    const response = await fetch("/api/catalogue");
    if (!response.ok) return [];
    const body = await response.json();
    return Array.isArray(body?.locations) ? body.locations : [];
  } catch {
    return [];
  }
}

export function RecordStockCount({
  onRecorded,
  locationId,
  isCanteen = false,
}: {
  onRecorded?: (countId: string) => void;
  /** Staff shell always knows its own logged-in staff member's location —
   * pass it to skip the locations fetch and picker entirely, since only
   * the owner (the admin /stock/count page, no fixed location) needs to
   * choose between locations. */
  locationId?: string;
  /** Gates the canteen-only expected-quantity display and post-submit
   * review step — see this file's top comment. Never true for the owner's
   * multi-location admin path below, which has no single fixed location. */
  isCanteen?: boolean;
}) {
  const [attempt, setAttempt] = useState(0);
  return locationId ? (
    <RecordStockCountForLocation
      key={attempt}
      locations={[{ id: locationId, code: "", name: "" }]}
      initialLocationId={locationId}
      isCanteen={isCanteen}
      onRetry={() => setAttempt((a) => a + 1)}
      onRecorded={onRecorded}
    />
  ) : (
    <RecordStockCountForOwner
      key={attempt}
      onRetry={() => setAttempt((a) => a + 1)}
      onRecorded={onRecorded}
    />
  );
}

type LocationsState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; locations: Location[] };

/** Owner-only path (admin /stock/count) — no single fixed location, so
 * fetch every location and let the picker in RecordStockCountView choose.
 * The owner already sees expected/derived-sales detail everywhere else
 * (stock-count-review.tsx) — this path stays the plain restaurant-shaped
 * flow rather than adding the canteen review step, since the owner's own
 * comparison table is a richer version of the same information. */
function RecordStockCountForOwner({
  onRetry,
  onRecorded,
}: {
  onRetry: () => void;
  onRecorded?: (countId: string) => void;
}) {
  const [locationsState, setLocationsState] = useState<LocationsState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    fetchLocations().then((locations) => {
      if (cancelled) return;
      setLocationsState(
        locations.length === 0 ? { status: "error" } : { status: "ready", locations },
      );
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (locationsState.status === "loading") return <CountingSkeleton />;
  if (locationsState.status === "error") {
    return (
      <div className="p-3">
        <ErrorState what="locations" onRetry={onRetry} />
      </div>
    );
  }

  return (
    <RecordStockCountForLocation
      locations={locationsState.locations}
      initialLocationId={locationsState.locations[0].id}
      isCanteen={false}
      onRetry={onRetry}
      onRecorded={onRecorded}
    />
  );
}

function RecordStockCountForLocation({
  locations,
  initialLocationId,
  isCanteen,
  onRetry,
  onRecorded,
}: {
  locations: Location[];
  initialLocationId: string;
  isCanteen: boolean;
  onRetry: () => void;
  onRecorded?: (countId: string) => void;
}) {
  const [locationId, setLocationId] = useState(initialLocationId);

  return (
    <RecordStockCountForLocationAttempt
      key={locationId}
      locations={locations}
      locationId={locationId}
      isCanteen={isCanteen}
      onLocationChange={setLocationId}
      onRetry={onRetry}
      onRecorded={onRecorded}
    />
  );
}

function RecordStockCountForLocationAttempt({
  locations,
  locationId,
  isCanteen,
  onLocationChange,
  onRetry,
  onRecorded,
}: {
  locations: Location[];
  locationId: string;
  isCanteen: boolean;
  onLocationChange: (locationId: string) => void;
  onRetry: () => void;
  onRecorded?: (countId: string) => void;
}) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    fetchCountableItems(locationId, isCanteen).then((result) => {
      if (!cancelled) setState(result);
    });
    return () => {
      cancelled = true;
    };
  }, [locationId, isCanteen]);

  return (
    <RecordStockCountView
      state={state}
      locations={locations}
      locationId={locationId}
      isCanteen={isCanteen}
      onLocationChange={onLocationChange}
      onRetry={onRetry}
      onRecorded={onRecorded}
    />
  );
}

/** The presentational half — what Storybook mounts to show every state
 * without a network. */
export function RecordStockCountView({
  state,
  locations,
  locationId,
  isCanteen = false,
  onLocationChange = () => {},
  onRetry = () => {},
  onRecorded = () => {},
  onSubmit = submitCount,
}: {
  state: LoadState;
  locations: Location[];
  locationId: string;
  isCanteen?: boolean;
  onLocationChange?: (locationId: string) => void;
  onRetry?: () => void;
  onRecorded?: (countId: string) => void;
  onSubmit?: typeof submitCount;
}) {
  const picker = locations.length > 1 && (
    <LocationPicker locations={locations} value={locationId} onChange={onLocationChange} />
  );

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
        {picker}
        <EmptyFirstUse
          icon={<ClipboardList className="size-4" />}
          title="Nothing to count yet"
          body="Once products or ingredients are added in the catalogue, they will appear here to count."
        />
      </div>
    );
  }

  return (
    <Counting
      items={state.items}
      locationId={locationId}
      isCanteen={isCanteen}
      picker={picker}
      onRecorded={onRecorded}
      onSubmit={onSubmit}
    />
  );
}

function LocationPicker({
  locations,
  value,
  onChange,
}: {
  locations: Location[];
  value: string;
  onChange: (locationId: string) => void;
}) {
  return (
    <div className="border-b bg-card px-3 pt-2 pb-2">
      <div className="flex gap-1.5" data-testid="count-location-picker">
        {locations.map((l) => (
          <button
            key={l.id}
            type="button"
            onClick={() => onChange(l.id)}
            data-testid={`count-location-${l.code}`}
            className={`rounded-full border px-3 py-1 text-[12px] font-medium transition-colors duration-100 ${
              l.id === value
                ? "border-neutral-900 bg-neutral-900 text-white"
                : "border-border bg-transparent text-muted-foreground"
            }`}
          >
            {l.name}
          </button>
        ))}
      </div>
    </div>
  );
}

/** What one short product line implies was sold — computed client-side from
 * the count's own submitted lines plus the item list already fetched
 * (priceMinor isn't part of the count response). Ingredient lines are never
 * included — ingredients aren't sold. */
type SoldLine = { itemId: string; name: string; quantity: number; revenueMinor: number | null };

function soldLinesFrom(submittedLines: SubmittedLine[], items: Item[]): SoldLine[] {
  const itemById = new Map(items.map((i) => [i.id, i]));
  return submittedLines
    .filter((l) => l.itemType === "product" && l.expectedQuantity != null)
    .map((l) => {
      const item = itemById.get(l.itemId);
      const soldQuantity = (l.expectedQuantity ?? 0) - l.countedQuantity;
      return {
        itemId: l.itemId,
        name: item?.name ?? "Unknown product",
        quantity: soldQuantity,
        revenueMinor: item?.priceMinor != null ? item.priceMinor * soldQuantity : null,
      };
    })
    .filter((l) => l.quantity > 0);
}

function Counting({
  items,
  locationId,
  isCanteen,
  picker,
  onRecorded,
  onSubmit,
}: {
  items: Item[];
  locationId: string;
  isCanteen: boolean;
  picker?: React.ReactNode;
  onRecorded: (countId: string) => void;
  onSubmit: typeof submitCount;
}) {
  const [query, setQuery] = useState("");
  // Canteen only — same "My stock" / "From restaurant" split as
  // stock-list.tsx and new-sale.tsx, same Product.locationId rule. Only
  // matters once transferred-in stock actually exists to count; falls back
  // to showing everything (own-only, since the canteen has no ingredients
  // and never counts anything but its own products otherwise).
  const [sourceFilter, setSourceFilter] = useState<"own" | "transferred">("own");
  const [lines, setLines] = useState<Line[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [recorded, setRecorded] = useState<{ countId: string; soldLines: SoldLine[] } | null>(null);

  const transferredItems = isCanteen
    ? items.filter((i) => i.itemType === "product" && i.locationId != null && i.locationId !== locationId)
    : [];
  const ownItems = isCanteen
    ? items.filter((i) => i.itemType !== "product" || i.locationId == null || i.locationId === locationId)
    : items;
  const bySource = isCanteen && transferredItems.length > 0
    ? sourceFilter === "transferred" ? transferredItems : ownItems
    : items;

  const shown = query.trim()
    ? bySource.filter((i) => i.name.toLowerCase().includes(query.trim().toLowerCase()))
    : bySource;

  const add = (item: Item) =>
    setLines((ls) => {
      if (ls.some((l) => l.item.id === item.id)) return ls;
      return [...ls, { item, quantity: "" }];
    });

  const remove = (id: string) => setLines((ls) => ls.filter((l) => l.item.id !== id));

  const setQuantity = (id: string, quantity: string) =>
    setLines((ls) => ls.map((l) => (l.item.id === id ? { ...l, quantity } : l)));

  // A canteen count records what's left after sales, not a restock — a
  // counted quantity above what was on hand can't be a valid count, so it
  // blocks submit the same way an empty or negative line does, rather than
  // just warning and letting her submit anyway.
  const isOverExpected = (l: Line) =>
    isCanteen && l.item.expectedQuantity != null && Number(l.quantity) > l.item.expectedQuantity;
  const linesComplete =
    lines.length > 0 &&
    lines.every((l) => Number(l.quantity) >= 0 && l.quantity !== "" && !isOverExpected(l));
  const canComplete = linesComplete && !submitting;

  const complete = async () => {
    setSubmitting(true);
    setSubmitError(null);
    const result = await onSubmit({
      locationId,
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
    if (isCanteen) {
      setRecorded({ countId: result.countId, soldLines: soldLinesFrom(result.lines, items) });
      return;
    }
    onRecorded(result.countId);
  };

  if (recorded) {
    return <SoldReview soldLines={recorded.soldLines} onDone={() => onRecorded(recorded.countId)} />;
  }

  return (
    // min-h-0 (not just min-h-full) matters here: as a flex item of the
    // shell's <main>, this column's default min-height is auto, so without
    // an explicit floor of 0 it refuses to shrink to the viewport and grows
    // to fit the whole item grid instead — main ends up scrolling that
    // oversized column, the search bar and sticky footer drift off-screen
    // with it, and "sticky" has nothing correctly-bounded to stick within.
    <div className="flex h-full min-h-0 flex-col">
      {picker}
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

      {isCanteen && transferredItems.length > 0 && (
        <div className="border-b bg-card px-3 pt-2 pb-2">
          <div
            className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1"
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
                aria-selected={sourceFilter === tab.key}
                onClick={() => setSourceFilter(tab.key)}
                data-testid={`count-source-tab-${tab.key}`}
                className={`h-8 rounded-md text-[13px] font-medium transition-colors duration-100 ${
                  sourceFilter === tab.key ? "bg-card shadow-sm" : "text-muted-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      )}

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
              const line = lines.find((l) => l.item.id === i.id);
              return (
                <CountTile
                  key={i.id}
                  item={i}
                  isCanteen={isCanteen}
                  line={line}
                  onSelect={() => add(i)}
                  onQuantityChange={(quantity) => setQuantity(i.id, quantity)}
                  onRemove={() => remove(i.id)}
                />
              );
            })}
          </div>
        )}
      </div>

      <div className="sticky bottom-0 border-t bg-card">
        {lines.length > 0 && (
          // Quantity is typed on the tile itself now (CountTile, above) —
          // scrolling down to a separate panel to find the input she just
          // tapped for was the exact friction this screen used to have with
          // a long item list. This stays as a compact review of everything
          // entered so far, not the place she types.
          <div className="max-h-32 overflow-y-auto px-4 py-1.5" data-testid="count-lines">
            {lines.map((l) => (
              <div
                key={l.item.id}
                className="flex items-center justify-between gap-2 border-b py-1.5 text-[13px] last:border-0"
              >
                <span className="min-w-0 truncate font-medium">{l.item.name}</span>
                <div className="flex shrink-0 items-center gap-1.5">
                  <span
                    className={`tabular-nums ${isOverExpected(l) ? "font-medium text-destructive" : "text-muted-foreground"}`}
                  >
                    {l.quantity === "" ? "—" : l.quantity}
                  </span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-6 shrink-0 text-muted-foreground"
                    onClick={() => remove(l.item.id)}
                    aria-label={`Remove ${l.item.name}`}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
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

          {!submitError && lines.some(isOverExpected) && (
            <p className="text-[11px] text-destructive">
              One or more lines exceed what was expected — scroll up and fix the highlighted item
              {lines.filter(isOverExpected).length > 1 ? "s" : ""} before recording.
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

/** One item in the grid. Selecting it (tap, once) expands the tile in
 * place to show a quantity input right there — typing the count no longer
 * means scrolling down to a separate panel below a potentially long grid
 * to find the line she just added, the friction this screen used to have.
 * Tapping the expanded tile's own header again removes the line, same
 * destination as the trash icon in the summary panel below the grid. */
function CountTile({
  item,
  isCanteen,
  line,
  onSelect,
  onQuantityChange,
  onRemove,
}: {
  item: Item;
  isCanteen: boolean;
  line?: Line;
  onSelect: () => void;
  onQuantityChange: (quantity: string) => void;
  onRemove: () => void;
}) {
  const subtitle =
    item.itemType === "ingredient"
      ? item.unit
      : isCanteen && item.expectedQuantity != null
        ? `${item.expectedQuantity} expected`
        : "product";

  const overExpected =
    isCanteen &&
    line != null &&
    item.expectedQuantity != null &&
    line.quantity !== "" &&
    Number(line.quantity) > item.expectedQuantity;

  if (!line) {
    return (
      <button
        onClick={onSelect}
        title={item.name}
        data-testid="count-item-tile"
        className="relative flex h-[64px] flex-col items-start justify-between rounded-lg border bg-card p-2 text-left transition-colors duration-100 active:bg-accent"
      >
        <span className="line-clamp-2 text-[13px] leading-tight font-medium">{item.name}</span>
        <span className="text-[11px] text-muted-foreground">{subtitle}</span>
      </button>
    );
  }

  return (
    <div
      className={`relative flex flex-col gap-1.5 rounded-lg border p-2 ${
        overExpected ? "border-destructive bg-destructive/5" : "border-neutral-400 bg-card"
      }`}
      data-testid="count-item-tile-selected"
    >
      <button
        onClick={onRemove}
        title={`Remove ${item.name}`}
        aria-label={`Remove ${item.name}`}
        className="flex items-start justify-between gap-1 text-left"
      >
        <span className="line-clamp-2 text-[13px] leading-tight font-medium">{item.name}</span>
        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-neutral-700 text-white">
          <Check className="size-3" />
        </span>
      </button>
      <span className="text-[11px] text-muted-foreground">{subtitle}</span>
      <div className="flex items-center gap-1.5">
        <Input
          inputMode="numeric"
          placeholder="Qty"
          value={line.quantity}
          onChange={(e) => onQuantityChange(e.target.value)}
          className={`h-8 text-[13px] ${overExpected ? "border-destructive text-destructive" : ""}`}
          autoFocus
          aria-invalid={overExpected}
          data-testid={`count-quantity-${item.id}`}
        />
        <span className="shrink-0 text-[11px] text-muted-foreground">
          {item.itemType === "ingredient" ? item.unit : "units"}
        </span>
      </div>
      {overExpected && (
        <p className="text-[11px] text-destructive" data-testid={`count-quantity-error-${item.id}`}>
          Can&apos;t exceed the {item.expectedQuantity} expected — a count records what&apos;s left, not a
          restock.
        </p>
      )}
    </div>
  );
}

/** Canteen-only — shown after the count is recorded, before routing to the
 * read view. The count already committed (see this file's top comment); this
 * is the "not a silent side effect" moment, not a true pre-commit gate. */
function SoldReview({ soldLines, onDone }: { soldLines: SoldLine[]; onDone: () => void }) {
  const totalRevenueMinor = soldLines.reduce((sum, l) => sum + (l.revenueMinor ?? 0), 0);

  return (
    <div className="flex min-h-full flex-col" data-testid="count-sold-review">
      <div className="flex-1 p-3">
        <div className="mb-3 flex items-center gap-2">
          <TrendingUp className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-medium">This count means you sold</h2>
        </div>

        {soldLines.length === 0 ? (
          <div className="rounded-lg border bg-card p-4">
            <p className="text-[13px] text-muted-foreground" data-testid="count-sold-review-empty">
              Nothing counted short of expected — no sale implied by this count.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border bg-card">
            {soldLines.map((l) => (
              <div
                key={l.itemId}
                className="flex items-center justify-between gap-3 border-b p-3 last:border-0"
                data-testid="count-sold-review-row"
              >
                <span className="min-w-0 truncate text-[13px] font-medium">{l.name}</span>
                <div className="flex shrink-0 items-baseline gap-2 text-[13px]">
                  <span className="tabular-nums text-muted-foreground">{l.quantity} sold</span>
                  <span className="tabular-nums font-medium">
                    {l.revenueMinor == null ? "—" : money(l.revenueMinor)}
                  </span>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between gap-3 bg-muted/25 px-3 py-2.5">
              <span className="text-[12px] text-muted-foreground">Total</span>
              <span className="tabular-nums text-[13px] font-semibold">{money(totalRevenueMinor)}</span>
            </div>
          </div>
        )}
      </div>

      <div className="sticky bottom-0 border-t bg-card px-4 py-3">
        <Button className="h-12 w-full text-[15px]" onClick={onDone} data-testid="count-sold-review-done">
          Done
        </Button>
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
