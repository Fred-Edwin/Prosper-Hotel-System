import { redirect } from "next/navigation";
import { getSession } from "@/modules/people";
import { DashboardPageClient } from "./dashboard-page-client";

// Owner-only, same pattern as catalogue/page.tsx. Dashboard shows profit and
// cash position — financial data, gated even though most sections are still
// placeholders (ticket 14 built Handover only; see dashboard-body.tsx).
export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.staff.role !== "owner") redirect("/staff");

  return <DashboardPageClient staffName={session.staff.name} />;
}
