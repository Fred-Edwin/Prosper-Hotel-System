import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { DashboardProfitView } from "./dashboard-profit";

/**
 * Dashboard's Profit panel — the owner's waterfall (revenue, cost of goods
 * sold, running costs, net profit), plus a By-location breakdown beneath it
 * (ticket 46). 2026-08-13: every figure here is final at both locations —
 * the canteen's cost of goods is computed from real sales, same as
 * restaurant, so there's no more provisional/estimate state to fixture.
 */
const meta = {
  title: "Modules/Reporting/DashboardProfit",
  component: DashboardProfitView,
  parameters: { layout: "padded" },
} satisfies Meta<typeof DashboardProfitView>;

export default meta;
type Story = StoryObj<typeof meta>;

const byLocationDay = {
  restaurant: {
    revenueMinor: 1860000,
    costOfGoodsMinor: 960000,
    grossProfitMinor: 900000,
    runningCostsMinor: 180000,
    netProfitMinor: 720000,
  },
  canteen: {
    revenueMinor: 540000,
    costOfGoodsMinor: 528000,
    grossProfitMinor: 12000,
    runningCostsMinor: 50000,
    netProfitMinor: -38000,
  },
};

export const DayView: Story = {
  name: "Day — a plausible trading day",
  args: {
    period: "day",
    state: {
      status: "ready",
      data: {
        revenue: { restaurant: 1860000, canteen: 540000, total: 2400000 },
        costOfGoods: { restaurant: 960000, canteen: 528000, total: 1488000 },
        runningCostsMinor: 230000,
        grossProfitMinor: 912000,
        netProfitMinor: 682000,
        byLocation: byLocationDay,
      },
    },
  },
};

export const WeekView: Story = {
  name: "Week — same panel, a week's figures",
  args: {
    period: "week",
    state: {
      status: "ready",
      data: {
        revenue: { restaurant: 11800000, canteen: 3200000, total: 15000000 },
        costOfGoods: { restaurant: 6100000, canteen: 3050000, total: 9150000 },
        runningCostsMinor: 1400000,
        grossProfitMinor: 5850000,
        netProfitMinor: 4450000,
        byLocation: {
          restaurant: {
            revenueMinor: 11800000,
            costOfGoodsMinor: 6100000,
            grossProfitMinor: 5700000,
            runningCostsMinor: 1100000,
            netProfitMinor: 4600000,
          },
          canteen: {
            revenueMinor: 3200000,
            costOfGoodsMinor: 3050000,
            grossProfitMinor: 150000,
            runningCostsMinor: 300000,
            netProfitMinor: -150000,
          },
        },
      },
    },
  },
};

export const MonthView: Story = {
  name: "Month — same panel, a calendar month's figures",
  args: {
    period: "month",
    state: {
      status: "ready",
      data: {
        revenue: { restaurant: 48600000, canteen: 13400000, total: 62000000 },
        costOfGoods: { restaurant: 25100000, canteen: 12750000, total: 37850000 },
        runningCostsMinor: 5800000,
        grossProfitMinor: 24150000,
        netProfitMinor: 18350000,
        byLocation: {
          restaurant: {
            revenueMinor: 48600000,
            costOfGoodsMinor: 25100000,
            grossProfitMinor: 23500000,
            runningCostsMinor: 4500000,
            netProfitMinor: 19000000,
          },
          canteen: {
            revenueMinor: 13400000,
            costOfGoodsMinor: 12750000,
            grossProfitMinor: 650000,
            runningCostsMinor: 1300000,
            netProfitMinor: -650000,
          },
        },
      },
    },
  },
};

export const CustomRangeView: Story = {
  name: "Custom range — any two dates, including a single past day",
  args: {
    period: "custom",
    customStart: "2026-07-01",
    customEnd: "2026-07-15",
    state: {
      status: "ready",
      data: {
        revenue: { restaurant: 24300000, canteen: 6700000, total: 31000000 },
        costOfGoods: { restaurant: 12550000, canteen: 6375000, total: 18925000 },
        runningCostsMinor: 2900000,
        grossProfitMinor: 12075000,
        netProfitMinor: 9175000,
        byLocation: {
          restaurant: {
            revenueMinor: 24300000,
            costOfGoodsMinor: 12550000,
            grossProfitMinor: 11750000,
            runningCostsMinor: 2300000,
            netProfitMinor: 9450000,
          },
          canteen: {
            revenueMinor: 6700000,
            costOfGoodsMinor: 6375000,
            grossProfitMinor: 325000,
            runningCostsMinor: 600000,
            netProfitMinor: -275000,
          },
        },
      },
    },
  },
};

export const Loading: Story = {
  args: { state: { status: "loading" } },
};

export const Denied: Story = {
  name: "Permission denied — not the owner",
  args: { state: { status: "denied" } },
};

export const ErrorLoading: Story = {
  name: "Error loading today's profit",
  args: { state: { status: "error" } },
};
