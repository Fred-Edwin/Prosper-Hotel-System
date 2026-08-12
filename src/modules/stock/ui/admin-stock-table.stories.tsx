import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { AdminStockTableView, type StockRow } from "./admin-stock-table";

/**
 * Admin-shell stock table — products and ingredients together, with the
 * low-stock filter (ticket 44). Canteen rows carry an "as at" count date
 * when the filter is active, since canteen stock is provisional between
 * counts.
 */
const meta = {
  title: "Modules/Stock/AdminStockTable",
  component: AdminStockTableView,
  parameters: { layout: "padded" },
} satisfies Meta<typeof AdminStockTableView>;

export default meta;
type Story = StoryObj<typeof meta>;

const baseRows: StockRow[] = [
  {
    itemType: "product",
    itemId: "1",
    itemName: "Sodas (500ml)",
    quantityOnHand: 42,
    unitCostMinor: 70,
    valueMinor: 2940,
    isEstimated: false,
    lowStockLevel: 12,
    isLow: false,
    asOf: null,
  },
  {
    itemType: "product",
    itemId: "2",
    itemName: "Mukimo",
    quantityOnHand: 8,
    unitCostMinor: 60,
    valueMinor: 480,
    isEstimated: true,
    lowStockLevel: 10,
    isLow: true,
    asOf: null,
  },
  {
    itemType: "ingredient",
    itemId: "3",
    itemName: "Maize flour",
    quantityOnHand: 3,
    unitCostMinor: 120,
    valueMinor: 360,
    isEstimated: false,
    lowStockLevel: 5,
    isLow: true,
    asOf: null,
  },
  {
    itemType: "ingredient",
    itemId: "4",
    itemName: "Cooking oil",
    quantityOnHand: 15,
    unitCostMinor: 280,
    valueMinor: 4200,
    isEstimated: false,
    lowStockLevel: null,
    isLow: false,
    asOf: null,
  },
];

export const Default: Story = {
  args: {
    state: { status: "ready", rows: baseRows },
  },
};

export const LowStockFilterActive: Story = {
  name: "Low-stock filter active",
  args: {
    state: {
      status: "ready",
      rows: [
        ...baseRows,
        {
          itemType: "product",
          itemId: "5",
          itemName: "Canteen soda",
          quantityOnHand: 6,
          unitCostMinor: 50,
          valueMinor: 300,
          isEstimated: false,
          lowStockLevel: 10,
          isLow: true,
          asOf: new Date("2026-08-05"),
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
