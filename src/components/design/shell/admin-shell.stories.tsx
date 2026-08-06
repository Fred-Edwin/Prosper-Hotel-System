import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { AdminShell } from "./admin-shell";
import { SummaryStrip } from "@/components/patterns/summary-strip";
import { TableToolbar } from "@/components/patterns/table-toolbar";
import { Button } from "@/components/ui/button";
import { money } from "@/lib/fixtures";
import { Download, Plus } from "lucide-react";

/**
 * The admin shell: brand-tinted rail, two-band header, content area.
 *
 * The rail is the one surface on every admin screen, which makes it the
 * cheapest place to give the software an identity — and the only place a strong
 * colour sits without spending the page's one-accent budget. Every foreground
 * on it was contrast-checked rather than eyeballed; muted 13px labels clear AA
 * at 7.29:1.
 *
 * The header is two bands doing different jobs: what the page **is** (title,
 * actions) above what you are **currently viewing** (search, filters, counts).
 * The toolbar is sticky; the header is not.
 *
 * Collapse state persists in localStorage, so these stories may open collapsed
 * if you collapsed it last.
 */
const meta = {
  title: "Shells/AdminShell",
  component: AdminShell,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof AdminShell>;

export default meta;
type Story = StoryObj<typeof meta>;

const body = (
  <SummaryStrip
    items={[
      {
        label: "Stock on hand",
        value: money(184200),
        sub: "38 items counted",
        link: { label: "See movements", href: "#" },
      },
      { label: "Low stock", value: "6", sub: "at or below 12 units", tone: "warning" },
      { label: "Without a cost", value: "3", sub: "no recipe, so no value" },
      { label: "Last counted", value: "5 Aug", sub: "restaurant store · Janiffer" },
    ]}
  />
);

export const Default: Story = {
  args: {
    active: "stock",
    title: "Stock",
    subtitle: "What is on hand at both locations, and what it is worth",
    actions: (
      <>
        <Button variant="outline" size="sm" className="h-8">
          <Download className="size-3.5" /> Export
        </Button>
        <Button size="sm" className="h-8">
          <Plus className="size-3.5" /> Take a count
        </Button>
      </>
    ),
    toolbar: (
      <TableToolbar
        query=""
        onQuery={() => {}}
        placeholder="Search stock"
        noun="items"
        count={47}
        total={47}
      />
    ),
    children: body,
  },
};

/** A page with no toolbar — the header is then a single band. */
export const WithoutToolbar: Story = {
  args: {
    active: "dashboard",
    title: "Dashboard",
    subtitle: "Today's figures, and what needs you",
    actions: (
      <Button size="sm" className="h-8">
        Record money out
      </Button>
    ),
    children: body,
  },
};

/** A record inside a destination carries a breadcrumb back to its list. */
export const WithBreadcrumb: Story = {
  args: {
    active: "people",
    trail: [{ label: "People", href: "#" }],
    title: "Sarah",
    subtitle: "Cashier · Restaurant · started 2 June 2025",
    actions: (
      <Button variant="outline" size="sm" className="h-8">
        Record a day
      </Button>
    ),
    children: body,
  },
};

/**
 * Under `md` the rail becomes a drawer — the same rail, with its groups,
 * location scope and live figure, not a different navigation. Seven
 * destinations across three groups cannot reduce to four tabs and a "More".
 */
export const Mobile: Story = {
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
  args: {
    active: "stock",
    title: "Stock",
    subtitle: "What is on hand",
    children: body,
  },
};
