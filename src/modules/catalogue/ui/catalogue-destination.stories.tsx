import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CatalogueDestinationView } from "./catalogue-destination";
import type { Asset, Product, Ingredient, RecipeWithCost } from "../schema";
import type { Location } from "@/modules/people";

const products: Product[] = [
  { id: "p1", name: "Mukimo", kind: "cooked_food", priceMinor: 150, lastKnownCostMinor: null, active: true },
  { id: "p2", name: "Chips", kind: "cooked_food", priceMinor: 100, lastKnownCostMinor: null, active: true },
  { id: "p3", name: "Githeri", kind: "cooked_food", priceMinor: 120, lastKnownCostMinor: null, active: true },
  { id: "p4", name: "Soda 500ml", kind: "goods", priceMinor: 80, lastKnownCostMinor: 50, active: true },
  { id: "p5", name: "Photocopy (per page)", kind: "service", priceMinor: 5, lastKnownCostMinor: null, active: true },
];

const ingredients: Ingredient[] = [
  { id: "i1", name: "Maize flour", unitOfMeasure: "kg", lastKnownCostMinor: 120, active: true },
  { id: "i2", name: "Cooking oil", unitOfMeasure: "litre", lastKnownCostMinor: 280, active: true },
  { id: "i3", name: "Potatoes", unitOfMeasure: "kg", lastKnownCostMinor: 80, active: true },
];

const locations: Location[] = [
  { id: "l1", code: "restaurant", name: "Restaurant" },
  { id: "l2", code: "canteen", name: "Canteen" },
];

const assets: Asset[] = [
  { id: "a1", name: "Chest freezer", locationId: "l1", quantity: 1, expenseId: null, retiredAt: null },
  { id: "a2", name: "Dining chairs", locationId: "l1", quantity: 24, expenseId: null, retiredAt: null },
  { id: "a3", name: "Spoons", locationId: "l2", quantity: 40, expenseId: null, retiredAt: null },
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

const meta = {
  title: "Modules/Catalogue/CatalogueDestination",
  component: CatalogueDestinationView,
  parameters: { layout: "padded" },
} satisfies Meta<typeof CatalogueDestinationView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    state: {
      status: "ready",
      products,
      ingredients,
      recipes: [
        { productId: "p1", recipe: mukimoRecipe },
        { productId: "p2", recipe: null },
        { productId: "p3", recipe: null },
      ],
      assets,
      locations,
    },
  },
};

export const Loading: Story = {
  args: { state: { status: "loading" } },
};

export const ErrorLoading: Story = {
  name: "Error",
  args: { state: { status: "error" } },
};

export const PermissionDenied: Story = {
  name: "Permission denied — not the owner",
  args: { state: { status: "denied" } },
};
