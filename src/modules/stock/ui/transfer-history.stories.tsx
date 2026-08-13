import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { TransferHistoryViewForState } from "./transfer-history";

const meta = {
  title: "Modules/Stock/TransferHistory",
  component: TransferHistoryViewForState,
  parameters: { layout: "fullscreen", viewport: { defaultViewport: "mobile1" } },
} satisfies Meta<typeof TransferHistoryViewForState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    state: {
      status: "ready",
      transfers: [
        {
          transferId: "tr-1",
          direction: "sent",
          status: "pending",
          counterpartLocationName: "Canteen",
          occurredAt: new Date("2026-08-13T09:05:00Z"),
          confirmedQuantity: null,
          reversed: false,
          isReversal: false,
          lines: [{ itemType: "product", itemId: "sodas", name: "Sodas (500ml)", quantity: 4, unit: "units" }],
        },
        {
          transferId: "tr-2",
          direction: "received",
          status: "confirmed",
          counterpartLocationName: "Canteen",
          occurredAt: new Date("2026-08-10T11:10:00Z"),
          confirmedQuantity: 6,
          reversed: false,
          isReversal: false,
          lines: [{ itemType: "ingredient", itemId: "eggs", name: "Eggs", quantity: 6, unit: "trays" }],
        },
        {
          transferId: "tr-3",
          direction: "sent",
          status: "confirmed",
          counterpartLocationName: "Canteen",
          occurredAt: new Date("2026-08-09T16:30:00Z"),
          confirmedQuantity: 2,
          reversed: true,
          isReversal: false,
          lines: [{ itemType: "ingredient", itemId: "paper", name: "Printing paper", quantity: 2, unit: "reams" }],
        },
        {
          transferId: "tr-4",
          direction: "received",
          status: "confirmed",
          counterpartLocationName: "Canteen",
          occurredAt: new Date("2026-08-09T10:15:00Z"),
          confirmedQuantity: 6,
          reversed: false,
          isReversal: false,
          lines: [{ itemType: "ingredient", itemId: "oil", name: "Cooking oil", quantity: 8, unit: "litres" }],
        },
        {
          transferId: "tr-5",
          direction: "sent",
          status: "cancelled",
          counterpartLocationName: "Canteen",
          occurredAt: new Date("2026-08-08T08:20:00Z"),
          confirmedQuantity: null,
          reversed: false,
          isReversal: false,
          lines: [{ itemType: "product", itemId: "sodas", name: "Sodas (500ml)", quantity: 2, unit: "units" }],
        },
      ],
    },
  },
};

export const PendingSend: Story = {
  name: "Sent, still pending — cancellable",
  args: {
    state: {
      status: "ready",
      transfers: [
        {
          transferId: "tr-1",
          direction: "sent",
          status: "pending",
          counterpartLocationName: "Canteen",
          occurredAt: new Date("2026-08-13T09:05:00Z"),
          confirmedQuantity: null,
          reversed: false,
          isReversal: false,
          lines: [{ itemType: "product", itemId: "sodas", name: "Sodas (500ml)", quantity: 4, unit: "units" }],
        },
      ],
    },
  },
};

export const ConfirmedShort: Story = {
  name: "Sent, confirmed short — undoable",
  args: {
    state: {
      status: "ready",
      transfers: [
        {
          transferId: "tr-1",
          direction: "sent",
          status: "confirmed",
          counterpartLocationName: "Canteen",
          occurredAt: new Date("2026-08-10T14:45:00Z"),
          confirmedQuantity: 3,
          reversed: false,
          isReversal: false,
          lines: [{ itemType: "product", itemId: "sodas", name: "Sodas (500ml)", quantity: 4, unit: "units" }],
        },
      ],
    },
  },
};

export const ReceivedTransfer: Story = {
  name: "Received transfer",
  args: {
    state: {
      status: "ready",
      transfers: [
        {
          transferId: "tr-2",
          direction: "received",
          status: "confirmed",
          counterpartLocationName: "Restaurant",
          occurredAt: new Date("2026-08-10T11:10:00Z"),
          confirmedQuantity: 6,
          reversed: false,
          isReversal: false,
          lines: [{ itemType: "ingredient", itemId: "eggs", name: "Eggs", quantity: 6, unit: "trays" }],
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
  args: { state: { status: "ready", transfers: [] } },
};

export const Error: Story = {
  args: { state: { status: "error" } },
};

export const Denied: Story = {
  name: "Permission denied",
  args: { state: { status: "denied" } },
};
