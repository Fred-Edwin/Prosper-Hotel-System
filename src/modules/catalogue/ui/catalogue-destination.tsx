"use client";

/**
 * The Catalogue destination — Products, Ingredients, Recipes, Assets tabs
 * behind one admin nav link. Ported from the locked design round
 * (round.tsx), minus fixtures, replaced with the real fetch/mutation
 * layer. Assets (ticket 34) landed later than the other three, once
 * docs/scope.md added the asset register to this module.
 *
 * Owner-only: the /catalogue route denies non-owners before this ever
 * mounts, so this component assumes an owner session.
 */

import { useEffect, useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { LoadingTable, ErrorState, PermissionDenied } from "@/components/patterns/states";
import { ProductsTab } from "./products-tab";
import { IngredientsTab } from "./ingredients-tab";
import { RecipesTab } from "./recipes-tab";
import { AssetsTab } from "./assets-tab";
import { fetchCatalogue, parseRecipeVersions, type CatalogueState } from "./catalogue-data";
import type { Recipe } from "../schema";

const tabs = [
  { key: "products", label: "Products" },
  { key: "ingredients", label: "Ingredients" },
  { key: "recipes", label: "Recipes" },
  { key: "assets", label: "Assets" },
];

async function postJson(url: string, method: string, body: unknown) {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) return { ok: false as const, reason: data.error as string };
  return { ok: true as const, data };
}

export function CatalogueDestination() {
  const [attempt, setAttempt] = useState(0);
  return <CatalogueDestinationForAttempt key={attempt} onRetry={() => setAttempt((a) => a + 1)} />;
}

function CatalogueDestinationForAttempt({ onRetry }: { onRetry: () => void }) {
  const [state, setState] = useState<CatalogueState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    fetchCatalogue().then((result) => {
      if (!cancelled) setState(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return <CatalogueDestinationView state={state} onRetry={onRetry} />;
}

/** The presentational half, driven by state rather than fetching — this is
 * what Storybook mounts to show every state without a network. */
export function CatalogueDestinationView({
  state,
  onRetry = () => {},
}: {
  state: CatalogueState;
  onRetry?: () => void;
}) {
  if (state.status === "loading") return <LoadingTable summary={0} columns={5} />;
  if (state.status === "denied")
    return (
      <PermissionDenied
        title="Only the owner can see the catalogue"
        body="Ask the owner if you need a product, ingredient or recipe changed."
      />
    );
  if (state.status === "error") return <ErrorState what="the catalogue" onRetry={onRetry} />;

  return <CatalogueTabs initial={state} />;
}

/** Owns the tab selection and the live copy of the data, seeded once from
 * the initial fetch and refreshed after every mutation. */
function CatalogueTabs({ initial }: { initial: Extract<CatalogueState, { status: "ready" }> }) {
  const [tab, setTab] = useState("products");
  const [data, setData] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [versionsByProduct, setVersionsByProduct] = useState<Record<string, Recipe[] | undefined>>({});
  const [versionsLoading, setVersionsLoading] = useState(false);

  const { products, ingredients, recipes, assets, locations } = data;
  const cookedFoodProducts = products.filter((p) => p.kind === "cooked_food" && p.active);

  async function refresh() {
    const result = await fetchCatalogue();
    if (result.status === "ready") setData(result);
  }

  async function loadVersions(productId: string) {
    setVersionsLoading(true);
    const response = await fetch(`/api/catalogue/recipes/${productId}/versions`);
    setVersionsLoading(false);
    if (!response.ok) return;
    const body = await response.json();
    setVersionsByProduct((prev) => ({
      ...prev,
      [productId]: parseRecipeVersions(body.versions),
    }));
  }

  async function withSaving(fn: () => Promise<{ ok: boolean; reason?: string }>) {
    setSaving(true);
    setError(undefined);
    const result = await fn();
    setSaving(false);
    if (!result.ok) {
      setError(
        result.reason === "duplicate_name" ? "That name is already in use." : "Couldn't save — try again.",
      );
      return;
    }
    await refresh();
  }

  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList className="mb-3 flex-wrap">
        {tabs.map((t) => (
          <TabsTrigger key={t.key} value={t.key}>
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="products">
        <ProductsTab
          products={products}
          saving={saving}
          error={error}
          onCreate={(input) => withSaving(() => postJson("/api/catalogue/products", "POST", input))}
          onUpdate={(id, input) =>
            withSaving(() => postJson(`/api/catalogue/products/${id}`, "PATCH", input))
          }
          onSetActive={(id, active) =>
            withSaving(() => postJson(`/api/catalogue/products/${id}/active`, "PATCH", { active }))
          }
        />
      </TabsContent>

      <TabsContent value="ingredients">
        <IngredientsTab
          ingredients={ingredients}
          saving={saving}
          error={error}
          onCreate={(input) => withSaving(() => postJson("/api/catalogue/ingredients", "POST", input))}
          onUpdate={(id, input) =>
            withSaving(() => postJson(`/api/catalogue/ingredients/${id}`, "PATCH", input))
          }
          onSetActive={(id, active) =>
            withSaving(() => postJson(`/api/catalogue/ingredients/${id}/active`, "PATCH", { active }))
          }
        />
      </TabsContent>

      <TabsContent value="recipes">
        <RecipesTab
          cookedFoodProducts={cookedFoodProducts}
          ingredients={ingredients}
          recipes={recipes}
          versionsByProduct={versionsByProduct}
          versionsLoading={versionsLoading}
          onLoadVersions={loadVersions}
          saving={saving}
          onSaveRecipe={(productId, input) =>
            withSaving(async () => {
              const result = await postJson("/api/catalogue/recipes", "POST", {
                productId,
                yieldQuantity: input.yieldQuantity,
                lines: input.lines,
              });
              // Saving creates a new version — the aside showing this
              // product's history would otherwise still hold the
              // pre-save fetch until the owner leaves and reopens it.
              if (result.ok) await loadVersions(productId);
              return result;
            })
          }
        />
      </TabsContent>

      <TabsContent value="assets">
        <AssetsTab
          assets={assets}
          locations={locations}
          saving={saving}
          error={error}
          onCreate={(input) => withSaving(() => postJson("/api/catalogue/assets", "POST", input))}
          onUpdateQuantity={(id, quantity) =>
            withSaving(() => postJson(`/api/catalogue/assets/${id}/quantity`, "PATCH", { quantity }))
          }
          onRetire={(id) =>
            withSaving(() => postJson(`/api/catalogue/assets/${id}/retire`, "PATCH", {}))
          }
        />
      </TabsContent>
    </Tabs>
  );
}
