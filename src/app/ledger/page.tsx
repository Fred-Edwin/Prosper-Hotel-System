import { redirect } from "next/navigation";
import { getSession } from "@/modules/people";
import { LedgerPageClient } from "./ledger-page-client";

// Owner-only, same pattern as catalogue/page.tsx. The ledger is the "why is
// this number what it is" view over sales, stock and cash — financial data.
export default async function LedgerPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.staff.role !== "owner") redirect("/staff");

  return <LedgerPageClient staffName={session.staff.name} />;
}
