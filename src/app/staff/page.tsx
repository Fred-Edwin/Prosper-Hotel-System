import { redirect } from "next/navigation";
import { getSession } from "@/modules/people";
import { getTodaysHandoverForStaff } from "@/modules/cash";
import { db } from "@/shared/db";
import { StaffPageClient } from "./staff-page-client";
import type { StaffRole } from "@/components/layout/staff-nav";

// docs/architecture.md: the owner works any position when present. The
// staff shell has no dedicated "owner" nav — she gets the broadest existing
// list (store-manager's) until a ticket decides she needs her own.
function toShellRole(role: string): StaffRole {
  if (role === "store_manager" || role === "owner") return "store-manager";
  if (role === "attendant") return "attendant";
  return "cashier";
}

export default async function StaffPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const handoverResult = await getTodaysHandoverForStaff(db, session);
  const handedOverToday = handoverResult.ok && handoverResult.handover !== null;

  return (
    <StaffPageClient
      staffName={session.staff.name}
      locationId={session.location.id}
      locationName={session.location.name}
      role={toShellRole(session.staff.role)}
      isOwner={session.staff.role === "owner"}
      handedOverToday={handedOverToday}
    />
  );
}
