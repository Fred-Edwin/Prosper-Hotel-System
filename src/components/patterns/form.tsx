"use client";

/**
 * Form primitives. Extracted from the People form in round C.
 *
 * Single column always. Labels above inputs, left-aligned — a placeholder is
 * not a label, because it disappears exactly when the user needs it. Sections
 * with headings once a form passes roughly eight fields.
 *
 * `Field` carries three things a bare Input cannot: the label, a hint that
 * explains consequence rather than restating the label, and an error that sits
 * next to the field rather than being summarised at the top of the form.
 *
 * **A disabled field states why.** A manager should be able to see that a pay
 * rate exists and that it is not theirs to change. Hiding it teaches nothing;
 * disabling it with a reason teaches who to ask. This is the same rule the
 * permission-denied page follows, one level down.
 */

import { Children, cloneElement, isValidElement, useId } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";

export function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {title}
      </h3>
      {description && (
        <p className="mt-0.5 mb-2 text-xs text-muted-foreground">
          {description}
        </p>
      )}
      <div className={`space-y-3 ${description ? "" : "mt-2"}`}>{children}</div>
    </div>
  );
}

export function Field({
  label,
  /** What happens if you change this — not a restatement of the label. */
  hint,
  /** Shown on blur, never on every keystroke. */
  error,
  /** Why this cannot be changed. Renders a lock and disables the row. */
  lockedReason,
  required,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  lockedReason?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  const locked = !!lockedReason;
  const generatedId = useId();
  const child = Children.only(children);
  const controlId =
    (isValidElement(child) && (child.props as { id?: string }).id) || generatedId;
  const control = isValidElement(child) ? cloneElement(child, { id: controlId } as never) : child;
  return (
    <div className={locked ? "opacity-70" : ""}>
      <Label htmlFor={controlId} className="mb-1 flex items-center gap-1.5 text-[13px]">
        {label}
        {required && (
          <span className="text-muted-foreground" aria-hidden>
            *
          </span>
        )}
        {locked && <Lock className="size-3 text-muted-foreground" />}
      </Label>
      {control}
      {error ? (
        <p role="alert" className="mt-1 text-xs text-danger">
          {error}
        </p>
      ) : (
        (hint || lockedReason) && (
          <p className="mt-1 text-xs text-muted-foreground">
            {lockedReason ?? hint}
          </p>
        )
      )}
    </div>
  );
}

/**
 * The action bar for a long form on its own page. Sticky at the foot, because a
 * save button below the fold on a twenty-field form is a save button nobody
 * finds.
 *
 * Sheets do not use this — `EditSheet` carries its own footer.
 */
export function FormActions({
  saveLabel = "Save changes",
  saving,
  dirty = true,
  onCancel,
}: {
  saveLabel?: string;
  saving?: boolean;
  /** When nothing has changed there is nothing to save. */
  dirty?: boolean;
  onCancel?: () => void;
}) {
  return (
    <div className="sticky bottom-0 -mx-4 mt-5 flex items-center gap-2 border-t bg-card/95 px-4 py-3 backdrop-blur">
      <Button size="sm" className="h-8" disabled={saving || !dirty}>
        {saving ? "Saving…" : saveLabel}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-8"
        disabled={saving}
        onClick={onCancel}
      >
        Cancel
      </Button>
      {!dirty && !saving && (
        <span className="ml-auto text-xs text-muted-foreground">
          No changes yet
        </span>
      )}
    </div>
  );
}
