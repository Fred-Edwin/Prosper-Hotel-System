import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { NonSalesLedgerView, type NonSalesLedgerRowData } from "./non-sales-ledger";

/**
 * The Ledger's Non-sales tab (ticket 43). Real seed-shaped data: entries
 * across all three reasons (wasted/consumed/given_away), a product and an
 * ingredient, and one recipe-less product valued at the estimated 60%-of-
 * price cost basis. Mounts `NonSalesLedgerView` directly, same split as
 * `StoreLedgerView`'s story: no network in Storybook, only
 * `LedgerShellView`'s real page composition supplies the fetching
 * `NonSalesLedger`.
 */

const wastedSoda: NonSalesLedgerRowData = {
  itemType: "product",
  itemId: "p1",
  itemName: "Soda",
  locationId: "loc-restaurant",
  locationCode: "restaurant",
  occurredAt: "2026-08-03T12:00:00Z",
  reason: "wasted",
  quantity: -3,
  costBasisMinor: 18000,
  isEstimated: false,
  sellingValueMinor: 30000,
  recordedBy: "Grace Wanjiru",
};

const staffMealPotatoes: NonSalesLedgerRowData = {
  itemType: "ingredient",
  itemId: "i1",
  itemName: "Potatoes",
  locationId: "loc-restaurant",
  locationCode: "restaurant",
  occurredAt: "2026-08-04T09:00:00Z",
  reason: "consumed",
  quantity: -5,
  costBasisMinor: 32500,
  isEstimated: false,
  sellingValueMinor: null,
  recordedBy: "Test Owner",
};

const complimentaryCrisps: NonSalesLedgerRowData = {
  itemType: "product",
  itemId: "p2",
  itemName: "Crisps",
  locationId: "loc-canteen",
  locationCode: "canteen",
  occurredAt: "2026-08-05T14:30:00Z",
  reason: "given_away",
  quantity: -1,
  costBasisMinor: 9000,
  isEstimated: true,
  sellingValueMinor: 15000,
  recordedBy: "Grace Wanjiru",
};

const meta = {
  title: "Modules/Reporting/NonSalesLedger",
  component: NonSalesLedgerView,
  parameters: { layout: "padded" },
  args: { onRetry: () => {} },
} satisfies Meta<typeof NonSalesLedgerView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Populated: Story = {
  name: "Populated table — all three reasons",
  args: {
    state: {
      status: "ready",
      rows: [wastedSoda, staffMealPotatoes, complimentaryCrisps],
    },
  },
};

export const EstimatedCost: Story = {
  name: "Estimated-cost row",
  args: {
    state: { status: "ready", rows: [complimentaryCrisps] },
  },
};

export const Loading: Story = {
  args: { state: { status: "loading" } },
};

export const EmptyNoMovements: Story = {
  name: "Empty — no movements in period",
  args: {
    state: { status: "ready", rows: [] },
  },
};

export const EmptyFiltered: Story = {
  name: "Empty — filtered to zero rows",
  args: {
    state: { status: "ready", rows: [wastedSoda, staffMealPotatoes, complimentaryCrisps] },
    initialQuery: "nonexistent item",
  },
};

export const Denied: Story = {
  name: "Permission denied — not the owner",
  args: { state: { status: "denied" } },
};

export const ErrorLoading: Story = {
  name: "Error loading the non-sales ledger",
  args: { state: { status: "error" } },
};
