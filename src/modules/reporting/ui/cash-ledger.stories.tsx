import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CashLedgerView, type CashLedgerDayData } from "./cash-ledger";

/**
 * The Ledger's Cash tab (ticket 40). Real seed-shaped data across three
 * days, with all five money-out categories and both handovers and a
 * repayment as money in, cash and M-Pesa balances kept independently
 * throughout (docs/design.md: never pooled). Mounts `CashLedgerView`
 * directly, same split as `ProductLedgerView`: no network in Storybook,
 * only `LedgerShellView`'s real page composition supplies the fetching
 * `CashLedger`.
 */

const day1: CashLedgerDayData = {
  date: "2026-08-05",
  openingCashMinor: 3860000,
  openingMpesaMinor: 1200000,
  handoversMinor: 940000,
  repaymentsMinor: 0,
  stockMinor: 0,
  runningMinor: 0,
  assetsMinor: 0,
  drawingsMinor: 0,
  closingCashMinor: 4700000,
  closingMpesaMinor: 1300000,
  salesEditedSince: null,
  transactions: [
    {
      id: "t1",
      description: "Handover",
      category: "handover",
      method: "cash",
      amountMinor: 620000,
      recordedBy: "Lucy",
      recordType: "Handover",
      recordId: "h-t1",
      amountField: "actualCashMinor",
      methodField: null,
    },
    {
      id: "t2",
      description: "Handover",
      category: "handover",
      method: "mpesa",
      amountMinor: 320000,
      recordedBy: "Lucy",
      recordType: "Handover",
      recordId: "h-t2",
      amountField: "actualMpesaMinor",
      methodField: null,
    },
  ],
};

const day2: CashLedgerDayData = {
  date: "2026-08-06",
  openingCashMinor: 4700000,
  openingMpesaMinor: 1300000,
  handoversMinor: 1080000,
  repaymentsMinor: 80000,
  stockMinor: 1240000,
  runningMinor: 600000,
  assetsMinor: 0,
  drawingsMinor: 0,
  closingCashMinor: 4120000,
  closingMpesaMinor: 1720000,
  salesEditedSince: null,
  transactions: [
    {
      id: "t3",
      description: "Maize flour, rice — wholesaler",
      category: "stock",
      method: "cash",
      amountMinor: 1240000,
      recordedBy: "Lucy",
      recordType: "Expense",
      recordId: "t3",
      amountField: "amountMinor",
      methodField: "paymentMethod",
    },
    {
      id: "t4",
      description: "Wages — week",
      category: "running",
      method: "mpesa",
      amountMinor: 600000,
      recordedBy: "Lucy",
      recordType: "Expense",
      recordId: "t4",
      amountField: "amountMinor",
      methodField: "paymentMethod",
    },
    {
      id: "t5",
      description: "Handover",
      category: "handover",
      method: "cash",
      amountMinor: 710000,
      recordedBy: "Lucy",
      recordType: "Handover",
      recordId: "h-t5",
      amountField: "actualCashMinor",
      methodField: null,
    },
    {
      id: "t6",
      description: "Handover",
      category: "handover",
      method: "mpesa",
      amountMinor: 370000,
      recordedBy: "Lucy",
      recordType: "Handover",
      recordId: "h-t6",
      amountField: "actualMpesaMinor",
      methodField: null,
    },
    {
      id: "t7",
      description: "Drawings repayment",
      category: "repayment",
      method: "cash",
      amountMinor: 80000,
      recordedBy: "Anne",
      recordType: "DrawingRepayment",
      recordId: "t7",
      amountField: "amountMinor",
      methodField: "paymentMethod",
    },
  ],
};

