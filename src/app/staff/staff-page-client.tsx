"use client";

import { useState } from "react";
import { StaffShellHome, StaffHome } from "@/components/layout/staff-shell";
import { staffNav, type StaffRole } from "@/components/layout/staff-nav";
import { StockList } from "@/modules/stock/ui/stock-list";
import { ReceiveDelivery } from "@/modules/stock/ui/receive-delivery";
import { IssueToKitchen } from "@/modules/stock/ui/issue-to-kitchen";
import { RecordProduction } from "@/modules/stock/ui/record-production";
import { RecordWastage } from "@/modules/stock/ui/record-wastage";
import { StockCount } from "@/modules/stock/ui/stock-count";
import { TransferStock } from "@/modules/stock/ui/transfer-stock";
import { TransferHistoryView } from "@/modules/stock/ui/transfer-history";
import { NewSale } from "@/modules/sales/ui/new-sale";
import { CreditSale } from "@/modules/sales/ui/credit-sale";
import { TodaysSales } from "@/modules/sales/ui/todays-sales";
import { Handover } from "@/modules/cash/ui/handover";
import { Takings } from "@/modules/cash/ui/takings";
import { NotBuilt } from "@/components/patterns/states";

export function StaffPageClient({
  staffName,
  locationId,
  locationName,
  role,
  handedOverToday,
}: {
  staffName: string;
  locationId: string;
  locationName: string;
  role: StaffRole;
  handedOverToday: boolean;
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
        <StaffHome role={role} handedOverToday={handedOverToday} onOpen={setActive} />
      )}
      {active === "stock" && <StockList locationId={locationId} />}
      {active === "sell" && <NewSale onDone={() => setActive(null)} />}
      {active === "credit" && <CreditSale onDone={() => setActive(null)} />}
      {active === "sales" && <TodaysSales />}
      {active === "receive" && <ReceiveDelivery onDone={() => setActive(null)} />}
      {active === "issue" && <IssueToKitchen onDone={() => setActive(null)} />}
      {active === "production" && <RecordProduction onDone={() => setActive(null)} />}
      {active === "wastage" && <RecordWastage onDone={() => setActive(null)} />}
      {active === "count" && <StockCount />}
      {active === "transfer" && <TransferStock />}
      {active === "transfer-history" && <TransferHistoryView />}
      {active === "handover" && <Handover />}
      {active === "takings" && <Takings />}
      {active !== null &&
        active !== "stock" &&
        active !== "sell" &&
        active !== "credit" &&
        active !== "sales" &&
        active !== "receive" &&
        active !== "issue" &&
        active !== "production" &&
        active !== "wastage" &&
        active !== "count" &&
        active !== "transfer" &&
        active !== "transfer-history" &&
        active !== "handover" &&
        active !== "takings" && <NotBuilt destination={activeLink?.label ?? ""} />}
    </StaffShellHome>
  );
}
