"use client";

/**
 * The Dashboard's content — the full locked grid from the design-reference
 * worktree's `dashboard-body.tsx` (commit a977bea): Profit block, four cash
 * panels, a revenue/profit chart, Needs you, Handover full-width, then
 * Stock movements + Store movements side by side.
 *
 * The reference's "By location" card is not built here — ticket 46 already
 * built that same restaurant/canteen breakdown as `DashboardProfit`'s own
 * `ByLocation` section, rendered directly under the Profit waterfall, so
 * this slot doesn't get a second copy (2026-08-12, confirmed with
 * Edwinfred — see ticket 48's file). "Needs you" is full-width as a result
 * rather than paired with it.
 *
 * Ticket 14 wired Handover; ticket 25 wires Profit (revenue, cost of goods
 * sold — both locations — running costs, net profit). Ticket 33 wires the
 * four cash panels (Cash position, M-Pesa balance — one shared fetch of
 * ticket 31's `getRunningCashBalance`, per `dashboard-cash-figures.tsx`;
 * Owed to you — ticket 33's own `getTotalCustomerBalance`; Your
 * drawings — ticket 32's netted `drawingDebtOwed`). Ticket 48 wires Needs
 * you (handover shortfalls, voided sales). Every remaining section's
 * module doesn't exist yet (low stock needs `stock`'s valuation shape,
 * which architecture.md notes already came out smaller than this same
 * prototype once). Each of those sections keeps its locked position and
 * card chrome but renders `SectionNotBuilt` instead of content, so the
 * eventual shape is visible now and each later ticket only has to replace
 * one card's body — never re-derive the layout.
 */

import { SectionHeader } from "@/components/patterns/states";
import { DashboardHandovers } from "@/modules/cash/ui/dashboard-handovers";
import {
  DashboardCashFigures,
  DashboardCashPositionView,
  DashboardMpesaBalanceView,
} from "@/modules/cash/ui/dashboard-cash-figures";
import { DashboardDrawings } from "@/modules/cash/ui/dashboard-drawings";
import { DashboardOwedToYou } from "@/modules/sales/ui/dashboard-owed-to-you";
import { DashboardProfit } from "@/modules/reporting/ui/dashboard-profit";
import { DashboardRevenueProfitChart } from "@/modules/reporting/ui/dashboard-revenue-profit-chart";
import { DashboardExceptions } from "@/modules/reporting/ui/dashboard-exceptions";
import { DashboardStockMovements } from "@/modules/reporting/ui/dashboard-stock-movements";
import { DashboardStoreMovements } from "@/modules/reporting/ui/dashboard-store-movements";

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
        <DashboardCashFigures>
          {(state, retry) => (
            <>
              <div className="bg-card">
                <DashboardCashPositionView state={state} onRetry={retry} />
              </div>
              <div className="bg-card">
                <DashboardMpesaBalanceView state={state} onRetry={retry} />
              </div>
            </>
          )}
        </DashboardCashFigures>
        <div className="bg-card">
          <DashboardOwedToYou />
        </div>
        <div className="bg-card">
          <DashboardDrawings />
        </div>
      </div>

      <div className="mb-5">
        <Card title="Revenue and profit">
          <DashboardRevenueProfitChart />
        </Card>
      </div>

      <div className="mb-5">
        <Card title="Needs you">
          <DashboardExceptions />
        </Card>
      </div>

      <div className="mb-5">
        <DashboardHandovers />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Stock movements">
          <DashboardStockMovements />
        </Card>
        <Card title="Restaurant store">
          <DashboardStoreMovements />
        </Card>
      </div>
    </>
  );
}
