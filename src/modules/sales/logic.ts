import type { PrismaClient } from "@/generated/prisma/client";
import {
  canAccessLocation,
  findCustomerById,
  findLocationById,
  type AuthenticatedStaff,
} from "@/modules/people";
import { findProductsByIds } from "@/modules/catalogue";
import { recordStockMovement } from "@/modules/stock";
import { isDayClosedFor } from "@/modules/cash";
import {
  createRepaymentRecord,
  createSaleRecord,
  findCreditPaymentLinesForCustomer,
  findRepaymentsForCustomer,
  findSaleById,
  findSalesForStaffToday,
  markSaleVoided,
  sumCreditAcrossAllCustomers,
  sumCreditForCustomer,
  sumCreditSaleQuantityByProductAtLocation,
  sumRepaymentsAcrossAllCustomers,
  sumRepaymentsForCustomer,
  sumSalesRevenueMinorAtLocationInPeriod,
} from "./queries";
import type { PaymentMethod, Repayment, Sale, SaleFulfilment } from "./schema";

export type RecordSaleResult =
  | { ok: true; sale: Sale }
  | {
      ok: false;
      reason:
        | "forbidden"
        | "invalid_quantity"
        | "inactive_product"
        | "payment_mismatch"
        | "credit_requires_customer"
        | "delivery_requires_customer"
        | "customer_not_found"
        | "unpaid_sale_not_allowed"
        | "not_found";
    }
  | { ok: false; reason: "insufficient_stock"; productId: string; available: number };

type PriceAndCreateSaleResult =
  | { ok: true; sale: Sale }
  | {
      ok: false;
      reason:
        | "invalid_quantity"
        | "inactive_product"
        | "payment_mismatch"
        | "credit_requires_customer"
        | "delivery_requires_customer"
        | "customer_not_found";
    }
  | { ok: false; reason: "insufficient_stock"; productId: string; available: number };

// Shared by recordCounterSale and recordSaleCorrection (ticket 45) — an
// ordinary sale and a backdated correction price, validate and decrement
// stock identically; only staffMemberId/occurredAt/effectiveAt/correction
// attribution differ, which the caller sets on top of this.
async function priceAndCreateSale(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  locationId: string,
  input: {
    fulfilment?: SaleFulfilment;
    customerId?: string | null;
    deliveryFeeMinor?: number | null;
    lines: { productId: string; quantity: number }[];
    paymentLines: { method: PaymentMethod; amountMinor: number; customerId?: string | null }[];
  },
  saleAttribution: {
    staffMemberId: string;
    occurredAt?: Date;
    effectiveAt?: Date;
    isCorrection?: boolean;
    correctionReason?: string;
  },
): Promise<PriceAndCreateSaleResult> {
  const fulfilment = input.fulfilment ?? "counter";

  if (input.lines.some((line) => line.quantity <= 0)) {
    return { ok: false, reason: "invalid_quantity" };
  }

  if (fulfilment === "delivery" && !input.customerId) {
    return { ok: false, reason: "delivery_requires_customer" };
  }

  const creditLines = input.paymentLines.filter((p) => p.method === "credit");
  if (creditLines.some((p) => !p.customerId)) {
    return { ok: false, reason: "credit_requires_customer" };
  }

  const customerIdsToCheck = new Set(creditLines.map((p) => p.customerId!));
  if (input.customerId) customerIdsToCheck.add(input.customerId);
  for (const id of customerIdsToCheck) {
    const customer = await findCustomerById(db, id);
    if (!customer) return { ok: false, reason: "customer_not_found" };
  }

  const products = await findProductsByIds(
    db,
    input.lines.map((line) => line.productId),
  );
  const productById = new Map(products.map((p) => [p.id, p]));

  const priced = input.lines.map((line) => {
    const product = productById.get(line.productId);
    return { line, product };
  });
  if (priced.some(({ product }) => !product || !product.active)) {
    return { ok: false, reason: "inactive_product" };
  }

  const saleLines = priced.map(({ line, product }) => ({
    productId: line.productId,
    quantity: line.quantity,
    priceMinor: product!.priceMinor ?? 0,
  }));

  const deliveryFeeMinor = fulfilment === "delivery" ? (input.deliveryFeeMinor ?? null) : null;
  const totalMinor =
    saleLines.reduce((sum, l) => sum + l.quantity * l.priceMinor, 0) + (deliveryFeeMinor ?? 0);
  const paidMinor = input.paymentLines.reduce((sum, p) => sum + p.amountMinor, 0);
  // docs/proposal.md §4 (revised 2026-08-13): a canteen cash/M-Pesa sale
  // carries no payment line at the point of entry — it's reconciled
  // against the day's declared handover totals instead of per sale, since
  // per-sale payment entry is too slow for rush trade. Zero payment lines
  // is that case and skips the match check entirely; any payment lines
  // present (a credit sale, or an ordinary restaurant sale) must still
  // balance exactly, unchanged from before.
  if (input.paymentLines.length > 0 && paidMinor !== totalMinor) {
    return { ok: false, reason: "payment_mismatch" };
  }

  // BUG-15: reject a line that oversells before writing anything, same
  // db.$transaction/sum-first/write-only-if-sufficient shape as
  // recordTransfer's insufficient_stock guard (stock/logic.ts). Sale
  // creation and stock decrement now happen in the one transaction, so a
  // failure partway through can't leave a Sale with no matching movement.
  return db.$transaction(async (tx) => {
    for (const { line, product } of priced) {
      if (product!.kind === "service") continue;
      const stock = await tx.stockMovement.aggregate({
        where: { productId: line.productId, locationId },
        _sum: { quantity: true },
      });
      const available = stock._sum.quantity ?? 0;
      if (available < line.quantity) {
        return { ok: false, reason: "insufficient_stock", productId: line.productId, available } as const;
      }
    }

    const sale = await createSaleRecord(tx, {
      locationId,
      staffMemberId: saleAttribution.staffMemberId,
      fulfilment,
      customerId: input.customerId ?? null,
      totalMinor,
      deliveryFeeMinor,
      lines: saleLines,
      paymentLines: input.paymentLines,
      occurredAt: saleAttribution.occurredAt,
      effectiveAt: saleAttribution.effectiveAt,
      isCorrection: saleAttribution.isCorrection,
      correctionReason: saleAttribution.correctionReason,
    });

    for (const { line, product } of priced) {
      if (product!.kind === "service") continue;
      await recordStockMovement(tx, requester, {
        productId: line.productId,
        locationId,
        quantity: -line.quantity,
        reason: "sold",
      });
    }

    return { ok: true, sale };
  });
}

