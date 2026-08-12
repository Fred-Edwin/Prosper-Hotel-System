import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { DashboardStockMovementsView, type DashboardStockMovementRow } from "./dashboard-stock-movements";

/**
 * Dashboard's "Stock movements" card (ticket 49) — today's product
 * movements by reason and location, wasted/consumed/given-away flagged in
 * danger tone. Real seed data shaped like the design reference's
 * `stockFlow` fixture.
 */
const meta = {
  title: "Modules/Reporting/DashboardStockMovements",
  component: DashboardStockMovementsView,
  parameters: { layout: "padded" },
} satisfies Meta<typeof DashboardStockMovementsView>;

export default meta;
type Story = StoryObj<typeof meta>;

const rows: DashboardStockMovementRow[] = [
  { reason: "produced", locationCode: "restaurant", qty: 40, valueMinor: 12000 },
  { reason: "received", locationCode: "canteen", qty: 25, valueMinor: 7500 },
  { reason: "sold", locationCode: "restaurant", qty: 32, valueMinor: 16000 },
  { reason: "sold", locationCode: "canteen", qty: 18, valueMinor: 9000 },
  { reason: "wasted", locationCode: "restaurant", qty: 3, valueMinor: 900 },
  { reason: "consumed", locationCode: "canteen", qty: 2, valueMinor: 600 },
  { reason: "given_away", locationCode: "restaurant", qty: 1, valueMinor: 300 },
];

export const Populated: Story = {
  args: { state: { status: "ready", rows } },
};

export const Empty: Story = {
  name: "Empty — no movements today",
  args: { state: { status: "ready", rows: [] } },
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
