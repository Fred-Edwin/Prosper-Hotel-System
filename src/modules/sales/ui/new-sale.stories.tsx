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
} satisfies Meta<typeof NewSaleView>;

export default meta;
type Story = StoryObj<typeof meta>;

const products = [
  { id: "p1", name: "Mukimo", kind: "cooked_food" as const, priceMinor: 150, active: true },
  { id: "p2", name: "Chips", kind: "cooked_food" as const, priceMinor: 100, active: true },
  { id: "p3", name: "Chapati", kind: "cooked_food" as const, priceMinor: 20, active: true },
  { id: "p4", name: "Githeri", kind: "cooked_food" as const, priceMinor: 120, active: true },
  { id: "p5", name: "Tea", kind: "cooked_food" as const, priceMinor: 30, active: true },
  { id: "p6", name: "Soda 500ml", kind: "goods" as const, priceMinor: 80, active: true },
  { id: "p7", name: "Water 1L", kind: "goods" as const, priceMinor: 60, active: true },
  { id: "p8", name: "Samosa", kind: "cooked_food" as const, priceMinor: 30, active: true },
  { id: "p9", name: "Photocopy (per page)", kind: "service" as const, priceMinor: 5, active: true },
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
