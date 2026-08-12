import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CategoriesTab } from "./categories-tab";
import type { Category } from "../schema";

const categories: Category[] = [
  { id: "c1", name: "Food", active: true },
  { id: "c2", name: "Drinks", active: true },
  { id: "c3", name: "Snacks", active: true },
  { id: "c4", name: "Stationery", active: false },
];

const meta = {
  title: "Modules/Catalogue/CategoriesTab",
  component: CategoriesTab,
  parameters: { layout: "padded" },
  args: {
    onCreate: () => {},
    onUpdate: () => {},
    onSetActive: () => {},
  },
} satisfies Meta<typeof CategoriesTab>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { categories },
};

export const EmptyFirstUse: Story = {
  name: "Empty — first use",
  args: { categories: [] },
};

export const Saving: Story = {
  args: { categories, saving: true },
};

export const WithError: Story = {
  name: "Save error",
  args: { categories, error: "That name is already in use." },
};
