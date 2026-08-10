import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { RecordProductionView } from "./record-production";

/**
 * Production — record what the kitchen made. Ticket 19.
 *
 * Default is interactive — search for a product, tap to select it, fill
 * in quantity, then Record production to reach confirmation, all within
 * the canvas. onSubmit is stubbed so no network call leaves the story.
 */
const meta = {
  title: "Modules/Stock/RecordProduction",
  component: RecordProductionView,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof RecordProductionView>;

export default meta;
type Story = StoryObj<typeof meta>;

const products = [
  { id: "p1", name: "Chips", kind: "cooked_food" as const, priceMinor: 15000, active: true },
  { id: "p2", name: "Chicken stew", kind: "cooked_food" as const, priceMinor: 35000, active: true },
  { id: "p3", name: "Ugali", kind: "cooked_food" as const, priceMinor: 10000, active: true },
];

const stubSubmit = async () => ({ ok: true as const });

export const Default: Story = {
  args: {
    state: { status: "ready", products },
    onSubmit: stubSubmit,
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

export const NoRecipeRejection: Story = {
  name: "Rejected — no current recipe",
  args: {
    state: { status: "ready", products },
    onSubmit: async () => ({ ok: false as const, error: "no_recipe" }),
  },
};
