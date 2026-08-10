"use client";

import { AdminShell } from "@/components/layout/admin-shell";
import { getDestinations } from "@/components/layout/admin-nav";
import { AdminStockTable } from "@/modules/stock/ui/admin-stock-table";
import { StockCountReview } from "@/modules/stock/ui/stock-count-review";
import { SectionHeader } from "@/components/patterns/states";
import { Button } from "@/components/ui/button";
import { ClipboardList } from "lucide-react";

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

      <div className="mt-6 overflow-hidden rounded-lg border bg-card">
        <SectionHeader
          title="Stock count"
          action={
            <Button size="sm" className="h-8" asChild>
              <a href="/stock/count">
                <ClipboardList className="size-3.5" /> Record a count
              </a>
            </Button>
          }
        />
        <div className="p-3">
          <StockCountReview locationId={locationId} />
        </div>
      </div>
    </AdminShell>
  );
}
