import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { HelpPanel } from "./help-panel";
import { Button } from "@/components/ui/button";

const meta = {
  title: "Patterns/HelpPanel",
  component: HelpPanel,
  parameters: { layout: "padded" },
} satisfies Meta<typeof HelpPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Desktop width — opens as a slide-over from the right, single-topic content (Money out has one section). */
export const SlideOverSingleSection: Story = {
  name: "Slide-over — single section (Money out)",
  args: { topic: "money-out" },
  parameters: { viewport: { defaultViewport: "desktop" } },
  render: (args) => <HelpPanel {...args} />,
};

/** Desktop width — a tabbed destination (Catalogue) shows all five tabs' content in one scroll. */
export const SlideOverMultiSection: Story = {
  name: "Slide-over — multi-section, tabbed page (Catalogue)",
  args: { topic: "catalogue" },
  parameters: { viewport: { defaultViewport: "desktop" } },
  render: (args) => <HelpPanel {...args} />,
};

/** Mobile width — opens as a bottom sheet instead of a slide-over. */
export const BottomSheet: Story = {
  name: "Bottom sheet — staff shell (Wastage)",
  args: { topic: "wastage" },
  parameters: { viewport: { defaultViewport: "mobile1" } },
  render: (args) => <HelpPanel {...args} />,
};

/** Mobile width, screen with a bottom-anchored primary action (New sale's "Complete sale") — the sheet reserves space above it rather than covering it. */
export const BottomSheetAboveActionBar: Story = {
  name: "Bottom sheet — clears a bottom action bar (New sale)",
  args: { topic: "new-sale", bottomOffset: 64 },
  parameters: { viewport: { defaultViewport: "mobile1" } },
  render: (args) => (
    <div className="relative min-h-screen">
      <HelpPanel {...args} />
      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background p-3">
        <Button className="w-full" disabled>
          Complete sale
        </Button>
      </div>
    </div>
  ),
};

/** Unknown topic key — the pattern degrades to render nothing rather than an empty panel, so a missing content entry fails silently on this component rather than confusing a real screen. Storybook shows the trigger absent. */
export const UnknownTopic: Story = {
  name: "Unknown topic — no trigger rendered",
  args: { topic: "not-a-real-topic" },
  render: (args) => <HelpPanel {...args} />,
};
