import type { ProductKind } from "@/generated/prisma/enums";

export type { ProductKind };

export type Product = {
  id: string;
  name: string;
  kind: ProductKind;
  priceMinor: number | null;
  active: boolean;
};

export type Ingredient = {
  id: string;
  name: string;
  unitOfMeasure: string;
  lastKnownCostMinor: number | null;
  active: boolean;
};
