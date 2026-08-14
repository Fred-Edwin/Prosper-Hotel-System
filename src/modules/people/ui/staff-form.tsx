"use client";

/**
 * Create/edit form for a staff member. One component for both, per
 * EditSheet's convention — same shape as catalogue's ProductForm.
 *
 * Active/inactive is a switch here rather than a separate row action —
 * deactivating is a state change on the record, same place its other
 * fields are edited.
 *
 * PIN is required on create, optional on edit (blank keeps the current
 * PIN) — ticket 17: "PIN... editable in place" without forcing the owner
 * to know or re-enter it just to change a phone number.
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
import type { Location, StaffMember, StaffRole } from "../schema";

const ROLE_LABEL: Record<StaffRole, string> = {
  owner: "Owner",
  store_manager: "Store manager",
  cashier: "Cashier",
  attendant: "Attendant",
};

export function StaffForm({
  open,
  onOpenChange,
  staff,
  locations,
  saving,
  error,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Absent when creating. */
  staff?: StaffMember;
  locations: Location[];
  saving?: boolean;
  error?: string;
  onSave: (input: {
    name: string;
    phone: string;
    role: StaffRole;
    locationId: string;
    dailyRateMinor: number;
    pin?: string;
    active: boolean;
  }) => void;
}) {
  const [name, setName] = useState(staff?.name ?? "");
  const [phone, setPhone] = useState(staff?.phone ?? "");
  const [role, setRole] = useState<StaffRole>(staff?.role ?? "cashier");
  const [locationId, setLocationId] = useState(staff?.locationId ?? locations[0]?.id ?? "");
  const [dailyRate, setDailyRate] = useState(
    staff?.dailyRateMinor != null ? String(staff.dailyRateMinor) : "",
  );
  const [pin, setPin] = useState("");
  const [active, setActive] = useState(staff?.active ?? true);
  const [confirmingDeactivate, setConfirmingDeactivate] = useState(false);

  return (
    <EditSheet
      open={open}
      onOpenChange={onOpenChange}
      title={staff ? `Edit ${staff.name}` : "New staff member"}
      saving={saving}
      saveLabel={staff ? "Save changes" : "Add staff member"}
      formId="staff-form"
      testIdPrefix="staff"
    >
      <form
        id="staff-form"
        onSubmit={(e) => {
          e.preventDefault();
          onSave({
            name,
            phone,
            role,
            locationId,
            dailyRateMinor: dailyRate.trim() === "" ? 0 : Number(dailyRate),
            pin: pin.trim() === "" ? undefined : pin.trim(),
            active,
          });
        }}
      >
        <FormSection title="Identity">
          <Field label="Name" required error={error}>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="h-9" />
          </Field>
          <Field label="Phone" required>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="h-9" />
          </Field>
        </FormSection>
        <FormSection title="Work">
          <Field label="Role" required>
            <Select value={role} onValueChange={(v) => setRole(v as StaffRole)}>
              <SelectTrigger className="h-9 w-full text-[13px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ROLE_LABEL)
                  .filter(([value]) => value !== "owner")
                  .map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Location" required>
            <Select value={locationId} onValueChange={setLocationId}>
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
          <Field label="Daily rate (KSh)" required>
            <Input
              value={dailyRate}
              onChange={(e) => setDailyRate(e.target.value)}
              inputMode="decimal"
              className="tabular h-9"
            />
          </Field>
        </FormSection>
        <FormSection
          title="PIN"
          description={
            staff
              ? "Leave blank to keep the current PIN. Four digits, used to log in."
              : "Four digits, used to log in."
          }
        >
          <Field label="PIN" required={!staff}>
            <Input
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              inputMode="numeric"
              maxLength={4}
              className="tabular h-9"
            />
          </Field>
        </FormSection>
        {staff && (
          <FormSection title="Status">
            <div className="flex items-start justify-between gap-4 rounded-md border p-3">
              <div>
                <div className="text-[13px] font-medium">Active</div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Turning this off stops them logging in. Their history is kept.
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
      {staff && (
        <ConfirmDialog
          open={confirmingDeactivate}
          onOpenChange={setConfirmingDeactivate}
          title={`Deactivate ${staff.name}?`}
          description="They will no longer be able to log in. Their sales, movements and handovers stay attributed to them, and they can be reactivated at any time."
          confirmLabel="Deactivate"
          onConfirm={() => setActive(false)}
        />
      )}
    </EditSheet>
  );
}
