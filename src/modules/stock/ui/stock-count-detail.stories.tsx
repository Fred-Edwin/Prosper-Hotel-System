import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { StockCountDetailView } from "./stock-count-detail";

/**
 * Stock count detail — the staff read view. Counted quantity only for the
 * restaurant, no expected figure, no difference, no agree/flag language,
 * per ticket 20's corrected permission model: the comparison stays
 * owner-only there regardless of who recorded the count.
 *
 * 2026-08-15: the canteen (isCanteen: true) is the deliberate exception —
 * Expected and Sold columns appear, since a canteen count is how the sold
 * figure gets produced and Edwinfred asked for the attendant to see the
 * same detail the owner does, not just the restaurant's counted-only view.
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

const canteenLines = [
  { id: "l1", itemType: "product" as const, itemName: "Soda 500ml", countedQuantity: 33, expectedQuantity: 40 },
  { id: "l2", itemType: "product" as const, itemName: "Samosa", countedQuantity: 20, expectedQuantity: 25 },
  { id: "l3", itemType: "product" as const, itemName: "Exercise book", countedQuantity: 60, expectedQuantity: 60 },
];

export const Default: Story = {
  args: { state: { status: "ready", lines } },
};

export const Canteen: Story = {
  name: "Canteen — Expected and Sold columns",
  args: { state: { status: "ready", lines: canteenLines }, isCanteen: true },
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
