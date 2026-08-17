import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { IssueToKitchenView } from "./issue-to-kitchen";

/**
 * Issuing to the kitchen — record ingredients leaving the store. Ticket 18.
 *
 * Default is interactive — search for an ingredient, tap to add it as a
 * line, fill in quantity, then Record issue to reach confirmation, all
 * within the canvas. onSubmit is stubbed so no network call leaves the
 * story.
 */
const meta = {
  title: "Modules/Stock/IssueToKitchen",
  component: IssueToKitchenView,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof IssueToKitchenView>;

export default meta;
type Story = StoryObj<typeof meta>;

// Quantities cover a healthy figure, fractional ones (kg/litres — the till
// only ever showed whole units) and a zero, which must read as "None on
// hand" while leaving the tile enabled.
const ingredients = [
  { id: "i1", name: "Flour", unitOfMeasure: "kg", active: true, quantityOnHand: 24 },
  { id: "i2", name: "Cooking oil", unitOfMeasure: "litre", active: true, quantityOnHand: 2.5 },
  { id: "i3", name: "Potatoes", unitOfMeasure: "kg", active: true, quantityOnHand: 0 },
  { id: "i4", name: "Tea leaves", unitOfMeasure: "packet", active: true, quantityOnHand: 7 },
  { id: "i5", name: "Sugar", unitOfMeasure: "kg", active: true, quantityOnHand: 0.75 },
];

const stubSubmit = async () => ({ ok: true as const });

export const Default: Story = {
  args: {
    state: { status: "ready", ingredients },
    onSubmit: stubSubmit,
  },
};

/**
 * The over-stock guard: add Cooking oil (2.5 litres on hand) and type 5.
 * The line shows "Only 2.5 litre in stock" and Record issue stays disabled
 * — the typed figure is left alone rather than clamped, so the store
 * manager sees what they asked for and decides.
 */
export const OverStock: Story = {
  name: "Asking for more than the store holds",
  args: {
    state: { status: "ready", ingredients },
    onSubmit: stubSubmit,
  },
};

export const Loading: Story = {
  args: { state: { status: "loading" } },
};

export const Empty: Story = {
  name: "Empty — first use",
  args: { state: { status: "ready", ingredients: [] } },
};

export const Error: Story = {
  args: { state: { status: "error" } },
};
