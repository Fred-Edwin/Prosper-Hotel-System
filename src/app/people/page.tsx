import { redirect } from "next/navigation";
import { getSession } from "@/modules/people";
import { NotBuiltPageClient } from "../not-built-page-client";

// Owner-only, same pattern as catalogue/page.tsx. Staff pay, rates and
// customer debts are financial/managerial data the owner manages.
export default async function PeoplePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.staff.role !== "owner") redirect("/staff");

  return (
    <NotBuiltPageClient
      staffName={session.staff.name}
      active="people"
      title="People"
      subtitle="Staff and customers — who is owed, and who owes"
    />
  );
}
