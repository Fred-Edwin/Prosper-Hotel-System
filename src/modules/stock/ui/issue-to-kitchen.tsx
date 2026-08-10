"use client";

/**
 * Issuing to the kitchen — record ingredients leaving the store.
 *
 * Mirrors Receiving's line-entry pattern per ticket 18: search/pick an
 * ingredient, add it as a line, enter quantity, confirm. Simpler than
 * Receiving in one respect — issuing isn't a loss or a purchase, so there's
 * no cost/price field per line, just quantity.
 */

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyFirstUse, ErrorState } from "@/components/patterns/states";
import { Search, Trash2, X, ArrowLeftRight, Check } from "lucide-react";

type Ingredient = {
  id: string;
  name: string;
  unitOfMeasure: string;
  active: boolean;
};

type Line = { ingredient: Ingredient; quantity: string };

export type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; ingredients: Ingredient[] };

async function fetchIngredients(): Promise<LoadState> {
  try {
    const response = await fetch("/api/catalogue/ingredients/active");
    if (!response.ok) return { status: "error" };
    const body = await response.json();
    if (!Array.isArray(body?.ingredients)) return { status: "error" };
    return { status: "ready", ingredients: body.ingredients };
  } catch {
    return { status: "error" };
  }
}

async function submitIssue(input: {
  lines: { ingredientId: string; quantity: number }[];
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const response = await fetch("/api/stock/issue", {
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

export function IssueToKitchen({ onDone }: { onDone?: () => void }) {
  const [attempt, setAttempt] = useState(0);
  return (
    <IssueToKitchenForAttempt
      key={attempt}
      onRetry={() => setAttempt((a) => a + 1)}
      onDone={onDone}
    />
  );
}

function IssueToKitchenForAttempt({
  onRetry,
  onDone,
}: {
  onRetry: () => void;
  onDone?: () => void;
}) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    fetchIngredients().then((result) => {
      if (!cancelled) setState(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return <IssueToKitchenView state={state} onRetry={onRetry} onDone={onDone} />;
}

/** The presentational half — what Storybook mounts to show every state
 * without a network. */
export function IssueToKitchenView({
  state,
  onRetry = () => {},
  onDone = () => {},
  onSubmit = submitIssue,
}: {
  state: LoadState;
  onRetry?: () => void;
  onDone?: () => void;
  onSubmit?: typeof submitIssue;
}) {
  if (state.status === "loading") return <IssuingSkeleton />;
  if (state.status === "error") {
    return (
      <div className="p-3">
        <ErrorState what="ingredients" onRetry={onRetry} />
      </div>
    );
  }
  if (state.ingredients.length === 0) {
    return (
      <div className="p-3">
        <EmptyFirstUse
          icon={<ArrowLeftRight className="size-4" />}
          title="No ingredients to issue yet"
          body="Once ingredients are added in the catalogue, they will appear here to issue to the kitchen."
        />
      </div>
    );
  }

  return <Issuing ingredients={state.ingredients} onDone={onDone} onSubmit={onSubmit} />;
}

function Issuing({
  ingredients,
  onDone,
  onSubmit,
}: {
  ingredients: Ingredient[];
  onDone: () => void;
  onSubmit: typeof submitIssue;
}) {
  const [query, setQuery] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<Line[] | null>(null);

  const shown = query.trim()
    ? ingredients.filter((i) => i.name.toLowerCase().includes(query.trim().toLowerCase()))
    : ingredients;

  const add = (ingredient: Ingredient) =>
    setLines((ls) => {
      if (ls.some((l) => l.ingredient.id === ingredient.id)) return ls;
      return [...ls, { ingredient, quantity: "" }];
    });

  const remove = (id: string) => setLines((ls) => ls.filter((l) => l.ingredient.id !== id));

  const setQuantity = (id: string, quantity: string) =>
    setLines((ls) => ls.map((l) => (l.ingredient.id === id ? { ...l, quantity } : l)));

  const linesComplete = lines.length > 0 && lines.every((l) => Number(l.quantity) > 0);
  const canComplete = linesComplete && !submitting;

  const complete = async () => {
    setSubmitting(true);
    setSubmitError(null);
    const result = await onSubmit({
      lines: lines.map((l) => ({
        ingredientId: l.ingredient.id,
        quantity: Number(l.quantity),
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
    return <IssueConfirmation lines={confirmed} onDone={onDone} />;
  }

  return (
    <div className="flex min-h-full flex-col">
      <div className="border-b bg-card px-3 pt-2 pb-2">
        <div className="relative">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search ingredients"
            className="h-10 pl-8"
            data-testid="issue-search"
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
          <div className="grid grid-cols-2 gap-2" data-testid="issue-ingredient-grid">
            {shown.map((i) => {
              const inLines = lines.some((l) => l.ingredient.id === i.id);
              return (
                <button
                  key={i.id}
                  onClick={() => add(i)}
                  title={i.name}
                  disabled={inLines}
                  data-testid="issue-ingredient-tile"
                  className={`relative flex h-[64px] flex-col items-start justify-between rounded-lg border bg-card p-2 text-left transition-colors duration-100 disabled:opacity-50 ${
                    inLines ? "border-neutral-400" : "active:bg-accent"
                  }`}
                >
                  <span className="line-clamp-2 text-[13px] leading-tight font-medium">
                    {i.name}
                  </span>
                  <span className="text-[11px] text-muted-foreground">{i.unitOfMeasure}</span>
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
          <div className="max-h-64 overflow-y-auto px-4 py-1.5" data-testid="issue-lines">
            {lines.map((l) => (
              <div key={l.ingredient.id} className="flex items-center gap-2 border-b py-2 last:border-0">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium">{l.ingredient.name}</div>
                  <div className="mt-1 flex items-center gap-1.5">
                    <Input
                      inputMode="numeric"
                      placeholder="Qty"
                      value={l.quantity}
                      onChange={(e) => setQuantity(l.ingredient.id, e.target.value)}
                      className="h-8 w-20 text-[13px]"
                      data-testid={`issue-quantity-${l.ingredient.id}`}
                    />
                    <span className="text-[11px] text-muted-foreground">{l.ingredient.unitOfMeasure}</span>
                  </div>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7 shrink-0 text-muted-foreground"
                  onClick={() => remove(l.ingredient.id)}
                  aria-label={`Remove ${l.ingredient.name}`}
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
              Couldn&apos;t record the issue. Nothing was lost — check the lines and try again.
            </p>
          )}

          <Button
            className="h-12 w-full text-[15px]"
            disabled={!canComplete}
            onClick={complete}
            data-testid="issue-complete"
          >
            {submitting ? "Recording…" : "Record issue"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function IssueConfirmation({ lines, onDone }: { lines: Line[]; onDone: () => void }) {
  return (
    <div className="flex min-h-full flex-col" data-testid="issue-confirmation">
      <div className="flex-1 space-y-4 p-4">
        <div className="flex flex-col items-center rounded-lg border bg-card px-6 py-8 text-center">
          <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-success-subtle text-success">
            <Check className="size-5" />
          </div>
          <p className="text-sm font-medium">Issue recorded</p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {lines.length} {lines.length === 1 ? "ingredient" : "ingredients"} issued to the kitchen
          </p>
        </div>

        <div className="rounded-lg border bg-card p-3">
          {lines.map((l) => (
            <div key={l.ingredient.id} className="flex justify-between gap-3 py-1.5 text-[13px]">
              <span className="min-w-0 truncate">{l.ingredient.name}</span>
              <span className="shrink-0 tabular-nums">
                {l.quantity} {l.ingredient.unitOfMeasure}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="sticky bottom-0 border-t bg-card px-4 py-3">
        <Button className="h-12 w-full text-[15px]" onClick={onDone} data-testid="issue-new">
          Record another issue
        </Button>
      </div>
    </div>
  );
}

function IssuingSkeleton() {
  return (
    <div className="p-3" data-testid="issue-loading">
      <Skeleton className="mb-3 h-10 w-full rounded-lg" />
      <div className="grid grid-cols-2 gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-[64px] rounded-lg" />
        ))}
      </div>
    </div>
  );
}
