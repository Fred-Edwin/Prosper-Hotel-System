import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ActivityView, type ActivityRowData } from "./activity";

/**
 * Activity — the audit trail (ticket 45). Mounts `ActivityView` directly,
 * same split as `CashLedgerView`: no network in Storybook, only the real
 * page composition (`Activity`) supplies fetching. Real seed-shaped rows
 * across sale/void/correction/movement/handover/takings/expense/
 * repayment/days_worked, with the correction row's effective/entered gap
 * — the single most load-bearing row type in this table.
 */

const rows: ActivityRowData[] = [
  {
    id: "sale-1",
    enteredAt: "2026-08-06 14:22",
    effectiveOn: "2026-08-06",
    kind: "sale",
    who: "Sarah",
    whoId: "staff-sarah",
    what: "Sale — 3 × Soda 500ml",
    locationName: "Restaurant",
    amountMinor: 240,
    reason: null,
  },
  {
    id: "expense-1",
    enteredAt: "2026-08-06 14:05",
    effectiveOn: "2026-08-06",
    kind: "expense",
    who: "Janiffer",
    whoId: "staff-janiffer",
    what: "Expense — stock — Charcoal, 2 sacks",
    locationName: "Restaurant",
    amountMinor: 1600,
    reason: null,
  },
  {
    // Was a "correction" row until T11 removed that mechanism. An
    // amendment is what replaces it, and the fixture had none — so the
    // "amendment" kind rendered a notable badge that no story ever
    // showed. `effectiveOn` is the day the edit applies to, `enteredAt`
    // the day she typed it; the gap between them is the point.
    id: "amendment-1",
    enteredAt: "2026-08-06 13:40",
    effectiveOn: "2026-08-03",
    kind: "amendment",
    who: "Lucy",
    whoId: "staff-lucy",
    what: "Sold · Rice plate · 3 Aug: 12 → 10",
    locationName: "Canteen",
    amountMinor: null,
    reason: null,
  },
  {
    id: "movement-1",
    enteredAt: "2026-08-06 12:58",
    effectiveOn: "2026-08-06",
    kind: "movement",
    who: "Janiffer",
    whoId: "staff-janiffer",
    what: "12 × Potatoes — issued to kitchen",
    locationName: "Restaurant",
    amountMinor: null,
    reason: null,
  },
  {
    id: "void-1",
    enteredAt: "2026-08-06 12:31",
    effectiveOn: "2026-08-06",
    kind: "void",
    who: "Mercy",
    whoId: "staff-mercy",
    what: "Sale voided — 1 × Chips",
    locationName: "Restaurant",
    amountMinor: 260,
    reason: null,
  },
  {
    id: "handover-1",
    enteredAt: "2026-08-06 09:02",
    effectiveOn: "2026-08-06",
    kind: "handover",
    who: "Anne",
    whoId: "staff-anne",
    what: "Handed over cash and M-Pesa",
    locationName: "Canteen",
    amountMinor: 5270,
    reason: null,
  },
  {
    id: "takings-1",
    enteredAt: "2026-08-05 19:47",
    effectiveOn: "2026-08-05",
    kind: "takings",
    who: "Anne",
    whoId: "staff-anne",
    what: "Canteen takings recorded",
    locationName: "Canteen",
    amountMinor: 4800,
    reason: null,
  },
  {
    id: "repayment-1",
    enteredAt: "2026-08-05 18:20",
    effectiveOn: "2026-08-05",
    kind: "repayment",
    who: "Lucy",
    whoId: "staff-lucy",
    what: "Drawing repayment",
    locationName: null,
    amountMinor: 800,
    reason: null,
  },
  {
    id: "days-worked-1",
    enteredAt: "2026-08-05",
    effectiveOn: "2026-08-05",
    kind: "days_worked",
    who: "Mercy",
    whoId: "staff-mercy",
    what: "Mercy — day worked",
    locationName: null,
    amountMinor: null,
    reason: null,
  },
];

const meta = {
  title: "Modules/Reporting/Activity",
  component: ActivityView,
  parameters: { layout: "padded" },
  args: {
    page: 1,
    kind: "all",
    personId: "all",
    query: "",
    people: [
      { id: "staff-sarah", name: "Sarah" },
      { id: "staff-lucy", name: "Lucy" },
      { id: "staff-anne", name: "Anne" },
      { id: "staff-mercy", name: "Mercy" },
      { id: "staff-janiffer", name: "Janiffer" },
    ],
    onPage: () => {},
    onKind: () => {},
    onPerson: () => {},
    onQuery: () => {},
    onClear: () => {},
    onRetry: () => {},
  },
} satisfies Meta<typeof ActivityView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Populated: Story = {
  args: { state: { status: "ready", rows, total: 1284 } },
};

export const Loading: Story = {
  args: { state: { status: "loading" } },
};

export const EmptyFirstUse: Story = {
  name: "Empty — first use",
  args: { state: { status: "ready", rows: [], total: 0 } },
};

export const EmptyFiltered: Story = {
  name: "Empty — filtered to zero rows",
  args: {
    state: { status: "ready", rows: [], total: 0 },
    query: "nonexistent phrase",
  },
};

export const Denied: Story = {
  name: "Permission denied — not the owner",
  args: { state: { status: "denied" } },
};
