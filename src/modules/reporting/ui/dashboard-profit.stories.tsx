import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { DashboardProfitView } from "./dashboard-profit";

/**
 * Dashboard's Profit panel — the owner's waterfall (revenue, cost of goods
 * sold, running costs, net profit). Real seed data shaped like a plausible
 * trading day: restaurant cost of goods and running costs are final;
 * canteen own-goods cost is estimated and labelled provisional throughout.
 */
const meta = {
  title: "Modules/Reporting/DashboardProfit",
  component: DashboardProfitView,
  parameters: { layout: "padded" },
} satisfies Meta<typeof DashboardProfitView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Provisional: Story = {
  name: "Provisional — canteen estimate, no correction yet",
  args: {
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
      },
    },
  },
};

export const JustCorrectedByCount: Story = {
  name: "Just corrected — a count landed today",
  args: {
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
      },
    },
  },
};

export const NoCanteenCountYet: Story = {
  name: "No canteen count yet — own-goods rate unavailable",
  args: {
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
