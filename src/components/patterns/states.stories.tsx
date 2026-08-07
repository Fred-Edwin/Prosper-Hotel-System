import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  EmptyFirstUse,
  EmptyFiltered,
  ErrorState,
  PermissionDenied,
  LoadingTable,
  LoadingDetail,
  NotBuilt,
} from "./states";
import { Button } from "@/components/ui/button";
import { PackageOpen, Plus } from "lucide-react";

/**
 * The five states every list, table and detail view must have.
 *
 * The distinctions are load-bearing, and seeing them next to each other is the
 * point of this file: first-use and filter-empty say different things, loading
 * holds the shape of what is coming, error promises nothing was lost, and
 * permission-denied states a reason rather than hiding a control.
 */
const meta = {
  title: "Patterns/States",
  parameters: { layout: "padded" },
} satisfies Meta;

export default meta;
type Story = StoryObj;

/**
 * First use. Says what goes here and how to create the first one.
 *
 * Never shown to someone who filtered — see FilterEmpty.
 */
export const FirstUse: Story = {
  render: () => (
    <EmptyFirstUse
      icon={<PackageOpen className="size-4" />}
      title="No stock recorded yet"
      body="Once you receive your first delivery or take an opening count, everything you hold will be listed here with what it is worth."
      action={
        <Button size="sm" className="h-8">
          <Plus className="size-3.5" /> Take an opening count
        </Button>
      }
    />
  ),
};

/**
 * A destination whose module isn't built yet — distinct from FirstUse, which
 * is a built screen with no records. No call to action: there is nothing the
 * user can do here to make it appear sooner.
 */
export const NotBuiltYet: Story = {
  render: () => <NotBuilt destination="Dashboard" />,
};

/**
 * No results from a filter — a *different* message.
 *
 * Never "create your first one" here: they have four hundred, they filtered
 * wrong, and telling them to create one suggests the system lost their data.
 */
export const FilterEmpty: Story = {
  render: () => <EmptyFiltered onClear={() => {}} noun="stock items" />,
};

/**
 * Plain language, a retry, and an explicit promise that nothing was lost.
 * A page that clears its filters on failure is unforgivable in a system people
 * enter money into.
 */
export const Error: Story = {
  render: () => <ErrorState what="stock" />,
};

/**
 * Hidden, or disabled with a stated reason — never an enabled control that
 * errors on click, and never a silently missing section. The body says what
 * they *can* see and who to ask.
 */
export const Denied: Story = {
  render: () => (
    <PermissionDenied
      title="Stock valuation is owner-only"
      body="You can see quantities on hand from the till. What stock is worth is restricted to Lucy — ask her if you need it."
    />
  ),
};

/**
 * A skeleton at the real dimensions, not a spinner. Same four-tile strip, same
 * 41px rows, so the page does not jump when the data arrives.
 */
export const LoadingATable: Story = {
  name: "Loading — table",
  render: () => <LoadingTable summary={4} rows={8} columns={6} />,
};

/** The detail page's shape: two columns, not a table. */
export const LoadingADetail: Story = {
  name: "Loading — detail",
  render: () => <LoadingDetail />,
};

/** A table with no summary strip above it — Activity's shape. */
export const LoadingTableOnly: Story = {
  name: "Loading — table, no summary",
  render: () => <LoadingTable summary={0} rows={12} columns={7} />,
};
