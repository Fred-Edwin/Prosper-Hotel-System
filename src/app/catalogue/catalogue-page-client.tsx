"use client";

/**
 * Client half of the Catalogue page. `getDestinations()` returns Lucide
 * icon components, which are not serializable across the server/client
 * boundary — the server page passes only plain data (staffName) and this
 * builds the nav itself, same split as staff-page-client.tsx.
 */

import { AdminShell } from "@/components/layout/admin-shell";
import { getDestinations } from "@/components/layout/admin-nav";
import { CatalogueDestination } from "@/modules/catalogue/ui/catalogue-destination";

export function CataloguePageClient({ staffName }: { staffName: string }) {
  return (
    <AdminShell
      destinations={getDestinations()}
      active="catalogue"
      staffName={staffName}
      title="Catalogue"
      subtitle="What the business sells and what it costs"
    >
      <CatalogueDestination />
    </AdminShell>
  );
}
