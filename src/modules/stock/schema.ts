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
  transferId: string | null;
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
  // Null for wasted/consumed/given_away (ticket 15) — no delivery to
  // group under. Always set for received (ticket 16).
  receiptId: string | null;
  transferId: string | null;
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

// CONTEXT.md's Non-sales Stock Consumption — the three reasons the client
// reads together but records distinctly.
export type NonSalesCategory = "wasted" | "consumed" | "given_away";

export type StockCountItemType = "product" | "ingredient";

// The stored/internal shape — expectedQuantity is always captured on
// write, for every role, per the ticket ("expected is still captured on
// write for every role, it's just not *shown* to a non-owner reader").
export type StockCountLine = {
  id: string;
  itemType: StockCountItemType;
  itemId: string;
  countedQuantity: number;
  expectedQuantity: number;
  correctedAt: Date | null;
  correctedBy: string | null;
};

export type StockCount = {
  id: string;
  locationId: string;
  staffMemberId: string;
  occurredAt: Date;
  lines: StockCountLine[];
};

// getStockCount's response shape — expectedQuantity is present only when
// the caller is the owner. The comparison is owner-only regardless of who
// recorded the count, so a store manager/attendant's response omits the
// field entirely rather than the UI hiding a column it already received.
export type StockCountLineForReader = Omit<StockCountLine, "expectedQuantity"> & {
  expectedQuantity?: number;
  itemName: string;
};

export type StockCountForReader = Omit<StockCount, "lines"> & {
  lines: StockCountLineForReader[];
};