const day3: CashLedgerDayData = {
  date: "2026-08-07",
  openingCashMinor: 4120000,
  openingMpesaMinor: 1720000,
  handoversMinor: 1180000,
  repaymentsMinor: 0,
  stockMinor: 0,
  runningMinor: 0,
  assetsMinor: 3000000,
  drawingsMinor: 1500000,
  closingCashMinor: 2800000,
  closingMpesaMinor: 1720000,
  salesEditedSince: null,
  transactions: [
    {
      id: "t8",
      description: "Freezer",
      category: "asset",
      method: "cash",
      amountMinor: 3000000,
      recordedBy: "Lucy",
      recordType: "Expense",
      recordId: "t8",
      amountField: "amountMinor",
      methodField: "paymentMethod",
    },
    {
      id: "t9",
      description: "Personal drawing",
      category: "drawing",
      method: "cash",
      amountMinor: 1500000,
      recordedBy: "Lucy",
      recordType: "Expense",
      recordId: "t9",
      amountField: "amountMinor",
      methodField: "paymentMethod",
    },
    {
      id: "t10",
      description: "Handover",
      category: "handover",
      method: "cash",
      amountMinor: 812000,
      recordedBy: "Lucy",
      recordType: "Handover",
      recordId: "h-t10",
      amountField: "actualCashMinor",
      methodField: null,
    },
    {
      id: "t11",
      description: "Handover",
      category: "handover",
      method: "mpesa",
      amountMinor: 368000,
      recordedBy: "Lucy",
      recordType: "Handover",
      recordId: "h-t11",
      amountField: "actualMpesaMinor",
      methodField: null,
    },
  ],
};

const meta = {
  title: "Modules/Reporting/CashLedger",
  component: CashLedgerView,
  parameters: { layout: "padded" },
  args: { onRetry: () => {} },
} satisfies Meta<typeof CashLedgerView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Populated: Story = {
  name: "Populated table",
  args: {
    state: { status: "ready", days: [day1, day2, day3] },
  },
};

export const DayExpanded: Story = {
  name: "Day expanded — transaction breakdown",
  args: {
    state: { status: "ready", days: [day1, day2, day3] },
    initialExpandedRowKey: day2.date,
  },
};

export const Loading: Story = {
  args: { state: { status: "loading" } },
};

export const EmptyNoMovements: Story = {
  name: "Empty — no movements in period",
  args: {
    state: { status: "ready", days: [] },
  },
};

export const EmptyFiltered: Story = {
  name: "Empty — filtered to zero rows",
  args: {
    state: { status: "ready", days: [day1, day2, day3] },
    initialQuery: "nonexistent description",
  },
};

export const Denied: Story = {
  name: "Permission denied — not the owner",
  args: { state: { status: "denied" } },
};

export const ErrorLoading: Story = {
  name: "Error loading the cash ledger",
  args: { state: { status: "error" } },
};

/**
 * C6 — a day whose sales moved after its handover was recorded.
 *
 * The expected figure deliberately does not follow (D2): it records a
 * check that happened between two people that evening, and a later edit
 * to the ledger is not evidence about what was counted. So the ledger and
 * that day's handover disagree afterwards, and the note says so in words
 * rather than restating one of the two numbers.
 */
export const SalesEditedSince: Story = {
  name: "Day expanded — sales edited after the handover",
  args: {
    state: {
      status: "ready",
      days: [
        day1,
        { ...day2, salesEditedSince: { count: 2, editedOn: "2026-08-12" } },
        day3,
      ],
    },
    initialExpandedRowKey: day2.date,
  },
};

/**
 * The editable table (T7).
 *
 * `onReplaceRows` is what switches editing on, so the reading stories
 * above render exactly the read-only table they always did. Amounts are
 * editable in the column each already occupies — no separate Amount
 * column, which would print every figure twice on one row. Balances and
 * day totals are read-only and say why; the payment method is read-only
 * in this ticket.
 *
 * There is no network in Storybook, so committing a cell shows the
 * saving state and then the error state — which is itself the per-cell
 * failure story.
 */
export const Editable: Story = {
  name: "Editable — day expanded, hover a figure",
  args: {
    state: { status: "ready", days: [day1, day2, day3] },
    initialExpandedRowKey: day2.date,
    onReplaceRows: () => {},
    periodStart: "2026-08-05T00:00:00.000Z",
    periodEnd: "2026-08-07T23:59:59.999Z",
  },
};
