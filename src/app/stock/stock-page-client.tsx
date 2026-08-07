"use client";

import { AdminShell } from "@/components/layout/admin-shell";
import { getDestinations } from "@/components/layout/admin-nav";
import { AdminStockTable } from "@/modules/stock/ui/admin-stock-table";

export function StockPageClient({
  staffName,
  locationId,
}: {
  staffName: string;
  locationId: string;
}) {
  return (
    <AdminShell
      destinations={getDestinations()}
      active="stock"
      staffName={staffName}
      title="Stock"
      subtitle="What is on hand, and what it is worth"
    >
      <AdminStockTable locationId={locationId} />
    </AdminShell>
  );
}
