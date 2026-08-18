import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { AmendConfirm } from "./amend-toast";

/**
 * The confirm step every ledger edit now passes through (owner decision,
 * 2026-08-18).
 *
 * T4 originally reserved this dialog for three escalations, reasoning
 * that a dialog firing constantly gets clicked through unread. The owner
 * overrode that: this is her money, and a figure changing because she
 * pressed Enter while reading is the failure she actually fears.
 *
 * So it always names the cell and both figures. A confirm that asks only
 * "are you sure?" costs a click without buying a check — she cannot see
 * what she is agreeing to. The escalations became extra warning text on a
 * dialog that was going to appear regardless.
 *
 * Cancel is focused on open, so a reflexive Enter lands on the safe
 * option.
 */
const meta = {
  title: "Modules/Reporting/AmendConfirm",
  component: AmendConfirm,
  parameters: { layout: "fullscreen" },
  args: { onCancel: () => {} },
} satisfies Meta<typeof AmendConfirm>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The ordinary case — most edits look like this. */
export const OrdinaryEdit: Story = {
  name: "Ordinary edit — the figures, nothing more",
  args: {
    confirming: {
      edit: {
        label: "Operating cost · 2026-08-15",
        from: "KSh 2,500",
        to: "KSh 2,700",
        escalation: null,
      },
      proceed: () => {},
    },
  },
};

/** A quantity rather than money — same dialog, no currency. */
export const QuantityEdit: Story = {
  name: "Quantity edit",
  args: {
    confirming: {
      edit: {
        label: "Sold · Chapati · 2026-08-17",
        from: "30",
        to: "28",
        escalation: null,
      },
      proceed: () => {},
    },
  },
};

/**
 * Opening and closing are running totals, so correcting one moves every
 * day after it. The warning is added to the dialog, not instead of it.
 */
export const DerivedPosition: Story = {
  name: "Escalation — a running total",
  args: {
    confirming: {
      edit: {
        label: "Closing · Sukuma · 2026-08-17",
        from: "12",
        to: "15",
        escalation: { kind: "derivedPosition" },
      },
      proceed: () => {},
    },
  },
};

/** D6: warn beyond 31 days, never block. */
export const FarBack: Story = {
  name: "Escalation — months back",
  args: {
    confirming: {
      edit: {
        label: "Received · Cooking oil · 2026-05-02",
        from: "10",
        to: "12",
        escalation: { kind: "farBack", months: 3 },
      },
      proceed: () => {},
    },
  },
};

/**
 * The one that matters most. The handover's expected figure deliberately
 * will not move (D2), so the ledger and that day's check disagree
 * afterwards — the only place in this design where two figures are meant
 * to differ, and unexplained it reads exactly like a bug.
 */
export const Handover: Story = {
  name: "Escalation — the day already has a handover",
  args: {
    confirming: {
      edit: {
        label: "Handover · 2026-08-17",
        from: "KSh 570",
        to: "KSh 620",
        escalation: { kind: "handover" },
      },
      proceed: () => {},
    },
  },
};
