import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { StockCountDetailView } from "./stock-count-detail";

/**
 * Stock count detail — the staff read view. Counted quantity only, no
 * expected figure, no difference, no agree/flag language, per ticket 20's
 * corrected permission model: the comparison is owner-only regardless of
 * who recorded the count.
 */
const meta = {
  title: "Modules/Stock/StockCountDetail",
  component: StockCountDetailView,
  parameters: { layout: "padded" },
} satisfies Meta<typeof StockCountDetailView>;

export default meta;
type Story = StoryObj<typeof meta>;

const lines = [
  { id: "l1", itemType: "product" as const, itemName: "Soda 500ml", countedQuantity: 40 },
  { id: "l2", itemType: "ingredient" as const, itemName: "Flour", countedQuantity: 12 },
  { id: "l3", itemType: "product" as const, itemName: "Mukimo", countedQuantity: 8 },
];

export const Default: Story = {
  args: { state: { status: "ready", lines } },
};

export const Loading: Story = {
  args: { state: { status: "loading" } },
};

export const Denied: Story = {
  name: "Permission denied — different location",
  args: { state: { status: "denied" } },
};

export const ErrorLoading: Story = {
  args: { state: { status: "error" } },
};
