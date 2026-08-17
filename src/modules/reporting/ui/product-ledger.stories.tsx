import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ProductLedgerView, type ProductLedgerRowData } from "./product-ledger";

/**
 * The Ledger's Product tab (ticket 39). Real seed-shaped data: a cooked-food
 * item priced via recipe cost, a bought-in good with a recorded cost, and
 * one item with no cost basis at all (profit shown as unavailable, not a
 * guess) — matching the reference's "no recipe — per-unit cost unknown"
 * treatment. Mounts `ProductLedgerView` directly, same split as
 * `DashboardHandoversView`: no network in Storybook, only `LedgerShellView`'s
 * real page composition supplies the fetching `ProductLedger`.
 */

const chipsRow: ProductLedgerRowData = {
  productId: "p1",
  productName: "Chips",
  locationId: "loc-restaurant",
  locationCode: "restaurant",
  categoryId: "cat-food",
  openingQty: 24,
  produced: 40,
  received: 0,
  transferredIn: 0,
  sold: 52,
  transferredOut: 5,
  nonSales: 2,
  corrected: 0,
  salesValueMinor: 520000,
  unitCostMinor: 4100,
  isEstimated: false,
  sellingPriceMinor: 10000,
  costOfSalesMinor: 213200,
  profitMinor: 306800,
  closingQty: 5,
  closingValueMinor: 20500,
  days: [
    {
      date: "2026-08-05",
      opening: 24,
      produced: 20,
      received: 0,
      transferredIn: 0,
      sold: 26,
      transferredOut: 3,
      nonSales: 1,
      corrected: 0,
      salesValueMinor: 260000,
      closing: 14,
    },
    {
      date: "2026-08-06",
      opening: 14,
      produced: 20,
      received: 0,
      transferredIn: 0,
      sold: 26,
      transferredOut: 2,
      nonSales: 1,
      corrected: 0,
      salesValueMinor: 260000,
      closing: 5,
    },
  ],
};

const sodaRow: ProductLedgerRowData = {
  productId: "p9",
  productName: "Soda 500ml",
  locationId: "loc-canteen",
  locationCode: "canteen",
  categoryId: "cat-drinks",
  openingQty: 96,
  produced: 0,
  received: 48,
  transferredIn: 0,
  sold: 60,
  transferredOut: 0,
  nonSales: 0,
  corrected: 0,
  salesValueMinor: 480000,
  unitCostMinor: 5800,
  isEstimated: false,
  sellingPriceMinor: 8000,
  costOfSalesMinor: 348000,
  profitMinor: 132000,
  closingQty: 84,
  closingValueMinor: 487200,
  days: [
    {
      date: "2026-08-06",
      opening: 96,
      produced: 0,
      received: 48,
      transferredIn: 0,
      sold: 60,
      transferredOut: 0,
      nonSales: 0,
      corrected: 0,
      salesValueMinor: 480000,
      closing: 84,
    },
  ],
};

const beefStewRow: ProductLedgerRowData = {
  productId: "p5",
  productName: "Beef stew",
  locationId: "loc-restaurant",
  locationCode: "restaurant",
  categoryId: "cat-food",
  openingQty: 12,
  produced: 15,
  received: 0,
  transferredIn: 0,
  sold: 18,
  transferredOut: 0,
  nonSales: 0,
  corrected: 0,
  salesValueMinor: 324000,
  unitCostMinor: null,
  isEstimated: false,
  sellingPriceMinor: 18000,
  costOfSalesMinor: null,
  profitMinor: null,
  closingQty: 9,
  closingValueMinor: null,
  days: [
    {
      date: "2026-08-06",
      opening: 12,
      produced: 15,
      received: 0,
      transferredIn: 0,
      sold: 18,
      transferredOut: 0,
      nonSales: 0,
      corrected: 0,
      salesValueMinor: 324000,
      closing: 9,
    },
  ],
};

const categories = [
  { id: "cat-food", name: "Food" },
  { id: "cat-drinks", name: "Drinks" },
];
const locations = [
  { id: "loc-restaurant", name: "Restaurant" },
  { id: "loc-canteen", name: "Canteen" },
];

const meta = {
  title: "Modules/Reporting/ProductLedger",
  component: ProductLedgerView,
  parameters: { layout: "padded" },
  args: { onRetry: () => {} },
} satisfies Meta<typeof ProductLedgerView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Populated: Story = {
  name: "Populated table",
  args: {
    state: { status: "ready", rows: [chipsRow, sodaRow, beefStewRow], categories, locations },
  },
};

export const RowExpanded: Story = {
  name: "Row expanded — day breakdown",
  args: {
    state: { status: "ready", rows: [chipsRow, sodaRow], categories, locations },
    initialExpandedRowKey: `${chipsRow.productId}:${chipsRow.locationId}`,
  },
};

/**
 * Editable-ledger T3. A day whose opening the owner corrected upward by 4.
 * The `corrected` column exists so that adjustment is visible and the row
 * still reconciles on screen: without it, closing moved for no reason any
 * visible column explained, which reads as a bug rather than a correction.
 * Signed (+4) deliberately — a bare "4" next to a delivery of 4 would read
 * as another delivery, which is exactly what plan §3.1 forbids.
 */
export const WithCorrection: Story = {
  name: "Owner correction — signed adjustment column",
  args: {
    state: {
      status: "ready",
      rows: [
        {
          ...beefStewRow,
          corrected: 4,
          closingQty: beefStewRow.closingQty + 4,
          days: beefStewRow.days.map((d, i) =>
            i === 0 ? { ...d, corrected: 4, closing: d.closing + 4 } : { ...d, opening: d.opening + 4, closing: d.closing + 4 },
          ),
        },
      ],
      categories,
      locations,
    },
    initialExpandedRowKey: `${beefStewRow.productId}:${beefStewRow.locationId}`,
  },
};

export const Loading: Story = {
  args: { state: { status: "loading" } },
};

export const EmptyNoMovements: Story = {
  name: "Empty — no movements in period",
  args: {
    state: { status: "ready", rows: [], categories, locations },
  },
};

export const EmptyFiltered: Story = {
  name: "Empty — filtered to zero rows",
  args: {
    state: { status: "ready", rows: [chipsRow, sodaRow], categories, locations },
    initialQuery: "nonexistent item",
  },
};

export const Denied: Story = {
  name: "Permission denied — not the owner",
  args: { state: { status: "denied" } },
};

export const ErrorLoading: Story = {
  name: "Error loading the product ledger",
  args: { state: { status: "error" } },
};
