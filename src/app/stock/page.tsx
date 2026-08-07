import { redirect } from "next/navigation";
import { getSession } from "@/modules/people";
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

  return (
    <StockPageClient
      staffName={session.staff.name}
      locationId={session.location.id}
    />
  );
}
