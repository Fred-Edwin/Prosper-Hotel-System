"use client";

/**
 * Shared client half for admin destinations with no module built yet.
 * `getDestinations()` returns Lucide icon components, not serializable
 * across the server/client boundary — same split as catalogue-page-client.tsx.
 */

import { AdminShell } from "@/components/layout/admin-shell";
import { getDestinations } from "@/components/layout/admin-nav";
import { NotBuilt } from "@/components/patterns/states";

export function NotBuiltPageClient({
  staffName,
  active,
  title,
  subtitle,
}: {
  staffName: string;
  active: string;
  title: string;
  subtitle: string;
}) {
  return (
    <AdminShell
      destinations={getDestinations()}
      active={active}
      staffName={staffName}
      title={title}
      subtitle={subtitle}
    >
      <NotBuilt destination={title} />
    </AdminShell>
  );
}
