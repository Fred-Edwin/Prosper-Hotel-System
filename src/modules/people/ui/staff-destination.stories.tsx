import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { StaffDestinationView } from "./staff-destination";
import type { Location, StaffMember } from "../schema";

const locations: Location[] = [
  { id: "l1", code: "restaurant", name: "Prosper Restaurant" },
  { id: "l2", code: "canteen", name: "Prosper Canteen" },
];

const staff: StaffMember[] = [
  {
    id: "s1",
    name: "Janiffer",
    phone: "+254700000002",
    role: "store_manager",
    locationId: "l1",
    dailyRateMinor: 700,
    active: true,
  },
  {
    id: "s2",
    name: "Sarah",
    phone: "+254700000003",
    role: "cashier",
    locationId: "l1",
    dailyRateMinor: 550,
    active: true,
  },
  {
    id: "s3",
    name: "Brian Otieno",
    phone: "+254700000004",
    role: "cashier",
    locationId: "l1",
    dailyRateMinor: 550,
    active: true,
  },
  {
    id: "s4",
    name: "Anne",
    phone: "+254700000005",
    role: "attendant",
    locationId: "l2",
    dailyRateMinor: 600,
    active: true,
  },
  {
    id: "s5",
    name: "Faith Mumbi",
    phone: "+254700000007",
    role: "cashier",
    locationId: "l1",
    dailyRateMinor: 550,
    active: false,
  },
];

const meta = {
  title: "Modules/People/StaffDestination",
  component: StaffDestinationView,
  parameters: { layout: "padded" },
} satisfies Meta<typeof StaffDestinationView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    state: { status: "ready", staff, locations },
  },
};

export const Empty: Story = {
  args: {
    state: { status: "ready", staff: [], locations },
  },
};

export const Loading: Story = {
  args: { state: { status: "loading" } },
};

export const ErrorLoading: Story = {
  name: "Error",
  args: { state: { status: "error" } },
};

export const PermissionDenied: Story = {
  name: "Permission denied — not the owner",
  args: { state: { status: "denied" } },
};
