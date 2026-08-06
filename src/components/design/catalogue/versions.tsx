"use client";

/**
 * A recipe's version history.
 *
 * This is the visible consequence of the effective-dating decision, and the
 * reason a recipe has a history at all: architecture.md forbids editing closed
 * figures, and a recipe's per-unit cost is baked into every profit figure
 * derived from it. Changing it in place would silently restate what last month
 * cost, which is exactly the "figures that move silently" the architecture
 * rejects.
 *
 * So a change is a new version from a date, past movements keep the version
 * they were costed with, and this list is how someone answers "why did chips
 * get more expensive in July".
 *
 * The cost delta between versions is the point of the list, so it is stated
 * rather than left to be worked out — and it uses semantic colour, because a
 * cost going up is a real thing to notice in a business this thin.
 */

import { ingredients, recipeCost, money, type Recipe } from "@/lib/fixtures";
import { Badge } from "@/components/ui/badge";

export function VersionHistory({ recipe }: { recipe: Recipe }) {
  return (
    <div className="divide-y">
      {recipe.versions.map((v, i) => {
        const { batch, perUnit } = recipeCost(v);
        const previous = recipe.versions[i + 1];
        const delta = previous ? perUnit - recipeCost(previous).perUnit : null;
        const current = i === 0;

        return (
          <div key={v.effectiveFrom} className="px-3.5 py-2.5">
            {/* The figure first — every row here is a past value of the number
                directly above this card. */}
            <div className="flex items-baseline justify-between gap-2">
              <span className="tabular text-[15px] font-semibold">
                {money(perUnit)}
              </span>
              {delta !== null && delta !== 0 ? (
                <span
                  className={`tabular text-[11px] ${
                    delta > 0 ? "text-danger" : "text-success"
                  }`}
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
              From {v.effectiveFrom}
              {current && delta !== null && delta !== 0 && (
                <span className="ml-1.5 rounded border px-1 text-[10px]">
                  in use
                </span>
              )}
            </div>

            <div className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
              {v.lines
                .map((l) => {
                  const ing = ingredients.find((x) => x.id === l.ingredientId);
                  return ing ? `${l.qty}${ing.unit} ${ing.name.toLowerCase()}` : "";
                })
                .filter(Boolean)
                .join(" · ")}{" "}
              → {v.yield} {recipe.unit}s, batch {money(batch)}
            </div>

            <div className="mt-1 text-[11px] leading-snug text-muted-foreground">
              {v.recordedBy}
              {v.note && <span> · {v.note}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
