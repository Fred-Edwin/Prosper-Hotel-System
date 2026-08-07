import type { PrismaClient } from "@/generated/prisma/client";
import { canAccessLocation, type AuthenticatedStaff } from "@/modules/people";
import { findProductsByIds } from "@/modules/catalogue";
import { recordStockMovement } from "@/modules/stock";
import { createSaleRecord } from "./queries";
import type { PaymentMethod, Sale } from "./schema";

export type RecordSaleResult =
  | { ok: true; sale: Sale }
  | {
      ok: false;
      reason: "forbidden" | "invalid_quantity" | "inactive_product" | "payment_mismatch";
    };

export async function recordCounterSale(
  db: PrismaClient,
  requester: AuthenticatedStaff,
  input: {
    lines: { productId: string; quantity: number }[];
    paymentLines: { method: PaymentMethod; amountMinor: number }[];
  },
): Promise<RecordSaleResult> {
  const locationId = requester.staff.locationId;
  if (!canAccessLocation(requester.staff.role, requester.staff.locationId, locationId)) {
    return { ok: false, reason: "forbidden" };
  }

  if (input.lines.some((line) => line.quantity <= 0)) {
    return { ok: false, reason: "invalid_quantity" };
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

  const totalMinor = saleLines.reduce((sum, l) => sum + l.quantity * l.priceMinor, 0);
  const paidMinor = input.paymentLines.reduce((sum, p) => sum + p.amountMinor, 0);
  if (paidMinor !== totalMinor) {
    return { ok: false, reason: "payment_mismatch" };
  }

  const sale = await createSaleRecord(db, {
    locationId,
    staffMemberId: requester.staff.id,
    fulfilment: "counter",
    totalMinor,
    lines: saleLines,
    paymentLines: input.paymentLines,
  });

  for (const { line, product } of priced) {
    if (product!.kind === "service") continue;
    await recordStockMovement(db, requester, {
      productId: line.productId,
      locationId,
      quantity: -line.quantity,
      reason: "sold",
    });
  }

  return { ok: true, sale };
}
