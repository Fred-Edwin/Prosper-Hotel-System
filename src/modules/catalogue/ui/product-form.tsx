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
import type { Location } from "@/modules/people";
import type { Category, Product, ProductKind } from "../schema";

const KIND_LABEL: Record<ProductKind, string> = {
  goods: "Goods",
  cooked_food: "Cooked food",
  service: "Service",
  packaging: "Packaging",
};

const NO_CATEGORY = "__none__";

export function ProductForm({
  open,
  onOpenChange,
  product,
  categories,
  locations,
  saving,
  error,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Absent when creating. */
  product?: Product;
  /** Active categories, plus the product's current category if it's been
   * deactivated since — deactivated categories otherwise drop out of the
   * picker (docs/conventions.md's ingredient-deactivation pattern). */
  categories: Category[];
  /** docs/architecture.md's "Product home location" note: required at
   * creation, editable after — same affordance as price/category, no lock
   * (unlike AssetForm's locked-after-creation location field). */
  locations: Location[];
  saving?: boolean;
  error?: string;
  onSave: (input: {
    name: string;
    kind: ProductKind;
    priceMinor: number | null;
    categoryId: string | null;
    lowStockLevel: number | null;
    active: boolean;
    locationId: string;
  }) => void;
}) {
  const [name, setName] = useState(product?.name ?? "");
  const [kind, setKind] = useState<ProductKind>(product?.kind ?? "goods");
  const [price, setPrice] = useState(
    product?.priceMinor != null ? String(product.priceMinor) : "",
  );
  const [categoryId, setCategoryId] = useState<string | null>(product?.categoryId ?? null);
  const [locationId, setLocationId] = useState(product?.locationId ?? locations[0]?.id ?? "");
  const [lowStockLevel, setLowStockLevel] = useState(
    product?.lowStockLevel != null ? String(product.lowStockLevel) : "",
  );
  const [active, setActive] = useState(product?.active ?? true);
  const [confirmingDeactivate, setConfirmingDeactivate] = useState(false);

  const currentCategory = product?.categoryId
    ? categories.find((c) => c.id === product.categoryId)
    : undefined;
  const categoryOptions =
    currentCategory && !currentCategory.active
      ? [...categories.filter((c) => c.active), currentCategory]
      : categories.filter((c) => c.active);

  return (
    <EditSheet
      open={open}
      onOpenChange={onOpenChange}
      title={product ? `Edit ${product.name}` : "New product"}
      saving={saving}
      saveLabel={product ? "Save changes" : "Create product"}
      formId="product-form"
      testIdPrefix="product"
    >
      <form
        id="product-form"
        onSubmit={(e) => {
          e.preventDefault();
          onSave({
            name,
            kind,
            priceMinor: price.trim() === "" ? null : Number(price),
            categoryId,
            lowStockLevel: lowStockLevel.trim() === "" ? null : Number(lowStockLevel),
            active,
            locationId,
          });
        }}
      >
        <FormSection title="Identity">
          <Field label="Name" required error={error}>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-9"
              data-testid="product-name-input"
            />
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
          <Field label="Category" hint="Optional — groups this product for reporting">
            <Select
              value={categoryId ?? NO_CATEGORY}
              onValueChange={(v) => setCategoryId(v === NO_CATEGORY ? null : v)}
            >
              <SelectTrigger className="h-9 w-full text-[13px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_CATEGORY}>No category</SelectItem>
                {categoryOptions.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.active ? c.name : `${c.name} (inactive)`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field
            label="Home location"
            required
            hint="Which location this belongs to by default — offered on New Sale there even before any stock has moved"
          >
            <Select value={locationId} onValueChange={setLocationId}>
              <SelectTrigger className="h-9 w-full text-[13px]" data-testid="product-location-select">
                <SelectValue placeholder="Select a location" />
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
        </FormSection>
        <FormSection title="Price" description="Leave blank if this product is not sold directly">
          <Field label="Selling price (KSh)">
            <Input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              inputMode="decimal"
              className="tabular h-9"
            />
          </Field>
        </FormSection>
        <FormSection
          title="Low stock"
          description="Leave blank to never flag this item as low"
        >
          <Field label="Low stock level">
            <Input
              value={lowStockLevel}
              onChange={(e) => setLowStockLevel(e.target.value)}
              inputMode="decimal"
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
