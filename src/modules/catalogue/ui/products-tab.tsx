"use client";

/**
 * Products tab — list, search, create/edit; deactivate lives on the edit
 * sheet as a status switch rather than a row action, since it is a field
 * on the record like any other.
 */

import { useMemo, useState } from "react";
import { RecordTable, Num, Truncate, RowAction, type Column } from "@/components/patterns/record-table";
import { TableToolbar } from "@/components/patterns/table-toolbar";
import { EmptyFirstUse, EmptyFiltered } from "@/components/patterns/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Package, Plus } from "lucide-react";
import { ProductForm } from "./product-form";
import type { Location } from "@/modules/people";
import type { Category, Product, ProductKind } from "../schema";

const KIND_LABEL: Record<ProductKind, string> = {
  goods: "Goods",
  cooked_food: "Cooked food",
  service: "Service",
  packaging: "Packaging",
};

export function ProductsTab({
  products,
  categories,
  locations,
  onCreate,
  onUpdate,
  onSetActive,
  saving,
  error,
}: {
  products: Product[];
  categories: Category[];
  locations: Location[];
  onCreate: (input: {
    name: string;
    kind: ProductKind;
    priceMinor: number | null;
    lastKnownCostMinor: number | null;
    categoryId: string | null;
    locationId: string;
  }) => void;
  onUpdate: (
    id: string,
    input: {
      name: string;
      kind: ProductKind;
      priceMinor: number | null;
      lastKnownCostMinor: number | null;
      categoryId: string | null;
      locationId: string;
    },
  ) => void;
  onSetActive: (id: string, active: boolean) => void;
  saving?: boolean;
  error?: string;
}) {
  const [query, setQuery] = useState("");
  const [locationId, setLocationId] = useState("all");
  const [categoryId, setCategoryId] = useState("all");
  // 2026-08-18: lets the owner jump straight to the products that need a
  // buying price, rather than skimming the whole list for "Not set".
  const [buyingPrice, setBuyingPrice] = useState("all");
  const [editing, setEditing] = useState<Product | null>(null);
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter(
      (p) =>
        (!q || p.name.toLowerCase().includes(q)) &&
        (locationId === "all" || p.locationId === locationId) &&
        (categoryId === "all" ||
          (categoryId === "uncategorised" ? p.categoryId === null : p.categoryId === categoryId)) &&
        (buyingPrice === "all" ||
          (buyingPrice === "missing"
            ? p.lastKnownCostMinor === null
            : buyingPrice === "zero"
              ? p.lastKnownCostMinor === 0
              : p.lastKnownCostMinor !== null && p.lastKnownCostMinor > 0)),
    );
  }, [products, query, locationId, categoryId, buyingPrice]);

  const columns: Column<Product>[] = [
    {
      key: "name",
      header: "Name",
      align: "left",
      cell: (p) => (
        <span className={p.active ? "" : "text-muted-foreground"}>
          <Truncate>{p.name}</Truncate>
        </span>
      ),
    },
    { key: "kind", header: "Kind", align: "left", cell: (p) => KIND_LABEL[p.kind] },
    {
      // 2026-08-18: buying price surfaced alongside selling price so the
      // owner can see, in one list, which products have no buying price at
      // all and which she has deliberately set to zero. The two are *not*
      // the same thing and must not look the same: zero means "made from
      // ingredients, already costed as those ingredients moved through the
      // store", while blank means "nobody has filled this in yet" — and a
      // blank one currently falls through to a 60%-of-selling-price
      // estimate in cost of goods sold. `Num` renders null as "—" and a
      // real zero as "0.00", so the distinction is already visible; the
      // "Not set" badge makes the blank case impossible to skim past,
      // since "—" alone reads as "nothing to see here" rather than
      // "action needed".
      key: "buyingPrice",
      header: "Buying price",
      cell: (p) =>
        p.lastKnownCostMinor === null ? (
          <Badge variant="secondary" className="font-normal">
            Not set
          </Badge>
        ) : (
          <Num value={p.lastKnownCostMinor} money />
        ),
    },
    { key: "price", header: "Selling price", cell: (p) => <Num value={p.priceMinor} money /> },
    {
      key: "status",
      header: "Status",
      align: "left",
      cell: (p) =>
        p.active ? (
          <Badge variant="outline">Active</Badge>
        ) : (
          <Badge variant="secondary">Inactive</Badge>
        ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      cell: (p) => (
        <RowAction label="Edit" onClick={() => setEditing(p)} testId={`product-row-edit-${p.id}`} />
      ),
    },
  ];

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <TableToolbar
          query={query}
          onQuery={setQuery}
          placeholder="Search products"
          filters={[
            {
              key: "location",
              value: locationId,
              onChange: setLocationId,
              allLabel: "All locations",
              options: locations.map((l) => ({ value: l.id, label: l.name })),
            },
            {
              key: "category",
              value: categoryId,
              onChange: setCategoryId,
              allLabel: "All categories",
              options: [
                ...categories.map((c) => ({ value: c.id, label: c.name })),
                { value: "uncategorised", label: "Uncategorised" },
              ],
            },
            {
              key: "buyingPrice",
              value: buyingPrice,
              onChange: setBuyingPrice,
              allLabel: "Any buying price",
              options: [
                { value: "missing", label: "No buying price" },
                { value: "zero", label: "Buying price zero" },
                { value: "set", label: "Buying price set" },
              ],
            },
          ]}
          count={filtered.length}
          total={products.length}
          noun="products"
          testIdPrefix="product"
        />
        <Button size="sm" className="h-8" onClick={() => setCreating(true)}>
          <Plus className="size-3.5" /> Add product
        </Button>
      </div>

      <RecordTable
        rows={filtered}
        columns={columns}
        rowKey={(p) => p.id}
        testIdPrefix="product"
        empty={
          products.length === 0 ? (
            <EmptyFirstUse
              icon={<Package className="size-4" />}
              title="No products yet"
              body="Add what the business sells — goods, cooked food, services or packaging."
              action={
                <Button size="sm" className="h-8" onClick={() => setCreating(true)}>
                  <Plus className="size-3.5" /> Add product
                </Button>
              }
            />
          ) : (
            <EmptyFiltered
              onClear={() => {
                setQuery("");
                setLocationId("all");
                setCategoryId("all");
                setBuyingPrice("all");
              }}
              noun="products"
            />
          )
        }
      />

      <ProductForm
        open={creating}
        onOpenChange={setCreating}
        categories={categories}
        locations={locations}
        saving={saving}
        error={error}
        onSave={(input) => onCreate(input)}
      />
      <ProductForm
        key={editing?.id ?? "editing"}
        open={editing !== null}
        onOpenChange={(v) => !v && setEditing(null)}
        product={editing ?? undefined}
        categories={categories}
        locations={locations}
        saving={saving}
        error={error}
        onSave={(input) => {
          if (!editing) return;
          onUpdate(editing.id, input);
          if (input.active !== editing.active) onSetActive(editing.id, input.active);
        }}
      />
    </div>
  );
}
