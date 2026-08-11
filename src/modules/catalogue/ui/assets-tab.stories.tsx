import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { AssetsTab } from "./assets-tab";
import type { Asset } from "../schema";
import type { Location } from "@/modules/people";

const locations: Location[] = [
  { id: "l1", code: "restaurant", name: "Restaurant" },
  { id: "l2", code: "canteen", name: "Canteen" },
];

const assets: Asset[] = [
  { id: "a1", name: "Chest freezer", locationId: "l1", quantity: 1, expenseId: null, retiredAt: null },
  { id: "a2", name: "Dining chairs", locationId: "l1", quantity: 24, expenseId: null, retiredAt: null },
  { id: "a3", name: "Spoons", locationId: "l2", quantity: 40, expenseId: null, retiredAt: null },
  { id: "a4", name: "Deep fryer", locationId: "l2", quantity: 2, expenseId: "e1", retiredAt: null },
];

const meta = {
  title: "Modules/Catalogue/AssetsTab",
  component: AssetsTab,
  parameters: { layout: "padded" },
  args: {
    locations,
    onCreate: () => {},
    onUpdateQuantity: () => {},
    onRetire: () => {},
  },
} satisfies Meta<typeof AssetsTab>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { assets },
};

export const EmptyFirstUse: Story = {
  name: "Empty — first use",
  args: { assets: [] },
};

export const Saving: Story = {
  args: { assets, saving: true },
};

export const WithError: Story = {
  name: "Save error",
  args: { assets, error: "Couldn't save — try again." },
};
