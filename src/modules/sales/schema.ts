import type { PaymentMethod, SaleFulfilment } from "@/generated/prisma/enums";

export type { PaymentMethod, SaleFulfilment };

export type SaleLine = {
  id: string;
  saleId: string;
  productId: string;
  quantity: number;
  priceMinor: number;
};

export type PaymentLine = {
  id: string;
  saleId: string;
  method: PaymentMethod;
  amountMinor: number;
  customerId: string | null;
};

// Ticket 36 — formulas.md §11: a repayment against a customer's credit
// balance. Not tied to a Sale — money coming in against existing credit,
// not a sale of goods. Append-only, reversible only, same discipline as
// DrawingRepayment.
export type Repayment = {
  id: string;
  customerId: string;
  locationId: string;
  staffMemberId: string;
  amountMinor: number;
  occurredAt: Date;
  reversed: boolean;
  reversedAt: Date | null;
};

export type Sale = {
  id: string;
  locationId: string;
  staffMemberId: string;
  fulfilment: SaleFulfilment;
  customerId: string | null;
  totalMinor: number;
  deliveryFeeMinor: number | null;
  occurredAt: Date;
  voided: boolean;
  voidedAt: Date | null;
  voidedBy: string | null;
  lines: SaleLine[];
  paymentLines: PaymentLine[];
};
