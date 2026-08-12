"use client";

/**
 * Client half of the Ledger page. `getDestinations()` returns Lucide icon
 * components, which are not serializable across the server/client
 * boundary — same split as catalogue-page-client.tsx.
 */

import { AdminShell } from "@/components/layout/admin-shell";
import { getDestinations } from "@/components/layout/admin-nav";
import { HelpPanel } from "@/components/patterns/help-panel";
import { LedgerShell } from "@/modules/reporting/ui/ledger-shell";

export function LedgerPageClient({ staffName }: { staffName: string }) {
  return (
    <AdminShell
      destinations={getDestinations()}
      active="ledger"
      staffName={staffName}
      title="Ledger"
      subtitle="Where every figure comes from"
      actions={<HelpPanel topic="ledger" />}
    >
      <LedgerShell />
    </AdminShell>
  );
}
