import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { RecordStockCountView } from "./record-stock-count";

/**
 * Stock count — record what's physically on hand. Ticket 20.
 *
 * Default is interactive — search for a product or ingredient, tap to add
 * it as a line, fill in the counted quantity, then Record count. onSubmit
 * is stubbed so no network call leaves the story.
 */
const meta = {
  title: "Modules/Stock/RecordStockCount",
  component: RecordStockCountView,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof RecordStockCountView>;

export default meta;
type Story = StoryObj<typeof meta>;

const items = [
  { id: "p1", name: "Soda 500ml", itemType: "product" as const, unit: "unit" },
  { id: "p2", name: "Mukimo", itemType: "product" as const, unit: "unit" },
  { id: "p3", name: "Chapati", itemType: "product" as const, unit: "unit" },
  { id: "i1", name: "Flour", itemType: "ingredient" as const, unit: "kg" },
  { id: "i2", name: "Cooking oil", itemType: "ingredient" as const, unit: "litre" },
  { id: "i3", name: "Potatoes", itemType: "ingredient" as const, unit: "kg" },
];

const stubSubmit = async () => ({ ok: true as const, countId: "count-1" });

export const Default: Story = {
  args: {
    state: { status: "ready", items },
    onSubmit: stubSubmit,
  },
};

export const Loading: Story = {
  args: { state: { status: "loading" } },
};

export const Empty: Story = {
  name: "Empty — first use",
  args: { state: { status: "ready", items: [] } },
};

export const Error: Story = {
  args: { state: { status: "error" } },
};
