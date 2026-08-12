import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  DashboardExceptionsView,
  type ExceptionShortfall,
  type ExceptionVoidedSale,
} from "./dashboard-exceptions";

/**
 * Dashboard's "Needs you" card (ticket 48) — today's handover shortfalls
 * and voided sales, with the zero-state shown when nothing needs
 * attention. Real seed data shaped like the design reference's
 * `Exceptions` fixture, minus the pending-expense source this codebase
 * has no equivalent for.
 */
const meta = {
  title: "Modules/Reporting/DashboardExceptions",
  component: DashboardExceptionsView,
  parameters: { layout: "padded" },
} satisfies Meta<typeof DashboardExceptionsView>;

export default meta;
type Story = StoryObj<typeof meta>;

const shortfalls: ExceptionShortfall[] = [
  {
    handoverId: "handover-1",
    staffName: "Grace Wanjiru",
    locationCode: "restaurant",
    cashDiffMinor: -450,
    mpesaDiffMinor: 0,
    occurredAt: "2026-08-12T18:00:00Z",
  },
  {
    handoverId: "handover-2",
    staffName: "Peter Otieno",
    locationCode: "canteen",
    cashDiffMinor: 0,
    mpesaDiffMinor: -200,
    occurredAt: "2026-08-12T18:30:00Z",
  },
];

const voidedSales: ExceptionVoidedSale[] = [
  {
    saleId: "sale-1",
    saleRef: "sale-1a2",
    voidedByName: "Grace Wanjiru",
    totalMinor: 850,
    locationCode: "restaurant",
    voidedAt: "2026-08-12T14:00:00Z",
  },
];

export const Populated: Story = {
  name: "Populated — shortfall and void",
  args: { state: { status: "ready", shortfalls, voidedSales } },
};

export const Empty: Story = {
  name: "Empty — everything agreed",
  args: { state: { status: "ready", shortfalls: [], voidedSales: [] } },
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
