"use client";

/**
 * Create/edit form for a category. Same shape as IngredientForm, minus the
 * secondary numeric fields — a category is name and active state only.
 */

import { useState } from "react";
import { FormSection, Field } from "@/components/patterns/form";
import { EditSheet } from "@/components/patterns/detail-page";
import { ConfirmDialog } from "@/components/patterns/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { Category } from "../schema";

export function CategoryForm({
  open,
  onOpenChange,
  category,
  saving,
  error,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Absent when creating. */
  category?: Category;
  saving?: boolean;
  error?: string;
  onSave: (input: { name: string; active: boolean }) => void;
}) {
  const [name, setName] = useState(category?.name ?? "");
  const [active, setActive] = useState(category?.active ?? true);
  const [confirmingDeactivate, setConfirmingDeactivate] = useState(false);

  return (
    <EditSheet
      open={open}
      onOpenChange={onOpenChange}
      title={category ? `Edit ${category.name}` : "New category"}
      saving={saving}
      saveLabel={category ? "Save changes" : "Create category"}
      formId="category-form"
      testIdPrefix="category"
    >
      <form
        id="category-form"
        onSubmit={(e) => {
          e.preventDefault();
          onSave({ name, active });
        }}
      >
        <FormSection title="Identity">
          <Field label="Name" required error={error}>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="h-9" />
          </Field>
        </FormSection>
        {category && (
          <FormSection title="Status">
            <div className="flex items-start justify-between gap-4 rounded-md border p-3">
              <div>
                <div className="text-[13px] font-medium">Active</div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Turning this off hides it from the product category picker. Products already
                  assigned keep showing it.
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
      {category && (
        <ConfirmDialog
          open={confirmingDeactivate}
          onOpenChange={setConfirmingDeactivate}
          title={`Deactivate ${category.name}?`}
          description="It will no longer be available to assign to products. Products already using it keep showing it, and it can be reactivated at any time."
          confirmLabel="Deactivate"
          onConfirm={() => setActive(false)}
        />
      )}
    </EditSheet>
  );
}
