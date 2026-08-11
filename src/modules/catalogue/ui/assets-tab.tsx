"use client";

/** Assets tab — list, search, create, and quantity-edit/retire via the
 * edit sheet. Same list/toolbar shape as IngredientsTab; retirement has no
 * badge or dimmed state — a retired asset simply isn't in `assets` at all
 * (docs/scope.md: filtered out entirely, not shown-but-marked). */

import { useMemo, useState } from "react";
import { RecordTable, Num, Truncate, RowAction, type Column } from "@/components/patterns/record-table";
import { TableToolbar } from "@/components/patterns/table-toolbar";
import { EmptyFirstUse, EmptyFiltered } from "@/components/patterns/states";
import { Button } from "@/components/ui/button";
import { Archive, Plus } from "lucide-react";
import { AssetForm } from "./asset-form";
import type { Asset } from "../schema";
import type { Location } from "@/modules/people";

export function AssetsTab({
  assets,
  locations,
  onCreate,
  onUpdateQuantity,
  onRetire,
  saving,
  error,
}: {
  assets: Asset[];
  locations: Location[];
  onCreate: (input: { name: string; locationId: string; quantity: number }) => void;
  onUpdateQuantity: (id: string, quantity: number) => void;
  onRetire: (id: string) => void;
  saving?: boolean;
  error?: string;
}) {
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Asset | null>(null);
  const [creating, setCreating] = useState(false);

  const locationName = useMemo(
    () => new Map(locations.map((l) => [l.id, l.name])),
    [locations],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return assets.filter((a) => !q || a.name.toLowerCase().includes(q));
  }, [assets, query]);

  const columns: Column<Asset>[] = [
    {
      key: "name",
      header: "Name",
      align: "left",
      cell: (a) => <Truncate>{a.name}</Truncate>,
    },
    {
      key: "location",
      header: "Location",
      align: "left",
      cell: (a) => locationName.get(a.locationId) ?? "—",
    },
    { key: "quantity", header: "Quantity", cell: (a) => <Num value={a.quantity} /> },
    {
      key: "actions",
      header: "",
      align: "right",
      cell: (a) => <RowAction label="Edit" onClick={() => setEditing(a)} />,
    },
  ];

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <TableToolbar
          query={query}
          onQuery={setQuery}
          placeholder="Search assets"
          count={filtered.length}
          total={assets.length}
          noun="assets"
        />
        <Button size="sm" className="h-8" onClick={() => setCreating(true)}>
          <Plus className="size-3.5" /> Add asset
        </Button>
      </div>

      <RecordTable
        rows={filtered}
        columns={columns}
        rowKey={(a) => a.id}
        empty={
          assets.length === 0 ? (
            <EmptyFirstUse
              icon={<Archive className="size-4" />}
              title="No assets recorded yet"
              body="Record the durable things the business owns — equipment, furniture, plates, spoons."
              action={
                <Button size="sm" className="h-8" onClick={() => setCreating(true)}>
                  <Plus className="size-3.5" /> Add asset
                </Button>
              }
            />
          ) : (
            <EmptyFiltered onClear={() => setQuery("")} noun="assets" />
          )
        }
      />

      <AssetForm
        open={creating}
        onOpenChange={setCreating}
        locations={locations}
        saving={saving}
        error={error}
        onSave={(input) => onCreate(input)}
      />
      <AssetForm
        open={editing !== null}
        onOpenChange={(v) => !v && setEditing(null)}
        asset={editing ?? undefined}
        locations={locations}
        saving={saving}
        error={error}
        onSave={(input) => {
          if (!editing) return;
          onUpdateQuantity(editing.id, input.quantity);
        }}
        onRetire={() => {
          if (!editing) return;
          onRetire(editing.id);
          setEditing(null);
        }}
      />
    </div>
  );
}
