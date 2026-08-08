import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { TodaysSalesView } from "./todays-sales";

const meta = {
  title: "Modules/Sales/TodaysSales",
  component: TodaysSalesView,
  parameters: { layout: "padded" },
} satisfies Meta<typeof TodaysSalesView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    state: {
      status: "ready",
      sales: [
        {
          id: "sale-4",
          fulfilment: "delivery",
          customerName: "Brian Otieno",
          totalMinor: 330,
          deliveryFeeMinor: 50,
          occurredAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
          voided: false,
          staffMemberName: "Restaurant Cashier",
          lines: [
            { id: "l0", productName: "Chips", quantity: 2, priceMinor: 100 },
            { id: "l0b", productName: "Soda 500ml", quantity: 1, priceMinor: 80 },
          ],
          paymentLines: [{ id: "p0", method: "mpesa", amountMinor: 330, customerName: null }],
        },
        {
          id: "sale-3",
          fulfilment: "counter",
          customerName: null,
          totalMinor: 310,
          deliveryFeeMinor: null,
          occurredAt: new Date().toISOString(),
          voided: false,
          staffMemberName: "Restaurant Cashier",
          lines: [
            { id: "l1", productName: "Sodas (500ml)", quantity: 2, priceMinor: 80 },
            { id: "l2", productName: "Chips", quantity: 1, priceMinor: 100 },
            { id: "l3", productName: "Biscuits (packet)", quantity: 1, priceMinor: 50 },
          ],
          paymentLines: [{ id: "p1", method: "cash", amountMinor: 310, customerName: null }],
        },
        {
          id: "sale-2",
          fulfilment: "counter",
          customerName: null,
          totalMinor: 150,
          deliveryFeeMinor: null,
          occurredAt: new Date(Date.now() - 1000 * 60 * 40).toISOString(),
          voided: true,
          staffMemberName: "Restaurant Cashier",
          lines: [{ id: "l4", productName: "Mukimo", quantity: 1, priceMinor: 150 }],
          paymentLines: [{ id: "p2", method: "mpesa", amountMinor: 150, customerName: null }],
        },
        {
          id: "sale-1",
          fulfilment: "counter",
          customerName: null,
          totalMinor: 230,
          deliveryFeeMinor: null,
          occurredAt: new Date(Date.now() - 1000 * 60 * 95).toISOString(),
          voided: false,
          staffMemberName: "Restaurant Cashier",
          lines: [
            { id: "l5", productName: "Mukimo", quantity: 1, priceMinor: 150 },
            { id: "l6", productName: "Sodas (500ml)", quantity: 1, priceMinor: 80 },
          ],
          paymentLines: [
            { id: "p3", method: "cash", amountMinor: 150, customerName: null },
            { id: "p4", method: "credit", amountMinor: 80, customerName: "Jane Wanjiru" },
          ],
        },
      ],
    },
  },
};

export const Loading: Story = {
  args: { state: { status: "loading" } },
};

export const Empty: Story = {
  name: "Empty — first use",
  args: { state: { status: "ready", sales: [] } },
};

export const Error: Story = {
  args: { state: { status: "error" } },
};

export const Denied: Story = {
  name: "Permission denied",
  args: { state: { status: "denied" } },
};

export const VoidSucceeds: Story = {
  name: "Void — succeeds",
  args: {
    state: Default.args.state,
    onVoid: async () => ({ ok: true }),
  },
};

export const VoidFails: Story = {
  name: "Void — fails",
  args: {
    state: Default.args.state,
    onVoid: async () => ({ ok: false, error: "already_voided" }),
  },
};
