import type { StockMovementReason } from "@/generated/prisma/enums";

export type { StockMovementReason };

export type StockMovement = {
  id: string;
  productId: string;
  locationId: string;
  quantity: number;
  reason: StockMovementReason;
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
  unitCostMinor: number;
  staffMemberId: string;
  occurredAt: Date;
  receiptId: string;
};

// One row per delivery event — every line recorded in the same
// recordIngredientReceipt call shares a receiptId. This is what a
// Stock-category Expense (cash module) references as "the receipt it
// pays for" — see ticket 16.
export type Receipt = {
  receiptId: string;
  locationId: string;
  occurredAt: Date;
  totalMinor: number;
  lineCount: number;
};
