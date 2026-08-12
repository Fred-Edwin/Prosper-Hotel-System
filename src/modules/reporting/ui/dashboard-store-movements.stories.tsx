import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { DashboardStoreMovementsView, type DashboardStoreMovementRow } from "./dashboard-store-movements";

/**
 * Dashboard's "Restaurant store" card (ticket 49) — today's per-ingredient
 * received/to-kitchen/to-canteen/closing quantities, restaurant only. Real
 * seed data shaped like the design reference's `storeFlow` fixture.
 */
const meta = {
  title: "Modules/Reporting/DashboardStoreMovements",
  component: DashboardStoreMovementsView,
  parameters: { layout: "padded" },
} satisfies Meta<typeof DashboardStoreMovementsView>;

export default meta;
type Story = StoryObj<typeof meta>;

const rows: DashboardStoreMovementRow[] = [
  {
    ingredientName: "Tomatoes",
    unitOfMeasure: "kg",
    received: 20,
    issuedToKitchen: 12,
    transferredOut: 0,
    closingQty: 28,
  },
  {
    ingredientName: "Cooking oil",
    unitOfMeasure: "L",
    received: 0,
    issuedToKitchen: 4,
    transferredOut: 2,
    closingQty: 14,
  },
  {
    ingredientName: "Rice",
    unitOfMeasure: "kg",
    received: 50,
    issuedToKitchen: 0,
    transferredOut: 0,
    closingQty: 90,
  },
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
