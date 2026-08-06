import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { FormSection, Field, FormActions } from "./form";
import { EditSheet } from "./detail-page";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Form primitives.
 *
 * Single column always, labels above inputs, sections once past ~8 fields.
 * A hint explains *consequence*, not what the label already said. An error sits
 * next to its field, never only summarised at the top. A locked field states
 * why rather than disappearing.
 */
const meta = {
  title: "Patterns/Form",
  parameters: { layout: "padded" },
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => (
    <div className="max-w-md space-y-5">
      <FormSection title="Identity">
        <Field label="Name" required>
          <Input defaultValue="Sarah" className="h-9" />
        </Field>
        <Field label="Phone" hint="Used for M-Pesa payments">
          <Input defaultValue="0715 220 981" className="h-9" />
        </Field>
      </FormSection>

      <FormSection title="Employment">
        <Field label="Role">
          <Select defaultValue="cashier">
            <SelectTrigger className="h-9 w-full text-[13px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cashier">Cashier</SelectItem>
              <SelectItem value="store-manager">Store manager</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field
          label="Daily rate"
          hint="Applies from today; past days keep the rate they were worked at"
        >
          <Input defaultValue="550" inputMode="numeric" className="tabular h-9" />
        </Field>
      </FormSection>
    </div>
  ),
};

/**
 * Validation on blur, shown next to the field. The hint is replaced by the
 * error rather than stacking, so the field never grows two lines of help.
 */
export const WithError: Story = {
  render: () => (
    <div className="max-w-md">
      <FormSection title="Employment">
        <Field
          label="Daily rate"
          required
          error="Enter an amount — a rate of nothing would make every day worked free."
        >
          <Input
            defaultValue=""
            aria-invalid
            inputMode="numeric"
            className="tabular h-9"
          />
        </Field>
      </FormSection>
    </div>
  ),
};

/**
 * A locked field states why, rather than being hidden.
 *
 * A manager should be able to see that a pay rate exists and that it is not
 * theirs to change. Hiding it teaches nothing; disabling it with a reason
 * teaches who to ask — the same rule the permission-denied page follows.
 */
export const Locked: Story = {
  render: () => (
    <div className="max-w-md space-y-5">
      <FormSection title="Balance">
        <Field
          label="Owes"
          lockedReason="Credit less repayments. Correct it by recording a repayment, so the change is attributable."
        >
          <Input defaultValue="1,240" disabled className="tabular h-9" />
        </Field>
      </FormSection>
      <FormSection title="Employment">
        <Field
          label="Daily rate"
          lockedReason="Only Lucy can change what someone is paid."
        >
          <Input defaultValue="550" disabled className="tabular h-9" />
        </Field>
      </FormSection>
    </div>
  ),
};

/** A switch with its consequence stated, not left to be guessed. */
export const WithSwitch: Story = {
  render: () => (
    <div className="max-w-md">
      <FormSection title="Status">
        <div className="flex items-start justify-between gap-4 rounded-md border p-3">
          <div>
            <div className="text-[13px] font-medium">Currently working here</div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Turning this off stops them appearing in handovers and rosters.
              Their history is kept.
            </p>
          </div>
          <Switch defaultChecked />
        </div>
      </FormSection>
    </div>
  ),
};

/** Nothing changed yet, so there is nothing to save. */
export const ActionsClean: Story = {
  name: "Actions — nothing changed",
  render: () => (
    <div className="max-w-md">
      <FormActions dirty={false} />
    </div>
  ),
};

export const ActionsDirty: Story = {
  name: "Actions — unsaved changes",
  render: () => (
    <div className="max-w-md">
      <FormActions dirty />
    </div>
  ),
};

/** Submit disabled while submitting, with text saying what is happening. */
export const ActionsSaving: Story = {
  name: "Actions — saving",
  render: () => (
    <div className="max-w-md">
      <FormActions saving />
    </div>
  ),
};

/** The sheet is the same component for create and edit. */
export const InASheet: Story = {
  render: function Render() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button size="sm" onClick={() => setOpen(true)}>
          Open the edit sheet
        </Button>
        <EditSheet
          open={open}
          onOpenChange={setOpen}
          title="Edit Sarah"
          description="Changes apply from today. Past days keep the rate they were worked at."
        >
          <FormSection title="Identity">
            <Field label="Name">
              <Input defaultValue="Sarah" className="h-9" />
            </Field>
            <Field label="Phone" hint="Used for M-Pesa payments">
              <Input defaultValue="0715 220 981" className="h-9" />
            </Field>
          </FormSection>
        </EditSheet>
      </>
    );
  },
};
