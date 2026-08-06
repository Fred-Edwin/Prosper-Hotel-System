import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { TableToolbar } from "./table-toolbar";
import { categories } from "@/lib/fixtures";
import { TriangleAlert, Clock } from "lucide-react";

/**
 * The table toolbar — what you are currently looking at, as opposed to what the
 * page is. It lives in the header's second band.
 *
 * The count states both numbers when filtered ("12 of 47"), because a bare
 * count after filtering cannot be told apart from a small table, and that
 * matters when someone is wondering where a row went.
 */
const meta = {
  title: "Patterns/TableToolbar",
  component: TableToolbar,
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-2">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TableToolbar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    query: "",
    onQuery: () => {},
    placeholder: "Search stock",
    noun: "items",
    count: 47,
    total: 47,
  },
};

/** With filters and a visible toggle. */
export const WithFilters: Story = {
  render: function Render() {
    const [query, setQuery] = useState("");
    const [location, setLocation] = useState("all");
    const [category, setCategory] = useState("all");
    const [low, setLow] = useState(false);
    return (
      <TableToolbar
        query={query}
        onQuery={setQuery}
        placeholder="Search stock"
        noun="items"
        count={low ? 6 : 47}
        total={47}
        filters={[
          {
            key: "location",
            value: location,
            onChange: setLocation,
            allLabel: "Both locations",
            options: [
              { value: "restaurant", label: "Restaurant" },
              { value: "canteen", label: "Canteen" },
            ],
          },
          {
            key: "category",
            value: category,
            onChange: setCategory,
            allLabel: "All categories",
            options: categories.map((c) => ({ value: c.key, label: c.label })),
            width: "8rem",
          },
        ]}
        toggles={[
          {
            key: "low",
            label: "Low stock",
            icon: TriangleAlert,
            on: low,
            onChange: setLow,
            count: 6,
          },
        ]}
      />
    );
  },
};

/**
 * Filtered. The count says "12 of 47" so the missing rows are explained rather
 * than looking like a short table.
 */
export const Filtered: Story = {
  args: {
    query: "chips",
    onQuery: () => {},
    placeholder: "Search stock",
    noun: "items",
    count: 12,
    total: 47,
  },
};

/**
 * A toggle that is on. Neutral fill, not accent — it reads as *chosen* without
 * competing with the page's primary action.
 */
export const ToggleOn: Story = {
  args: {
    query: "",
    onQuery: () => {},
    placeholder: "Search what for, or who recorded it",
    noun: "payments",
    count: 2,
    total: 12,
    toggles: [
      {
        key: "pending",
        label: "Waiting for you",
        icon: Clock,
        on: true,
        onChange: () => {},
        count: 2,
      },
    ],
  },
};

/** Disabled while the page is loading or in an error state. */
export const Disabled: Story = {
  args: {
    query: "",
    onQuery: () => {},
    placeholder: "Search stock",
    noun: "items",
    count: 0,
    total: 47,
    disabled: true,
    filters: [
      {
        key: "location",
        value: "all",
        onChange: () => {},
        allLabel: "Both locations",
        options: [{ value: "restaurant", label: "Restaurant" }],
      },
    ],
  },
};
