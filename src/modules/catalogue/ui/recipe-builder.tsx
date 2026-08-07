"use client";

/**
 * Recipe editor — "Builder". Ported from the locked design round
 * (prosper-hotel-design-reference, round E, src/components/design/catalogue/
 * recipe-builder.tsx) — swapped from fixtures to real ingredients/recipe
 * props, everything else unchanged.
 *
 * The ingredient list on the left is searchable and shows what it costs; the
 * recipe accumulates in the centre with the cost pinned on the right, so the
 * effect of adding half a litre of oil is visible at the moment of adding
 * it — the one number every profit figure depends on gets a column of its
 * own rather than the bottom of a scroll.
 *
 * Surfaces carry the hierarchy rather than colour: the picker recedes on a
 * muted ground (a source, not part of the recipe), the recipe sits forward
 * on white and bordered (what is being worked on), the cost panel is a
 * filled dark surface (the output every profit figure depends on).
 *
 * This shape exists nowhere else — a page, not a template, per design.md's
 * "a shape used by exactly one destination is a page."
 */

import { useMemo, useState } from "react";
import { money } from "@/shared/money";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus, X } from "lucide-react";
import type { Ingredient, RecipeLine } from "../schema";

export function RecipeBuilder({
  ingredients,
  initialLines = [],
  initialYield = "",
  unit = "unit",
  saving,
  onSave,
  /** Rendered under the cost panel, in the same column — version history. */
  aside,
}: {
  ingredients: Ingredient[];
  initialLines?: RecipeLine[];
  initialYield?: string;
  unit?: string;
  saving?: boolean;
  onSave: (input: { lines: RecipeLine[]; yieldQuantity: number }) => void;
  aside?: React.ReactNode;
}) {
  const [lines, setLines] = useState<RecipeLine[]>(initialLines);
  const [yieldQty, setYieldQty] = useState(String(initialYield));
  const [query, setQuery] = useState("");

  const y = Number(yieldQty) || 0;
  const batchMinor = lines.reduce((sum, l) => {
    const ing = ingredients.find((i) => i.id === l.ingredientId);
    return sum + (ing?.lastKnownCostMinor != null ? ing.lastKnownCostMinor * l.quantity : 0);
  }, 0);
  const anyUnknownCost = lines.some((l) => {
    const ing = ingredients.find((i) => i.id === l.ingredientId);
    return ing?.lastKnownCostMinor == null;
  });
  const anyZeroQuantity = lines.some((l) => l.quantity <= 0);
  const perUnitMinor = y > 0 && !anyUnknownCost ? Math.round(batchMinor / y) : null;

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ingredients.filter((i) => i.active && (!q || i.name.toLowerCase().includes(q)));
  }, [ingredients, query]);

  const add = (id: string) =>
    setLines((ls) =>
      ls.some((l) => l.ingredientId === id) ? ls : [...ls, { ingredientId: id, quantity: 1 }],
    );

  return (
    <div>
      <div className="grid gap-4 lg:grid-cols-[236px_minmax(0,1fr)_268px]">
        {/* The storeroom — recessed. A source drawn from, not part of the
            recipe, so it sits back on a muted ground with no border of its
            own. */}
        <div className="order-2 overflow-hidden rounded-lg bg-muted/40 lg:order-1">
          <div className="p-2">
            <div className="relative">
              <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search ingredients"
                className="h-8 bg-card pl-8 text-[13px]"
              />
            </div>
          </div>
          <div className="max-h-96 overflow-y-auto px-2 pb-2">
            {shown.map((i) => {
              const used = lines.some((l) => l.ingredientId === i.id);
              return (
                <button
                  key={i.id}
                  type="button"
                  onClick={() => add(i.id)}
                  disabled={used}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors duration-100 hover:bg-card disabled:opacity-40 disabled:hover:bg-transparent"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px]">{i.name}</div>
                    <div className="tabular text-[11px] text-muted-foreground">
                      {i.lastKnownCostMinor == null ? "—" : money(i.lastKnownCostMinor)} per{" "}
                      {i.unitOfMeasure}
                    </div>
                  </div>
                  {used ? (
                    <span className="shrink-0 text-[10px] text-muted-foreground">in</span>
                  ) : (
                    <Plus className="size-3.5 shrink-0 text-muted-foreground" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* The recipe — forward. White, bordered, the widest column, roomy
            rows. This is what is being worked on. */}
        <div className="order-1 overflow-hidden rounded-lg border bg-card shadow-sm lg:order-2">
          <div className="flex items-baseline justify-between border-b px-4 py-2.5">
            <h3 className="text-[13px] font-medium">One batch takes</h3>
            <span className="tabular text-[11px] text-muted-foreground">
              {lines.length} {lines.length === 1 ? "ingredient" : "ingredients"}
            </span>
          </div>
          {lines.length === 0 ? (
            <div className="px-4 py-12 text-center text-[13px] text-muted-foreground">
              Pick ingredients from the left to build the recipe.
            </div>
          ) : (
            <div className="divide-y">
              {lines.map((l) => {
                const ing = ingredients.find((i) => i.id === l.ingredientId);
                if (!ing) return null;
                const invalid = l.quantity <= 0;
                return (
                  <div key={l.ingredientId} className="flex items-center gap-2 px-4 py-2.5">
                    <span className="min-w-0 flex-1 truncate text-[13px]">{ing.name}</span>
                    <Input
                      inputMode="decimal"
                      value={String(l.quantity)}
                      onChange={(e) => {
                        // Negative quantities are meaningless here — a
                        // recipe never removes stock by the batch, so a
                        // typo like "-3" is clamped rather than silently
                        // accepted and folded into the batch cost.
                        const parsed = Number(e.target.value);
                        const next = Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
                        setLines((ls) =>
                          ls.map((x) =>
                            x.ingredientId === l.ingredientId ? { ...x, quantity: next } : x,
                          ),
                        );
                      }}
                      aria-label={`${ing.name} quantity`}
                      aria-invalid={invalid}
                      className="tabular h-8 w-16 shrink-0 text-right text-[13px]"
                    />
                    <span className="w-8 shrink-0 text-[11px] text-muted-foreground">
                      {ing.unitOfMeasure}
                    </span>
                    <span className="tabular w-20 shrink-0 text-right text-[13px]">
                      {ing.lastKnownCostMinor == null ? "—" : money(ing.lastKnownCostMinor * l.quantity)}
                    </span>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-7 shrink-0 text-muted-foreground"
                      onClick={() =>
                        setLines((ls) => ls.filter((x) => x.ingredientId !== l.ingredientId))
                      }
                      aria-label={`Remove ${ing.name}`}
                    >
                      <X className="size-3.5" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* The cost — loudest. A filled dark surface: the output, and the one
            number every profit figure in the app depends on. */}
        <div className="order-3">
          <div className="overflow-hidden rounded-lg bg-neutral-900 text-neutral-50">
            <div className="px-4 pt-3.5 pb-3">
              <div className="text-[11px] text-neutral-400">One batch costs</div>
              <div className="tabular text-xl font-semibold">{money(batchMinor)}</div>
            </div>

            <div className="border-t border-white/10 px-4 py-3">
              <label htmlFor="recipe-yield" className="text-[11px] text-neutral-400">
                Makes how many {unit}s?
              </label>
              <Input
                id="recipe-yield"
                inputMode="numeric"
                value={yieldQty}
                onChange={(e) => setYieldQty(e.target.value)}
                className="tabular mt-1 h-9 border-white/20 bg-white/10 text-right text-[13px] text-neutral-50 focus-visible:ring-white/30"
              />
            </div>

            <div className="border-t border-white/10 px-4 py-3.5">
              <div className="text-[11px] text-neutral-400">So one {unit} costs</div>
              <div className="tabular mt-0.5 text-3xl font-semibold">
                {perUnitMinor === null ? (
                  <span className="text-neutral-400">—</span>
                ) : (
                  money(perUnitMinor)
                )}
              </div>
            </div>

            {/* Save lives on the panel it commits — the output column, not a
                floating action disconnected from the figure it produces. */}
            <div className="border-t border-white/10 px-4 py-3">
              <Button
                size="sm"
                className="h-8 w-full bg-white text-neutral-900 hover:bg-white/90"
                disabled={saving || lines.length === 0 || y <= 0 || anyZeroQuantity}
                onClick={() => onSave({ lines, yieldQuantity: y })}
              >
                {saving ? "Saving…" : "Save recipe"}
              </Button>
            </div>
          </div>

          <p className="mt-2 px-1 text-[11px] text-muted-foreground">
            {anyZeroQuantity
              ? "Every ingredient needs a quantity above zero before this can be saved."
              : "Every profit figure uses this. Saving creates a new version from today — past figures keep the recipe they were costed with."}
          </p>

          {aside && <div className="mt-3">{aside}</div>}
        </div>
      </div>
    </div>
  );
}
