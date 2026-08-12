import type { ProductKind } from "@/generated/prisma/enums";

export type { ProductKind };

export type Product = {
  id: string;
  name: string;
  kind: ProductKind;
  priceMinor: number | null;
  lastKnownCostMinor: number | null;
  active: boolean;
  categoryId: string | null;
};

export type Category = {
  id: string;
  name: string;
  active: boolean;
};

export type Ingredient = {
  id: string;
  name: string;
  unitOfMeasure: string;
  lastKnownCostMinor: number | null;
  active: boolean;
};

export type RecipeLine = {
  ingredientId: string;
  quantity: number;
};

export type Recipe = {
  id: string;
  productId: string;
  yieldQuantity: number;
  effectiveFrom: Date;
  createdAt: Date;
  lines: RecipeLine[];
};

// null when the product has no recipe at all — distinct from a recipe
// existing but an ingredient's cost being unknown (also null, per line).
export type RecipeWithCost = Recipe & { perUnitCostMinor: number | null };

export type Asset = {
  id: string;
  name: string;
  locationId: string;
  quantity: number;
  expenseId: string | null;
  // Filter-only — never surfaced as a visible "Inactive" state. Non-null
  // means retired.
  retiredAt: Date | null;
};
