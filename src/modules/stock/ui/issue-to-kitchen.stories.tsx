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

const ingredients = [
  { id: "i1", name: "Flour", unitOfMeasure: "kg", active: true },
  { id: "i2", name: "Cooking oil", unitOfMeasure: "litre", active: true },
  { id: "i3", name: "Potatoes", unitOfMeasure: "kg", active: true },
  { id: "i4", name: "Tea leaves", unitOfMeasure: "packet", active: true },
  { id: "i5", name: "Sugar", unitOfMeasure: "kg", active: true },
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