export async function recordCounterSale(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  input: {
    fulfilment?: SaleFulfilment;
    customerId?: string | null;
    deliveryFeeMinor?: number | null;
    lines: { productId: string; quantity: number }[];
    paymentLines: { method: PaymentMethod; amountMinor: number; customerId?: string | null }[];
  },
): Promise<RecordSaleResult> {
  const locationId = requester.staff.locationId;
  if (!canAccessLocation(requester.staff.role, requester.staff.locationId, locationId)) {
    return { ok: false, reason: "forbidden" };
  }

  // proposal.md §2: the store manager "records delivery orders" but "does
  // not have access to counter sales" — the fulfilment kind, not the role
  // alone, decides access, since both paths share this one function.
  const fulfilment = input.fulfilment ?? "counter";
  if (requester.staff.role === "store_manager" && fulfilment !== "delivery") {
    return { ok: false, reason: "forbidden" };
  }

  // docs/proposal.md §4 (revised 2026-08-13): only the canteen records a
  // sale with no payment line at entry, reconciled later via the day's
  // handover total. The restaurant's per-sale payment discipline stays
  // enforced by the system, not just by the till UI always sending
  // payment lines — the exact gap that let BUG-10's double-count happen
  // undetected.
  if (input.paymentLines.length === 0) {
    const location = await findLocationById(db, locationId);
    if (location?.code !== "canteen") {
      return { ok: false, reason: "unpaid_sale_not_allowed" };
    }
  }

  return priceAndCreateSale(db, requester, locationId, input, {
    staffMemberId: requester.staff.id,
  });
}

export type RecordSaleCorrectionResult =
  | { ok: true; sale: Sale }
  | {
      ok: false;
      reason:
        | "forbidden"
        | "reason_required"
        | "invalid_quantity"
        | "inactive_product"
        | "payment_mismatch"
        | "credit_requires_customer"
        | "delivery_requires_customer"
        | "customer_not_found";
    }
  | { ok: false; reason: "insufficient_stock"; productId: string; available: number };

// architecture.md's "Changing a closed day": the owner does not edit a
// closed figure, she records a new entry with occurredAt = now and
// effectiveAt = the day it corrects. Reuses priceAndCreateSale — the same
// pricing/validation/stock-decrement path as an ordinary sale — so "stock
// adjusted accordingly" (proposal.md §8) comes for free. Purely additive:
// the corrected day's original Sale(s) are never touched.
export async function recordSaleCorrection(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  input: {
    staffMemberId: string;
    locationId: string;
    effectiveDate: Date;
    reason: string;
    fulfilment?: SaleFulfilment;
    customerId?: string | null;
    deliveryFeeMinor?: number | null;
    lines: { productId: string; quantity: number }[];
    paymentLines: { method: PaymentMethod; amountMinor: number; customerId?: string | null }[];
  },
): Promise<RecordSaleCorrectionResult> {
  if (!requireOwner(requester)) {
    return { ok: false, reason: "forbidden" };
  }

  if (input.reason.trim() === "") {
    return { ok: false, reason: "reason_required" };
  }

  return priceAndCreateSale(db, requester, input.locationId, input, {
    staffMemberId: input.staffMemberId,
    occurredAt: new Date(),
    effectiveAt: input.effectiveDate,
    isCorrection: true,
    correctionReason: input.reason.trim(),
  });
}

