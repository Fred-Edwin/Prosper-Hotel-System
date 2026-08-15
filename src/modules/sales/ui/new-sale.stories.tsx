import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { NewSaleView } from "./new-sale";

/**
 * The New sale (till) flow. See new-sale.tsx for how this was adapted from
 * the locked design-reference prototype rather than invented.
 *
 * Default is interactive — tap products to build a basket, type payment
 * amounts, and Complete sale to reach the confirmation state, all within
 * the canvas. onSubmit is stubbed here so no network call leaves the story.
 */
const meta = {
  title: "Modules/Sales/NewSale",
  component: NewSaleView,
  parameters: { layout: "fullscreen" },
  args: { locationId: "restaurant-1" },
} satisfies Meta<typeof NewSaleView>;

export default meta;
type Story = StoryObj<typeof meta>;

const products = [
  { id: "p1", name: "Mukimo", kind: "cooked_food" as const, priceMinor: 150, active: true, locationId: "restaurant-1", onHand: 24 },
  { id: "p2", name: "Chips", kind: "cooked_food" as const, priceMinor: 100, active: true, locationId: "restaurant-1", onHand: 18 },
  { id: "p3", name: "Chapati", kind: "cooked_food" as const, priceMinor: 20, active: true, locationId: "restaurant-1", onHand: 40 },
  { id: "p4", name: "Githeri", kind: "cooked_food" as const, priceMinor: 120, active: true, locationId: "restaurant-1", onHand: 15 },
  { id: "p5", name: "Tea", kind: "cooked_food" as const, priceMinor: 30, active: true, locationId: "restaurant-1", onHand: 50 },
  { id: "p6", name: "Soda 500ml", kind: "goods" as const, priceMinor: 80, active: true, locationId: "restaurant-1", onHand: 30 },
  { id: "p7", name: "Water 1L", kind: "goods" as const, priceMinor: 60, active: true, locationId: "restaurant-1", onHand: 22 },
  { id: "p8", name: "Samosa", kind: "cooked_food" as const, priceMinor: 30, active: true, locationId: "restaurant-1", onHand: 12 },
  { id: "p9", name: "Photocopy (per page)", kind: "service" as const, priceMinor: 5, active: true, locationId: "restaurant-1", onHand: 0 },
];

// Ticket 53: a mix of own (home location matches) and transferred-in (home
// location elsewhere, sellable here only via the ledger) products, at the
// canteen — demonstrates the "My stock" / "From another location" split
// and the "Transferred in" badge.
const mixedLocationProducts = [
  { id: "p10", name: "Biscuits (packet)", kind: "goods" as const, priceMinor: 50, active: true, locationId: "canteen-1", onHand: 35 },
  { id: "p11", name: "Printing paper (ream)", kind: "goods" as const, priceMinor: 550, active: true, locationId: "canteen-1", onHand: 8 },
  { id: "p12", name: "Sweets (piece)", kind: "goods" as const, priceMinor: 10, active: true, locationId: "canteen-1", onHand: 60 },
  { id: "p1", name: "Mukimo", kind: "cooked_food" as const, priceMinor: 150, active: true, locationId: "restaurant-1", onHand: 10 },
  { id: "p2", name: "Chips", kind: "cooked_food" as const, priceMinor: 100, active: true, locationId: "restaurant-1", onHand: 6 },
];

// BUG-15's soft guardrail: on-hand quantity per tile. Zero disables the
// tile ("Out of stock"), low-but-nonzero shows the warning badge (reusing
// admin-stock-table.tsx's isLow/TriangleAlert pattern), plenty shows no
// badge at all.
const mixedStockProducts = [
  { id: "p1", name: "Mukimo", kind: "cooked_food" as const, priceMinor: 150, active: true, locationId: "restaurant-1", onHand: 24 },
  { id: "p2", name: "Chips", kind: "cooked_food" as const, priceMinor: 100, active: true, locationId: "restaurant-1", onHand: 3 },
  { id: "p3", name: "Chapati", kind: "cooked_food" as const, priceMinor: 20, active: true, locationId: "restaurant-1", onHand: 0 },
  { id: "p4", name: "Githeri", kind: "cooked_food" as const, priceMinor: 120, active: true, locationId: "restaurant-1", onHand: 1 },
  { id: "p5", name: "Tea", kind: "cooked_food" as const, priceMinor: 30, active: true, locationId: "restaurant-1", onHand: 50 },
  { id: "p9", name: "Photocopy (per page)", kind: "service" as const, priceMinor: 5, active: true, locationId: "restaurant-1", onHand: 0 },
];

