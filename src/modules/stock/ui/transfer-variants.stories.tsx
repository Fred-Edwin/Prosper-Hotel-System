import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { StaffShellHome } from "@/components/layout/staff-shell";
import { TransferVariant } from "./transfer-variants";

/**
 * The three variants offered during design exploration for ticket 21 —
 * "inline" was approved and is what `transfer-stock.tsx` (the production
 * entry point) renders. Kept here as the record of the choice; the
 * confirm-flow and error stories below exercise the approved variant.
 */
const meta = {
  title: "Modules/Stock/TransferDesign",
  parameters: {
    layout: "fullscreen",
    viewport: { defaultViewport: "mobile1" },
    // StaffShellHome uses next/navigation's useRouter. Tell Storybook's
    // Next/Vite framework to mount its App Router mock around this story.
    nextjs: { appDirectory: true },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

function Frame({ variant, onTransfer }: { variant: "inline" | "tray" | "review"; onTransfer?: (lines: { id: string; quantity: number }[]) => Promise<boolean> }) {
  return (
    <StaffShellHome
      staffName="Janiffer"
      locationName="restaurant"
      active="transfer"
      title="Transfer stock"
      onHome={() => {}}
    >
      <TransferVariant variant={variant} onTransfer={onTransfer} />
    </StaffShellHome>
  );
}

export const InlineDraft: Story = { render: () => <Frame variant="inline" /> };
export const PersistentTray: Story = { render: () => <Frame variant="tray" /> };
export const ReviewLed: Story = { render: () => <Frame variant="review" /> };

export const ConfirmFlow: Story = {
  name: "Confirm flow — approved (inline) variant",
  render: () => <Frame variant="inline" onTransfer={async () => true} />,
};

export const InsufficientStockError: Story = {
  name: "Insufficient stock — rejected on confirm",
  render: () => <Frame variant="inline" onTransfer={async () => false} />,
};
