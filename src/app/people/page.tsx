import { redirect } from "next/navigation";
import { getSession } from "@/modules/people";
import { PeoplePageClient } from "./people-page-client";

// Owner-only, same pattern as catalogue/page.tsx. Staff pay, rates and
// customer debts are financial/managerial data the owner manages.
export default async function PeoplePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.staff.role !== "owner") redirect("/staff");

  return <PeoplePageClient staffName={session.staff.name} />;
}
