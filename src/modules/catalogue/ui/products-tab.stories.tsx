import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ProductsTab } from "./products-tab";
import type { Category, Product } from "../schema";

const categories: Category[] = [
  { id: "c1", name: "Food", active: true },
  { id: "c2", name: "Drinks", active: true },
  { id: "c3", name: "Stationery", active: true },
];

const products: Product[] = [
  { id: "p1", name: "Mukimo", kind: "cooked_food", priceMinor: 150, lastKnownCostMinor: null, lowStockLevel: null, active: true, categoryId: "c1" },
  { id: "p2", name: "Chips", kind: "cooked_food", priceMinor: 100, lastKnownCostMinor: null, lowStockLevel: null, active: true, categoryId: "c1" },
  { id: "p3", name: "Soda 500ml", kind: "goods", priceMinor: 80, lastKnownCostMinor: 50, lowStockLevel: null, active: true, categoryId: "c2" },
  { id: "p4", name: "Exercise book", kind: "goods", priceMinor: 60, lastKnownCostMinor: 40, lowStockLevel: null, active: true, categoryId: "c3" },
  { id: "p5", name: "Photocopy (per page)", kind: "service", priceMinor: 5, lastKnownCostMinor: null, lowStockLevel: null, active: true, categoryId: null },
  { id: "p6", name: "Delivery box", kind: "packaging", priceMinor: null, lastKnownCostMinor: null, lowStockLevel: null, active: false, categoryId: null },
];

const meta = {
  title: "Modules/Catalogue/ProductsTab",
  component: ProductsTab,
  parameters: { layout: "padded" },
  args: {
    categories,
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
