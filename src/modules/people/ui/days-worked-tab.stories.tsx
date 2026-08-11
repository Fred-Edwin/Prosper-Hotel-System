import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { DaysWorkedTab, type DaysWorkedState } from "./days-worked-tab";
import type { StaffMember } from "../schema";

const staff: StaffMember[] = [
  {
    id: "s1",
    name: "Brian Otieno",
    phone: "+254700000004",
    role: "cashier",
    locationId: "l1",
    dailyRateMinor: 550,
    active: true,
  },
  {
    id: "s2",
    name: "Anne",
    phone: "+254700000005",
    role: "attendant",
    locationId: "l2",
    dailyRateMinor: 600,
    active: true,
  },
  {
    id: "s3",
    name: "Faith Mumbi",
    phone: "+254700000007",
    role: "cashier",
    locationId: "l1",
    dailyRateMinor: 550,
    active: false,
  },
];

function daysWorkedResponse(days: { date: string; paid: boolean }[], dailyRateMinor: number): DaysWorkedState {
  const unpaid = days.filter((d) => !d.paid).length;
  return {
    status: "ready",
    daysWorked: days.map((d, i) => ({
      id: `d${i}`,
      date: d.date,
      paidAs: d.paid ? "expense-1" : null,
    })),
    pay: {
      daysWorked: days.length,
      dailyRateMinor,
      payMinor: days.length * dailyRateMinor,
      unpaidDaysWorked: unpaid,
      unpaidMinor: unpaid * dailyRateMinor,
    },
  };
}

const meta = {
  title: "Modules/People/DaysWorkedTab",
  component: DaysWorkedTab,
  parameters: { layout: "padded" },
  args: {
    staff,
    onRecord: async () => ({ ok: true }),
    onPay: async () => ({ ok: true }),
  },
} satisfies Meta<typeof DaysWorkedTab>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NoStaffChosen: Story = {
  name: "Empty — no staff chosen",
  args: {
    // Never called: the empty state renders before any staff member is
    // selected, so onFetch has nothing to demonstrate here.
    onFetch: async () => ({ status: "error" }),
  },
};

export const DaysMarked: Story = {
  name: "Days marked, computed pay",
  args: {
    onFetch: async () =>
      daysWorkedResponse(
        [
          { date: "2026-08-01", paid: false },
          { date: "2026-08-04", paid: false },
          { date: "2026-08-06", paid: false },
        ],
        550,
      ),
  },
};

export const AllPaid: Story = {
  name: "Days marked, all paid",
  args: {
    onFetch: async () =>
      daysWorkedResponse(
        [
          { date: "2026-08-01", paid: true },
          { date: "2026-08-04", paid: true },
        ],
        550,
      ),
  },
};

export const NoDaysThisMonth: Story = {
  name: "Empty — no days recorded yet",
  args: {
    onFetch: async () => ({
      status: "ready",
      daysWorked: [],
      pay: { daysWorked: 0, dailyRateMinor: 550, payMinor: 0, unpaidDaysWorked: 0, unpaidMinor: 0 },
    }),
  },
};

export const LoadError: Story = {
  name: "Error loading",
  args: {
    onFetch: async () => ({ status: "error" }),
  },
};
