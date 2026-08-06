"use client";

/**
 * Recipe editor — "Builder".
 *
 * The argument: building a recipe and reading one are different tasks, and the
 * arithmetic form only serves the second. Someone writing down how they cook
 * githeri does not start with a statement to amend — they start with a
 * storeroom and pick from it. So: the ingredient list on the left, searchable
 * and showing what it costs, and the recipe accumulating on the right with the
 * cost pinned where it can be watched while ingredients go in.
 *
 * The cost panel is the point. In the arithmetic form the per-unit cost is at
 * the bottom of a scroll; here it is fixed, so the effect of adding half a
 * litre of oil is visible at the moment of adding it. For the one number every
 * profit figure depends on, that feedback is worth a column.
 *
 * It is also the only form that survives a fifteen-ingredient recipe without
 * becoming a scroll, and searching a fifty-item storeroom is a real need that
 * an inline picker handles badly.
 *
 * Chosen over the arithmetic form: "the workflow has a very good user
 * experience… it's spacious so you can read comfortably, and you can edit the
 * quantities comfortably."
 *
 * **Surfaces carry the hierarchy.** The first pass made every panel an
 * identical white card with a border, so the page blurred into one even field
 * and the only thing that stood out was an amber alert. Fixed by giving the
 * three columns three different weights rather than by adding colour, which
 * would have spent the page's one-accent budget:
 *
 *   The **picker recesses** — a muted ground, no border of its own. It is a
 *   source you draw from, not part of the recipe.
 *   The **recipe sits forward** — white, bordered, the widest column, roomy
 *   rows. It is what you are working on.
 *   The **cost panel is loudest** — a filled dark surface. It is the output,
 *   and the one number every profit figure in the app depends on.
 *
 * This shape exists nowhere else, which was the honest objection to it: two
 * panels with a pinned total is a new pattern, and if only recipes use it then
 * it is a page rather than a template. It stays a page. On a phone the columns
 * stack and the cost panel moves to the top, where a fixed figure belongs when
 * there is no room to pin it.
 */

import { useMemo, useState } from "react";
import {
  ingredients,
  money,
  type Recipe,
  type RecipeLine,
} from "@/lib/fixtures";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus, X } from "lucide-react";

export function RecipeBuilder({
  recipe,
  /** Rendered under the cost panel, in the same column. */
  aside,
}: {
  recipe: Recipe;
  aside?: React.ReactNode;
}) {
  const current = recipe.versions[0];
  const [lines, setLines] = useState<RecipeLine[]>(current.lines);
  const [yieldQty, setYieldQty] = useState(String(current.yield));
  const [query, setQuery] = useState("");

  const y = Number(yieldQty) || 0;
  const batch = lines.reduce((s, l) => {
    const ing = ingredients.find((i) => i.id === l.ingredientId);
    return s + (ing ? ing.unitCost * l.qty : 0);
  }, 0);
  const perUnit = y > 0 ? batch / y : null;

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ingredients.filter((i) => !q || i.name.toLowerCase().includes(q));
  }, [query]);

  const add = (id: string) =>
    setLines((ls) =>
      ls.some((l) => l.ingredientId === id)
        ? ls
        : [...ls, { ingredientId: id, qty: 1 }],
    );

  return (
    <div className="grid gap-4 lg:grid-cols-[236px_minmax(0,1fr)_268px]">
      {/* The storeroom — recessed. A source you draw from, not part of the
          recipe, so it sits back on a muted ground with no border of its own. */}
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
                onClick={() => add(i.id)}
                disabled={used}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors duration-100 hover:bg-card disabled:opacity-40 disabled:hover:bg-transparent"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px]">{i.name}</div>
                  <div className="tabular text-[11px] text-muted-foreground">
                    {money(i.unitCost)} per {i.unit}
                  </div>
                </div>
                {used ? (
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    in
                  </span>
                ) : (
                  <Plus className="size-3.5 shrink-0 text-muted-foreground" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* The recipe — forward. White, bordered, the widest column, roomy rows.
          This is what is being worked on. */}
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
              const ing = ingredients.find((i) => i.id === l.ingredientId)!;
              return (
                <div
                  key={l.ingredientId}
                  className="flex items-center gap-2 px-4 py-2.5"
                >
                  <span className="min-w-0 flex-1 truncate text-[13px]">
                    {ing.name}
                  </span>
                  <Input
                    inputMode="decimal"
                    value={String(l.qty)}
                    onChange={(e) =>
                      setLines((ls) =>
                        ls.map((x) =>
                          x.ingredientId === l.ingredientId
                            ? { ...x, qty: Number(e.target.value) || 0 }
                            : x,
                        ),
                      )
                    }
                    aria-label={`${ing.name} quantity`}
                    className="tabular h-8 w-16 shrink-0 text-right text-[13px]"
                  />
                  <span className="w-8 shrink-0 text-[11px] text-muted-foreground">
                    {ing.unit}
                  </span>
                  <span className="tabular w-20 shrink-0 text-right text-[13px]">
                    {money(ing.unitCost * l.qty)}
                  </span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7 shrink-0 text-muted-foreground"
                    onClick={() =>
                      setLines((ls) =>
                        ls.filter((x) => x.ingredientId !== l.ingredientId),
                      )
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

      {/* The cost — loudest. A filled dark surface, because this is the output
          and the one number every profit figure in the app depends on. It is
          the only element here that is not a white card, which is what gives
          the page a hierarchy rather than an even field of panels.

          Not the accent: this is not an action, and the page's one accent
          belongs to the primary button. Dark neutral says "important" without
          saying "press me". */}
      {/* Not sticky any more — with the history under it the column is taller
          than the viewport, and a sticky block that cannot fit scrolls its own
          content away. The cost stays visible because the recipe beside it is
          short enough not to push it off. */}
      <div className="order-3">
        <div className="overflow-hidden rounded-lg bg-neutral-900 text-neutral-50">
          <div className="px-4 pt-3.5 pb-3">
            <div className="text-[11px] text-neutral-400">One batch costs</div>
            <div className="tabular text-xl font-semibold">{money(batch)}</div>
          </div>

          <div className="border-t border-white/10 px-4 py-3">
            <label
              htmlFor="recipe-yield"
              className="text-[11px] text-neutral-400"
            >
              Makes how many {recipe.unit}s?
            </label>
            <Input
              id="recipe-yield"
              inputMode="numeric"
              value={yieldQty}
              onChange={(e) => setYieldQty(e.target.value)}
              className="tabular mt-1 h-9 border-white/20 bg-white/10 text-right text-[13px] text-neutral-50 focus-visible:ring-white/30"
            />
          </div>

          {/* The figure the whole screen exists to produce. */}
          <div className="border-t border-white/10 px-4 py-3.5">
            <div className="text-[11px] text-neutral-400">
              So one {recipe.unit} costs
            </div>
            <div className="tabular mt-0.5 text-3xl font-semibold">
              {perUnit === null ? (
                <span className="text-neutral-400">—</span>
              ) : (
                money(perUnit)
              )}
            </div>
          </div>
        </div>

        <p className="mt-2 px-1 text-[11px] text-muted-foreground">
          Every profit figure uses this. Saving creates a new version from
          today — past figures keep the recipe they were costed with.
        </p>

        {/* The version history belongs here rather than below the grid: it is
            commentary on this figure, not on the recipe as a whole, and every
            row in it is a past value of the number directly above. As a
            full-width card underneath it aligned to nothing. */}
        {aside && <div className="mt-3">{aside}</div>}
      </div>
    </div>
  );
}

export const builderNote = "Two panels + pinned cost · a new shape";
