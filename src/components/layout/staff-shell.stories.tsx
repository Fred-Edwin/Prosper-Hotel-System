import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { StaffShellHome, StaffHome } from "./staff-shell";
import { HelpCircle } from "lucide-react";

/**
 * The staff shell — Launcher.
 *
 * A cashier is not navigating. She is on the till for six hours and hands over
 * once, so persistent navigation is furniture for a journey nobody takes — and
 * it would permanently occupy the bottom 60px, which is where the thumb is and
 * where the primary action has to live. A tab bar lost on exactly that.
 *
 * Three shells at 3 / 6 / 5 links, all from the same frame. Task content
 * (handover, sale, etc.) is a placeholder here — it is built per module, not
 * part of the shell.
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
    <StaffShellHome
      staffName="Sarah"
      locationName="restaurant"
      active={null}
      title=""
    >
      <StaffHome role="cashier" handedOverToday={false} onOpen={() => {}} />
    </StaffShellHome>
  ),
};

/** Six links is where the launcher is least comfortable, and it still holds. */
export const HomeStoreManager: Story = {
  name: "Home — store manager (6 links)",
  render: () => (
    <StaffShellHome
      staffName="Janiffer"
      locationName="restaurant"
      active={null}
      title=""
    >
      <StaffHome
        role="store-manager"
        handedOverToday={false}
        onOpen={() => {}}
      />
    </StaffShellHome>
  ),
};

export const HomeAttendant: Story = {
  name: "Home — attendant (5 links)",
  render: () => (
    <StaffShellHome
      staffName="Anne"
      locationName="canteen"
      active={null}
      title=""
    >
      <StaffHome role="attendant" handedOverToday={false} onOpen={() => {}} />
    </StaffShellHome>
  ),
};

/** Already handed over today — the banner is gone. */
export const HomeHandedOver: Story = {
  name: "Home — already handed over",
  render: () => (
    <StaffShellHome
      staffName="Sarah"
      locationName="restaurant"
      active={null}
      title=""
    >
      <StaffHome role="cashier" handedOverToday onOpen={() => {}} />
    </StaffShellHome>
  ),
};

/** Inside a task the whole screen belongs to the task, and leaving is the
 * back arrow every phone user already knows. */
export const InsideATask: Story = {
  name: "Task — placeholder content",
  render: () => (
    <StaffShellHome
      staffName="Sarah"
      locationName="restaurant"
      active="sell"
      title="New sale"
      onHome={() => {}}
    >
      <div className="p-3 text-[13px] text-muted-foreground">
        Task content lives in its own module.
      </div>
    </StaffShellHome>
  ),
};

/** The task header's actions slot, top-right — populated here with a
 * placeholder to confirm it doesn't crowd the back-chevron/title. Real
 * content (the HelpPanel trigger) is wired per-screen in a later ticket. */
export const InsideATaskWithActions: Story = {
  name: "Task — with header action",
  render: () => (
    <StaffShellHome
      staffName="Sarah"
      locationName="restaurant"
      active="sell"
      title="New sale"
      onHome={() => {}}
      actions={
        <button
          className="flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
          aria-label="Help"
        >
          <HelpCircle className="size-4.5" />
        </button>
      }
    >
      <div className="p-3 text-[13px] text-muted-foreground">
        Task content lives in its own module.
      </div>
    </StaffShellHome>
  ),
};
