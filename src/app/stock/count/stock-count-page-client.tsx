"use client";

import { useRouter } from "next/navigation";
import { AdminShell } from "@/components/layout/admin-shell";
import { getDestinations } from "@/components/layout/admin-nav";
import { RecordStockCount } from "@/modules/stock/ui/record-stock-count";

// The recording flow is the same phone-shaped composition used from the
// staff shell (record-stock-count.tsx) — reused as-is here, not redesigned
// for desktop, per ticket 20. Constrained to a phone-width column inside
// the admin frame rather than stretched across it, since stretching a
// search/tap-tile/quantity flow to full width would not make it a desktop
// composition, just a wide one.
//
// On recording, the owner returns to /stock rather than landing on the
// counted-only staff read view — she has the full comparison table there
// (stock-count-review.tsx), which is strictly more useful to her than the
// blind-count view built for the person who can't see the comparison.
export function StockCountPageClient({ staffName }: { staffName: string }) {
  const router = useRouter();

  return (
    <AdminShell
      destinations={getDestinations()}
      active="stock"
      staffName={staffName}
      title="Record a stock count"
      subtitle="Count what is physically on hand"
      trail={[{ label: "Stock", href: "/stock" }]}
    >
      <div className="mx-auto max-w-sm overflow-hidden rounded-lg border bg-card">
        <RecordStockCount onRecorded={() => router.push("/stock")} />
      </div>
    </AdminShell>
  );
}
