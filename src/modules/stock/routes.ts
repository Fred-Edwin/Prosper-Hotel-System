import { db } from "@/shared/db";
import { getSession, listLocations } from "@/modules/people";
import {
  cancelPendingTransfer,
  confirmTransfer,
  correctStockCount,
  getCurrentStockAtLocation,
  getIngredientStockValuesAtLocation,
  getLowStockItems,
  getPendingTransfersAtLocation,
  getConfirmedTransfersSentFromLocation,
  getProductStockValueAtLocation,
  getSellableProductsAtLocation,
  getTransferableItems,
  getLatestStockCount,
  getStockCount,
  recordIngredientIssue,
  recordIngredientReceipt,
  recordNonSalesConsumption,
  recordProduction,
  recordStockCount,
  recordTransfer,
  recordTransfers,
  reverseTransfer,
  listTransfersAtLocation,
} from "./logic";

export async function stockAtLocationRoute(
  _request: Request,
  { params }: { params: Promise<{ locationId: string }> },
): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: "unauthenticated" }, { status: 401 });

  const { locationId } = await params;
  const result = await getCurrentStockAtLocation(db, session, locationId);
  if (!result.ok) {
    const status = result.reason === "not_found" ? 404 : 403;
    return Response.json({ error: result.reason }, { status });
  }

  return Response.json({ levels: result.levels });
}

// Backs GET /api/catalogue/products/active?locationId=<id> — every staff
// member needs to pick a product when recording a sale, receipt, or
// wastage entry. Lives here rather than in catalogue/routes.ts because it
// depends on stock's movement ledger (docs/architecture.md's "Product home
// location" note), and catalogue must not import from stock (stock already
// imports catalogue — see docs/conventions.md's cross-module rule). The
// route's URL stays catalogue-namespaced; only the thin Next.js file at
// that path re-exports this instead.
export async function sellableProductsAtLocationRoute(request: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: "unauthenticated" }, { status: 401 });

  const locationId = new URL(request.url).searchParams.get("locationId");
  if (!locationId) return Response.json({ error: "location_required" }, { status: 400 });

  const result = await getSellableProductsAtLocation(db, session, locationId);
  if (!result.ok) {
    const status = result.reason === "not_found" ? 404 : 403;
    return Response.json({ error: result.reason }, { status });
  }

  return Response.json({ products: result.products });
}

export async function stockValueAtLocationRoute(
  _request: Request,
  { params }: { params: Promise<{ locationId: string }> },
): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: "unauthenticated" }, { status: 401 });

  const { locationId } = await params;
  const result = await getProductStockValueAtLocation(db, session, locationId);
  if (!result.ok) {
    return Response.json({ error: result.reason }, { status: 403 });
  }

  return Response.json({ values: result.values });
}

export async function ingredientStockValueAtLocationRoute(
  _request: Request,
  { params }: { params: Promise<{ locationId: string }> },
): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: "unauthenticated" }, { status: 401 });

  const { locationId } = await params;
  const result = await getIngredientStockValuesAtLocation(db, session, locationId);
  if (!result.ok) {
    return Response.json({ error: result.reason }, { status: 403 });
  }

  return Response.json({ values: result.values });
}

export async function lowStockAtLocationRoute(
  _request: Request,
  { params }: { params: Promise<{ locationId: string }> },
): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: "unauthenticated" }, { status: 401 });

  const { locationId } = await params;
  const result = await getLowStockItems(db, session, locationId);
  if (!result.ok) {
    const status = result.reason === "not_found" ? 404 : 403;
    return Response.json({ error: result.reason }, { status });
  }

  return Response.json({ items: result.items });
}

function writeStatus(reason: string): number {
  return reason === "forbidden" ? 403 : 400;
}

export async function recordIngredientReceiptRoute(request: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: "unauthenticated" }, { status: 401 });

  const body = await request.json();
  const result = await recordIngredientReceipt(db, session, {
    locationId: session.staff.locationId,
    lines: body.lines,
  });
  if (!result.ok) {
    return Response.json({ error: result.reason }, { status: writeStatus(result.reason) });
  }

  return Response.json({ movements: result.movements });
}

export async function recordTransferRoute(request: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: "unauthenticated" }, { status: 401 });

  const body = await request.json();
  const common = {
    fromLocationId: session.staff.locationId,
    toLocationId: body.toLocationId,
  };
  const result = Array.isArray(body.lines)
    ? await recordTransfers(db, session, { ...common, lines: body.lines })
    : await recordTransfer(db, session, { ...common, itemType: body.itemType, itemId: body.itemId, quantity: body.quantity });
  if (!result.ok) {
    return Response.json({ error: result.reason }, { status: writeStatus(result.reason) });
  }

  return Response.json({ transfers: result.transfers });
}

// Added 2026-08-13 — REQ-02 Part A. The receiving screen's queue.
export async function pendingTransfersRoute(): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: "unauthenticated" }, { status: 401 });
  const result = await getPendingTransfersAtLocation(db, session, session.staff.locationId);
  if (!result.ok) return Response.json({ error: result.reason }, { status: 403 });
  return Response.json({ transfers: result.transfers });
}

