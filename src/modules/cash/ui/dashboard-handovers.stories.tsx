import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { DashboardHandoversView } from "./dashboard-handovers";

/**
 * Dashboard's Handover section — the owner's comparison view. Real seed
 * data shaped like a plausible restaurant day: two staff agreed, one is
 * short on both cash and M-Pesa.
 */
const meta = {
  title: "Modules/Cash/DashboardHandovers",
  component: DashboardHandoversView,
  parameters: { layout: "padded" },
} satisfies Meta<typeof DashboardHandoversView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AgreedAndFlagged: Story = {
  name: "Mixed — one flagged",
  args: {
    state: {
      status: "ready",
      handovers: [
        {
          id: "h1",
          staffName: "Amina Hassan",
          expectedCashMinor: 815000,
          expectedMpesaMinor: 620000,
          actualCashMinor: 815000,
          actualMpesaMinor: 620000,
        },
        {
          id: "h2",
          staffName: "Brian Otieno",
          expectedCashMinor: 420000,
          expectedMpesaMinor: 310000,
          actualCashMinor: 395000,
          actualMpesaMinor: 300000,
        },
        {
          id: "h3",
          staffName: "Catherine Njeri",
          expectedCashMinor: 500000,
          expectedMpesaMinor: 275000,
          actualCashMinor: 500000,
          actualMpesaMinor: 275000,
        },
      ],
    },
  },
};

export const AllAgreed: Story = {
  args: {
    state: {
      status: "ready",
      handovers: [
        {
          id: "h1",
          staffName: "Amina Hassan",
          expectedCashMinor: 815000,
          expectedMpesaMinor: 620000,
          actualCashMinor: 815000,
          actualMpesaMinor: 620000,
        },
      ],
    },
  },
};

export const EmptyFirstUseToday: Story = {
  name: "No handovers recorded yet today",
  args: { state: { status: "ready", handovers: [] } },
};

export const Loading: Story = {
  args: { state: { status: "loading" } },
};

export const Denied: Story = {
  name: "Permission denied — not the owner",
  args: { state: { status: "denied" } },
};

export const ErrorLoading: Story = {
  name: "Error loading today's handovers",
  args: { state: { status: "error" } },
};
