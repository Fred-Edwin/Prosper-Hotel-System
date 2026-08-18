import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { AmendedCell } from "./amend-history";

/**
 * Editable-ledger T9.1 — the marker on an edited cell, and its history.
 *
 * The dot is visible at rest, which departs from the *editable*
 * affordance's hover-only rule. The two answer different questions: "you
 * could change this" only matters when she is reaching for the cell, but
 * "this was changed" is something she needs to scan for — the point is
 * finding edited figures without knowing in advance which they are.
 *
 * The always-visible underline was rejected on 2026-08-17 because
 * fourteen editable columns meant marking everything. An amended cell is
 * rare: twelve amendments across an eighteen-day period in a realistic
 * database touch five cells.
 */
const meta = {
  title: "Modules/Reporting/AmendedCell",
  component: AmendedCell,
  parameters: { layout: "centered" },
} satisfies Meta<typeof AmendedCell>;

export default meta;
type Story = StoryObj<typeof meta>;

const figure = <span className="tabular text-[13px]">30</span>;

/** No history — the cell is byte-identical to what it was before T9. */
export const NeverEdited: Story = {
  name: "Never edited — no marker at all",
  args: {
    label: "Sold · Chapati · 2026-08-17",
    children: figure,
  },
};

export const EditedOnce: Story = {
  name: "Edited once",
  args: {
    label: "Sold · Chapati · 2026-08-17",
    amendments: [
      {
        cellKey: "k",
        previousValue: "32",
        newValue: "30",
        who: "Admin Owner",
        enteredAt: "2026-08-17T14:20:00.000Z",
        effectiveOn: "2026-08-17",
        ledgerContext: "sold · Chapati · restaurant",
      },
    ],
    children: figure,
  },
};

/**
 * Several edits to one figure. Newest first — "what did this say before"
 * is nearly always a question about the most recent change, and C8
 * guarantees there may be many, since Undo is itself an amendment.
 */
export const EditedSeveralTimes: Story = {
  name: "Edited several times",
  args: {
    label: "New gas cylinder · 2026-08-11",
    amendments: [
      {
        cellKey: "k",
        previousValue: "12000",
        newValue: "13000",
        who: "Admin Owner",
        enteredAt: "2026-08-18T09:12:00.000Z",
        effectiveOn: "2026-08-11",
        ledgerContext: "New gas cylinder · 2026-08-11",
      },
      {
        cellKey: "k",
        previousValue: "15000",
        newValue: "12000",
        who: "Admin Owner",
        enteredAt: "2026-08-18T08:55:00.000Z",
        effectiveOn: "2026-08-11",
        ledgerContext: "New gas cylinder · 2026-08-11",
      },
      {
        cellKey: "k",
        previousValue: "20000",
        newValue: "15000",
        who: "Admin Owner",
        enteredAt: "2026-08-18T08:40:00.000Z",
        effectiveOn: "2026-08-11",
        ledgerContext: "New gas cylinder · 2026-08-11",
      },
    ],
    children: <span className="tabular text-[13px]">KSh 13,000</span>,
  },
};

/**
 * Typed a week after the day it applies to. The popover states the
 * ledger day separately only here — saying "for 11 Aug" on an edit made
 * on 11 Aug is noise, and saying it on one made a week later is the
 * whole distinction the Amendment model keeps two dates for.
 */
export const EditedLongAfterTheDay: Story = {
  name: "Edited long after the day it applies to",
  args: {
    label: "Received · Cooking oil · 2026-05-02",
    amendments: [
      {
        cellKey: "k",
        previousValue: "10",
        newValue: "12",
        who: "Admin Owner",
        enteredAt: "2026-08-18T09:00:00.000Z",
        effectiveOn: "2026-05-02",
        ledgerContext: "received · Cooking oil · restaurant",
      },
    ],
    children: <span className="tabular text-[13px]">12</span>,
  },
};
