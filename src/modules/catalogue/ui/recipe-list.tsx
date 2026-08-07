"use client";

/**
 * The recipes tab — every cooked-food product, whether or not it has a
 * recipe. Ported from the locked design round (recipe-list.tsx).
 *
 * Absences are listed, not summarised (design.md): a list of three recipes
 * hides that twelve dishes are sold at unknown cost, so a product with no
 * recipe is a row here too, greyed, cost "—", with an action to add one.
 */

import { Button } from "@/components/ui/button";
import { money } from "@/shared/money";
import { ChevronRight, Plus } from "lucide-react";
import type { Product } from "../schema";
import type { RecipeRow } from "./catalogue-data";

export function RecipeList({
  products,
  recipes,
  onOpen,
}: {
  /** Cooked-food products only. */
  products: Product[];
  recipes: RecipeRow[];
  onOpen: (productId: string) => void;
}) {
  const withRecipe = recipes.filter((r) => r.recipe !== null).length;

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-2.5">
        <h2 className="text-sm font-medium">Cooked dishes</h2>
        <span className="tabular text-xs text-muted-foreground">
          {withRecipe} of {products.length} have a recipe
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-[13px]">
          <thead className="sticky top-0 z-10">
            <tr className="border-b bg-muted/60 text-[11px] text-muted-foreground">
              <th className="px-4 py-2 text-left font-medium">Dish</th>
              <th className="px-2 py-2 text-right font-medium">Sells for</th>
              <th className="px-2 py-2 text-right font-medium">Costs to make</th>
              <th className="px-4 py-2 text-right font-medium">Margin</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => {
              const recipe = recipes.find((r) => r.productId === product.id)?.recipe ?? null;

              if (!recipe || recipe.perUnitCostMinor === null) {
                return (
                  <tr key={product.id} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="px-4 py-2 text-muted-foreground">{product.name}</td>
                    <td className="tabular px-2 py-2 text-right text-muted-foreground">
                      {product.priceMinor === null ? "—" : money(product.priceMinor)}
                    </td>
                    <td className="px-2 py-2 text-right text-muted-foreground">—</td>
                    <td className="px-4 py-2 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 text-[11px]"
                        onClick={() => onOpen(product.id)}
                      >
                        <Plus className="size-3" /> Add
                      </Button>
                    </td>
                  </tr>
                );
              }

              const margin =
                product.priceMinor !== null
                  ? ((product.priceMinor - recipe.perUnitCostMinor) / product.priceMinor) * 100
                  : null;
              const thin = margin !== null && margin < 40;

              return (
                <tr key={product.id} className="group border-b last:border-0 hover:bg-muted/40">
                  <td className="px-4 py-2">
                    <button
                      onClick={() => onOpen(product.id)}
                      className="flex items-center gap-1.5 text-left font-medium"
                    >
                      {product.name}
                      <ChevronRight className="size-3.5 text-muted-foreground opacity-0 transition-opacity duration-100 group-hover:opacity-100" />
                    </button>
                  </td>
                  <td className="tabular px-2 py-2 text-right text-muted-foreground">
                    {product.priceMinor === null ? "—" : money(product.priceMinor)}
                  </td>
                  <td className="tabular px-2 py-2 text-right font-medium">
                    {money(recipe.perUnitCostMinor)}
                  </td>
                  <td
                    className={`tabular px-4 py-2 text-right ${thin ? "text-warning" : ""}`}
                  >
                    {margin === null ? "—" : `${margin.toFixed(0)}%`}
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
