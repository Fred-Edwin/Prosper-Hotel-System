import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CreditSaleView } from "./credit-sale";

/**
 * The canteen attendant's credit sale entry point (ticket 26). A trimmed
 * `new-sale.tsx` Till — see credit-sale.tsx for why it isn't a reuse.
 *
 * Default is interactive — tap products to build a basket, pick or add a
 * customer, then Record credit sale to reach the confirmation state, all
 * within the canvas. onSubmit is stubbed here so no network call leaves the
 * story.
 */
const meta = {
  title: "Modules/Sales/CreditSale",
  component: CreditSaleView,
  parameters: { layout: "fullscreen" },
  args: { locationId: "canteen-1" },
} satisfies Meta<typeof CreditSaleView>;

export default meta;
type Story = StoryObj<typeof meta>;

const products = [
  { id: "p1", name: "Mukimo", kind: "cooked_food" as const, priceMinor: 150, active: true, locationId: "canteen-1" },
  { id: "p2", name: "Chips", kind: "cooked_food" as const, priceMinor: 100, active: true, locationId: "canteen-1" },
  { id: "p3", name: "Chapati", kind: "cooked_food" as const, priceMinor: 20, active: true, locationId: "canteen-1" },
  { id: "p4", name: "Githeri", kind: "cooked_food" as const, priceMinor: 120, active: true, locationId: "canteen-1" },
  { id: "p5", name: "Tea", kind: "cooked_food" as const, priceMinor: 30, active: true, locationId: "canteen-1" },
  { id: "p6", name: "Soda 500ml", kind: "goods" as const, priceMinor: 80, active: true, locationId: "canteen-1" },
  { id: "p7", name: "Water 1L", kind: "goods" as const, priceMinor: 60, active: true, locationId: "canteen-1" },
  { id: "p8", name: "Samosa", kind: "cooked_food" as const, priceMinor: 30, active: true, locationId: "canteen-1" },
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

/**
 * Nothing added and no customer picked yet — "Record credit sale" is
 * disabled until both are true. Add a product and pick a customer within
 * the canvas to reach the ready-to-submit state.
 */
export const Default: Story = {
  name: "No customer selected — action disabled",
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
