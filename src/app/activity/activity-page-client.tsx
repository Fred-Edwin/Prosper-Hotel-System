"use client";

/**
 * Client half of the Activity page. `getDestinations()` returns Lucide
 * icon components, not serializable across the server/client boundary —
 * same split as ledger-page-client.tsx.
 */

import { AdminShell } from "@/components/layout/admin-shell";
import { getDestinations } from "@/components/layout/admin-nav";
import { Activity } from "@/modules/reporting/ui/activity";

export function ActivityPageClient({ staffName }: { staffName: string }) {
  return (
    <AdminShell
      destinations={getDestinations()}
      active="activity"
      staffName={staffName}
      title="Activity"
      subtitle="Every change, who made it, when"
    >
      <Activity />
    </AdminShell>
  );
}
