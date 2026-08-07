"use client";

/**
 * A recipe's version history. Ported from the locked design round
 * (recipe-builder round E, versions.tsx) — swapped from fixtures to real
 * ingredient/version props.
 *
 * architecture.md forbids editing closed figures; a recipe's per-unit cost
 * is baked into every profit figure derived from it, so a change is a new
 * version from a date rather than an edit in place. This list is how
 * someone answers "why did chips get more expensive in July".
 */

import { money } from "@/shared/money";
import { Badge } from "@/components/ui/badge";
import type { Ingredient, Recipe } from "../schema";

function perUnitMinor(recipe: Recipe, ingredients: Ingredient[]): number | null {
  let totalMinor = 0;
  for (const line of recipe.lines) {
    const cost = ingredients.find((i) => i.id === line.ingredientId)?.lastKnownCostMinor;
    if (cost == null) return null;
    totalMinor += cost * line.quantity;
  }
  return Math.round(totalMinor / recipe.yieldQuantity);
}

export function VersionHistory({
  versions,
  ingredients,
  unit = "unit",
}: {
  /** Newest first. */
  versions: Recipe[];
  ingredients: Ingredient[];
  unit?: string;
}) {
  return (
    <div className="divide-y">
      {versions.map((v, i) => {
        const perUnit = perUnitMinor(v, ingredients);
        const previous = versions[i + 1];
        const previousPerUnit = previous ? perUnitMinor(previous, ingredients) : null;
        const delta =
          perUnit !== null && previousPerUnit !== null ? perUnit - previousPerUnit : null;
        const current = i === 0;

        return (
          <div key={v.id} className="px-3.5 py-2.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="tabular text-[15px] font-semibold">
                {perUnit === null ? "—" : money(perUnit)}
              </span>
              {delta !== null && delta !== 0 ? (
                <span
                  className={`tabular text-[11px] ${delta > 0 ? "text-danger" : "text-success"}`}
                >
                  {delta > 0 ? "↑" : "↓"}
                  {money(Math.abs(delta))}
                </span>
              ) : (
                current && (
                  <Badge variant="outline" className="text-[10px] font-normal">
                    in use
                  </Badge>
                )
              )}
            </div>

            <div className="tabular mt-0.5 text-[11px] text-muted-foreground">
              From {v.effectiveFrom.toLocaleDateString("en-KE")}
            </div>

            <div className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
              {v.lines
                .map((l) => {
                  const ing = ingredients.find((x) => x.id === l.ingredientId);
                  return ing ? `${l.quantity}${ing.unitOfMeasure} ${ing.name.toLowerCase()}` : "";
                })
                .filter(Boolean)
                .join(" · ")}{" "}
              → {v.yieldQuantity} {unit}s
            </div>
          </div>
        );
      })}
    </div>
  );
}
