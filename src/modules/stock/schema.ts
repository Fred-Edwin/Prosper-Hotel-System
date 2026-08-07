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
