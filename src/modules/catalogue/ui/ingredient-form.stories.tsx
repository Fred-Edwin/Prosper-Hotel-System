import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { IngredientForm } from "./ingredient-form";
import type { Ingredient } from "../schema";

const ingredientWithThreshold: Ingredient = {
  id: "i1",
  name: "Maize flour",
  unitOfMeasure: "kg",
  lastKnownCostMinor: 120,
  lowStockLevel: 5,
  active: true,
};

const ingredientNoThreshold: Ingredient = {
  id: "i2",
  name: "Cooking oil",
  unitOfMeasure: "litre",
  lastKnownCostMinor: 280,
  lowStockLevel: null,
  active: true,
};

const meta = {
  title: "Modules/Catalogue/IngredientForm",
  component: IngredientForm,
  parameters: { layout: "padded" },
  args: {
    open: true,
    onOpenChange: () => {},
    onSave: () => {},
  },
} satisfies Meta<typeof IngredientForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NewIngredient: Story = {
  name: "New ingredient",
  args: {},
};

export const LowStockLevelSet: Story = {
  name: "Low stock level set",
  args: { ingredient: ingredientWithThreshold },
};

export const LowStockLevelUnset: Story = {
  name: "Low stock level unset",
  args: { ingredient: ingredientNoThreshold },
};
