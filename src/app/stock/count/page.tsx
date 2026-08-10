import { redirect } from "next/navigation";
import { getSession } from "@/modules/people";
import { StockCountPageClient } from "./stock-count-page-client";

// Owner-only, same pattern as /stock. The owner reaches the recording
// flow from the admin Stock destination rather than the staff shell (ticket
// 20's corrected entry point) — a lighter linked-out route rather than
// embedding the phone-shaped picker directly in the desktop page, so the
// recording composition stays phone-first rather than being squeezed into
// the wide admin frame it wasn't designed for.
export default async function StockCountPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.staff.role !== "owner") redirect("/staff");

  return <StockCountPageClient staffName={session.staff.name} />;
}
