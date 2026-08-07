import { db } from "@/shared/db";
import { getSession } from "@/modules/people";
import { recordCounterSale } from "./logic";

function writeStatus(reason: string): number {
  if (reason === "forbidden") return 403;
  return 400;
}

export async function recordCounterSaleRoute(request: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: "unauthenticated" }, { status: 401 });

  const body = await request.json();
  const result = await recordCounterSale(db, session, {
    lines: body.lines,
    paymentLines: body.paymentLines,
  });
  if (!result.ok) {
    return Response.json({ error: result.reason }, { status: writeStatus(result.reason) });
  }
  return Response.json({ sale: result.sale });
}
