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
};

export type Sale = {
  id: string;
  locationId: string;
  staffMemberId: string;
  fulfilment: SaleFulfilment;
  totalMinor: number;
  occurredAt: Date;
  lines: SaleLine[];
  paymentLines: PaymentLine[];
};
