"use client";

/**
 * Recipes tab — list, then a record. Ported from the locked design round's
 * RecipeDetail (round.tsx) — a cooked-food product opens from the list into
 * its builder, with version history beneath as supporting evidence rather
 * than a peer column.
 */

import { useState } from "react";
import { DetailCard } from "@/components/patterns/detail-page";
import { Skeleton } from "@/components/ui/skeleton";
import { money } from "@/shared/money";
import { ChevronLeft } from "lucide-react";
import { RecipeList } from "./recipe-list";
import { RecipeBuilder } from "./recipe-builder";
import { VersionHistory } from "./version-history";
import type { Ingredient, Product, Recipe, RecipeLine } from "../schema";
import type { RecipeRow } from "./catalogue-data";

export function RecipesTab({
  cookedFoodProducts,
  ingredients,
  recipes,
  versionsByProduct,
  versionsLoading,
  onLoadVersions,
  saving,
  error,
  onSaveRecipe,
}: {
  cookedFoodProducts: Product[];
  ingredients: Ingredient[];
  recipes: RecipeRow[];
  /** Populated on demand, keyed by product id — newest first. */
  versionsByProduct: Record<string, Recipe[] | undefined>;
  /** True while the open product's version history is being fetched. */
  versionsLoading?: boolean;
  onLoadVersions: (productId: string) => void;
  saving?: boolean;
  error?: string;
  onSaveRecipe: (productId: string, input: { lines: RecipeLine[]; yieldQuantity: number }) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const product = cookedFoodProducts.find((p) => p.id === openId) ?? null;

  if (!product) {
    return (
      <RecipeList
        products={cookedFoodProducts}
        recipes={recipes}
        onOpen={(id) => {
          setOpenId(id);
          onLoadVersions(id);
        }}
      />
    );
  }

  const current = recipes.find((r) => r.productId === product.id)?.recipe ?? null;
  const versions = versionsByProduct[product.id] ?? [];
  const margin =
    current?.perUnitCostMinor != null && product.priceMinor !== null
      ? ((product.priceMinor - current.perUnitCostMinor) / product.priceMinor) * 100
      : null;

  return (
    <div>
      <button
        onClick={() => setOpenId(null)}
        className="mb-3 flex items-center gap-1 text-[13px] text-muted-foreground transition-colors duration-100 hover:text-foreground"
      >
        <ChevronLeft className="size-3.5" /> All recipes
      </button>

      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">{product.name}</h2>
          <p className="text-[13px] text-muted-foreground">What one unit takes to make</p>
        </div>
        <div className="flex items-center gap-5 text-right">
          <Figure
            label="Sells for"
            value={product.priceMinor === null ? "—" : money(product.priceMinor)}
          />
          <Figure
            label="Costs to make"
            value={current?.perUnitCostMinor == null ? "—" : money(current.perUnitCostMinor)}
          />
          <Figure
            label="Margin"
            value={margin === null ? "—" : `${margin.toFixed(0)}%`}
            tone={margin !== null && margin < 40 ? "warning" : undefined}
          />
        </div>
      </div>

      <RecipeBuilder
        ingredients={ingredients}
        initialLines={current?.lines ?? []}
        initialYield={current ? String(current.yieldQuantity) : ""}
        saving={saving}
        error={error}
        onSave={(input) => onSaveRecipe(product.id, input)}
        aside={
          versionsLoading ? (
            <DetailCard title="Version history" flush>
              <div className="space-y-2 p-3.5">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-3 w-full" />
              </div>
            </DetailCard>
          ) : versions.length > 0 ? (
            <DetailCard
              title="Version history"
              flush
              footnote="A change is a new version from a date. Past figures keep the recipe they were costed with, so a closed month never restates itself."
            >
              <VersionHistory versions={versions} ingredients={ingredients} />
            </DetailCard>
          ) : undefined
        }
      />
    </div>
  );
}

function Figure({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "warning";
}) {
  return (
    <div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div
        className={`tabular text-[15px] font-semibold ${tone === "warning" ? "text-warning" : ""}`}
      >
        {value}
      </div>
    </div>
  );
}
