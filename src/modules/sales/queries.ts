import type { PrismaClient } from "@/generated/prisma/client";
import type { PaymentMethod, Sale, SaleFulfilment } from "./schema";

export async function findSaleById(db: PrismaClient, saleId: string): Promise<Sale | null> {
  return db.sale.findUnique({
    where: { id: saleId },
    include: { lines: true, paymentLines: true },
  });
}

export async function markSaleVoided(
  db: PrismaClient,
  saleId: string,
  voidedBy: string,
): Promise<Sale> {
  return db.sale.update({
    where: { id: saleId },
    data: { voided: true, voidedAt: new Date(), voidedBy },
    include: { lines: true, paymentLines: true },
  });
}

export async function createSaleRecord(
  db: PrismaClient,
  data: {
    locationId: string;
    staffMemberId: string;
    fulfilment: SaleFulfilment;
    customerId?: string | null;
    totalMinor: number;
    deliveryFeeMinor?: number | null;
    lines: { productId: string; quantity: number; priceMinor: number }[];
    paymentLines: { method: PaymentMethod; amountMinor: number; customerId?: string | null }[];
  },
): Promise<Sale> {
  return db.sale.create({
    data: {
      locationId: data.locationId,
      staffMemberId: data.staffMemberId,
      fulfilment: data.fulfilment,
      customerId: data.customerId ?? null,
      totalMinor: data.totalMinor,
      deliveryFeeMinor: data.deliveryFeeMinor ?? null,
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

// Ticket 24: count-derived sales at the canteen subtracts recorded credit
// sales from the formula — only credit is individually recorded there
// (CONTEXT.md's Sale entry). Non-void lines only, per formulas.md's rule
// that cancelled entries count nowhere.
export async function sumCreditSaleQuantityByProductAtLocation(
  db: PrismaClient,
  locationId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<{ productId: string; quantity: number }[]> {
  const sales = await db.sale.findMany({
    where: {
      locationId,
      voided: false,
      occurredAt: { gt: periodStart, lte: periodEnd },
      paymentLines: { some: { method: "credit" } },
    },
    include: { lines: true },
  });

  const quantityByProduct = new Map<string, number>();
  for (const sale of sales) {
    for (const line of sale.lines) {
      quantityByProduct.set(
        line.productId,
        (quantityByProduct.get(line.productId) ?? 0) + line.quantity,
      );
    }
  }

  return Array.from(quantityByProduct.entries()).map(([productId, quantity]) => ({
    productId,
    quantity,
  }));
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
