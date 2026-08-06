import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { DetailPage, DetailCard, FactList, EditSheet } from "./detail-page";
import { LoadingDetail, PermissionDenied } from "./states";
import { FormSection, Field } from "./form";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { money } from "@/lib/fixtures";
import { Pencil } from "lucide-react";

/**
 * The detail page: what is **true** about a record on the left, what
 * **happened** to it on the right.
 *
 * The split generalises across every record here — a staff member has a rate
 * left and days worked right; a customer has a balance left and movements
 * right; a product has a price and recipe left, movements right.
 *
 * It beat a tabbed layout on one argument: a figure sits directly above its own
 * arithmetic, which tabs cannot do without repeating the figure.
 */
const meta = {
  title: "Patterns/DetailPage",
  parameters: { layout: "padded" },
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => (
    <DetailPage
      identity={
        <>
          <DetailCard
            title="Owed to them"
            action={
              <Button variant="ghost" size="sm" className="h-7 text-xs">
                <Pencil className="size-3" /> Edit
              </Button>
            }
            footnote="Last paid 31 July. Paying records a cash movement and clears the balance."
          >
            {/* The figure, then its arithmetic directly beneath it. */}
            <div className="tabular text-3xl font-semibold">{money(2750)}</div>
            <div className="mt-3 space-y-1 border-t pt-2 text-[13px]">
              <div className="flex justify-between">
                <span className="text-muted-foreground">5 days × KSh 550</span>
                <span className="tabular">KSh 2,750</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Advances taken</span>
                <span className="tabular">−KSh 0</span>
              </div>
            </div>
            <Button size="sm" className="mt-4 h-8 w-full">
              Pay Sarah
            </Button>
          </DetailCard>

          <DetailCard title="Details" flush>
            <div className="py-2">
              <FactList
                facts={[
                  { label: "Role", value: "Cashier" },
                  { label: "Location", value: "restaurant", capitalize: true },
                  { label: "Daily rate", value: money(550), tabular: true },
                  { label: "Phone", value: "0715 220 981", tabular: true },
                  {
                    label: "Status",
                    value: (
                      <Badge
                        variant="outline"
                        className="border-success/30 bg-success-subtle font-normal text-success"
                      >
                        Working here
                      </Badge>
                    ),
                  },
                ]}
              />
            </div>
          </DetailCard>
        </>
      }
      history={
        <>
          <DetailCard
            title="Handovers"
            flush
            badge={
              <Badge
                variant="outline"
                className="border-danger/30 bg-danger-subtle text-danger"
              >
                1 unexplained
              </Badge>
            }
          >
            <div className="px-4 py-3 text-[13px]">
              Cash short {money(250)} on 2026-08-06
              <div className="text-xs text-muted-foreground">
                Handed over less than the till expected. Not yet explained.
              </div>
            </div>
          </DetailCard>

          <DetailCard title="Days worked" flush>
            <div className="px-4 py-3 text-[13px] text-muted-foreground">
              5 of 5 days this period
            </div>
          </DetailCard>
        </>
      }
    />
  ),
};

/** A record with nothing recorded against it yet. */
export const EmptyHistory: Story = {
  render: () => (
    <DetailPage
      identity={
        <DetailCard title="Owes the business">
          <div className="tabular text-3xl font-semibold">{money(0)}</div>
          <p className="mt-3 border-t pt-2 text-[13px] text-muted-foreground">
            Nothing outstanding.
          </p>
        </DetailCard>
      }
      history={
        <DetailCard title="Credit and repayments" flush>
          <p className="px-4 py-8 text-center text-[13px] text-muted-foreground">
            Nothing recorded yet. Credit taken at the till will appear here.
          </p>
        </DetailCard>
      }
    />
  ),
};

/** Two columns, not a table — the shape has to match what is coming. */
export const Loading: Story = {
  render: () => <LoadingDetail />,
};

export const Denied: Story = {
  render: () => (
    <PermissionDenied
      title="Pay details are owner-only"
      body="You can see who works here and which days they worked. What each person is paid is restricted to Lucy."
    />
  ),
};

/** Editing is a sheet over the record, so the record stays visible behind it. */
export const Editing: Story = {
  render: function Render() {
    const [open, setOpen] = useState(true);
    return (
      <>
        <Button size="sm" onClick={() => setOpen(true)}>
          Open
        </Button>
        <EditSheet
          open={open}
          onOpenChange={setOpen}
          title="Edit Sarah"
          description="Changes apply from today."
        >
          <FormSection title="Identity">
            <Field label="Name">
              <Input defaultValue="Sarah" className="h-9" />
            </Field>
          </FormSection>
        </EditSheet>
      </>
    );
  },
};

/** Submit disabled while saving, with text saying what is happening. */
export const Saving: Story = {
  render: function Render() {
    const [open, setOpen] = useState(true);
    return (
      <EditSheet
        open={open}
        onOpenChange={setOpen}
        title="Edit Sarah"
        saving
      >
        <FormSection title="Identity">
          <Field label="Name">
            <Input defaultValue="Sarah" disabled className="h-9" />
          </Field>
        </FormSection>
      </EditSheet>
    );
  },
};
