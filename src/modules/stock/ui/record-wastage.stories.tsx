import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { RecordWastageView } from "./record-wastage";

/**
 * Non-sales — record stock that left without being sold: wasted, staff
 * meals, or complimentary. Ticket 15; nav/category copy renamed from
 * Wastage/Consumed/Given away — see record-wastage.tsx's header comment.
 *
 * Default is interactive — search, tap a product or ingredient tile,
 * enter a quantity, pick a category, then Record to reach confirmation,
 * all within the canvas. onSubmit is stubbed so no network call leaves
 * the story.
 */
const meta = {
  title: "Modules/Stock/RecordWastage",
  component: RecordWastageView,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof RecordWastageView>;

export default meta;
type Story = StoryObj<typeof meta>;

// Quantities cover a healthy figure, fractional ones (kg/litres) and zero,
// which reads as "none left" without disabling the tile.
const products = [
  { id: "p1", name: "Sodas (500ml)", kind: "goods" as const, priceMinor: 10000, active: true, quantityOnHand: 48 },
  { id: "p2", name: "Chips", kind: "cooked_food" as const, priceMinor: 25000, active: true, quantityOnHand: 3 },
  { id: "p3", name: "Mukimo", kind: "cooked_food" as const, priceMinor: 20000, active: true, quantityOnHand: 0 },
  { id: "p4", name: "Biscuits", kind: "goods" as const, priceMinor: 5000, active: true, quantityOnHand: 12 },
];

const ingredients = [
  { id: "i1", name: "Flour", unitOfMeasure: "kg", lastKnownCostMinor: 8000, active: true, quantityOnHand: 24 },
  { id: "i2", name: "Cooking oil", unitOfMeasure: "litre", lastKnownCostMinor: 25000, active: true, quantityOnHand: 2.5 },
  { id: "i3", name: "Potatoes", unitOfMeasure: "kg", lastKnownCostMinor: 6000, active: true, quantityOnHand: 0 },
];

const stubSubmit = async () => ({ ok: true as const });

export const Default: Story = {
  args: {
    state: { status: "ready", products, ingredients },
    onSubmit: stubSubmit,
  },
};

/**
 * The over-quantity guard: tap Chips (3 left) and type 5. "Only 3 in
 * stock." appears and Record stays disabled — the typed figure is left
 * alone rather than clamped.
 */
export const OverStock: Story = {
  name: "Recording more than is in stock",
  args: {
    state: { status: "ready", products, ingredients },
    onSubmit: stubSubmit,
  },
};

export const Loading: Story = {
  args: { state: { status: "loading" } },
};

export const Empty: Story = {
  name: "Empty — first use",
  args: { state: { status: "ready", products: [], ingredients: [] } },
};

export const Error: Story = {
  args: { state: { status: "error" } },
};
