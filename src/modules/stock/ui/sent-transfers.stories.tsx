import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { SentTransfersView } from "./sent-transfers";
import type { PendingTransferForReader } from "../index";

/**
 * Sent transfers — 2026-08-13 canteen redesign, item 4. Reconciliation
 * visibility for a sender (typically the restaurant store manager sending
 * to the canteen): confirmed transfers with sent-vs-confirmed quantity, so
 * a shortfall at the receiving end is visible without digging into the
 * ledger. See sent-transfers.tsx's header comment for why this reads the
 * Transfer model directly rather than reusing transfer-history.tsx.
 */
const meta = {
  title: "Modules/Stock/SentTransfers",
  component: SentTransfersView,
  parameters: { layout: "fullscreen", viewport: { defaultViewport: "mobile1" } },
} satisfies Meta<typeof SentTransfersView>;

export default meta;
type Story = StoryObj<typeof meta>;

const reconciled: PendingTransferForReader = {
  id: "t1",
  fromLocationId: "loc-restaurant",
  toLocationId: "loc-canteen",
  itemType: "product",
  itemId: "p1",
  itemName: "Chapati",
  sentQuantity: 40,
  status: "confirmed",
  sentByStaffMemberId: "s1",
  sentAt: new Date("2026-08-13T09:12:00Z"),
  confirmedQuantity: 40,
  confirmedByStaffMemberId: "s2",
  confirmedAt: new Date("2026-08-13T09:20:00Z"),
  reversedTransferId: null,
  cancelledByStaffMemberId: null,
  cancelledAt: null,
};

const withShortfall: PendingTransferForReader = {
  ...reconciled,
  id: "t2",
  itemName: "Mukimo",
  sentQuantity: 15,
  confirmedQuantity: 12,
  confirmedAt: new Date("2026-08-13T10:05:00Z"),
};

export const AllReconciled: Story = {
  name: "All reconciled",
  args: {
    state: { status: "ready", transfers: [reconciled] },
  },
};

export const WithShortfall: Story = {
  name: "One with a shortfall",
  args: {
    state: { status: "ready", transfers: [withShortfall, reconciled] },
  },
};

export const Loading: Story = {
  args: { state: { status: "loading" } },
};

export const Empty: Story = {
  name: "Empty — nothing confirmed yet",
  args: { state: { status: "ready", transfers: [] } },
};

export const Error: Story = {
  args: { state: { status: "error" } },
};

export const PermissionDenied: Story = {
  args: { state: { status: "denied" } },
};
