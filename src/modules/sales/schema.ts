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
