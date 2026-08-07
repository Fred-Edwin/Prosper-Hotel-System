import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { RecipeBuilder } from "./recipe-builder";
import { VersionHistory } from "./version-history";
import { DetailCard } from "@/components/patterns/detail-page";
import type { Ingredient, Recipe } from "../schema";

const ingredients: Ingredient[] = [
  { id: "i1", name: "Maize flour", unitOfMeasure: "kg", lastKnownCostMinor: 120, active: true },
  { id: "i2", name: "Cooking oil", unitOfMeasure: "litre", lastKnownCostMinor: 280, active: true },
  { id: "i3", name: "Potatoes", unitOfMeasure: "kg", lastKnownCostMinor: 80, active: true },
  { id: "i4", name: "Beans", unitOfMeasure: "kg", lastKnownCostMinor: 150, active: true },
  { id: "i5", name: "Maize", unitOfMeasure: "kg", lastKnownCostMinor: 70, active: true },
  { id: "i6", name: "Beef", unitOfMeasure: "kg", lastKnownCostMinor: null, active: true },
];

const versions: Recipe[] = [
  {
    id: "r2",
    productId: "p1",
    yieldQuantity: 10,
    effectiveFrom: new Date("2026-07-01"),
    createdAt: new Date("2026-07-01"),
    lines: [
      { ingredientId: "i4", quantity: 3 },
      { ingredientId: "i5", quantity: 3 },
    ],
  },
  {
    id: "r1",
    productId: "p1",
    yieldQuantity: 10,
    effectiveFrom: new Date("2026-05-01"),
    createdAt: new Date("2026-05-01"),
    lines: [
      { ingredientId: "i4", quantity: 2.5 },
      { ingredientId: "i5", quantity: 3 },
    ],
  },
];

const meta = {
  title: "Modules/Catalogue/RecipeBuilder",
  component: RecipeBuilder,
  parameters: { layout: "padded" },
  args: { onSave: () => {} },
} satisfies Meta<typeof RecipeBuilder>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NewRecipe: Story = {
  args: { ingredients, unit: "plate" },
};

export const EditingExisting: Story = {
  args: {
    ingredients,
    unit: "plate",
    initialLines: [
      { ingredientId: "i4", quantity: 3 },
      { ingredientId: "i5", quantity: 3 },
    ],
    initialYield: "10",
  },
};

export const WithUnknownIngredientCost: Story = {
  name: "An ingredient with no known cost — total shows —",
  args: {
    ingredients,
    unit: "plate",
    initialLines: [{ ingredientId: "i6", quantity: 1 }],
    initialYield: "4",
  },
};

export const Saving: Story = {
  args: {
    ingredients,
    unit: "plate",
    initialLines: [{ ingredientId: "i4", quantity: 3 }],
    initialYield: "10",
    saving: true,
  },
};

export const WithVersionHistory: Story = {
  name: "With version history beneath the cost panel",
  args: {
    ingredients,
    unit: "plate",
    initialLines: versions[0].lines,
    initialYield: String(versions[0].yieldQuantity),
    aside: (
      <DetailCard
        title="Version history"
        flush
        footnote="A change is a new version from a date. Past figures keep the recipe they were costed with, so a closed month never restates itself."
      >
        <VersionHistory versions={versions} ingredients={ingredients} unit="plate" />
      </DetailCard>
    ),
  },
};
