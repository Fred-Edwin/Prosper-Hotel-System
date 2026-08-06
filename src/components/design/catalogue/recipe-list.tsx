"use client";

/**
 * The recipe list.
 *
 * The first pass opened the recipes tab straight into editing Chips, with no
 * way to reach Githeri or Beef stew — a detail page pretending to be a tab,
 * while the other three tabs were lists. This is the list, and a recipe opens
 * from it.
 *
 * It carries what the other tabs cannot: **cooked products with no recipe are
 * listed alongside the ones that have one**, greyed, with "not recorded" where
 * the cost would be. A list of three recipes hides the fact that twelve dishes
 * are being sold at an unknown cost; a list of fifteen rows, twelve of them
 * blank, states it. That is the gap this destination exists to close, made
 * visible in the place someone would fix it.
 *
 * Per-unit cost is the column that matters, so it is last and it is the only
 * one carrying weight. Margin is beside it because a recipe whose cost has
 * crept up until it eats the price is the thing worth catching, and the two
 * numbers only mean something together.
 */

import {
  products,
  recipes,
  recipeCost,
  money,
  type Recipe,
} from "@/lib/fixtures";
import { Button } from "@/components/ui/button";
import { ChevronRight, Plus } from "lucide-react";

interface Row {
  productId: string;
  name: string;
  price: number;
  recipe: Recipe | null;
}

export function RecipeList({
  onOpen,
}: {
  onOpen: (recipeId: string) => void;
}) {
  // Every cooked product, whether or not it has a recipe. The absences are the
  // point of the list.
  const rows: Row[] = products
    .filter((p) => p.kind === "cooked")
    .map((p) => ({
      productId: p.id,
      name: p.name,
      price: p.price,
      recipe: recipes.find((r) => r.productId === p.id) ?? null,
    }))
    .sort((a, b) => Number(!!b.recipe) - Number(!!a.recipe));

  const withRecipe = rows.filter((r) => r.recipe).length;

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-2.5">
        <h2 className="text-sm font-medium">Cooked dishes</h2>
        <span className="tabular text-xs text-muted-foreground">
          {withRecipe} of {rows.length} have a recipe
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] text-[13px]">
          <thead>
            <tr className="border-b bg-muted/60 text-[11px] text-muted-foreground">
              <th className="px-4 py-2 text-left font-medium">Dish</th>
              <th className="px-2 py-2 text-left font-medium">Ingredients</th>
              <th className="px-2 py-2 text-right font-medium">Sells for</th>
              <th className="px-2 py-2 text-right font-medium">Costs to make</th>
              <th className="px-4 py-2 text-right font-medium">Margin</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              if (!r.recipe) return <MissingRow key={r.productId} row={r} />;

              const v = r.recipe.versions[0];
              const { perUnit } = recipeCost(v);
              const margin = ((r.price - perUnit) / r.price) * 100;
              const thin = margin < 40;

              return (
                <tr
                  key={r.productId}
                  className="group border-b last:border-0 hover:bg-muted/40"
                >
                  <td className="px-4 py-2">
                    <button
                      onClick={() => onOpen(r.recipe!.id)}
                      className="flex items-center gap-1.5 text-left font-medium"
                    >
                      {r.name}
                      <ChevronRight className="size-3.5 text-muted-foreground opacity-0 transition-opacity duration-100 group-hover:opacity-100" />
                    </button>
                  </td>
                  <td className="px-2 py-2 text-muted-foreground">
                    {v.lines.length} · makes {v.yield} {r.recipe.unit}s
                  </td>
                  <td className="tabular px-2 py-2 text-right text-muted-foreground">
                    {money(r.price)}
                  </td>
                  <td className="tabular px-2 py-2 text-right font-medium">
                    {money(perUnit)}
                  </td>
                  <td
                    className={`tabular px-4 py-2 text-right ${
                      thin ? "text-warning" : ""
                    }`}
                  >
                    {margin.toFixed(0)}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * A dish sold at an unknown cost. Recessive, because it is an absence rather
 * than a record — but present, because hiding it is how twelve unknown costs
 * stay unknown.
 */
function MissingRow({ row }: { row: Row }) {
  return (
    <tr className="border-b last:border-0 hover:bg-muted/40">
      <td className="px-4 py-2 text-muted-foreground">{row.name}</td>
      <td className="px-2 py-2">
        <span className="text-[11px] text-muted-foreground">Not recorded</span>
      </td>
      <td className="tabular px-2 py-2 text-right text-muted-foreground">
        {money(row.price)}
      </td>
      <td className="px-2 py-2 text-right text-muted-foreground">—</td>
      <td className="px-4 py-2 text-right">
        <Button variant="outline" size="sm" className="h-6 text-[11px]">
          <Plus className="size-3" /> Add
        </Button>
      </td>
    </tr>
  );
}
