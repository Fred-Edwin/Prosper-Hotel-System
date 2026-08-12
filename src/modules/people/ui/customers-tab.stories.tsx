import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CustomersTab } from "./customers-tab";
import type { CustomerWithBalance } from "./customer-data";

const customers: CustomerWithBalance[] = [
  { id: "c1", name: "Jane Wanjiru", phone: "+254700111222", balanceMinor: 24000 },
  { id: "c2", name: "Brian Otieno", phone: "+254700333444", balanceMinor: 6000 },
  { id: "c3", name: "Amani Njeri", phone: null, balanceMinor: 0 },
  { id: "c4", name: "Wambui Kariuki", phone: "+254700555666", balanceMinor: 15000 },
];

const meta = {
  title: "Modules/People/CustomersTab",
  component: CustomersTab,
  parameters: { layout: "padded" },
  args: {
    onFetchHistory: async () => ({
      status: "ready",
      entries: [
        { kind: "credit", amountMinor: 8000, occurredAt: "2026-07-20T10:00:00Z" },
        { kind: "credit", amountMinor: 16000, occurredAt: "2026-08-01T10:00:00Z" },
      ],
    }),
    onRecordRepayment: async () => ({ ok: true }),
  },
} satisfies Meta<typeof CustomersTab>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithBalances: Story = {
  name: "List — several customers, some owing",
  args: {
    customers,
    totalOwedMinor: customers.reduce((s, c) => s + c.balanceMinor, 0),
  },
};

export const Empty: Story = {
  name: "Empty — first use",
  args: {
    customers: [],
    totalOwedMinor: 0,
  },
};
