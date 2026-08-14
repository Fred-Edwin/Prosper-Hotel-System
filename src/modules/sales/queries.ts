import type {
  Prisma,
  PrismaClient,
  Sale as PrismaSale,
  SaleLine as PrismaSaleLine,
  PaymentLine as PrismaPaymentLine,
  Repayment as PrismaRepayment,
} from "@/generated/prisma/client";
import type { PaymentLine, PaymentMethod, Repayment, Sale, SaleFulfilment } from "./schema";

// createSaleRecord is called from inside a db.$transaction for BUG-15's
// overselling guard (sales/logic.ts), so this needs to accept a
// transaction client, not just the top-level PrismaClient.
type Db = PrismaClient | Prisma.TransactionClient;

// Prisma returns Decimal fields (quantity, and every *Minor money field) as
// Decimal.js objects, not plain numbers — converted here so the rest of the
// app keeps using plain numbers as before the Int -> Decimal(10,2)
// migrations.
function toSale(
  row: PrismaSale & { lines: PrismaSaleLine[]; paymentLines: PrismaPaymentLine[] },
): Sale {
  return {
    ...row,
    totalMinor: row.totalMinor.toNumber(),
    deliveryFeeMinor: row.deliveryFeeMinor?.toNumber() ?? null,
    lines: row.lines.map((line) => ({
      ...line,
      quantity: line.quantity.toNumber(),
      priceMinor: line.priceMinor.toNumber(),
    })),
    paymentLines: row.paymentLines.map((line) => ({
      ...line,
      amountMinor: line.amountMinor.toNumber(),
    })),
  };
}

function toRepayment(row: PrismaRepayment): Repayment {
  return { ...row, amountMinor: row.amountMinor.toNumber() };
}

export async function findSaleById(db: PrismaClient, saleId: string): Promise<Sale | null> {
  const row = await db.sale.findUnique({
    where: { id: saleId },
    include: { lines: true, paymentLines: true },
  });
  return row && toSale(row);
}

export async function markSaleVoided(
  db: PrismaClient,
  saleId: string,
  voidedBy: string,
): Promise<Sale> {
  const row = await db.sale.update({
    where: { id: saleId },
    data: { voided: true, voidedAt: new Date(), voidedBy },
    include: { lines: true, paymentLines: true },
  });
  return toSale(row);
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
  const row = await db.sale.create({
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
  return toSale(row);
}

// Ticket 45 — Activity's sale/void/correction rows: every sale across
// both locations in a period, including voided (Activity shows voids as
// their own kind, so they must not be filtered out here).
export async function listSalesInPeriod(
  db: PrismaClient,
  periodStart: Date,
  periodEnd: Date,
): Promise<Sale[]> {
  const rows = await db.sale.findMany({
    where: { occurredAt: { gt: periodStart, lte: periodEnd } },
    include: { lines: true, paymentLines: true },
    orderBy: { occurredAt: "desc" },
  });
  return rows.map(toSale);
}

// Non-void only, via the sale relation — "cancelled entries count
// nowhere" (formulas.md's opening rule); BUG-12 was this filter missing.
export async function sumCreditForCustomer(db: PrismaClient, customerId: string): Promise<number> {
  const result = await db.paymentLine.aggregate({
    where: { customerId, method: "credit", sale: { voided: false } },
    _sum: { amountMinor: true },
  });
  return result._sum.amountMinor?.toNumber() ?? 0;
}

// Ticket 33: "Owed to you" on the Dashboard — the sum across all
// customers, both locations, per formulas.md §11. Non-void only, via the
// sale relation — BUG-12 was this filter missing.
export async function sumCreditAcrossAllCustomers(db: PrismaClient): Promise<number> {
  const result = await db.paymentLine.aggregate({
    where: { method: "credit", sale: { voided: false } },
    _sum: { amountMinor: true },
  });
  return result._sum.amountMinor?.toNumber() ?? 0;
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
  return result._sum.amountMinor?.toNumber() ?? 0;
}

export async function sumRepaymentsAcrossAllCustomers(db: PrismaClient): Promise<number> {
  const result = await db.repayment.aggregate({
    where: { reversed: false },
    _sum: { amountMinor: true },
  });
  return result._sum.amountMinor?.toNumber() ?? 0;
}

export async function createRepaymentRecord(
  db: PrismaClient,
  data: { customerId: string; locationId: string; staffMemberId: string; amountMinor: number },
): Promise<Repayment> {
  const row = await db.repayment.create({ data });
  return toRepayment(row);
}

export async function findRepaymentsForCustomer(
  db: PrismaClient,
  customerId: string,
): Promise<Repayment[]> {
  const rows = await db.repayment.findMany({
    where: { customerId, reversed: false },
    orderBy: { occurredAt: "desc" },
  });
  return rows.map(toRepayment);
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
  return lines.map(({ sale, ...line }) => ({
    ...line,
    amountMinor: line.amountMinor.toNumber(),
    occurredAt: sale.occurredAt,
  }));
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
        (quantityByProduct.get(line.productId) ?? 0) + line.quantity.toNumber(),
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
  return result._sum.totalMinor?.toNumber() ?? 0;
}

export async function findSalesForStaffToday(
  db: PrismaClient,
  staffMemberId: string,
  locationId: string,
  dayStart: Date,
  dayEnd: Date,
): Promise<Sale[]> {
  const rows = await db.sale.findMany({
    where: {
      staffMemberId,
      locationId,
      occurredAt: { gte: dayStart, lt: dayEnd },
    },
    include: { lines: true, paymentLines: true },
    orderBy: { occurredAt: "desc" },
  });
  return rows.map(toSale);
}
