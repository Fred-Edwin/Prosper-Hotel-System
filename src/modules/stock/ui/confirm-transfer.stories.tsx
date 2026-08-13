import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ConfirmTransferView } from "./confirm-transfer";
import type { PendingTransferForReader } from "../index";

/**
 * Confirm transfer — 2026-08-13 canteen redesign, REQ-02 Part A. New nav
 * destination, reachable from the staff-shell pending-transfer banner and
 * from transfer history. See confirm-transfer.tsx's header comment for why
 * this isn't blind (unlike the handover count) and why it's a list of
 * single-item cards rather than a multi-line form.
 *
 * Default is interactive — type a received quantity and Confirm to see the
 * receipt state, including the shortfall callout when it's less than sent.
 */
const meta = {
  title: "Modules/Stock/ConfirmTransfer",
  component: ConfirmTransferView,
  parameters: { layout: "fullscreen", viewport: { defaultViewport: "mobile1" } },
} satisfies Meta<typeof ConfirmTransferView>;

export default meta;
type Story = StoryObj<typeof meta>;

const now = new Date("2026-08-13T09:12:00Z");

const transfers: PendingTransferForReader[] = [
  {
    id: "t1",
    fromLocationId: "loc-restaurant",
    toLocationId: "loc-canteen",
    itemType: "product",
    itemId: "p1",
    itemName: "Chapati",
    sentQuantity: 40,
    status: "pending",
    sentByStaffMemberId: "s1",
    sentAt: now,
    confirmedQuantity: null,
    confirmedByStaffMemberId: null,
    confirmedAt: null,
    reversedTransferId: null,
    cancelledByStaffMemberId: null,
    cancelledAt: null,
  },
  {
    id: "t2",
    fromLocationId: "loc-restaurant",
    toLocationId: "loc-canteen",
    itemType: "product",
    itemId: "p2",
    itemName: "Mukimo",
    sentQuantity: 15,
    status: "pending",
    sentByStaffMemberId: "s1",
    sentAt: new Date("2026-08-13T09:20:00Z"),
    confirmedQuantity: null,
    confirmedByStaffMemberId: null,
    confirmedAt: null,
    reversedTransferId: null,
    cancelledByStaffMemberId: null,
    cancelledAt: null,
  },
];

const stubConfirm = async (_transferId: string, _confirmedQuantity: number) => ({ ok: true as const });
const stubConfirmShortfall = async () => ({ ok: true as const });

export const Default: Story = {
  args: {
    state: { status: "ready", transfers },
    onConfirm: stubConfirm,
  },
};

/**
 * Type a quantity less than what was sent (e.g. 36 instead of 40) and
 * Confirm — the receipt shows the shortfall as its own discrepancy,
 * separate from wastage, per proposal.md §4.
 */
export const ConfirmWithShortfall: Story = {
  name: "Confirm — with shortfall",
  args: {
    state: { status: "ready", transfers: [transfers[0]] },
    onConfirm: stubConfirmShortfall,
  },
};

export const SingleItem: Story = {
  name: "Single item waiting",
  args: {
    state: { status: "ready", transfers: [transfers[1]] },
    onConfirm: stubConfirm,
  },
};

export const Loading: Story = {
  args: { state: { status: "loading" } },
};

export const Empty: Story = {
  name: "Empty — nothing waiting",
  args: { state: { status: "ready", transfers: [] } },
};

export const Error: Story = {
  args: { state: { status: "error" } },
};

export const PermissionDenied: Story = {
  args: { state: { status: "denied" } },
};
