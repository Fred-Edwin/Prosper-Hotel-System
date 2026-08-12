import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CustomerDetail } from "./customer-detail";
import type { CustomerWithBalance } from "./customer-data";

const owingCustomer: CustomerWithBalance = {
  id: "c1",
  name: "Jane Wanjiru",
  phone: "+254700111222",
  balanceMinor: 24000,
};

const settledCustomer: CustomerWithBalance = {
  id: "c3",
  name: "Amani Njeri",
  phone: null,
  balanceMinor: 0,
};

const meta = {
  title: "Modules/People/CustomerDetail",
  component: CustomerDetail,
  parameters: { layout: "padded" },
  args: {
    onBack: () => {},
    onRecordRepayment: async () => ({ ok: true }),
  },
} satisfies Meta<typeof CustomerDetail>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Owing: Story = {
  name: "Owing — credit and repayment history",
  args: {
    customer: owingCustomer,
    onFetchHistory: async () => ({
      status: "ready",
      entries: [
        { kind: "repayment", amountMinor: 4000, occurredAt: "2026-08-05T10:00:00Z" },
        { kind: "credit", amountMinor: 8000, occurredAt: "2026-07-20T10:00:00Z" },
        { kind: "credit", amountMinor: 20000, occurredAt: "2026-07-01T10:00:00Z" },
      ],
    }),
  },
};

export const Settled: Story = {
  name: "Settled — zero balance",
  args: {
    customer: settledCustomer,
    onFetchHistory: async () => ({
      status: "ready",
      entries: [
        { kind: "credit", amountMinor: 5000, occurredAt: "2026-06-10T10:00:00Z" },
        { kind: "repayment", amountMinor: 5000, occurredAt: "2026-06-20T10:00:00Z" },
      ],
    }),
  },
};

export const NoHistoryYet: Story = {
  name: "Empty — nothing recorded yet",
  args: {
    customer: settledCustomer,
    onFetchHistory: async () => ({ status: "ready", entries: [] }),
  },
};

export const ErrorLoading: Story = {
  name: "Error loading history",
  args: {
    customer: owingCustomer,
    onFetchHistory: async () => ({ status: "error" }),
  },
};
