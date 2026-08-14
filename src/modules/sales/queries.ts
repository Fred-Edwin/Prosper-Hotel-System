import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import type { PaymentLine, PaymentMethod, Repayment, Sale, SaleFulfilment } from "./schema";

// createSaleRecord is called from inside a db.$transaction for BUG-15's
// overselling guard (sales/logic.ts), so this needs to accept a
// transaction client, not just the top-level PrismaClient.
type Db = PrismaClient | Prisma.TransactionClient;

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
  db: Db,
  data: {
    locationId: string;
    staffMemberId: string;
    fulfilment: SaleFulfilment;
    customerId?: string | null;
    totalMinor: number;
    deliveryFeeMinor?: number | null;
    lines: { productId: string; quantity: number; priceMinor: number }[];
    paymentLines: { method: PaymentMethod; amountMinor: number; customerId?: string | null }[];
    occurredAt?: Date;
    effectiveAt?: Date;
    isCorrection?: boolean;
    correctionReason?: string;
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
      ...(data.occurredAt ? { occurredAt: data.occurredAt } : {}),
      effectiveAt: data.effectiveAt ?? data.occurredAt ?? new Date(),
      isCorrection: data.isCorrection ?? false,
      correctionReason: data.correctionReason ?? null,
    },
    include: { lines: true, paymentLines: true },
  });
}

// Ticket 45 — Activity's sale/void/correction rows: every sale across
// both locations in a period, including voided (Activity shows voids as
// their own kind, so they must not be filtered out here).
export async function listSalesInPeriod(
  db: PrismaClient,
  periodStart: Date,
  periodEnd: Date,
): Promise<Sale[]> {
  return db.sale.findMany({
    where: { occurredAt: { gt: periodStart, lte: periodEnd } },
    include: { lines: true, paymentLines: true },
    orderBy: { occurredAt: "desc" },
  });
}

// Non-void only, via the sale relation — "cancelled entries count
// nowhere" (formulas.md's opening rule); BUG-12 was this filter missing.
export async function sumCreditForCustomer(db: PrismaClient, customerId: string): Promise<number> {
  const result = await db.paymentLine.aggregate({
    where: { customerId, method: "credit", sale: { voided: false } },
    _sum: { amountMinor: true },
  });
  return result._sum.amountMinor ?? 0;
}

// Ticket 33: "Owed to you" on the Dashboard — the sum across all
// customers, both locations, per formulas.md §11. Non-void only, via the
// sale relation — BUG-12 was this filter missing.
export async function sumCreditAcrossAllCustomers(db: PrismaClient): Promise<number> {
  const result = await db.paymentLine.aggregate({
    where: { method: "credit", sale: { voided: false } },
    _sum: { amountMinor: true },
  });
  return result._sum.amountMinor ?? 0;
}

// Ticket 36 — formulas.md §11: "owed by a customer = credit given −
// repayments." Unreversed repayments only, symmetric to how credit sums
// exclude void sales — a wrong repayment does not silently understate
// what a customer owes.
export async function sumRepaymentsForCustomer(db: PrismaClient, customerId: string): Promise<number> {
  const result = await db.repayment.aggregate({
    where: { customerId, reversed: false },
    _sum: { amountMinor: true },
  });
  return result._sum.amountMinor ?? 0;
}

export async function sumRepaymentsAcrossAllCustomers(db: PrismaClient): Promise<number> {
  const result = await db.repayment.aggregate({
    where: { reversed: false },
    _sum: { amountMinor: true },
  });
  return result._sum.amountMinor ?? 0;
}

export async function createRepaymentRecord(
  db: PrismaClient,
  data: { customerId: string; locationId: string; staffMemberId: string; amountMinor: number },
): Promise<Repayment> {
  return db.repayment.create({ data });
}

export async function findRepaymentsForCustomer(
  db: PrismaClient,
  customerId: string,
): Promise<Repayment[]> {
  return db.repayment.findMany({
    where: { customerId, reversed: false },
    orderBy: { occurredAt: "desc" },
  });
}

// Ticket 36's customer detail view: credit lines with the sale's
// occurredAt attached, so logic.ts can merge them with repayments into
// one chronological ledger.
export async function findCreditPaymentLinesForCustomer(
  db: PrismaClient,
  customerId: string,
): Promise<(PaymentLine & { occurredAt: Date })[]> {
  const lines = await db.paymentLine.findMany({
    where: { customerId, method: "credit" },
    include: { sale: true },
    orderBy: { sale: { occurredAt: "desc" } },
  });
  return lines.map(({ sale, ...line }) => ({ ...line, occurredAt: sale.occurredAt }));
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

// Ticket 25: formulas.md §5's transfer rate ("what its food sold for")
// and §7's restaurant revenue both need total recorded sales value at a
// location in a period, not scoped to one staff member. Non-void only —
// "cancelled entries count nowhere" (formulas.md's opening rule).
export async function sumSalesRevenueMinorAtLocationInPeriod(
  db: PrismaClient,
  locationId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<number> {
  const result = await db.sale.aggregate({
    where: { locationId, voided: false, occurredAt: { gt: periodStart, lte: periodEnd } },
    _sum: { totalMinor: true },
  });
  return result._sum.totalMinor ?? 0;
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
