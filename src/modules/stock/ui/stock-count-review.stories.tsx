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
 *
 * Ticket 24 adds the "since last count" section, isCanteen-gated — the
 * canteen's derived-sold quantity and revenue per item, computed from the
 * same expected/counted/priceMinor fields the comparison table above
 * already shows, not a separate backend field (2026-08-15 fix — see this
 * file's top comment for why the old derivedSales prop was removed).
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

const canteenLinesWithShortfall: ReviewLine[] = [
  {
    id: "c1",
    itemType: "product",
    itemName: "Soda 500ml",
    countedQuantity: 33,
    expectedQuantity: 40,
    correctedAt: null,
    priceMinor: 10000,
  },
  {
    id: "c2",
    itemType: "product",
    itemName: "Biscuits",
    countedQuantity: 60,
    expectedQuantity: 60,
    correctedAt: null,
    priceMinor: 5000,
  },
  {
    id: "c3",
    itemType: "product",
    itemName: "Samosa",
    countedQuantity: 5,
    expectedQuantity: 25,
    correctedAt: null,
    priceMinor: 5000,
  },
];

/** A canteen count with two lines short of expected — the "since last
 * count" table shows what sold, item by item, per formulas.md §2's
 * formula. */
export const CanteenWithDetail: Story = {
  name: "Canteen — since last count",
  args: {
    state: { status: "ready", countId: "count-3", lines: canteenLinesWithShortfall },
    isCanteen: true,
    onCorrect: stubCorrect,
  },
};

/** A canteen count where nothing came up short — the "since last count"
 * section still renders, with an explicit empty state rather than nothing
 * at all, so the owner can tell "nothing sold" from "this is broken." */
export const CanteenNoShortfall: Story = {
  name: "Canteen — nothing sold since last count",
  args: {
    state: {
      status: "ready",
      countId: "count-4",
      lines: canteenLinesWithShortfall.map((l) => ({ ...l, countedQuantity: l.expectedQuantity })),
    },
    isCanteen: true,
    onCorrect: stubCorrect,
  },
};

export const Loading: Story = {
  args: { state: { status: "loading" } },
};

export const ErrorLoading: Story = {
  args: { state: { status: "error" } },
};
