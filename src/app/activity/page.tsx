import { redirect } from "next/navigation";
import { getSession } from "@/modules/people";
import { ActivityPageClient } from "./activity-page-client";

// Owner-only, same pattern as catalogue/page.tsx. The audit trail is a
// managerial view over every change across the business.
export default async function ActivityPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.staff.role !== "owner") redirect("/staff");

  return <ActivityPageClient staffName={session.staff.name} />;
}
