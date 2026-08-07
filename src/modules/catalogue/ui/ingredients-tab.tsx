"use client";

/** Ingredients tab — list, search, create/edit. Same shape as ProductsTab,
 * including deactivate living on the edit sheet rather than a row action. */

import { useMemo, useState } from "react";
import { RecordTable, Num, Truncate, RowAction, type Column } from "@/components/patterns/record-table";
import { TableToolbar } from "@/components/patterns/table-toolbar";
import { EmptyFirstUse, EmptyFiltered } from "@/components/patterns/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Wheat, Plus } from "lucide-react";
import { IngredientForm } from "./ingredient-form";
import type { Ingredient } from "../schema";

export function IngredientsTab({
  ingredients,
  onCreate,
  onUpdate,
  onSetActive,
  saving,
  error,
}: {
  ingredients: Ingredient[];
  onCreate: (input: {
    name: string;
    unitOfMeasure: string;
    lastKnownCostMinor: number | null;
  }) => void;
  onUpdate: (
    id: string,
    input: { name: string; unitOfMeasure: string; lastKnownCostMinor: number | null },
  ) => void;
  onSetActive: (id: string, active: boolean) => void;
  saving?: boolean;
  error?: string;
}) {
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Ingredient | null>(null);
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ingredients.filter((i) => !q || i.name.toLowerCase().includes(q));
  }, [ingredients, query]);

  const columns: Column<Ingredient>[] = [
    {
      key: "name",
      header: "Name",
      align: "left",
      cell: (i) => (
        <span className={i.active ? "" : "text-muted-foreground"}>
          <Truncate>{i.name}</Truncate>
        </span>
      ),
    },
    { key: "unit", header: "Unit", align: "left", cell: (i) => i.unitOfMeasure },
    {
      key: "cost",
      header: "Cost per unit",
      cell: (i) => <Num value={i.lastKnownCostMinor} money />,
    },
    {
      key: "status",
      header: "Status",
      align: "left",
      cell: (i) =>
        i.active ? (
          <Badge variant="outline">Active</Badge>
        ) : (
          <Badge variant="secondary">Inactive</Badge>
        ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      cell: (i) => <RowAction label="Edit" onClick={() => setEditing(i)} />,
    },
  ];

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <TableToolbar
          query={query}
          onQuery={setQuery}
          placeholder="Search ingredients"
          count={filtered.length}
          total={ingredients.length}
          noun="ingredients"
        />
        <Button size="sm" className="h-8" onClick={() => setCreating(true)}>
          <Plus className="size-3.5" /> Add ingredient
        </Button>
      </div>

      <RecordTable
        rows={filtered}
        columns={columns}
        rowKey={(i) => i.id}
        empty={
          ingredients.length === 0 ? (
            <EmptyFirstUse
              icon={<Wheat className="size-4" />}
              title="No ingredients yet"
              body="Add what the kitchen buys and uses to cook — flour, oil, potatoes."
              action={
                <Button size="sm" className="h-8" onClick={() => setCreating(true)}>
                  <Plus className="size-3.5" /> Add ingredient
                </Button>
              }
            />
          ) : (
            <EmptyFiltered onClear={() => setQuery("")} noun="ingredients" />
          )
        }
      />

      <IngredientForm
        open={creating}
        onOpenChange={setCreating}
        saving={saving}
        error={error}
        onSave={(input) => onCreate(input)}
      />
      <IngredientForm
        open={editing !== null}
        onOpenChange={(v) => !v && setEditing(null)}
        ingredient={editing ?? undefined}
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
