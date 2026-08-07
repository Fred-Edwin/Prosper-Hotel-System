import { redirect } from "next/navigation";
import { getSession } from "@/modules/people";
import { CataloguePageClient } from "./catalogue-page-client";

// Owner-only destination — matches every write in tickets 01–02 being
// owner-gated, and catalogue data (ingredient cost, recipe cost) is not
// shown to staff roles. Denied at the route, not just hidden from nav.
export default async function CataloguePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.staff.role !== "owner") redirect("/staff");

  return <CataloguePageClient staffName={session.staff.name} />;
}
