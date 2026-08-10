import { db } from "@/shared/db";
import { getSession } from "@/modules/people";
import {
  correctStockCount,
  getCurrentStockAtLocation,
  getStockCount,
  recordIngredientIssue,
  recordIngredientReceipt,
  recordNonSalesConsumption,
  recordProduction,
  recordStockCount,
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
    productId: body.productId,
    locationId: session.staff.locationId,
    quantity: body.quantity,
  });
  if (!result.ok) {
    return Response.json({ error: result.reason }, { status: writeStatus(result.reason) });
  }

  return Response.json({ movement: result.movement });
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
  });
  if (!result.ok) {
    const status = result.reason === "not_found" ? 404 : result.reason === "forbidden" ? 403 : 400;
    return Response.json({ error: result.reason }, { status });
  }

  return Response.json({ ok: true });
}