// formulas.md §11: "owed by a customer = credit given − repayments."
// Derived, never a stored figure — same discipline as CONTEXT.md's credit
// payment lines.
export async function getCustomerBalance(db: PrismaClient, customerId: string): Promise<number> {
  const [creditMinor, repaidMinor] = await Promise.all([
    sumCreditForCustomer(db, customerId),
    sumRepaymentsForCustomer(db, customerId),
  ]);
  return creditMinor - repaidMinor;
}

export type GetCustomerBalanceForOwnerResult =
  | { ok: true; balanceMinor: number }
  | { ok: false; reason: "forbidden" };

// Ticket 36 — the first people → sales cross-module read: People's
// Customers tab reads a per-customer balance through this owner-gated
// wrapper rather than calling the ungated getCustomerBalance directly,
// same "gate one layer below the route, inside logic.ts" rule as every
// other location/owner-scoped read in this codebase.
export async function getCustomerBalanceForOwner(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  customerId: string,
): Promise<GetCustomerBalanceForOwnerResult> {
  if (!requireOwner(requester)) {
    return { ok: false, reason: "forbidden" };
  }
  const balanceMinor = await getCustomerBalance(db, customerId);
  return { ok: true, balanceMinor };
}

export type RecordRepaymentResult =
  | { ok: true; repayment: Repayment }
  | { ok: false; reason: "forbidden" | "invalid_amount" | "customer_not_found" | "exceeds_balance" };

// formulas.md §11: "Any staff member may give credit or record a
// repayment" — any role, own location, same shape as recordCounterSale's
// gate. Rejects an amount exceeding the current balance, mirroring
// cash's recordDrawingRepayment/exceeds_outstanding — an overpayment
// isn't a state this tracker represents.
export async function recordRepayment(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  input: { customerId: string; amountMinor: number },
): Promise<RecordRepaymentResult> {
  const locationId = requester.staff.locationId;
  if (!canAccessLocation(requester.staff.role, requester.staff.locationId, locationId)) {
    return { ok: false, reason: "forbidden" };
  }

  if (input.amountMinor <= 0) {
    return { ok: false, reason: "invalid_amount" };
  }

  const customer = await findCustomerById(db, input.customerId);
  if (!customer) return { ok: false, reason: "customer_not_found" };

  const balance = await getCustomerBalance(db, input.customerId);
  if (input.amountMinor > balance) {
    return { ok: false, reason: "exceeds_balance" };
  }

  const repayment = await createRepaymentRecord(db, {
    customerId: input.customerId,
    locationId,
    staffMemberId: requester.staff.id,
    amountMinor: input.amountMinor,
  });

  return { ok: true, repayment };
}

export type CustomerCreditHistoryEntry =
  | { kind: "credit"; amountMinor: number; occurredAt: Date }
  | { kind: "repayment"; amountMinor: number; occurredAt: Date };

export type GetCustomerCreditHistoryResult =
  | { ok: true; entries: CustomerCreditHistoryEntry[] }
  | { ok: false; reason: "forbidden" };

// Ticket 36's customer detail view: credit lines and repayments merged
// into one chronological ledger, newest first — the movement that
// changes the balance shown alongside the arithmetic it changes.
export async function getCustomerCreditHistory(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  customerId: string,
): Promise<GetCustomerCreditHistoryResult> {
  if (!requireOwner(requester)) {
    return { ok: false, reason: "forbidden" };
  }

  const [creditLines, repayments] = await Promise.all([
    findCreditPaymentLinesForCustomer(db, customerId),
    findRepaymentsForCustomer(db, customerId),
  ]);

  const entries: CustomerCreditHistoryEntry[] = [
    ...creditLines.map((line) => ({
      kind: "credit" as const,
      amountMinor: line.amountMinor,
      occurredAt: line.occurredAt,
    })),
    ...repayments.map((repayment) => ({
      kind: "repayment" as const,
      amountMinor: repayment.amountMinor,
      occurredAt: repayment.occurredAt,
    })),
  ].sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());

  return { ok: true, entries };
}

