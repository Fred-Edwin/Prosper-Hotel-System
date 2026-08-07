import type { PrismaClient } from "@/generated/prisma/client";
import type { PaymentMethod, Sale, SaleFulfilment } from "./schema";

export async function createSaleRecord(
  db: PrismaClient,
  data: {
    locationId: string;
    staffMemberId: string;
    fulfilment: SaleFulfilment;
    totalMinor: number;
    lines: { productId: string; quantity: number; priceMinor: number }[];
    paymentLines: { method: PaymentMethod; amountMinor: number }[];
  },
): Promise<Sale> {
  return db.sale.create({
    data: {
      locationId: data.locationId,
      staffMemberId: data.staffMemberId,
      fulfilment: data.fulfilment,
      totalMinor: data.totalMinor,
      lines: { create: data.lines },
      paymentLines: { create: data.paymentLines },
    },
    include: { lines: true, paymentLines: true },
  });
}
