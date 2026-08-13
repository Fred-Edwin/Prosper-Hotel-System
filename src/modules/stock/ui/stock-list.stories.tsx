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

/**
 * 2026-08-13 canteen redesign, item 3: canteen-only My stock / From
 * restaurant filter, per docs/proposal.md §4 — "her stock screen
 * distinguishes the two only for her own reference." All three tabs are
 * interactive within the canvas.
 */
export const CanteenBySource: Story = {
  name: "Canteen — My stock / From restaurant",
  args: {
    state: {
      status: "ready-by-source",
      levels: [
        { productId: "1", productName: "Sodas (500ml)", quantityOnHand: 42, source: "own" },
        { productId: "2", productName: "Biscuits", quantityOnHand: 25, source: "own" },
        { productId: "3", productName: "Chapati", quantityOnHand: 15, source: "restaurant-supplied" },
        { productId: "4", productName: "Mukimo", quantityOnHand: 8, source: "restaurant-supplied" },
        { productId: "5", productName: "Printing paper (ream)", quantityOnHand: 3, source: "own" },
      ],
    },
  },
};

/** Filtered to "My stock" with nothing matching — a different message and
 * a way back than the first-use empty state, per ui-rules' required-states
 * distinction. Switch tabs within the canvas to see this naturally, or
 * view this fixture directly. */
export const CanteenBySourceFilteredEmpty: Story = {
  name: "Canteen — filtered to empty",
  args: {
    state: {
      status: "ready-by-source",
      levels: [
        { productId: "3", productName: "Chapati", quantityOnHand: 15, source: "restaurant-supplied" },
      ],
    },
  },
};
