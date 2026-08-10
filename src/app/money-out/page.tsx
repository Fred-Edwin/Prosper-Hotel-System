import { redirect } from "next/navigation";
import { getSession } from "@/modules/people";
import { MoneyOutDestination } from "@/modules/cash/ui/money-out-destination";

// Owner-only, same pattern as catalogue/page.tsx. Only the owner pays money
// out (docs/architecture.md), so this destination is hers alone.
export default async function MoneyOutPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.staff.role !== "owner") redirect("/staff");

  return <MoneyOutDestination staffName={session.staff.name} />;
}
