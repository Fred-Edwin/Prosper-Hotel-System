"use client";

/** Categories tab — list, search, create/edit. Same shape as
 * IngredientsTab/ProductsTab, including deactivate living on the edit
 * sheet rather than a row action. */

import { useMemo, useState } from "react";
import { RecordTable, Truncate, RowAction, type Column } from "@/components/patterns/record-table";
import { TableToolbar } from "@/components/patterns/table-toolbar";
import { EmptyFirstUse, EmptyFiltered } from "@/components/patterns/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tag, Plus } from "lucide-react";
import { CategoryForm } from "./category-form";
import type { Category } from "../schema";

export function CategoriesTab({
  categories,
  onCreate,
  onUpdate,
  onSetActive,
  saving,
  error,
}: {
  categories: Category[];
  onCreate: (input: { name: string }) => void;
  onUpdate: (id: string, input: { name: string }) => void;
  onSetActive: (id: string, active: boolean) => void;
  saving?: boolean;
  error?: string;
}) {
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Category | null>(null);
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return categories.filter((c) => !q || c.name.toLowerCase().includes(q));
  }, [categories, query]);

  const columns: Column<Category>[] = [
    {
      key: "name",
      header: "Name",
      align: "left",
      cell: (c) => (
        <span className={c.active ? "" : "text-muted-foreground"}>
          <Truncate>{c.name}</Truncate>
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      align: "left",
      cell: (c) =>
        c.active ? (
          <Badge variant="outline">Active</Badge>
        ) : (
          <Badge variant="secondary">Inactive</Badge>
        ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      cell: (c) => (
        <RowAction label="Edit" onClick={() => setEditing(c)} testId={`category-row-edit-${c.id}`} />
      ),
    },
  ];

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <TableToolbar
          query={query}
          onQuery={setQuery}
          placeholder="Search categories"
          count={filtered.length}
          total={categories.length}
          noun="categories"
          testIdPrefix="category"
        />
        <Button size="sm" className="h-8" onClick={() => setCreating(true)}>
          <Plus className="size-3.5" /> Add category
        </Button>
      </div>

      <RecordTable
        rows={filtered}
        columns={columns}
        rowKey={(c) => c.id}
        testIdPrefix="category"
        empty={
          categories.length === 0 ? (
            <EmptyFirstUse
              icon={<Tag className="size-4" />}
              title="No categories yet"
              body="Group products the way you think about them — food, drinks, snacks, stationery."
              action={
                <Button size="sm" className="h-8" onClick={() => setCreating(true)}>
                  <Plus className="size-3.5" /> Add category
                </Button>
              }
            />
          ) : (
            <EmptyFiltered onClear={() => setQuery("")} noun="categories" />
          )
        }
      />

      <CategoryForm
        open={creating}
        onOpenChange={setCreating}
        saving={saving}
        error={error}
        onSave={(input) => onCreate(input)}
      />
      <CategoryForm
        open={editing !== null}
        onOpenChange={(v) => !v && setEditing(null)}
        category={editing ?? undefined}
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
