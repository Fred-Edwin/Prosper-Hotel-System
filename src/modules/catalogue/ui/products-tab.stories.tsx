import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ProductsTab } from "./products-tab";
import type { Location } from "@/modules/people";
import type { Category, Product } from "../schema";

const categories: Category[] = [
  { id: "c1", name: "Food", active: true },
  { id: "c2", name: "Drinks", active: true },
  { id: "c3", name: "Stationery", active: true },
];

const locations: Location[] = [
  { id: "loc-1", code: "restaurant", name: "Prosper Restaurant" },
  { id: "loc-2", code: "canteen", name: "Prosper Canteen" },
];

const products: Product[] = [
  { id: "p1", name: "Mukimo", kind: "cooked_food", priceMinor: 150, lastKnownCostMinor: null, lowStockLevel: null, active: true, categoryId: "c1", locationId: "loc-1" },
  // Buying price 0 — made from ingredients, already costed as those moved
  // through the store. Must render as "0.00", never as the "Not set" badge
  // that a null gets: the two mean different things (2026-08-18).
  { id: "p2", name: "Chips", kind: "cooked_food", priceMinor: 100, lastKnownCostMinor: 0, lowStockLevel: null, active: true, categoryId: "c1", locationId: "loc-1" },
  { id: "p3", name: "Soda 500ml", kind: "goods", priceMinor: 80, lastKnownCostMinor: 50, lowStockLevel: null, active: true, categoryId: "c2", locationId: "loc-1" },
  { id: "p4", name: "Exercise book", kind: "goods", priceMinor: 60, lastKnownCostMinor: 40, lowStockLevel: null, active: true, categoryId: "c3", locationId: "loc-2" },
  { id: "p5", name: "Photocopy (per page)", kind: "service", priceMinor: 5, lastKnownCostMinor: null, lowStockLevel: null, active: true, categoryId: null, locationId: "loc-2" },
  { id: "p6", name: "Delivery box", kind: "packaging", priceMinor: null, lastKnownCostMinor: null, lowStockLevel: null, active: false, categoryId: null, locationId: "loc-1" },
];

const meta = {
  title: "Modules/Catalogue/ProductsTab",
  component: ProductsTab,
  parameters: { layout: "padded" },
  args: {
    categories,
    locations,
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
