import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ProductsTab } from "./products-tab";
import type { Product } from "../schema";

const products: Product[] = [
  { id: "p1", name: "Mukimo", kind: "cooked_food", priceMinor: 150, active: true },
  { id: "p2", name: "Chips", kind: "cooked_food", priceMinor: 100, active: true },
  { id: "p3", name: "Soda 500ml", kind: "goods", priceMinor: 80, active: true },
  { id: "p4", name: "Exercise book", kind: "goods", priceMinor: 60, active: true },
  { id: "p5", name: "Photocopy (per page)", kind: "service", priceMinor: 5, active: true },
  { id: "p6", name: "Delivery box", kind: "packaging", priceMinor: null, active: false },
];

const meta = {
  title: "Modules/Catalogue/ProductsTab",
  component: ProductsTab,
  parameters: { layout: "padded" },
  args: {
    onCreate: () => {},
    onUpdate: () => {},
    onSetActive: () => {},
  },
} satisfies Meta<typeof ProductsTab>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { products },
};

export const EmptyFirstUse: Story = {
  name: "Empty — first use",
  args: { products: [] },
};

export const Saving: Story = {
  args: { products, saving: true },
};

export const WithError: Story = {
  name: "Save error",
  args: { products, error: "That name is already in use." },
};
