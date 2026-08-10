"use client";

/**
 * Client half of the Dashboard page. `getDestinations()` returns Lucide
 * icon components, not serializable across the server/client boundary —
 * same split as catalogue-page-client.tsx.
 */

import { AdminShell } from "@/components/layout/admin-shell";
import { getDestinations } from "@/components/layout/admin-nav";
import { DashboardBody } from "./dashboard-body";

export function DashboardPageClient({ staffName }: { staffName: string }) {
  return (
    <AdminShell
      destinations={getDestinations()}
      active="dashboard"
      staffName={staffName}
      title="Dashboard"
      subtitle="Today's figures and what needs you"
    >
      <DashboardBody />
    </AdminShell>
  );
}
