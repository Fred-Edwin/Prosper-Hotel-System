import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { HandoverView } from "./handover";

/**
 * The handover — a blind count, at both locations. See handover.tsx's doc
 * comment for why: the staff member never sees the expected figure (sales
 * recorded that day, at either location — revised 2026-08-13), only the
 * owner does (ticket 14).
 *
 * Default is interactive: type both amounts, "Check what I've counted" to
 * reach the confirm step, then "Hand over" to reach the recorded state, all
 * within the canvas. onSubmit is stubbed so no network call leaves the
 * story.
 */
const meta = {
  title: "Modules/Cash/Handover",
  component: HandoverView,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof HandoverView>;

export default meta;
type Story = StoryObj<typeof meta>;

const stubSubmitAgreed = async (input: { cashMinor: number; mpesaMinor: number }) => ({
  ok: true as const,
  handover: { actualCashMinor: input.cashMinor, actualMpesaMinor: input.mpesaMinor },
});

const stubSubmitFails = async () => ({ ok: false as const, error: "network" });

export const Default: Story = {
  name: "Not yet recorded today",
  args: {
    state: {
      status: "ready",
      handover: null,
      locationCode: "restaurant",
    },
    onSubmit: stubSubmitAgreed,
  },
};

export const Loading: Story = {
  args: { state: { status: "loading" } },
};

export const Denied: Story = {
  name: "Permission denied",
  args: { state: { status: "denied" } },
};

export const ErrorLoading: Story = {
  name: "Error loading today's handover",
  args: { state: { status: "error" } },
};

/**
 * Already recorded today — Sarah's stress case from the design fixtures,
 * short by 250 in cash. The staff view never shows that: she only sees
 * what she herself entered, with the option to record again.
 */
export const AlreadyRecordedToday: Story = {
  name: "Already recorded today — editable",
  args: {
    state: {
      status: "ready",
      handover: { actualCashMinor: 8150, actualMpesaMinor: 6200 },
      locationCode: "restaurant",
    },
    onSubmit: stubSubmitAgreed,
  },
};

export const SubmitFails: Story = {
  name: "Submit fails — count preserved",
  args: {
    state: {
      status: "ready",
      handover: null,
      locationCode: "restaurant",
    },
    onSubmit: stubSubmitFails,
  },
};

/**
 * Ticket 28: a non-owner's second edit after their own handover already
 * closed the day. The staff member can still see and re-enter their count,
 * but submitting is rejected with a clear reason.
 */
export const DayClosed: Story = {
  name: "Day closed — edit rejected",
  args: {
    state: {
      status: "ready",
      handover: { actualCashMinor: 8150, actualMpesaMinor: 6200 },
      locationCode: "restaurant",
    },
    onSubmit: async () => ({ ok: false as const, error: "day_closed" }),
  },
};

/**
 * Canteen, revised 2026-08-13 — same blind count, same single handover
 * step as the restaurant (no separate takings declaration beforehand).
 * Only the confirm step's copy changes ("today's recorded sales" instead
 * of "what the till recorded").
 */
export const CanteenNotYetRecorded: Story = {
  name: "Canteen — not yet recorded today",
  args: {
    state: {
      status: "ready",
      handover: null,
      locationCode: "canteen",
    },
    onSubmit: stubSubmitAgreed,
  },
};

export const CanteenAlreadyRecordedToday: Story = {
  name: "Canteen — already recorded today, editable",
  args: {
    state: {
      status: "ready",
      handover: { actualCashMinor: 4800, actualMpesaMinor: 3200 },
      locationCode: "canteen",
    },
    onSubmit: stubSubmitAgreed,
  },
};
