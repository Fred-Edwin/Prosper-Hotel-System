"use client";

import { useState } from "react";
import { AdminShell } from "@/components/layout/admin-shell";
import { getDestinations } from "@/components/layout/admin-nav";
import { HelpPanel } from "@/components/patterns/help-panel";
import { AdminStockTable } from "@/modules/stock/ui/admin-stock-table";
import { StockCountReview } from "@/modules/stock/ui/stock-count-review";
import { SectionHeader } from "@/components/patterns/states";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClipboardList } from "lucide-react";
import type { Location } from "@/modules/people";

export function StockPageClient({
  staffName,
  locations,
  initialLocationId,
}: {
  staffName: string;
  locations: Location[];
  initialLocationId: string;
}) {
  const [locationId, setLocationId] = useState(initialLocationId);

  return (
    <AdminShell
      destinations={getDestinations()}
      active="stock"
      staffName={staffName}
      title="Stock"
      subtitle="What is on hand, and what it is worth"
      actions={<HelpPanel topic="stock" />}
    >
      {locations.length > 1 && (
        <Tabs value={locationId} onValueChange={setLocationId} className="mb-3">
          <TabsList>
            {locations.map((location) => (
              <TabsTrigger key={location.id} value={location.id} className="capitalize">
                {location.code}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}

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
