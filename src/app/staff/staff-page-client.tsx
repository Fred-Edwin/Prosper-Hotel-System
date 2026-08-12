"use client";

import { useState } from "react";
import { StaffShellHome, StaffHome } from "@/components/layout/staff-shell";
import { staffNav, type StaffRole } from "@/components/layout/staff-nav";
import { HelpPanel } from "@/components/patterns/help-panel";
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

// Height (px) of a task screen's sticky bottom-anchored primary action bar —
// an h-12 (48px) button in a py-3 (24px) wrapper plus a 1px border-top,
// identical across every screen with one. The help sheet reserves this much
// space above it so it never covers the action.
const BOTTOM_BAR_HEIGHT = 73;

// Screens without a bottom-anchored primary action omit bottomOffset entirely.
const helpTopicByActive: Record<
  string,
  { topic: string; bottomOffset?: number }
> = {
  sell: { topic: "new-sale", bottomOffset: BOTTOM_BAR_HEIGHT },
  sales: { topic: "todays-sales" },
  wastage: { topic: "wastage", bottomOffset: BOTTOM_BAR_HEIGHT },
  stock: { topic: "staff-stock" },
  handover: { topic: "handover", bottomOffset: BOTTOM_BAR_HEIGHT },
  takings: { topic: "takings", bottomOffset: BOTTOM_BAR_HEIGHT },
  credit: { topic: "credit-sale", bottomOffset: BOTTOM_BAR_HEIGHT },
  receive: { topic: "receiving", bottomOffset: BOTTOM_BAR_HEIGHT },
  count: { topic: "stock-count", bottomOffset: BOTTOM_BAR_HEIGHT },
  transfer: { topic: "transfer-stock", bottomOffset: BOTTOM_BAR_HEIGHT },
  issue: { topic: "to-kitchen", bottomOffset: BOTTOM_BAR_HEIGHT },
  production: { topic: "production", bottomOffset: BOTTOM_BAR_HEIGHT },
};

function helpPanelFor(active: string) {
  const entry = helpTopicByActive[active];
  if (!entry) return undefined;
  return <HelpPanel topic={entry.topic} bottomOffset={entry.bottomOffset} />;
}

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
      actions={active ? helpPanelFor(active) : undefined}
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
