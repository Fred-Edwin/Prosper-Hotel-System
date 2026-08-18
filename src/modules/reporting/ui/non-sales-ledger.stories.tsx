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
  movementId: "m1",
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
  movementId: "m2",
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
  movementId: "m3",
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

/**
 * The editable table (T7.4).
 *
 * `onReplaceRows` is what switches editing on, so the reading stories
 * above render exactly the read-only table they always did.
 *
 * A row here is one movement, which makes this the one tab where cost and
 * selling value are edited on the record itself: they were snapshotted
 * when the movement was recorded (ticket 15) and are never recomputed, so
 * a wrong one stays wrong until she fixes it. Quantity still goes through
 * the day-total path — two entries for one item on one day pose the same
 * "which row absorbs it" question every other tab has.
 *
 * The estimated-cost row is worth looking at: the "est" marker means
 * there was no recipe and the figure is 60% of selling price. Typing a
 * real figure over it is exactly what this cell is for.
 *
 * There is no network in Storybook, so committing a cell shows the saving
 * state and then the error state — which is itself the per-cell failure
 * story.
 */
export const Editable: Story = {
  name: "Editable — hover a quantity or figure",
  args: {
    state: { status: "ready", rows: [wastedSoda, staffMealPotatoes, complimentaryCrisps] },
    onReplaceRows: () => {},
    periodStart: "2026-08-01T00:00:00.000Z",
    periodEnd: "2026-08-31T23:59:59.999Z",
  },
};
