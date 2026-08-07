import { redirect } from "next/navigation";
import { getSession } from "@/modules/people";
import { NotBuiltPageClient } from "../not-built-page-client";

// Owner-only, same pattern as catalogue/page.tsx. Dashboard shows profit and
// cash position — financial data, gated even though it's a placeholder today.
export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.staff.role !== "owner") redirect("/staff");

  return (
    <NotBuiltPageClient
      staffName={session.staff.name}
      active="dashboard"
      title="Dashboard"
      subtitle="Today's figures and what needs you"
    />
  );
}
