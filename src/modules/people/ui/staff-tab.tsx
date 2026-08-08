"use client";

/**
 * Staff tab — list, search, filter by location, create/edit; deactivate
 * lives on the edit sheet as a status switch, same as catalogue's
 * ProductsTab/ProductForm.
 */

import { useMemo, useState } from "react";
import { RecordTable, Num, Truncate, RowAction, type Column } from "@/components/patterns/record-table";
import { TableToolbar } from "@/components/patterns/table-toolbar";
import { EmptyFirstUse, EmptyFiltered } from "@/components/patterns/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, Plus } from "lucide-react";
import { StaffForm } from "./staff-form";
import type { Location, StaffMember, StaffRole } from "../schema";

const ROLE_LABEL: Record<StaffRole, string> = {
  owner: "Owner",
  store_manager: "Store manager",
  cashier: "Cashier",
  attendant: "Attendant",
};

export function StaffTab({
  staff,
  locations,
  onCreate,
  onUpdate,
  onSetActive,
  saving,
  error,
}: {
  staff: StaffMember[];
  locations: Location[];
  onCreate: (input: {
    name: string;
    phone: string;
    role: StaffRole;
    locationId: string;
    dailyRateMinor: number;
    pin?: string;
  }) => void;
  onUpdate: (
    id: string,
    input: {
      name: string;
      phone: string;
      role: StaffRole;
      locationId: string;
      dailyRateMinor: number;
      pin?: string;
    },
  ) => void;
  onSetActive: (id: string, active: boolean) => void;
  saving?: boolean;
  error?: string;
}) {
  const [query, setQuery] = useState("");
  const [locationId, setLocationId] = useState("all");
  const [editing, setEditing] = useState<StaffMember | null>(null);
  const [creating, setCreating] = useState(false);

  const locationName = useMemo(
    () => Object.fromEntries(locations.map((l) => [l.id, l.name])),
    [locations],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return staff.filter(
      (s) =>
        (locationId === "all" || s.locationId === locationId) &&
        (!q || s.name.toLowerCase().includes(q)),
    );
  }, [staff, query, locationId]);

  const columns: Column<StaffMember>[] = [
    {
      key: "name",
      header: "Name",
      align: "left",
      cell: (s) => (
        <span className={s.active ? "" : "text-muted-foreground"}>
          <Truncate>{s.name}</Truncate>
        </span>
      ),
    },
    { key: "role", header: "Role", align: "left", cell: (s) => ROLE_LABEL[s.role] },
    {
      key: "location",
      header: "Location",
      align: "left",
      cell: (s) => locationName[s.locationId] ?? "—",
    },
    {
      key: "rate",
      header: "Daily rate",
      cell: (s) => <Num value={s.dailyRateMinor} money />,
    },
    {
      key: "status",
      header: "Status",
      align: "left",
      cell: (s) =>
        s.active ? (
          <Badge variant="outline">Active</Badge>
        ) : (
          <Badge variant="secondary">Inactive</Badge>
        ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      cell: (s) => <RowAction label="Edit" onClick={() => setEditing(s)} />,
    },
  ];

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <TableToolbar
          query={query}
          onQuery={setQuery}
          placeholder="Search staff"
          count={filtered.length}
          total={staff.length}
          noun="staff"
          filters={[
            {
              key: "location",
              value: locationId,
              onChange: setLocationId,
              allLabel: "All locations",
              options: locations.map((l) => ({ value: l.id, label: l.name })),
              width: "10rem",
            },
          ]}
        />
        <Button size="sm" className="h-8" onClick={() => setCreating(true)}>
          <Plus className="size-3.5" /> Add staff member
        </Button>
      </div>

      <RecordTable
        rows={filtered}
        columns={columns}
        rowKey={(s) => s.id}
        empty={
          staff.length === 0 ? (
            <EmptyFirstUse
              icon={<Users className="size-4" />}
              title="No staff yet"
              body="Add the people who work here — their role, location and daily rate."
              action={
                <Button size="sm" className="h-8" onClick={() => setCreating(true)}>
                  <Plus className="size-3.5" /> Add staff member
                </Button>
              }
            />
          ) : (
            <EmptyFiltered
              onClear={() => {
                setQuery("");
                setLocationId("all");
              }}
              noun="staff"
            />
          )
        }
      />

      <StaffForm
        open={creating}
        onOpenChange={setCreating}
        locations={locations}
        saving={saving}
        error={error}
        onSave={(input) => onCreate(input)}
      />
      <StaffForm
        key={editing?.id ?? "editing"}
        open={editing !== null}
        onOpenChange={(v) => !v && setEditing(null)}
        staff={editing ?? undefined}
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
