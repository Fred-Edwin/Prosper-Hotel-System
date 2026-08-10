import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { StockCountReviewView, type ReviewLine } from "./stock-count-review";

/**
 * Owner's stock count review/correct table — desktop-oriented, under the
 * admin Stock destination. Ticket 20.
 *
 * Real seed-shaped data: a restaurant count with two agreeing lines and
 * one short (theft, breakage or a miscount — the count doesn't say which,
 * only that it disagrees). The correction is a quantity entry pre-filled
 * with the counted value, not a single-tap reversal.
 */
const meta = {
  title: "Modules/Stock/StockCountReview",
  component: StockCountReviewView,
  parameters: { layout: "padded" },
} satisfies Meta<typeof StockCountReviewView>;

export default meta;
type Story = StoryObj<typeof meta>;

const stubCorrect = async () => ({ ok: true as const });

const mixedLines: ReviewLine[] = [
  {
    id: "l1",
    itemType: "product",
    itemName: "Soda 500ml",
    countedQuantity: 40,
    expectedQuantity: 40,
    correctedAt: null,
  },
  {
    id: "l2",
    itemType: "ingredient",
    itemName: "Flour",
    countedQuantity: 12,
    expectedQuantity: 15,
    correctedAt: null,
  },
  {
    id: "l3",
    itemType: "product",
    itemName: "Mukimo",
    countedQuantity: 8,
    expectedQuantity: 8,
    correctedAt: null,
  },
];

export const Mixed: Story = {
  name: "Mixed — one flagged",
  args: {
    state: { status: "ready", countId: "count-1", lines: mixedLines },
    onCorrect: stubCorrect,
  },
};

/** The correction input open on the flagged line, pre-filled with the
 * counted value and editable — the state this ticket's checkpoint asked to
 * be shown before wiring to the API. */
export const CorrectionOpen: Story = {
  name: "Correction input open on a flagged line",
  args: {
    state: { status: "ready", countId: "count-1", lines: mixedLines },
    onCorrect: stubCorrect,
    initialCorrectingId: "l2",
  },
};

export const AlreadyCorrected: Story = {
  name: "Flagged line already corrected",
  args: {
    state: {
      status: "ready",
      countId: "count-1",
      lines: mixedLines.map((l) =>
        l.id === "l2" ? { ...l, correctedAt: "2026-08-10T09:00:00Z" } : l,
      ),
    },
    onCorrect: stubCorrect,
  },
};

export const AllAgreed: Story = {
  args: {
    state: {
      status: "ready",
      countId: "count-2",
      lines: mixedLines.map((l) => ({ ...l, countedQuantity: l.expectedQuantity })),
    },
    onCorrect: stubCorrect,
  },
};

export const NoCountYet: Story = {
  name: "Empty — no count recorded yet",
  args: {
    state: { status: "ready", countId: null, lines: null },
  },
};

export const Loading: Story = {
  args: { state: { status: "loading" } },
};

export const ErrorLoading: Story = {
  args: { state: { status: "error" } },
};
