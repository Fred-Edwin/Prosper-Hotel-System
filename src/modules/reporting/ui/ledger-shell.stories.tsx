import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { LedgerShellView } from "./ledger-shell";

/**
 * The Ledger's page shell — period picker, cost-of-goods-sold waterfall,
 * and the four sub-ledger tabs. Only the waterfall shows real figures in
 * this ticket; every sub-ledger tab shows its designed not-yet-wired
 * state (Product and Cash land in tickets 39/40, Store and Non-sales in a
 * later ticket).
 */
const meta = {
  title: "Modules/Reporting/LedgerShell",
  component: LedgerShellView,
  parameters: { layout: "padded" },
  args: {
    preset: "week",
    onPresetChange: () => {},
    customStart: "2026-07-30",
    customEnd: "2026-08-06",
    onCustomStartChange: () => {},
    onCustomEndChange: () => {},
  },
} satisfies Meta<typeof LedgerShellView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithData: Story = {
  name: "Waterfall with data",
  args: {
    state: {
      status: "ready",
      data: {
        openingMinor: 6842000,
        purchasesMinor: 4977000,
        closingMinor: 7118000,
        costOfGoodsSoldMinor: 4701000,
        salesValueMinor: 6374000,
        grossProfitMinor: 1673000,
        nonSalesAtCostMinor: 128400,
        nonSalesAtPriceMinor: 214000,
        canteenCostRate: 0.72,
      },
    },
  },
};

export const Loading: Story = {
  args: { state: { status: "loading" } },
};

// Finding 3: no canteen count yet, so the own-goods rate — and therefore
// cost of goods sold and gross profit — can't be computed for the period.
export const CanteenCostUnavailable: Story = {
  name: "Canteen cost unavailable — no count yet",
  args: {
    state: {
      status: "ready",
      data: {
        openingMinor: 6842000,
        purchasesMinor: 4977000,
        closingMinor: 7118000,
        costOfGoodsSoldMinor: null,
        salesValueMinor: 6374000,
        grossProfitMinor: null,
        nonSalesAtCostMinor: 128400,
        nonSalesAtPriceMinor: 214000,
        canteenCostRate: null,
      },
    },
  },
};

export const EmptyNoMovements: Story = {
  name: "Empty — no movements in period",
  args: {
    state: {
      status: "ready",
      data: {
        openingMinor: 0,
        purchasesMinor: 0,
        closingMinor: 0,
        costOfGoodsSoldMinor: 0,
        salesValueMinor: 0,
        grossProfitMinor: 0,
        nonSalesAtCostMinor: 0,
        nonSalesAtPriceMinor: 0,
        canteenCostRate: null,
      },
    },
  },
};

export const Denied: Story = {
  name: "Permission denied — not the owner",
  args: { state: { status: "denied" } },
};

export const ErrorLoading: Story = {
  name: "Error loading the ledger",
  args: { state: { status: "error" } },
};
