import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { StaffShellHome, StaffHome } from "./shell-home";
import { MethodBlock, NoteBlock, ConfirmBlock } from "./handover-body";
import { Button } from "@/components/ui/button";

/**
 * The staff shell — Launcher.
 *
 * A cashier is not navigating. She is on the till for six hours and hands over
 * once, so persistent navigation is furniture for a journey nobody takes — and
 * it would permanently occupy the bottom 60px, which is where the thumb is and
 * where the primary action has to live. A tab bar lost on exactly that.
 *
 * Three shells at 3 / 6 / 5 links, all from the same frame.
 */
const meta = {
  title: "Shells/StaffShell",
  parameters: { layout: "fullscreen", viewport: { defaultViewport: "mobile1" } },
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const HomeCashier: Story = {
  name: "Home — cashier (3 links)",
  render: () => (
    <StaffShellHome role="cashier" active={null} title="">
      <StaffHome role="cashier" onOpen={() => {}} />
    </StaffShellHome>
  ),
};

/** Six links is where the launcher is least comfortable, and it still holds. */
export const HomeStoreManager: Story = {
  name: "Home — store manager (6 links)",
  render: () => (
    <StaffShellHome role="store-manager" active={null} title="">
      <StaffHome role="store-manager" onOpen={() => {}} />
    </StaffShellHome>
  ),
};

export const HomeAttendant: Story = {
  name: "Home — attendant (5 links)",
  render: () => (
    <StaffShellHome role="attendant" active={null} title="">
      <StaffHome role="attendant" onOpen={() => {}} />
    </StaffShellHome>
  ),
};

/**
 * Inside a task the whole screen belongs to the task, and leaving is the back
 * arrow every phone user already knows.
 *
 * The handover count is **blind** — no expected figure anywhere, because a
 * shown expectation is a target to reconcile *to*. The only feedback is the
 * amount echoed back in words, which catches the failure a blind count actually
 * has: a typo.
 */
export const HandoverCounting: Story = {
  name: "Task — handover, counting",
  render: () => (
    <StaffShellHome
      role="cashier"
      active="handover"
      title="Handover"
      onHome={() => {}}
    >
      <div className="flex min-h-full flex-col">
        <div className="flex-1 space-y-2.5 p-3">
          <p className="text-[13px] text-muted-foreground">
            Count what you are handing over. Cash and M-Pesa are counted
            separately.
          </p>
          <MethodBlock
            label="Cash"
            note="Notes and coins in the drawer"
            value="8150"
            onChange={() => {}}
          />
          <MethodBlock
            label="M-Pesa"
            note="Check against the paybill messages"
            value=""
            onChange={() => {}}
          />
          <NoteBlock value="" onChange={() => {}} />
        </div>
        <div className="sticky bottom-0 border-t bg-card px-4 py-3">
          <Button className="h-12 w-full text-[15px]" disabled>
            Check what I&apos;ve counted
          </Button>
          <p className="mt-1.5 text-center text-[11px] text-muted-foreground">
            Enter both amounts, even if one is nothing
          </p>
        </div>
      </div>
    </StaffShellHome>
  ),
};

/**
 * The confirm step. It replaces the self-correction a blind count removes —
 * figures repeated back large and in words, one way forward, one way back.
 *
 * The staff member is told the comparison happens, not its result. Concealing
 * that a count is checked would be a trick.
 */
export const HandoverConfirming: Story = {
  name: "Task — handover, confirming",
  render: () => (
    <StaffShellHome
      role="cashier"
      active="handover"
      title="Handover"
      onHome={() => {}}
    >
      <div className="flex min-h-full flex-col">
        <div className="flex-1">
          <ConfirmBlock cashN={8150} mpesaN={6200} onBack={() => {}} />
        </div>
        <div className="sticky bottom-0 border-t bg-card px-4 py-3">
          <Button className="h-12 w-full text-[15px]">Hand over now</Button>
        </div>
      </div>
    </StaffShellHome>
  ),
};
