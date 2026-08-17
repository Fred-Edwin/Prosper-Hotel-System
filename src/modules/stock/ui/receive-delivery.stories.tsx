import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ReceiveDeliveryView } from "./receive-delivery";

/**
 * Receiving — record a delivery into the store. Ticket 12, extended by
 * ticket 22 for canteen product receiving.
 *
 * Default is interactive — search for an ingredient, tap to add it as a
 * line, fill in quantity and price paid, then Record delivery to reach
 * confirmation, all within the canvas. onSubmit is stubbed so no network
 * call leaves the story. The Ingredients/Products tabs let a mixed
 * delivery (e.g. the canteen's printer paper and airtime scratch cards
 * bought in the same visit) be built across both pickers.
 */
const meta = {
  title: "Modules/Stock/ReceiveDelivery",
  component: ReceiveDeliveryView,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof ReceiveDeliveryView>;

export default meta;
type Story = StoryObj<typeof meta>;

// Quantities cover the three cases the on-hand line has to read well in:
// a healthy figure, a fractional one (kg/litres — the till only ever showed
// whole units), and zero, which must read as "None on hand" without ever
// disabling the tile. i6/p4 pair a zero with a never-bought item, which is
// how a newly catalogued item looks on its first delivery.
const ingredients = [
  { id: "i1", name: "Flour", unitOfMeasure: "kg", lastKnownCostMinor: 8000, active: true, quantityOnHand: 24 },
  { id: "i2", name: "Cooking oil", unitOfMeasure: "litre", lastKnownCostMinor: 25000, active: true, quantityOnHand: 2.5 },
  { id: "i3", name: "Potatoes", unitOfMeasure: "kg", lastKnownCostMinor: 6000, active: true, quantityOnHand: 0 },
  { id: "i4", name: "Tea leaves", unitOfMeasure: "packet", lastKnownCostMinor: 15000, active: true, quantityOnHand: 7 },
  { id: "i5", name: "Sugar", unitOfMeasure: "kg", lastKnownCostMinor: 12000, active: true, quantityOnHand: 0.75 },
  { id: "i6", name: "Printing paper", unitOfMeasure: "ream", lastKnownCostMinor: null, active: true, quantityOnHand: 0 },
];

const products = [
  { id: "p1", name: "Soda (500ml)", lastKnownCostMinor: 5000, active: true, quantityOnHand: 48 },
  { id: "p2", name: "Biscuits", lastKnownCostMinor: 3500, active: true, quantityOnHand: 3 },
  { id: "p3", name: "Airtime scratch card", lastKnownCostMinor: 10000, active: true, quantityOnHand: 0 },
  { id: "p4", name: "Bottled water", lastKnownCostMinor: null, active: true, quantityOnHand: 0 },
];

const stubSubmit = async () => ({ ok: true as const });

export const Default: Story = {
  args: {
    state: { status: "ready", ingredients, products },
    onSubmit: stubSubmit,
  },
};

// Ticket 22: a canteen delivery may be products only — the Products tab
// starts selected when there are no ingredients to receive against.
export const ProductsOnly: Story = {
  name: "Canteen — products only",
  args: {
    state: { status: "ready", ingredients: [], products },
    onSubmit: stubSubmit,
  },
};

// Ticket 22: a single supplier drop-off mixing both families — switch tabs
// to add lines from each, both landing on the same delivery.
export const Mixed: Story = {
  name: "Mixed delivery — ingredients and products",
  args: {
    state: { status: "ready", ingredients, products },
    onSubmit: stubSubmit,
  },
};

export const Loading: Story = {
  args: { state: { status: "loading" } },
};

export const Empty: Story = {
  name: "Empty — first use",
  args: { state: { status: "ready", ingredients: [], products: [] } },
};

export const Error: Story = {
  args: { state: { status: "error" } },
};
