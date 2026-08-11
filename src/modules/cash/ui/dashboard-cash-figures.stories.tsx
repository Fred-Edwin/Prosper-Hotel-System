import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { DashboardCashPositionView } from "./dashboard-cash-figures";

/**
 * Dashboard's Cash position cell — ticket 31's running cash balance, one
 * of the two figures fed by a single `getRunningCashBalance` fetch (see
 * `dashboard-mpesa-balance.stories.tsx` for the M-Pesa cell, which shares
 * the same underlying states).
 */
const meta = {
  title: "Modules/Cash/DashboardCashPosition",
  component: DashboardCashPositionView,
  parameters: { layout: "padded" },
} satisfies Meta<typeof DashboardCashPositionView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Ready: Story = {
  args: { state: { status: "ready", cashMinor: 452000, mpesaMinor: 918000 } },
};

export const Loading: Story = {
  args: { state: { status: "loading" } },
};

export const Denied: Story = {
  name: "Permission denied — not the owner",
  args: { state: { status: "denied" } },
};

export const ErrorLoading: Story = {
  name: "Error loading the cash position",
  args: { state: { status: "error" } },
};
