import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { StockListView } from "./stock-list";

/**
 * Staff-shell stock list. See stock-list.tsx for why this is a new
 * composition rather than a reuse of the admin stock-body table.
 */
const meta = {
  title: "Modules/Stock/StockList",
  component: StockListView,
  parameters: { layout: "padded" },
} satisfies Meta<typeof StockListView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    state: {
      status: "ready",
      levels: [
        { productId: "1", productName: "Sodas (500ml)", quantityOnHand: 42 },
        { productId: "2", productName: "Mukimo", quantityOnHand: 8 },
        { productId: "3", productName: "Printing paper (ream)", quantityOnHand: 3 },
        { productId: "4", productName: "Chips", quantityOnHand: 0 },
      ],
    },
  },
};

export const Loading: Story = {
  args: { state: { status: "loading" } },
};

export const Empty: Story = {
  name: "Empty — first use",
  args: { state: { status: "ready", levels: [] } },
};

export const Error: Story = {
  args: { state: { status: "error" } },
};

export const Denied: Story = {
  name: "Permission denied",
  args: { state: { status: "denied" } },
};
