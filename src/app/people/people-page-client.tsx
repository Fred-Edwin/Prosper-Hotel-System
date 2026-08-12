"use client";

/**
 * Client half of the People page. `getDestinations()` returns Lucide icon
 * components, which are not serializable across the server/client
 * boundary — same split as catalogue-page-client.tsx.
 */

import { AdminShell } from "@/components/layout/admin-shell";
import { getDestinations } from "@/components/layout/admin-nav";
import { HelpPanel } from "@/components/patterns/help-panel";
import { StaffDestination } from "@/modules/people/ui/staff-destination";

export function PeoplePageClient({ staffName }: { staffName: string }) {
  return (
    <AdminShell
      destinations={getDestinations()}
      active="people"
      staffName={staffName}
      title="People"
      subtitle="Staff and customers — who is owed, and who owes"
      actions={<HelpPanel topic="people" />}
    >
      <StaffDestination />
    </AdminShell>
  );
}
