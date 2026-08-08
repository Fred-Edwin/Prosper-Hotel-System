import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { HandoverView } from "./handover";

/**
 * The restaurant handover — a blind count. See handover.tsx's doc comment
 * for why: the staff member never sees the expected figure, only the owner
 * does (ticket 14).
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
    state: { status: "ready", handover: null },
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
    },
    onSubmit: stubSubmitAgreed,
  },
};

export const SubmitFails: Story = {
  name: "Submit fails — count preserved",
  args: {
    state: { status: "ready", handover: null },
    onSubmit: stubSubmitFails,
  },
};
