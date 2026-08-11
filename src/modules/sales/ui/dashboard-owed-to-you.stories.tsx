import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { DashboardOwedToYouView } from "./dashboard-owed-to-you";

/**
 * Dashboard's "Owed to you" cell — the sum of credit extended across all
 * customers, both locations (formulas.md §11).
 */
const meta = {
  title: "Modules/Sales/DashboardOwedToYou",
  component: DashboardOwedToYouView,
  parameters: { layout: "padded" },
} satisfies Meta<typeof DashboardOwedToYouView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Ready: Story = {
  args: { state: { status: "ready", totalMinor: 620000 } },
};

export const ZeroBalance: Story = {
  name: "No credit outstanding",
  args: { state: { status: "ready", totalMinor: 0 } },
};

export const Loading: Story = {
  args: { state: { status: "loading" } },
};

export const Denied: Story = {
  name: "Permission denied — not the owner",
  args: { state: { status: "denied" } },
};

export const ErrorLoading: Story = {
  name: "Error loading what customers owe",
  args: { state: { status: "error" } },
};
