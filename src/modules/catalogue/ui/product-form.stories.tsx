import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ProductForm } from "./product-form";
import type { Category, Product } from "../schema";

const categories: Category[] = [
  { id: "c1", name: "Food", active: true },
  { id: "c2", name: "Drinks", active: true },
  { id: "c3", name: "Stationery", active: false },
];

const productWithCategory: Product = {
  id: "p1",
  name: "Soda 500ml",
  kind: "goods",
  priceMinor: 80,
  lastKnownCostMinor: 50,
  active: true,
  categoryId: "c2",
};

const productNoCategory: Product = {
  id: "p2",
  name: "Photocopy (per page)",
  kind: "service",
  priceMinor: 5,
  lastKnownCostMinor: null,
  active: true,
  categoryId: null,
};

const productWithDeactivatedCategory: Product = {
  id: "p3",
  name: "Exercise book",
  kind: "goods",
  priceMinor: 60,
  lastKnownCostMinor: 40,
  active: true,
  categoryId: "c3",
};

const meta = {
  title: "Modules/Catalogue/ProductForm",
  component: ProductForm,
  parameters: { layout: "padded" },
  args: {
    open: true,
    categories,
    onOpenChange: () => {},
    onSave: () => {},
  },
} satisfies Meta<typeof ProductForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CategorySet: Story = {
  name: "Category set",
  args: { product: productWithCategory },
};

export const CategoryUnset: Story = {
  name: "Category unset",
  args: { product: productNoCategory },
};

export const DeactivatedCategoryStillShownOnExistingProduct: Story = {
  name: "Deactivated category still shown on existing product",
  args: { product: productWithDeactivatedCategory },
};

export const NewProductNoCategory: Story = {
  name: "New product — no category yet",
  args: {},
};
