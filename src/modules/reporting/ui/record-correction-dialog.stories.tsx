import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { RecordCorrectionDialogView } from "./record-correction-dialog";

/**
 * Record a correction — ticket 45. Mounts `RecordCorrectionDialogView`
 * directly with injected staff/locations/products, same split as every
 * other fetch-driven component here: no network in Storybook.
 */

const locations = [
  { id: "loc-restaurant", name: "Restaurant" },
  { id: "loc-canteen", name: "Canteen" },
];

const staff = [
  { id: "staff-sarah", name: "Sarah", locationId: "loc-restaurant" },
  { id: "staff-anne", name: "Anne", locationId: "loc-canteen" },
];

const products = [
  { id: "product-soda", name: "Soda 500ml", priceMinor: 80 },
  { id: "product-chips", name: "Chips", priceMinor: 260 },
];

const meta = {
  title: "Modules/Reporting/RecordCorrectionDialog",
  component: RecordCorrectionDialogView,
  parameters: { layout: "padded" },
  args: {
    staff,
    locations,
    products,
    onOpenChange: () => {},
    onSubmit: async () => ({ ok: true }) as const,
    onRecorded: () => {},
  },
} satisfies Meta<typeof RecordCorrectionDialogView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Form: Story = {
  args: { open: true },
};

export const ValidationReasonRequired: Story = {
  name: "Validation — reason required",
  args: { open: true, initialReason: " " },
};
