import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { TakingsScreen } from "./takings";

/**
 * Canteen takings — a direct declaration, not a blind count. See
 * takings.tsx's doc comment for why this diverges from Handover's framing
 * despite sharing its shape.
 *
 * Default is interactive: type both totals, "Check what I've entered" to
 * reach the confirm step, then "Record today's takings" to reach the
 * recorded state, all within the canvas. onSubmit is stubbed so no network
 * call leaves the story.
 */
const meta = {
  title: "Modules/Cash/Takings",
  component: TakingsScreen,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof TakingsScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

const stubSubmitOk = async (input: { cashMinor: number; mpesaMinor: number }) => ({
  ok: true as const,
  takings: { cashMinor: input.cashMinor, mpesaMinor: input.mpesaMinor },
});

const stubSubmitFails = async () => ({ ok: false as const, error: "network" });

export const Default: Story = {
  name: "Not yet recorded today",
  args: {
    state: { status: "ready", takings: null },
    onSubmit: stubSubmitOk,
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
  name: "Error loading today's takings",
  args: { state: { status: "error" } },
};

/** Already recorded today — Anne's ordinary close, editable in place. */
export const AlreadyRecordedToday: Story = {
  name: "Already recorded today — editable",
  args: {
    state: {
      status: "ready",
      takings: { cashMinor: 3400, mpesaMinor: 2000 },
    },
    onSubmit: stubSubmitOk,
  },
};

export const SubmitFails: Story = {
  name: "Submit fails — entry preserved",
  args: {
    state: { status: "ready", takings: null },
    onSubmit: stubSubmitFails,
  },
};

/**
 * Ticket 28: the attendant's own handover already closed the day, so a
 * takings re-entry is rejected with a clear reason.
 */
export const DayClosed: Story = {
  name: "Day closed — edit rejected",
  args: {
    state: {
      status: "ready",
      takings: { cashMinor: 5000, mpesaMinor: 3200 },
    },
    onSubmit: async () => ({ ok: false as const, error: "day_closed" }),
  },
};
