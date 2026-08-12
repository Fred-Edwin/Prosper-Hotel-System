import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { StoreLedgerView, type StoreLedgerRowData } from "./store-ledger";

/**
 * The Ledger's Store tab (ticket 42). Real seed-shaped data: an ingredient
 * whose running-average cost moved within the period (the up/down
 * indicator) and one that didn't. Mounts `StoreLedgerView` directly, same
 * split as `ProductLedgerView`'s story: no network in Storybook, only
 * `LedgerShellView`'s real page composition supplies the fetching
 * `StoreLedger`.
 */

const potatoesRow: StoreLedgerRowData = {
  ingredientId: "i1",
  ingredientName: "Potatoes",
  unitOfMeasure: "kg",
  locationId: "loc-restaurant",
  locationCode: "restaurant",
  openingQty: 34,
  purchasedQty: 120,
  purchasedValueMinor: 756000,
  issuedToKitchen: 104,
  transferredOut: 0,
  spoilage: 2,
  closingQty: 48,
  closingValueMinor: 312000,
  unitCostMinor: 6500,
  previousUnitCostMinor: 6100,
};

const beefRow: StoreLedgerRowData = {
  ingredientId: "i2",
  ingredientName: "Beef",
  unitOfMeasure: "kg",
  locationId: "loc-restaurant",
  locationCode: "restaurant",
  openingQty: 6,
  purchasedQty: 36,
  purchasedValueMinor: 2088000,
  issuedToKitchen: 34,
  transferredOut: 0,
  spoilage: 0,
  closingQty: 8,
  closingValueMinor: 464000,
  unitCostMinor: 58000,
  previousUnitCostMinor: 56000,
};

const cookingOilRow: StoreLedgerRowData = {
  ingredientId: "i3",
  ingredientName: "Cooking oil",
  unitOfMeasure: "L",
  locationId: "loc-restaurant",
  locationCode: "restaurant",
  openingQty: 18,
  purchasedQty: 12,
  purchasedValueMinor: 384000,
  issuedToKitchen: 16,
  transferredOut: 0,
  spoilage: 0,
  closingQty: 14,
  closingValueMinor: 448000,
  unitCostMinor: 32000,
  previousUnitCostMinor: 32000,
};

const printingPaperRow: StoreLedgerRowData = {
  ingredientId: "i4",
  ingredientName: "Printing paper",
  unitOfMeasure: "ream",
  locationId: "loc-canteen",
  locationCode: "canteen",
  openingQty: 6,
  purchasedQty: 8,
  purchasedValueMinor: 496000,
  issuedToKitchen: 0,
  transferredOut: 5,
  spoilage: 0,
  closingQty: 9,
  closingValueMinor: 558000,
  unitCostMinor: 62000,
  previousUnitCostMinor: 60000,
};

const locations = [
  { id: "loc-restaurant", name: "Restaurant" },
  { id: "loc-canteen", name: "Canteen" },
];

const meta = {
  title: "Modules/Reporting/StoreLedger",
  component: StoreLedgerView,
  parameters: { layout: "padded" },
  args: { onRetry: () => {} },
} satisfies Meta<typeof StoreLedgerView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Populated: Story = {
  name: "Populated table",
  args: {
    state: { status: "ready", rows: [potatoesRow, beefRow, cookingOilRow, printingPaperRow], locations },
  },
};

export const CostMoved: Story = {
  name: "Cost-moved indicator shown",
  args: {
    state: { status: "ready", rows: [potatoesRow, beefRow], locations },
  },
};

export const Loading: Story = {
  args: { state: { status: "loading" } },
};

export const EmptyNoMovements: Story = {
  name: "Empty — no movements in period",
  args: {
    state: { status: "ready", rows: [], locations },
  },
};

export const EmptyFiltered: Story = {
  name: "Empty — filtered to zero rows",
  args: {
    state: { status: "ready", rows: [potatoesRow, beefRow], locations },
    initialQuery: "nonexistent ingredient",
  },
};

export const Denied: Story = {
  name: "Permission denied — not the owner",
  args: { state: { status: "denied" } },
};

export const ErrorLoading: Story = {
  name: "Error loading the store ledger",
  args: { state: { status: "error" } },
};
