"use client";

/**
 * Catalogue. Settled in round E.
 *
 * Four tabs — products, ingredients, recipes, assets. Customers were moved out
 * to People: a customer is not reference data, it is a live balance that
 * changes with every credit sale, and keeping them here would have meant the
 * one destination meant to be static contained the one thing that moves daily.
 *
 * The recipe was the shape with no precedent, and the Builder won it. Two
 * corrections followed from looking at the built page:
 *
 *   **A list, then a record.** The first pass opened straight into editing
 *   Chips with no way to reach the other recipes — a detail page pretending to
 *   be a tab, while the other three tabs were lists. Now the list is the tab.
 *
 *   **Hierarchy through weight and surface, not colour.** Every block was an
 *   identical white card, so the page blurred into one even field and the only
 *   thing that stood out was an amber alert. Three fixes: the redundant summary
 *   strip is gone (it said what the alert said, worse), the dish carries a
 *   page-level identity instead of a 13px card title, and the builder's three
 *   columns now sit at three different weights.
 */

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { AccentSwitcher } from "@/components/design/accent-switcher";
import { AdminShell } from "@/components/design/shell/admin-shell";
import { DetailCard } from "@/components/patterns/detail-page";
import { RecipeBuilder } from "./recipe-builder";
import { RecipeList } from "./recipe-list";
import { VersionHistory } from "./versions";
import {
  products,
  ingredients,
  recipes,
  assets,
  recipeCost,
  money,
  type Recipe,
} from "@/lib/fixtures";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Plus } from "lucide-react";

const tabs = [
  { key: "products", label: "Products", hint: "What is sold, and for how much" },
  { key: "ingredients", label: "Ingredients", hint: "What the kitchen uses" },
  { key: "recipes", label: "Recipes", hint: "What each dish takes to make" },
  { key: "assets", label: "Assets", hint: "What the business owns" },
];

export function CatalogueRound() {
  const params = useSearchParams();
  const [tab, setTab] = useState(params.get("tab") ?? "recipes");
  const [openId, setOpenId] = useState<string | null>(null);

  const open = recipes.find((r) => r.id === openId) ?? null;

  return (
    <>
      <AdminShell
        active="catalogue"
        title="Catalogue"
        subtitle="Everything the business refers to"
        actions={
          <Button size="sm" className="h-8">
            <Plus className="size-3.5" /> Add
          </Button>
        }
      >
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-3 flex-wrap">
            {tabs.map((t) => (
              <TabsTrigger key={t.key} value={t.key}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="products">
            <SimpleTable
              head={["Product", "Kind", "Price", "Unit cost", "Margin"]}
              rows={products.slice(0, 10).map((p) => [
                p.name,
                p.kind,
                money(p.price),
                p.unitCost === null ? "—" : money(p.unitCost),
                p.unitCost === null
                  ? "—"
                  : `${(((p.price - p.unitCost) / p.price) * 100).toFixed(0)}%`,
              ])}
            />
          </TabsContent>

          <TabsContent value="ingredients">
            <SimpleTable
              head={["Ingredient", "Unit", "Unit cost", "On hand"]}
              rows={ingredients.map((i) => [
                i.name,
                i.unit,
                money(i.unitCost),
                String(i.stock),
              ])}
            />
          </TabsContent>

          <TabsContent value="recipes">
            {open ? (
              <RecipeDetail recipe={open} onBack={() => setOpenId(null)} />
            ) : (
              <RecipeList onOpen={setOpenId} />
            )}
          </TabsContent>

          <TabsContent value="assets">
            <SimpleTable
              head={["Asset", "Location", "Bought", "Cost", "Expense"]}
              rows={assets.map((a) => [
                a.name,
                a.location,
                a.purchasedOn,
                money(a.cost),
                a.expenseRef,
              ])}
            />
          </TabsContent>
        </Tabs>
      </AdminShell>

      <AccentSwitcher />
    </>
  );
}

/**
 * One recipe.
 *
 * The dish gets a **page-level identity** — its name as a real heading with the
 * per-unit cost beside it — rather than being a 13px card title indistinguishable
 * from "Version history" next to it. That was the second cause of the flat page:
 * nothing marked the primary object.
 *
 * Version history moved below the builder rather than beside it. It is
 * supporting evidence, not a peer of the thing being edited, and putting it in
 * a third column forced the builder narrower than it wanted to be.
 */
function RecipeDetail({
  recipe,
  onBack,
}: {
  recipe: Recipe;
  onBack: () => void;
}) {
  const { perUnit } = recipeCost(recipe.versions[0]);
  const product = products.find((p) => p.id === recipe.productId);
  const margin = product ? ((product.price - perUnit) / product.price) * 100 : null;

  return (
    <div>
      <button
        onClick={onBack}
        className="mb-3 flex items-center gap-1 text-[13px] text-muted-foreground transition-colors duration-100 hover:text-foreground"
      >
        <ChevronLeft className="size-3.5" /> All recipes
      </button>

      {/* The subject of the screen, weighted as such. */}
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">{recipe.product}</h2>
          <p className="text-[13px] text-muted-foreground">
            What one {recipe.unit} takes to make
          </p>
        </div>
        {product && (
          <div className="flex items-center gap-5 text-right">
            <Figure label="Sells for" value={money(product.price)} />
            <Figure label="Costs to make" value={money(perUnit)} />
            <Figure
              label="Margin"
              value={`${margin!.toFixed(0)}%`}
              tone={margin! < 40 ? "warning" : undefined}
            />
          </div>
        )}
      </div>

      <RecipeBuilder
        recipe={recipe}
        aside={
          <DetailCard
            title="Version history"
            flush
            footnote="A change is a new version from a date. Past figures keep the recipe they were costed with, so a closed month never restates itself."
          >
            <VersionHistory recipe={recipe} />
          </DetailCard>
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
        className={`tabular text-[15px] font-semibold ${
          tone === "warning" ? "text-warning" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}

/**
 * A plain table, deliberately not a new component.
 *
 * The record-table page is still unextracted, so the other three tabs use the
 * simplest honest thing rather than inventing a fifth table treatment that
 * would have to be unpicked later. What matters this round is whether four
 * unrelated shapes behind one link hold together.
 */
function SimpleTable({
  head,
  rows,
}: {
  head: string[];
  rows: string[][];
}) {
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b bg-muted/60 text-[11px] text-muted-foreground">
              {head.map((h, i) => (
                <th
                  key={h}
                  className={`px-3 py-2 font-medium ${
                    i === 0 ? "text-left" : i < 2 ? "text-left" : "text-right"
                  }`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r[0]} className="border-b last:border-0 hover:bg-muted/40">
                {r.map((c, i) => (
                  <td
                    key={i}
                    className={`px-3 py-2 ${
                      i === 0
                        ? "font-medium"
                        : i < 2
                          ? "text-muted-foreground capitalize"
                          : "tabular text-right"
                    }`}
                  >
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
