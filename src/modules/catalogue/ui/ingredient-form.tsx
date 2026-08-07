"use client";

/**
 * Create/edit form for an ingredient. Same shape as ProductForm, including
 * the active/inactive switch living on the sheet rather than a row action.
 */

import { useState } from "react";
import { FormSection, Field } from "@/components/patterns/form";
import { EditSheet } from "@/components/patterns/detail-page";
import { ConfirmDialog } from "@/components/patterns/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { Ingredient } from "../schema";

export function IngredientForm({
  open,
  onOpenChange,
  ingredient,
  saving,
  error,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Absent when creating. */
  ingredient?: Ingredient;
  saving?: boolean;
  error?: string;
  onSave: (input: {
    name: string;
    unitOfMeasure: string;
    lastKnownCostMinor: number | null;
    active: boolean;
  }) => void;
}) {
  const [name, setName] = useState(ingredient?.name ?? "");
  const [unitOfMeasure, setUnitOfMeasure] = useState(ingredient?.unitOfMeasure ?? "");
  const [cost, setCost] = useState(
    ingredient?.lastKnownCostMinor != null ? String(ingredient.lastKnownCostMinor) : "",
  );
  const [active, setActive] = useState(ingredient?.active ?? true);
  const [confirmingDeactivate, setConfirmingDeactivate] = useState(false);

  return (
    <EditSheet
      open={open}
      onOpenChange={onOpenChange}
      title={ingredient ? `Edit ${ingredient.name}` : "New ingredient"}
      saving={saving}
      saveLabel={ingredient ? "Save changes" : "Create ingredient"}
      formId="ingredient-form"
    >
      <form
        id="ingredient-form"
        onSubmit={(e) => {
          e.preventDefault();
          onSave({
            name,
            unitOfMeasure,
            lastKnownCostMinor: cost.trim() === "" ? null : Math.round(Number(cost)),
            active,
          });
        }}
      >
        <FormSection title="Identity">
          <Field label="Name" required error={error}>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="h-9" />
          </Field>
          <Field label="Unit of measure" required hint="e.g. kg, litre, packet">
            <Input
              value={unitOfMeasure}
              onChange={(e) => setUnitOfMeasure(e.target.value)}
              className="h-9"
            />
          </Field>
        </FormSection>
        <FormSection
          title="Cost"
          description="Last known purchase cost per unit — feeds recipe costing"
        >
          <Field label="Cost per unit (KSh)">
            <Input
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              inputMode="numeric"
              className="tabular h-9"
            />
          </Field>
        </FormSection>
        {ingredient && (
          <FormSection title="Status">
            <div className="flex items-start justify-between gap-4 rounded-md border p-3">
              <div>
                <div className="text-[13px] font-medium">Active</div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Turning this off hides it from new recipes. Its history is kept.
                </p>
              </div>
              <Switch
                checked={active}
                onCheckedChange={(checked) => {
                  if (!checked) setConfirmingDeactivate(true);
                  else setActive(true);
                }}
              />
            </div>
          </FormSection>
        )}
      </form>
      {ingredient && (
        <ConfirmDialog
          open={confirmingDeactivate}
          onOpenChange={setConfirmingDeactivate}
          title={`Deactivate ${ingredient.name}?`}
          description="It will no longer be available to add to recipes. Its history is kept, and it can be reactivated at any time."
          confirmLabel="Deactivate"
          onConfirm={() => setActive(false)}
        />
      )}
    </EditSheet>
  );
}
