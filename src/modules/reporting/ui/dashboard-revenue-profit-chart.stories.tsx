import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { DashboardRevenueProfitChartView, type RevenueProfitTrendPoint } from "./dashboard-revenue-profit-chart";

/**
 * Dashboard's Revenue and profit chart — the last of the Dashboard's
 * figure-driven cards (ticket 47). Fourteen days of revenue and net
 * profit, one axis, a genuinely closed day rendered as a gap rather than
 * a zero. Real seed data shaped like the design reference's `trend`
 * fixture, with a Sunday closed.
 */
const meta = {
  title: "Modules/Reporting/DashboardRevenueProfitChart",
  component: DashboardRevenueProfitChartView,
  parameters: { layout: "padded" },
} satisfies Meta<typeof DashboardRevenueProfitChartView>;

export default meta;
type Story = StoryObj<typeof meta>;

const trend: RevenueProfitTrendPoint[] = [
  { date: "2026-07-24", revenue: 21400, netProfit: 5980 },
  { date: "2026-07-25", revenue: 26800, netProfit: 8140 },
  { date: "2026-07-26", revenue: null, netProfit: null },
  { date: "2026-07-27", revenue: 19200, netProfit: 5210 },
  { date: "2026-07-28", revenue: 22600, netProfit: 6740 },
  { date: "2026-07-29", revenue: 20100, netProfit: 5420 },
  { date: "2026-07-30", revenue: 23800, netProfit: 7260 },
  { date: "2026-07-31", revenue: 24900, netProfit: 7880 },
  { date: "2026-08-01", revenue: 28200, netProfit: 9140 },
  { date: "2026-08-02", revenue: null, netProfit: null },
  { date: "2026-08-03", revenue: 18900, netProfit: 4820 },
  { date: "2026-08-04", revenue: 21700, netProfit: 6110 },
  { date: "2026-08-05", revenue: 22400, netProfit: 6390 },
  { date: "2026-08-06", revenue: 24000, netProfit: 6820 },
];

export const Populated: Story = {
  name: "Populated — a closed day present",
  args: { state: { status: "ready", points: trend } },
};

export const Empty: Story = {
  name: "Empty — no trading history yet",
  args: { state: { status: "ready", points: trend.map((p) => ({ ...p, revenue: null, netProfit: null })) } },
};

export const Loading: Story = {
  args: { state: { status: "loading" } },
};

export const Denied: Story = {
  args: { state: { status: "denied" } },
};

export const ErrorStory: Story = {
  name: "Error",
  args: { state: { status: "error" } },
};
