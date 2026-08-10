import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { StockCountDetailView } from "./stock-count-detail";

/**
 * Stock count detail — expected, counted and difference per line, with
 * the owner's correct action on a disagreeing line. Ticket 20.
 *
 * Real seed-shaped data: a restaurant count with two agreeing lines and
 * one short (theft, breakage or a miscount — the count doesn't say which,
 * only that it disagrees).
 */
const meta = {
  title: "Modules/Stock/StockCountDetail",
  component: StockCountDetailView,
  parameters: { layout: "padded" },
} satisfies Meta<typeof StockCountDetailView>;

export default meta;
type Story = StoryObj<typeof meta>;

const stubCorrect = async () => ({ ok: true as const });

const mixedLines = [
  {
    id: "l1",
    itemType: "product" as const,
    itemName: "Soda 500ml",
    countedQuantity: 40,
    expectedQuantity: 40,
    correctedAt: null,
  },
  {
    id: "l2",
    itemType: "ingredient" as const,
    itemName: "Flour",
    countedQuantity: 12,
    expectedQuantity: 15,
    correctedAt: null,
  },
  {
    id: "l3",
    itemType: "product" as const,
    itemName: "Mukimo",
    countedQuantity: 8,
    expectedQuantity: 8,
    correctedAt: null,
  },
];

export const OwnerMixed: Story = {
  name: "Owner — mixed, one flagged",
  args: {
    countId: "count-1",
    isOwner: true,
    state: { status: "ready", lines: mixedLines },
    onCorrect: stubCorrect,
  },
};

export const OwnerAlreadyCorrected: Story = {
  name: "Owner — flagged line already corrected",
  args: {
    countId: "count-1",
    isOwner: true,
    state: {
      status: "ready",
      lines: mixedLines.map((l) =>
        l.id === "l2" ? { ...l, correctedAt: "2026-08-10T09:00:00Z" } : l,
      ),
    },
    onCorrect: stubCorrect,
  },
};

export const StoreManagerMixed: Story = {
  name: "Store manager — can view, cannot correct",
  args: {
    countId: "count-1",
    isOwner: false,
    state: { status: "ready", lines: mixedLines },
    onCorrect: stubCorrect,
  },
};

export const AllAgreed: Story = {
  args: {
    countId: "count-2",
    isOwner: true,
    state: {
      status: "ready",
      lines: mixedLines.map((l) => ({ ...l, countedQuantity: l.expectedQuantity })),
    },
    onCorrect: stubCorrect,
  },
};

export const Loading: Story = {
  args: { countId: "count-1", isOwner: true, state: { status: "loading" } },
};

export const Denied: Story = {
  name: "Permission denied — different location",
  args: { countId: "count-1", isOwner: false, state: { status: "denied" } },
};

export const ErrorLoading: Story = {
  args: { countId: "count-1", isOwner: true, state: { status: "error" } },
};
