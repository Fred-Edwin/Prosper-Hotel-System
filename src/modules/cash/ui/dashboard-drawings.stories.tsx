import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { DashboardDrawingsView } from "./dashboard-drawings";

/**
 * Dashboard's "Your drawings" cell — ticket 32's netted `drawingDebtOwed`
 * (debt minus unreversed repayments).
 */
const meta = {
  title: "Modules/Cash/DashboardDrawings",
  component: DashboardDrawingsView,
  parameters: { layout: "padded" },
} satisfies Meta<typeof DashboardDrawingsView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Ready: Story = {
  args: { state: { status: "ready", outstandingMinor: 350000 } },
};

export const ZeroBalance: Story = {
  name: "No outstanding drawings",
  args: { state: { status: "ready", outstandingMinor: 0 } },
};

export const Loading: Story = {
  args: { state: { status: "loading" } },
};

export const Denied: Story = {
  name: "Permission denied — not the owner",
  args: { state: { status: "denied" } },
};

export const ErrorLoading: Story = {
  name: "Error loading your drawings balance",
  args: { state: { status: "error" } },
};
