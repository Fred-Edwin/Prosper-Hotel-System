"use client";

import { useState } from "react";
import { StaffShellHome, StaffHome } from "@/components/layout/staff-shell";
import { staffNav, type StaffRole } from "@/components/layout/staff-nav";
import { StockList } from "@/modules/stock/ui/stock-list";
import { ReceiveDelivery } from "@/modules/stock/ui/receive-delivery";
import { RecordWastage } from "@/modules/stock/ui/record-wastage";
import { NewSale } from "@/modules/sales/ui/new-sale";
import { TodaysSales } from "@/modules/sales/ui/todays-sales";
import { NotBuilt } from "@/components/patterns/states";

export function StaffPageClient({
  staffName,
  locationId,
  locationName,
  role,
}: {
  staffName: string;
  locationId: string;
  locationName: string;
  role: StaffRole;
}) {
  const [active, setActive] = useState<string | null>(null);

  const activeLink = active ? staffNav[role].find((l) => l.key === active) : null;

  return (
    <StaffShellHome
      staffName={staffName}
      locationName={locationName}
      active={active}
      title={activeLink?.label ?? ""}
      onHome={() => setActive(null)}
    >
      {active === null && (
        <StaffHome role={role} handedOverToday={false} onOpen={setActive} />
      )}
      {active === "stock" && <StockList locationId={locationId} />}
      {active === "sell" && <NewSale onDone={() => setActive(null)} />}
      {active === "sales" && <TodaysSales />}
      {active === "receive" && <ReceiveDelivery onDone={() => setActive(null)} />}
      {active === "wastage" && <RecordWastage onDone={() => setActive(null)} />}
      {active !== null &&
        active !== "stock" &&
        active !== "sell" &&
        active !== "sales" &&
        active !== "receive" &&
        active !== "wastage" && <NotBuilt destination={activeLink?.label ?? ""} />}
    </StaffShellHome>
  );
}
