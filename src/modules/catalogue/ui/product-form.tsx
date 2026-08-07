"use client";

/**
 * Create/edit form for a product. One component for both, per
 * `EditSheet`'s convention — the difference is the title and what the
 * fields are seeded with.
 *
 * Price is a field here, not a screen — design.md: "setting a price is a
 * field on the product form... not a screen."
 *
 * Active/inactive is a switch here rather than a separate row action —
 * deactivating is a state change on the record, same place its other
 * fields are edited.
 */

import { useState } from "react";
import { FormSection, Field } from "@/components/patterns/form";
import { EditSheet } from "@/components/patterns/detail-page";
import { ConfirmDialog } from "@/components/patterns/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Product, ProductKind } from "../schema";

const KIND_LABEL: Record<ProductKind, string> = {
  goods: "Goods",
  cooked_food: "Cooked food",
  service: "Service",
  packaging: "Packaging",
};

export function ProductForm({
  open,
  onOpenChange,
  product,
  saving,
  error,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Absent when creating. */
  product?: Product;
  saving?: boolean;
  error?: string;
  onSave: (input: {
    name: string;
    kind: ProductKind;
    priceMinor: number | null;
    active: boolean;
  }) => void;
}) {
  const [name, setName] = useState(product?.name ?? "");
  const [kind, setKind] = useState<ProductKind>(product?.kind ?? "goods");
  const [price, setPrice] = useState(
    product?.priceMinor != null ? String(product.priceMinor) : "",
  );
  const [active, setActive] = useState(product?.active ?? true);
  const [confirmingDeactivate, setConfirmingDeactivate] = useState(false);

  return (
    <EditSheet
      open={open}
      onOpenChange={onOpenChange}
      title={product ? `Edit ${product.name}` : "New product"}
      saving={saving}
      saveLabel={product ? "Save changes" : "Create product"}
      formId="product-form"
    >
      <form
        id="product-form"
        onSubmit={(e) => {
          e.preventDefault();
          onSave({
            name,
            kind,
            priceMinor: price.trim() === "" ? null : Math.round(Number(price)),
            active,
          });
        }}
      >
        <FormSection title="Identity">
          <Field label="Name" required error={error}>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="h-9" />
          </Field>
          <Field label="Kind" required>
            <Select value={kind} onValueChange={(v) => setKind(v as ProductKind)}>
              <SelectTrigger className="h-9 w-full text-[13px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(KIND_LABEL).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </FormSection>
        <FormSection title="Price" description="Leave blank if this product is not sold directly">
          <Field label="Selling price (KSh)">
            <Input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              inputMode="numeric"
              className="tabular h-9"
            />
          </Field>
        </FormSection>
        {product && (
          <FormSection title="Status">
            <div className="flex items-start justify-between gap-4 rounded-md border p-3">
              <div>
                <div className="text-[13px] font-medium">Active</div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Turning this off hides it from new sales. Its history is kept.
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
      {product && (
        <ConfirmDialog
          open={confirmingDeactivate}
          onOpenChange={setConfirmingDeactivate}
          title={`Deactivate ${product.name}?`}
          description="It will no longer appear on the till or be sellable. Its history is kept, and it can be reactivated at any time."
          confirmLabel="Deactivate"
          onConfirm={() => setActive(false)}
        />
      )}
    </EditSheet>
  );
}