// Ticket 24: stock's count-derived-sales formula reads this directly — the
// caller (recordStockCount, already permission-checked) is trusted, so
// this has no access check of its own, same as catalogue's
// findProductsByIds being called from stock/logic.ts.
export async function creditSaleQuantityByProductAtLocation(
  db: PrismaClient,
  locationId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<{ productId: string; quantity: number }[]> {
  return sumCreditSaleQuantityByProductAtLocation(db, locationId, periodStart, periodEnd);
}

export type ListTodaysSalesResult =
  | { ok: true; sales: Sale[] }
  | { ok: false; reason: "forbidden" };

// Ticket 09: own sales only, today only, own location only. Never another
// staff member's sales — that's not a location-access question, so it's
// enforced by scoping the query to requester.staff.id rather than by a
// forbidden check.
export async function listTodaysSalesForStaff(
  db: PrismaClient,
  requester: AuthenticatedStaff,
): Promise<ListTodaysSalesResult> {
  const locationId = requester.staff.locationId;
  if (!canAccessLocation(requester.staff.role, requester.staff.locationId, locationId)) {
    return { ok: false, reason: "forbidden" };
  }

  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const sales = await findSalesForStaffToday(db, requester.staff.id, locationId, dayStart, dayEnd);
  return { ok: true, sales };
}

export type VoidSaleResult =
  | { ok: true; sale: Sale }
  | {
      ok: false;
      reason: "forbidden" | "not_found" | "already_voided" | "not_same_day" | "day_closed";
    };

// architecture.md: "any role," same day, before close. Post-close is
// owner-only — see cash's isDayClosedFor, keyed to the sale's own staff
// member/location, since closing is per-person.
export async function voidSale(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  saleId: string,
): Promise<VoidSaleResult> {
  const sale = await findSaleById(db, saleId);
  if (!sale) return { ok: false, reason: "not_found" };

  if (!canAccessLocation(requester.staff.role, requester.staff.locationId, sale.locationId)) {
    return { ok: false, reason: "forbidden" };
  }

  if (sale.voided) return { ok: false, reason: "already_voided" };

  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);

  if (requester.staff.role !== "owner") {
    // proposal.md §8: "A staff member may cancel an entry they made" —
    // not a colleague's, at the same location.
    if (sale.staffMemberId !== requester.staff.id) return { ok: false, reason: "forbidden" };
    if (sale.occurredAt < dayStart) return { ok: false, reason: "not_same_day" };
    const closed = await isDayClosedFor(db, sale.staffMemberId, sale.locationId, dayStart);
    if (closed) return { ok: false, reason: "day_closed" };
  }

  const products = await findProductsByIds(
    db,
    sale.lines.map((line) => line.productId),
  );
  const productById = new Map(products.map((p) => [p.id, p]));

  for (const line of sale.lines) {
    if (productById.get(line.productId)?.kind === "service") continue;
    await recordStockMovement(db, requester, {
      productId: line.productId,
      locationId: sale.locationId,
      quantity: line.quantity,
      reason: "corrected",
    });
  }

  const voided = await markSaleVoided(db, saleId, requester.staff.id);
  return { ok: true, sale: voided };
}

export type SalesRevenueResult =
  | { ok: true; totalMinor: number }
  | { ok: false; reason: "forbidden" };

// Ticket 25 — formulas.md §5's transfer rate ("what its food sold for")
// and §7's restaurant revenue ("recorded sales at the restaurant").
// Owner-gated like every other location-scoped read here; owner passes
// canAccessLocation for any location.
export async function getSalesRevenueAtLocation(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  locationId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<SalesRevenueResult> {
  if (!canAccessLocation(requester.staff.role, requester.staff.locationId, locationId)) {
    return { ok: false, reason: "forbidden" };
  }
  const totalMinor = await sumSalesRevenueMinorAtLocationInPeriod(
    db,
    locationId,
    periodStart,
    periodEnd,
  );
  return { ok: true, totalMinor };
}

function requireOwner(requester: AuthenticatedStaff): boolean {
  return requester.staff.role === "owner";
}

export type TotalCustomerBalanceResult =
  | { ok: true; totalMinor: number }
  | { ok: false; reason: "forbidden" };

// Ticket 33 — Dashboard's "Owed to you"; ticket 36 also reuses this for
// the Customers tab's summary total, "don't recompute it a second way."
// Credit given minus repayments, summed across all customers, both
// locations, per formulas.md §11. Owner-only, same access pattern as
// cash's getRunningCashBalance.
export async function getTotalCustomerBalance(
  db: PrismaClient,
  requester: AuthenticatedStaff,
): Promise<TotalCustomerBalanceResult> {
  if (!requireOwner(requester)) {
    return { ok: false, reason: "forbidden" };
  }
  const [creditMinor, repaidMinor] = await Promise.all([
    sumCreditAcrossAllCustomers(db),
    sumRepaymentsAcrossAllCustomers(db),
  ]);
  return { ok: true, totalMinor: creditMinor - repaidMinor };
}
