import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { DashboardMpesaBalanceView } from "./dashboard-cash-figures";

/**
 * Dashboard's M-Pesa balance cell — the second figure from the same
 * `getRunningCashBalance` fetch as `dashboard-cash-figures.stories.tsx`'s
 * Cash position cell.
 */
const meta = {
  title: "Modules/Cash/DashboardMpesaBalance",
  component: DashboardMpesaBalanceView,
  parameters: { layout: "padded" },
} satisfies Meta<typeof DashboardMpesaBalanceView>;

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
  name: "Error loading the M-Pesa balance",
  args: { state: { status: "error" } },
};
