import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { AdminStockTableView } from "./admin-stock-table";

/**
 * Admin-shell stock table. See admin-stock-table.tsx for why this is the
 * minimal slice rather than Design's full valuation table.
 */
const meta = {
  title: "Modules/Stock/AdminStockTable",
  component: AdminStockTableView,
  parameters: { layout: "padded" },
} satisfies Meta<typeof AdminStockTableView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    state: {
      status: "ready",
      rows: [
        {
          productId: "1",
          productName: "Sodas (500ml)",
          quantityOnHand: 42,
          unitCostMinor: 70,
          valueMinor: 2940,
          isEstimated: false,
        },
        {
          productId: "2",
          productName: "Mukimo",
          quantityOnHand: 8,
          unitCostMinor: 60,
          valueMinor: 480,
          isEstimated: true,
        },
        {
          productId: "3",
          productName: "Printing paper (ream)",
          quantityOnHand: 3,
          unitCostMinor: 450,
          valueMinor: 1350,
          isEstimated: false,
        },
        {
          productId: "4",
          productName: "Chips",
          quantityOnHand: 0,
          unitCostMinor: 2000,
          valueMinor: 0,
          isEstimated: false,
        },
      ],
    },
  },
};

export const Loading: Story = {
  args: { state: { status: "loading" } },
};

export const Empty: Story = {
  name: "Empty — first use",
  args: { state: { status: "ready", rows: [] } },
};

export const Error: Story = {
  args: { state: { status: "error" } },
};

export const Denied: Story = {
  name: "Permission denied",
  args: { state: { status: "denied" } },
};
