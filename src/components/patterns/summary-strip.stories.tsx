import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { SummaryStrip } from "./summary-strip";
import { money } from "@/lib/fixtures";

/**
 * The summary strip states, and links where a link exists.
 *
 * The two rules worth seeing side by side: a figure that is *composed* carries
 * its arithmetic directly beneath it, and a figure that a record explains
 * carries a link *alongside* it rather than instead of it. A strip whose tiles
 * all link somewhere is a strip that answers nothing.
 */
const meta = {
  title: "Patterns/SummaryStrip",
  component: SummaryStrip,
  parameters: { layout: "padded" },
} satisfies Meta<typeof SummaryStrip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    items: [
      {
        label: "Stock on hand",
        value: money(184200),
        sub: "38 items counted",
        link: { label: "See movements", href: "#" },
      },
      { label: "Low stock", value: "6", sub: "at or below 12 units", tone: "warning" },
      { label: "Without a cost", value: "3", sub: "no recipe, so no value" },
      { label: "Last counted", value: "5 Aug", sub: "restaurant store · Janiffer" },
    ],
  },
};

/** Three columns, the other honest width. */
export const ThreeUp: Story = {
  args: {
    columns: 3,
    items: [
      { label: "Paid out this period", value: money(48600), sub: "12 entries" },
      { label: "Assets", value: money(31200), sub: "equipment the business owns" },
      { label: "Drawings", value: money(17400), sub: "owed back to the business" },
    ],
  },
};

/** A composed figure shows its arithmetic in the same cell. */
export const WithArithmetic: Story = {
  args: {
    columns: 2,
    items: [
      {
        label: "Owed to Sarah",
        value: money(2750),
        detail: (
          <div className="space-y-1 text-[13px]">
            <div className="flex justify-between">
              <span className="text-muted-foreground">5 days × KSh 550</span>
              <span className="tabular">KSh 2,750</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Advances taken</span>
              <span className="tabular">−KSh 0</span>
            </div>
          </div>
        ),
      },
      {
        label: "Owed to the business",
        value: money(8030),
        sub: "5 of 6 customers",
        link: { label: "See credit and repayments", href: "#" },
      },
    ],
  },
};

/** Semantic tone, never decorative. Red is a shortfall, amber a warning. */
export const Tones: Story = {
  args: {
    columns: 3,
    items: [
      { label: "Net profit", value: money(12400), tone: "success", sub: "after everything" },
      { label: "Oldest unpaid", value: "74 days", tone: "danger", sub: "decides who to chase" },
      { label: "Unexplained shortfalls", value: "2", tone: "warning", sub: "handovers that did not agree" },
    ],
  },
};

/** A figure derived from an estimate is marked wherever it appears. */
export const Provisional: Story = {
  args: {
    columns: 2,
    items: [
      {
        label: "Cost of goods sold",
        value: money(47010),
        provisional: true,
        sub: "canteen own-goods estimated between counts",
      },
      { label: "Revenue", value: money(63740), sub: "of takings" },
    ],
  },
};

/**
 * Zero is a real answer and reads as one. "—" is reserved for values that are
 * unknown, which is a different statement.
 */
export const Empty: Story = {
  args: {
    columns: 3,
    items: [
      { label: "Paid out this period", value: money(0), sub: "nothing yet" },
      { label: "Low stock", value: "0", sub: "nothing below 12 units" },
      { label: "Without a cost", value: "0", sub: "every dish has a recipe" },
    ],
  },
};
