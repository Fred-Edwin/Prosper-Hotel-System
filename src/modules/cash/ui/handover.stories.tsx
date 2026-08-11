import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { HandoverView } from "./handover";

/**
 * The handover — a blind count, at both locations. See handover.tsx's doc
 * comment for why: the staff member never sees the expected figure (sales
 * sum at the restaurant, that day's Takings at the canteen), only the
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
      takingsRecordedToday: true,
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
      takingsRecordedToday: true,
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
      takingsRecordedToday: true,
    },
    onSubmit: stubSubmitFails,
  },
};

/**
 * Canteen, ticket 27 — same blind count, only the confirm step's copy
 * changes ("today's takings" instead of "what the till recorded").
 */
export const CanteenNotYetRecorded: Story = {
  name: "Canteen — not yet recorded today",
  args: {
    state: {
      status: "ready",
      handover: null,
      locationCode: "canteen",
      takingsRecordedToday: true,
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
      takingsRecordedToday: true,
    },
    onSubmit: stubSubmitAgreed,
  },
};

/**
 * The canteen-only blocked state: nothing to check the handover against
 * yet because today's takings haven't been recorded. No count form is
 * shown — recording is refused rather than compared against a false zero.
 */
export const CanteenTakingsNotRecordedYet: Story = {
  name: "Canteen — takings not recorded yet",
  args: {
    state: {
      status: "ready",
      handover: null,
      locationCode: "canteen",
      takingsRecordedToday: false,
    },
    onSubmit: stubSubmitAgreed,
  },
};
