import { db } from "@/shared/db";
import { getSession } from "@/modules/people";
import { getCurrentStockAtLocation } from "./logic";

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
