import type { StockMovementReason } from "@/generated/prisma/enums";

export type { StockMovementReason };

export type StockMovement = {
  id: string;
  productId: string;
  locationId: string;
  quantity: number;
  reason: StockMovementReason;
  costBasisMinor: number | null;
  sellingValueMinor: number | null;
  isEstimated: boolean | null;
  staffMemberId: string;
  occurredAt: Date;
};

export type StockLevel = {
  productId: string;
  productName: string;
  quantityOnHand: number;
};

export type IngredientMovement = {
  id: string;
  ingredientId: string;
  locationId: string;
  quantity: number;
  reason: StockMovementReason;
  unitCostMinor: number | null;
  costBasisMinor: number | null;
  sellingValueMinor: number | null;
  isEstimated: boolean | null;
  staffMemberId: string;
  occurredAt: Date;
};

// CONTEXT.md's Non-sales Stock Consumption — the three reasons the client
// reads together but records distinctly.
export type NonSalesCategory = "wasted" | "consumed" | "given_away";