export async function confirmedTransfersSentRoute(): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: "unauthenticated" }, { status: 401 });
  const result = await getConfirmedTransfersSentFromLocation(db, session, session.staff.locationId);
  if (!result.ok) return Response.json({ error: result.reason }, { status: 403 });
  return Response.json({ transfers: result.transfers });
}

export async function confirmTransferRoute(
  request: Request,
  { params }: { params: Promise<{ transferId: string }> },
): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: "unauthenticated" }, { status: 401 });
  const { transferId } = await params;
  const body = await request.json();
  const result = await confirmTransfer(db, session, {
    transferId,
    confirmedQuantity: body.confirmedQuantity,
  });
  if (!result.ok) return Response.json({ error: result.reason }, { status: writeStatus(result.reason) });
  return Response.json({ transfer: result.transfer });
}

export async function cancelPendingTransferRoute(
  _request: Request,
  { params }: { params: Promise<{ transferId: string }> },
): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: "unauthenticated" }, { status: 401 });
  const { transferId } = await params;
  const result = await cancelPendingTransfer(db, session, transferId);
  if (!result.ok) return Response.json({ error: result.reason }, { status: writeStatus(result.reason) });
  return Response.json({ transfer: result.transfer });
}

export async function transferableItemsRoute(): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: "unauthenticated" }, { status: 401 });
  const result = await getTransferableItems(db, session, session.staff.locationId);
  if (!result.ok) return Response.json({ error: result.reason }, { status: 403 });
  const locations = await listLocations(db);
  return Response.json({
    items: result.items,
    toLocation: locations.find((location) => location.id !== session.staff.locationId) ?? null,
  });
}

export async function transferHistoryRoute(): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: "unauthenticated" }, { status: 401 });
  const result = await listTransfersAtLocation(db, session);
  if (!result.ok) return Response.json({ error: result.reason }, { status: 403 });
  return Response.json({ transfers: result.transfers });
}

export async function reverseTransferRoute(_request: Request, { params }: { params: Promise<{ transferId: string }> }): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: "unauthenticated" }, { status: 401 });
  const { transferId } = await params;
  const result = await reverseTransfer(db, session, transferId);
  if (!result.ok) return Response.json({ error: result.reason }, { status: writeStatus(result.reason) });
  return Response.json({ movements: result.movements });
}

export async function recordIngredientIssueRoute(request: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: "unauthenticated" }, { status: 401 });

  const body = await request.json();
  const result = await recordIngredientIssue(db, session, {
    locationId: session.staff.locationId,
    lines: body.lines,
  });
  if (!result.ok) {
    return Response.json({ error: result.reason }, { status: writeStatus(result.reason) });
  }

  return Response.json({ movements: result.movements });
}

export async function recordProductionRoute(request: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: "unauthenticated" }, { status: 401 });

  const body = await request.json();
  const result = await recordProduction(db, session, {
    locationId: session.staff.locationId,
    lines: body.lines,
  });
  if (!result.ok) {
    return Response.json({ error: result.reason }, { status: writeStatus(result.reason) });
  }

  return Response.json({ movements: result.movements });
}

export async function recordNonSalesConsumptionRoute(request: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: "unauthenticated" }, { status: 401 });

  const body = await request.json();
  const result = await recordNonSalesConsumption(db, session, {
    itemType: body.itemType,
    itemId: body.itemId,
    locationId: session.staff.locationId,
    quantity: body.quantity,
    category: body.category,
  });
  if (!result.ok) {
    return Response.json({ error: result.reason }, { status: writeStatus(result.reason) });
  }

  return Response.json({ movement: result.movement });
}

export async function recordStockCountRoute(request: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: "unauthenticated" }, { status: 401 });

  const body = await request.json();
  const result = await recordStockCount(db, session, {
    locationId: session.staff.locationId,
    lines: body.lines,
  });
  if (!result.ok) {
    return Response.json({ error: result.reason }, { status: writeStatus(result.reason) });
  }

  return Response.json({ count: result.count });
}

export async function stockCountRoute(
  _request: Request,
  { params }: { params: Promise<{ countId: string }> },
): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: "unauthenticated" }, { status: 401 });

  const { countId } = await params;
  const result = await getStockCount(db, session, countId);
  if (!result.ok) {
    const status = result.reason === "not_found" ? 404 : 403;
    return Response.json({ error: result.reason }, { status });
  }

  return Response.json({ count: result.count });
}

export async function latestStockCountRoute(
  _request: Request,
  { params }: { params: Promise<{ locationId: string }> },
): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: "unauthenticated" }, { status: 401 });

  const { locationId } = await params;
  const result = await getLatestStockCount(db, session, locationId);
  if (!result.ok) {
    return Response.json({ error: result.reason }, { status: 403 });
  }

  return Response.json({ count: result.count });
}

export async function correctStockCountRoute(
  request: Request,
  { params }: { params: Promise<{ countId: string }> },
): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: "unauthenticated" }, { status: 401 });

  const { countId } = await params;
  const body = await request.json();
  const result = await correctStockCount(db, session, {
    stockCountId: countId,
    lineId: body.lineId,
    correctedQuantity: body.correctedQuantity,
  });
  if (!result.ok) {
    const status = result.reason === "not_found" ? 404 : result.reason === "forbidden" ? 403 : 400;
    return Response.json({ error: result.reason }, { status });
  }

  return Response.json({ ok: true });
}
