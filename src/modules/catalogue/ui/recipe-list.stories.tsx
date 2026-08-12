import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { RecipeList } from "./recipe-list";
import type { Product, RecipeWithCost } from "../schema";

const products: Product[] = [
  { id: "p1", name: "Mukimo", kind: "cooked_food", priceMinor: 150, lastKnownCostMinor: null, active: true, categoryId: null },
  { id: "p2", name: "Chips", kind: "cooked_food", priceMinor: 100, lastKnownCostMinor: null, active: true, categoryId: null },
  { id: "p3", name: "Githeri", kind: "cooked_food", priceMinor: 120, lastKnownCostMinor: null, active: true, categoryId: null },
  { id: "p4", name: "Beef stew", kind: "cooked_food", priceMinor: 180, lastKnownCostMinor: null, active: true, categoryId: null },
];

const mukimoRecipe: RecipeWithCost = {
  id: "r1",
  productId: "p1",
  yieldQuantity: 10,
  effectiveFrom: new Date("2026-06-01"),
  createdAt: new Date("2026-06-01"),
  lines: [{ ingredientId: "i1", quantity: 3 }],
  perUnitCostMinor: 89,
};

const chipsRecipe: RecipeWithCost = {
  id: "r2",
  productId: "p2",
  yieldQuantity: 8,
  effectiveFrom: new Date("2026-05-01"),
  createdAt: new Date("2026-05-01"),
  lines: [{ ingredientId: "i3", quantity: 4 }],
  perUnitCostMinor: 94,
};

const meta = {
  title: "Modules/Catalogue/RecipeList",
  component: RecipeList,
  parameters: { layout: "padded" },
  args: { onOpen: () => {} },
} satisfies Meta<typeof RecipeList>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Absences are listed, not summarised — Githeri and Beef stew have no recipe. */
export const MixedWithAbsences: Story = {
  name: "Mixed — some dishes without a recipe",
  args: {
    products,
    recipes: [
      { productId: "p1", recipe: mukimoRecipe },
      { productId: "p2", recipe: chipsRecipe },
      { productId: "p3", recipe: null },
      { productId: "p4", recipe: null },
    ],
  },
};

export const EveryDishHasARecipe: Story = {
  args: {
    products: products.slice(0, 2),
    recipes: [
      { productId: "p1", recipe: mukimoRecipe },
      { productId: "p2", recipe: chipsRecipe },
    ],
  },
};

export const NoRecipesYet: Story = {
  args: {
    products,
    recipes: products.map((p) => ({ productId: p.id, recipe: null })),
  },
};
