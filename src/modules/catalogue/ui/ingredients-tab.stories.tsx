import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { IngredientsTab } from "./ingredients-tab";
import type { Ingredient } from "../schema";

const ingredients: Ingredient[] = [
  { id: "i1", name: "Maize flour", unitOfMeasure: "kg", lastKnownCostMinor: 120, lowStockLevel: null, active: true },
  { id: "i2", name: "Cooking oil", unitOfMeasure: "litre", lastKnownCostMinor: 280, lowStockLevel: null, active: true },
  { id: "i3", name: "Potatoes", unitOfMeasure: "kg", lastKnownCostMinor: 80, lowStockLevel: null, active: true },
  { id: "i4", name: "Beef", unitOfMeasure: "kg", lastKnownCostMinor: null, lowStockLevel: null, active: true },
  { id: "i5", name: "Printing paper", unitOfMeasure: "ream", lastKnownCostMinor: 550, lowStockLevel: null, active: false },
];

const meta = {
  title: "Modules/Catalogue/IngredientsTab",
  component: IngredientsTab,
  parameters: { layout: "padded" },
  args: {
    onCreate: () => {},
    onUpdate: () => {},
    onSetActive: () => {},
  },
} satisfies Meta<typeof IngredientsTab>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { ingredients },
};

export const EmptyFirstUse: Story = {
  name: "Empty — first use",
  args: { ingredients: [] },
};

export const Saving: Story = {
  args: { ingredients, saving: true },
};

export const WithError: Story = {
  name: "Save error",
  args: { ingredients, error: "That name is already in use." },
};
