import type { StockMovementReason, TransferItemType, TransferStatus } from "@/generated/prisma/enums";

export type { StockMovementReason, TransferItemType, TransferStatus };

// Added 2026-08-13 — REQ-02 Part A / docs/scope.md's canteen redesign.
// Pending until the receiving side confirms; see prisma/schema.prisma's
// Transfer model comment for the full lifecycle.
export type Transfer = {
  id: string;
  fromLocationId: string;
  toLocationId: string;
  itemType: TransferItemType;
  itemId: string;
  sentQuantity: number;
  status: TransferStatus;
  sentByStaffMemberId: string;
  sentAt: Date;
  confirmedQuantity: number | null;
  confirmedByStaffMemberId: string | null;
  confirmedAt: Date | null;
  reversedTransferId: string | null;
  cancelledByStaffMemberId: string | null;
  cancelledAt: Date | null;
};

// Reader-facing shape for a pending transfer awaiting confirmation —
// includes the item's display name, since the receiving screen shows
// "40 chapatis, sent 09:12" rather than a bare itemId.
export type PendingTransferForReader = Transfer & { itemName: string };

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
  // Shared by every line recorded in the same receiving call (ticket 22) —
  // a delivery may mix product and ingredient lines under one receipt id.
  // Null for every other reason.
  receiptId: string | null;
};

export type StockLevel = {
  productId: string;
  productName: string;
  quantityOnHand: number;
  // docs/architecture.md's "Product home location" note: true when this
  // location is the product's home location, false when it's here only via
  // a transfer reflected in the ledger — the staff-shell Stock page's "My
  // stock" / "From another location" split.
  isOwn: boolean;
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

// Ticket 44: one row of the low-stock filter — restaurant items compare
// against live on-hand (asOf null); canteen items compare against the
// most recent count's quantity (asOf the count's occurredAt), since
// canteen stock is provisional between counts.
export type LowStockItem = {
  itemType: StockCountItemType;
  itemId: string;
  itemName: string;
  quantityOnHand: number;
  lowStockLevel: number;
  asOf: Date | null;
};

