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
    paymentLines: { method: PaymentMethod; amountMinor: number; customerId?: string | null }[];
  },
): Promise<Sale> {
  return db.sale.create({
    data: {
      locationId: data.locationId,
      staffMemberId: data.staffMemberId,
      fulfilment: data.fulfilment,
      totalMinor: data.totalMinor,
      lines: { create: data.lines },
      paymentLines: {
        create: data.paymentLines.map((p) => ({
          method: p.method,
          amountMinor: p.amountMinor,
          customerId: p.customerId ?? null,
        })),
      },
    },
    include: { lines: true, paymentLines: true },
  });
}

export async function sumCreditForCustomer(db: PrismaClient, customerId: string): Promise<number> {
  const result = await db.paymentLine.aggregate({
    where: { customerId, method: "credit" },
    _sum: { amountMinor: true },
  });
  return result._sum.amountMinor ?? 0;
}

export async function findSalesForStaffToday(
  db: PrismaClient,
  staffMemberId: string,
  locationId: string,
  dayStart: Date,
  dayEnd: Date,
): Promise<Sale[]> {
  return db.sale.findMany({
    where: {
      staffMemberId,
      locationId,
      occurredAt: { gte: dayStart, lt: dayEnd },
    },
    include: { lines: true, paymentLines: true },
    orderBy: { occurredAt: "desc" },
  });
}
