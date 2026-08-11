"use client";

/**
 * Create form for an asset (name, location, quantity) and edit form for an
 * existing one (quantity only — name/location are identity, set once at
 * creation; ticket 34 only offers updateAssetQuantity, not a general
 * rename). Retire lives here rather than as a row action, same placement
 * as IngredientForm's deactivate — but one-way, no switch: retiring is
 * final in this ticket, so a plain confirm-gated button, not a toggle.
 */

import { useState } from "react";
import { FormSection, Field } from "@/components/patterns/form";
import { EditSheet } from "@/components/patterns/detail-page";
import { ConfirmDialog } from "@/components/patterns/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Asset } from "../schema";
import type { Location } from "@/modules/people";

export function AssetForm({
  open,
  onOpenChange,
  asset,
  locations,
  saving,
  error,
  onSave,
  onRetire,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Absent when creating. */
  asset?: Asset;
  locations: Location[];
  saving?: boolean;
  error?: string;
  onSave: (input: { name: string; locationId: string; quantity: number }) => void;
  onRetire?: () => void;
}) {
  const [name, setName] = useState(asset?.name ?? "");
  const [locationId, setLocationId] = useState(asset?.locationId ?? locations[0]?.id ?? "");
  const [quantity, setQuantity] = useState(asset ? String(asset.quantity) : "");
  const [confirmingRetire, setConfirmingRetire] = useState(false);

  return (
    <EditSheet
      open={open}
      onOpenChange={onOpenChange}
      title={asset ? `Edit ${asset.name}` : "New asset"}
      saving={saving}
      saveLabel={asset ? "Save changes" : "Add asset"}
      formId="asset-form"
    >
      <form
        id="asset-form"
        onSubmit={(e) => {
          e.preventDefault();
          onSave({
            name,
            locationId,
            quantity: quantity.trim() === "" ? 0 : Math.round(Number(quantity)),
          });
        }}
      >
        <FormSection title="Identity">
          <Field label="Name" required error={error} hint="e.g. Chest freezer, Dining chairs, Spoons">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!!asset}
              className="h-9"
            />
          </Field>
          <Field label="Location" required>
            <Select value={locationId} onValueChange={setLocationId} disabled={!!asset}>
              <SelectTrigger className="h-9 w-full text-[13px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {locations.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field
            label="Quantity"
            required
            hint={
              asset
                ? undefined
                : "A repeat purchase of the same name at the same location adds to this row rather than creating a new one."
            }
          >
            <Input
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              inputMode="numeric"
              className="tabular h-9"
            />
          </Field>
        </FormSection>
        {asset && onRetire && (
          <FormSection title="Retire">
            <div className="flex items-start justify-between gap-4 rounded-md border p-3">
              <div>
                <div className="text-[13px] font-medium">Retire this asset</div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Removes it from this list. Its record is kept but cannot be brought back here.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8"
                onClick={() => setConfirmingRetire(true)}
              >
                Retire
              </Button>
            </div>
          </FormSection>
        )}
      </form>
      {asset && onRetire && (
        <ConfirmDialog
          open={confirmingRetire}
          onOpenChange={setConfirmingRetire}
          title={`Retire ${asset.name}?`}
          description="It will be removed from the asset register. Its record is kept, but this cannot be undone here."
          confirmLabel="Retire"
          destructive
          onConfirm={onRetire}
        />
      )}
    </EditSheet>
  );
}
