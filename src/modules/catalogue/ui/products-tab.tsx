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
import type { Product, ProductKind } from "../schema";

const KIND_LABEL: Record<ProductKind, string> = {
  goods: "Goods",
  cooked_food: "Cooked food",
  service: "Service",
  packaging: "Packaging",
};

export function ProductsTab({
  products,
  onCreate,
  onUpdate,
  onSetActive,
  saving,
  error,
}: {
  products: Product[];
  onCreate: (input: { name: string; kind: ProductKind; priceMinor: number | null }) => void;
  onUpdate: (
    id: string,
    input: { name: string; kind: ProductKind; priceMinor: number | null },
  ) => void;
  onSetActive: (id: string, active: boolean) => void;
  saving?: boolean;
  error?: string;
}) {
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Product | null>(null);
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => !q || p.name.toLowerCase().includes(q));
  }, [products, query]);

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
    { key: "price", header: "Price", cell: (p) => <Num value={p.priceMinor} money /> },
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
      cell: (p) => <RowAction label="Edit" onClick={() => setEditing(p)} />,
    },
  ];

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <TableToolbar
          query={query}
          onQuery={setQuery}
          placeholder="Search products"
          count={filtered.length}
          total={products.length}
          noun="products"
        />
        <Button size="sm" className="h-8" onClick={() => setCreating(true)}>
          <Plus className="size-3.5" /> Add product
        </Button>
      </div>

      <RecordTable
        rows={filtered}
        columns={columns}
        rowKey={(p) => p.id}
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
            <EmptyFiltered onClear={() => setQuery("")} noun="products" />
          )
        }
      />

      <ProductForm
        open={creating}
        onOpenChange={setCreating}
        saving={saving}
        error={error}
        onSave={(input) => onCreate(input)}
      />
      <ProductForm
        open={editing !== null}
        onOpenChange={(v) => !v && setEditing(null)}
        product={editing ?? undefined}
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
