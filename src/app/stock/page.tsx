import { redirect } from "next/navigation";
import { getSession, listLocations } from "@/modules/people";
import { db } from "@/shared/db";
import { StockPageClient } from "./stock-page-client";

// Owner-only, same pattern as catalogue/page.tsx. Stock quantities aren't
// cost-sensitive the way catalogue is, but every other admin destination is
// owner-gated as a stopgap and this stays consistent with that until
// per-destination gating is decided (docs/design.md: "do not gate shells by
// role" leaves this genuinely undecided, not settled).
export default async function StockPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.staff.role !== "owner") redirect("/staff");

  // Ticket 44: the owner needs to switch between both locations from this
  // one page — low stock's basis (on-hand vs. latest-count) depends on
  // which location is being viewed.
  const locations = await listLocations(db);

  return (
    <StockPageClient
      staffName={session.staff.name}
      locations={locations}
      initialLocationId={session.location.id}
    />
  );
}
