import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { StaffShellHome } from "@/components/layout/staff-shell";
import { TransferVariant } from "./transfer-variants";

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

function Frame({ variant }: { variant: "inline" | "tray" | "review" }) {
  return (
    <StaffShellHome
      staffName="Janiffer"
      locationName="restaurant"
      active="transfer"
      title="Transfer stock"
      onHome={() => {}}
    >
      <TransferVariant variant={variant} />
    </StaffShellHome>
  );
}

export const InlineDraft: Story = { render: () => <Frame variant="inline" /> };
export const PersistentTray: Story = { render: () => <Frame variant="tray" /> };
export const ReviewLed: Story = { render: () => <Frame variant="review" /> };
