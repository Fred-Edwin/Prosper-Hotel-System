import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { DashboardProfitView } from "./dashboard-profit";

/**
 * Dashboard's Profit panel — the owner's waterfall (revenue, cost of goods
 * sold, running costs, net profit), plus a By-location breakdown beneath it
 * (ticket 46). Real seed data shaped like a plausible trading day:
 * restaurant cost of goods and running costs are final; canteen own-goods
 * cost is estimated and labelled provisional throughout.
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
    provisional: false,
  },
  canteen: {
    revenueMinor: 540000,
    costOfGoodsMinor: 528000,
    grossProfitMinor: 12000,
    runningCostsMinor: 50000,
    netProfitMinor: -38000,
    provisional: true,
  },
};

export const Provisional: Story = {
  name: "Day — canteen estimate, no correction yet",
  args: {
    period: "day",
    state: {
      status: "ready",
      data: {
        revenue: { restaurant: 1860000, canteen: 540000, total: 2400000 },
        costOfGoods: {
          restaurant: 960000,
          canteenExact: 240000,
          canteenEstimated: 288000,
          total: 1488000,
        },
        runningCostsMinor: 230000,
        grossProfitMinor: 912000,
        netProfitMinor: 682000,
        canteenCostRate: 0.72,
        lastCanteenCount: "2026-08-01T00:00:00Z",
        correction: { available: false },
        byLocation: byLocationDay,
      },
    },
  },
};

export const JustCorrectedByCount: Story = {
  name: "Just corrected — a count landed today",
  args: {
    period: "day",
    state: {
      status: "ready",
      data: {
        revenue: { restaurant: 1860000, canteen: 540000, total: 2400000 },
        costOfGoods: {
          restaurant: 960000,
          canteenExact: 240000,
          canteenEstimated: 288000,
          total: 1488000,
        },
        runningCostsMinor: 230000,
        grossProfitMinor: 912000,
        netProfitMinor: 682000,
        canteenCostRate: 0.75,
        lastCanteenCount: "2026-08-06T00:00:00Z",
        correction: {
          available: true,
          estimatedSinceLastCountMinor: 6120000,
          measuredAtCountMinor: 6380000,
          differenceMinor: -260000,
        },
        byLocation: byLocationDay,
      },
    },
  },
};

export const NoCanteenCountYet: Story = {
  name: "No canteen count yet — own-goods rate unavailable",
  args: {
    period: "day",
    state: {
      status: "ready",
      data: {
        revenue: { restaurant: 1860000, canteen: 0, total: 1860000 },
        costOfGoods: {
          restaurant: 960000,
          canteenExact: 0,
          canteenEstimated: 0,
          total: 960000,
        },
        runningCostsMinor: 230000,
        grossProfitMinor: 900000,
        netProfitMinor: 670000,
        canteenCostRate: null,
        lastCanteenCount: null,
        correction: { available: false },
        byLocation: {
          restaurant: {
            revenueMinor: 1860000,
            costOfGoodsMinor: 960000,
            grossProfitMinor: 900000,
            runningCostsMinor: 230000,
            netProfitMinor: 670000,
            provisional: false,
          },
          canteen: {
            revenueMinor: 0,
            costOfGoodsMinor: 0,
            grossProfitMinor: 0,
            runningCostsMinor: 0,
            netProfitMinor: 0,
            provisional: true,
          },
        },
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
        costOfGoods: {
          restaurant: 6100000,
          canteenExact: 1400000,
          canteenEstimated: 1650000,
          total: 9150000,
        },
        runningCostsMinor: 1400000,
        grossProfitMinor: 5850000,
        netProfitMinor: 4450000,
        canteenCostRate: 0.72,
        lastCanteenCount: "2026-08-04T00:00:00Z",
        correction: {
          available: true,
          estimatedSinceLastCountMinor: 1980000,
          measuredAtCountMinor: 2100000,
          differenceMinor: 120000,
        },
        byLocation: {
          restaurant: {
            revenueMinor: 11800000,
            costOfGoodsMinor: 6100000,
            grossProfitMinor: 5700000,
            runningCostsMinor: 1100000,
            netProfitMinor: 4600000,
            provisional: false,
          },
          canteen: {
            revenueMinor: 3200000,
            costOfGoodsMinor: 3050000,
            grossProfitMinor: 150000,
            runningCostsMinor: 300000,
            netProfitMinor: -150000,
            provisional: true,
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
        costOfGoods: {
          restaurant: 25100000,
          canteenExact: 5900000,
          canteenEstimated: 6850000,
          total: 37850000,
        },
        runningCostsMinor: 5800000,
        grossProfitMinor: 24150000,
        netProfitMinor: 18350000,
        canteenCostRate: 0.73,
        lastCanteenCount: "2026-07-29T00:00:00Z",
        correction: { available: false },
        byLocation: {
          restaurant: {
            revenueMinor: 48600000,
            costOfGoodsMinor: 25100000,
            grossProfitMinor: 23500000,
            runningCostsMinor: 4500000,
            netProfitMinor: 19000000,
            provisional: false,
          },
          canteen: {
            revenueMinor: 13400000,
            costOfGoodsMinor: 12750000,
            grossProfitMinor: 650000,
            runningCostsMinor: 1300000,
            netProfitMinor: -650000,
            provisional: true,
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