const customers = [
  { id: "c1", name: "Jane Wanjiru", phone: "0722000111" },
  { id: "c2", name: "Brian Otieno", phone: null },
  { id: "c3", name: "Amani", phone: "0733111222" },
];

const stubSubmit = async () => ({ ok: true as const });
const stubLoadCustomers = async () => customers;
const stubCreateCustomer = async (input: { name: string; phone?: string }) => ({
  ok: true as const,
  customer: { id: `new-${input.name}`, name: input.name, phone: input.phone ?? null },
});

export const Default: Story = {
  args: {
    state: { status: "ready", products },
    onSubmit: stubSubmit,
    onLoadCustomers: stubLoadCustomers,
    onCreateCustomer: stubCreateCustomer,
  },
};

/**
 * A credit line: pick "Credit" as the method, type an amount, then a
 * customer picker appears — search the seeded list, or add a new one
 * inline. Interact within the canvas to reach each state; there is no
 * static frame for a picker mid-search or mid-create.
 */
export const CreditLine: Story = {
  name: "Credit line — customer required",
  args: {
    state: { status: "ready", products },
    onSubmit: stubSubmit,
    onLoadCustomers: stubLoadCustomers,
    onCreateCustomer: stubCreateCustomer,
  },
};

/**
 * Ticket 11: selecting Delivery in the fulfilment toggle requires a
 * customer (the same picker credit uses, search or add inline) before
 * "Complete sale" enables, and reveals an optional delivery fee input.
 * Interact within the canvas — tap Delivery, add products, pick a
 * customer, optionally type a fee.
 */
export const DeliveryFulfilment: Story = {
  name: "Delivery — customer required, fee optional",
  args: {
    state: { status: "ready", products },
    onSubmit: stubSubmit,
    onLoadCustomers: stubLoadCustomers,
    onCreateCustomer: stubCreateCustomer,
  },
};

export const Loading: Story = {
  args: { state: { status: "loading" } },
};

export const Empty: Story = {
  name: "Empty — first use",
  args: { state: { status: "ready", products: [] } },
};

export const Error: Story = {
  args: { state: { status: "error" } },
};

/**
 * Ticket 53: at the canteen, own stock (biscuits, paper, sweets) and
 * transferred-in restaurant products (Mukimo, Chips) are grouped into
 * separate sections, the latter badged "Transferred in" — closes BUG-14.
 */
export const OwnAndTransferredIn: Story = {
  name: "Mix of own and transferred-in products",
  args: {
    state: { status: "ready", products: mixedLocationProducts },
    locationId: "canteen-1",
    onSubmit: stubSubmit,
    onLoadCustomers: stubLoadCustomers,
    onCreateCustomer: stubCreateCustomer,
  },
};

/**
 * BUG-15's soft guardrail. Chapati is at 0 — its tile shows "Out of stock"
 * and can't be tapped. Chips and Githeri are low (3 and 1 left) — a warning
 * badge, same isLow/TriangleAlert visual language as the admin stock table.
 * Tea has plenty, no badge. The Photocopy service line never shows a stock
 * badge at all — services aren't stock-tracked.
 */
export const StockLevelsOnTiles: Story = {
  name: "On-hand quantity — out of stock and low stock",
  args: {
    state: { status: "ready", products: mixedStockProducts },
    onSubmit: stubSubmit,
    onLoadCustomers: stubLoadCustomers,
    onCreateCustomer: stubCreateCustomer,
  },
};

/**
 * BUG-15's hard guardrail, surfaced. Stock can go stale between this
 * screen loading and the tap on Complete sale (another staff member's
 * sale, a race) — the backend rejects the line and this is what the
 * cashier sees: the specific item and how many are actually left, not a
 * generic failure. Add Githeri to the basket, then Complete sale to see
 * this fire (stubbed here to fail with insufficient_stock rather than
 * succeed).
 */
export const InsufficientStockOnSubmit: Story = {
  name: "Rejected — stock ran out between load and submit",
  args: {
    state: { status: "ready", products: mixedStockProducts },
    onSubmit: async () => ({
      ok: false as const,
      error: "insufficient_stock",
      productId: "p4",
      available: 1,
    }),
    onLoadCustomers: stubLoadCustomers,
    onCreateCustomer: stubCreateCustomer,
  },
};
