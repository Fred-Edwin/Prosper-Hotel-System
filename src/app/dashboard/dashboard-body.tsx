"use client";

/**
 * The Dashboard's content — the full locked grid from the design-reference
 * worktree's `dashboard-body.tsx` (commit a977bea): Profit block, four cash
 * panels, a revenue/profit chart, Exceptions + Location comparison side by
 * side, Handover full-width, then Stock movements + Store movements side by
 * side.
 *
 * Ticket 14 wired Handover; ticket 25 wires Profit (revenue, cost of goods
 * sold — both locations — running costs, net profit). Every remaining
 * section's module doesn't exist yet (cash position needs `cash`'s own
 * dashboard reads, low stock needs `stock`'s valuation shape, which
 * architecture.md notes already came out smaller than this same prototype
 * once). Each of those sections keeps its locked position and card chrome
 * but renders `SectionNotBuilt` instead of content, so the eventual shape
 * is visible now and each later ticket only has to replace one card's
 * body — never re-derive the layout.
 */

import { SectionHeader, SectionNotBuilt } from "@/components/patterns/states";
import { DashboardHandovers } from "@/modules/cash/ui/dashboard-handovers";
import { DashboardProfit } from "@/modules/reporting/ui/dashboard-profit";

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-card">
      <SectionHeader title={title} />
      {children}
    </div>
  );
}

export function DashboardBody() {
  return (
    <>
      <DashboardProfit />

      <div className="mb-4 grid gap-px overflow-hidden rounded-lg border bg-border md:grid-cols-2 xl:grid-cols-4">
        <div className="bg-card">
          <SectionNotBuilt section="Cash position" />
        </div>
        <div className="bg-card">
          <SectionNotBuilt section="M-Pesa balance" />
        </div>
        <div className="bg-card">
          <SectionNotBuilt section="Owed to you" />
        </div>
        <div className="bg-card">
          <SectionNotBuilt section="Your drawings" />
        </div>
      </div>

      <div className="mb-5">
        <Card title="Revenue and profit">
          <SectionNotBuilt section="Revenue and profit" />
        </Card>
      </div>

      <div className="mb-5 grid gap-4 lg:grid-cols-2">
        <Card title="Needs you">
          <SectionNotBuilt section="Needs you" />
        </Card>
        <Card title="By location">
          <SectionNotBuilt section="Location comparison" />
        </Card>
      </div>

      <div className="mb-5">
        <DashboardHandovers />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Stock movements">
          <SectionNotBuilt section="Stock movements" />
        </Card>
        <Card title="Restaurant store">
          <SectionNotBuilt section="Store movements" />
        </Card>
      </div>
    </>
  );
}
