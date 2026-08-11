import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { StockCountReviewView, type DerivedSaleLine, type ReviewLine } from "./stock-count-review";

/**
 * Owner's stock count review/correct table — desktop-oriented, under the
 * admin Stock destination. Ticket 20.
 *
 * Real seed-shaped data: a restaurant count with two agreeing lines and
 * one short (theft, breakage or a miscount — the count doesn't say which,
 * only that it disagrees). The correction is a quantity entry pre-filled
 * with the counted value, not a single-tap reversal.
 *
 * Ticket 24 adds the "since last count" section — the canteen's
 * derived-sold quantity and revenue per item, absent for a restaurant
 * count (most stories here) or shown as unavailable for a canteen's
 * first-ever count.
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
    state: { status: "ready", countId: "count-1", lines: mixedLines, derivedSales: { available: false } },
    onCorrect: stubCorrect,
  },
};

/** The correction input open on the flagged line, pre-filled with the
 * counted value and editable — the state this ticket's checkpoint asked to
 * be shown before wiring to the API. */
export const CorrectionOpen: Story = {
  name: "Correction input open on a flagged line",
  args: {
    state: { status: "ready", countId: "count-1", lines: mixedLines, derivedSales: { available: false } },
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
      derivedSales: { available: false },
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
      derivedSales: { available: false },
    },
    onCorrect: stubCorrect,
  },
};

export const NoCountYet: Story = {
  name: "Empty — no count recorded yet",
  args: {
    state: { status: "ready", countId: null, lines: null, derivedSales: { available: false } },
  },
};

const canteenLines: ReviewLine[] = [
  {
    id: "c1",
    itemType: "product",
    itemName: "Soda 500ml",
    countedQuantity: 25,
    expectedQuantity: 25,
    correctedAt: null,
  },
  {
    id: "c2",
    itemType: "product",
    itemName: "Biscuits",
    countedQuantity: 60,
    expectedQuantity: 60,
    correctedAt: null,
  },
];

const derivedLines: DerivedSaleLine[] = [
  { productId: "p1", itemName: "Soda 500ml", quantity: 32, revenueMinor: 3200 },
  { productId: "p2", itemName: "Biscuits", quantity: 18, revenueMinor: 900 },
];

/** A canteen count with a previous count to derive against — the
 * "since last count" table shows what sold, item by item, per
 * formulas.md §2's formula. */
export const CanteenWithDetail: Story = {
  name: "Canteen — since last count",
  args: {
    state: {
      status: "ready",
      countId: "count-3",
      lines: canteenLines,
      derivedSales: { available: true, lines: derivedLines },
    },
    onCorrect: stubCorrect,
  },
};

/** The canteen's first-ever count — nothing to derive against yet, per
 * formulas.md's "first period has no measured rate" caveat. Shown as
 * unavailable rather than a false zero-baseline figure. */
export const CanteenFirstCount: Story = {
  name: "Canteen — first count, detail unavailable",
  args: {
    state: {
      status: "ready",
      countId: "count-4",
      lines: canteenLines,
      derivedSales: { available: false },
    },
    onCorrect: stubCorrect,
  },
};

export const Loading: Story = {
  args: { state: { status: "loading" } },
};

export const ErrorLoading: Story = {
  args: { state: { status: "error" } },
};
