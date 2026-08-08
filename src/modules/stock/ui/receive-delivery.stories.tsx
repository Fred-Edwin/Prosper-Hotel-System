import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ReceiveDeliveryView } from "./receive-delivery";

/**
 * Receiving — record a delivery into the store. Ticket 12.
 *
 * Default is interactive — search for an ingredient, tap to add it as a
 * line, fill in quantity and price paid, then Record delivery to reach
 * confirmation, all within the canvas. onSubmit is stubbed so no network
 * call leaves the story.
 */
const meta = {
  title: "Modules/Stock/ReceiveDelivery",
  component: ReceiveDeliveryView,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof ReceiveDeliveryView>;

export default meta;
type Story = StoryObj<typeof meta>;

const ingredients = [
  { id: "i1", name: "Flour", unitOfMeasure: "kg", lastKnownCostMinor: 8000, active: true },
  { id: "i2", name: "Cooking oil", unitOfMeasure: "litre", lastKnownCostMinor: 25000, active: true },
  { id: "i3", name: "Potatoes", unitOfMeasure: "kg", lastKnownCostMinor: 6000, active: true },
  { id: "i4", name: "Tea leaves", unitOfMeasure: "packet", lastKnownCostMinor: 15000, active: true },
  { id: "i5", name: "Sugar", unitOfMeasure: "kg", lastKnownCostMinor: 12000, active: true },
  { id: "i6", name: "Printing paper", unitOfMeasure: "ream", lastKnownCostMinor: null, active: true },
];

const stubSubmit = async () => ({ ok: true as const });

export const Default: Story = {
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
