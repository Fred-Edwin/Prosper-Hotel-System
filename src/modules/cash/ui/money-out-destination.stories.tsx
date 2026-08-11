import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { MoneyOutContentView, type LoadState, type BalanceState } from "./money-out-destination";
import type { ExpenseView } from "./money-out-list";
import type { ReceiptOption } from "./expense-fields";
import type {
  DrawingRepaymentView,
  BalanceState as DrawingDebtState,
  RepaymentListState,
} from "./drawing-repayment-card";

/**
 * Money out — sheet record form chosen at the ticket 16 checkpoint, matching
 * how Catalogue's product/ingredient/recipe forms already open.
 *
 * Content only, no AdminShell — same split Catalogue uses in its own
 * stories, since AdminShell's Sidebar needs an app-router context
 * Storybook doesn't provide.
 */
const meta = {
  title: "Cash/MoneyOutDestination",
  component: MoneyOutContentView,
  parameters: { layout: "padded" },
} satisfies Meta<typeof MoneyOutContentView>;

export default meta;
type Story = StoryObj<typeof meta>;

const expenses: ExpenseView[] = [
  {
    id: "exp-1",
    category: "stock",
    amountMinor: 800000,
    paymentMethod: "cash",
    note: "Flour and cooking oil delivery",
    occurredAt: "2026-08-08T07:10:00.000Z",
    staffMemberName: "Lucy Owner",
    reversed: false,
  },
  {
    id: "exp-2",
    category: "running",
    amountMinor: 500000,
    paymentMethod: "mpesa",
    note: "Gas refill",
    occurredAt: "2026-08-08T06:40:00.000Z",
    staffMemberName: "Lucy Owner",
    reversed: false,
  },
  {
    id: "exp-3",
    category: "asset",
    amountMinor: 1500000,
    paymentMethod: "cash",
    note: "New chest freezer",
    occurredAt: "2026-08-07T15:20:00.000Z",
    staffMemberName: "Lucy Owner",
    reversed: false,
  },
  {
    id: "exp-4",
    category: "drawing",
    amountMinor: 200000,
    paymentMethod: "cash",
    note: null,
    occurredAt: "2026-08-07T09:05:00.000Z",
    staffMemberName: "Lucy Owner",
    reversed: false,
  },
  {
    id: "exp-5",
    category: "running",
    amountMinor: 120000,
    paymentMethod: "cash",
    note: "Charcoal — recorded twice by mistake",
    occurredAt: "2026-08-06T18:00:00.000Z",
    staffMemberName: "Lucy Owner",
    reversed: true,
  },
];

const balanceReady: BalanceState = { status: "ready", cashMinor: 4500000, mpesaMinor: 1230000 };

async function fetchBalanceStub(): Promise<BalanceState> {
  return balanceReady;
}

const receipts: ReceiptOption[] = [
  { receiptId: "rec-1", occurredAt: "2026-08-08T07:00:00.000Z", totalMinor: 800000, lineCount: 3 },
  { receiptId: "rec-2", occurredAt: "2026-08-05T11:30:00.000Z", totalMinor: 420000, lineCount: 2 },
];

const ready: LoadState = { status: "ready", expenses };

async function fetchReceiptsStub(): Promise<ReceiptOption[]> {
  return receipts;
}

async function submitStub() {
  return { ok: true as const };
}

async function reverseStub() {
  return { ok: true as const };
}

const drawingRepayments: DrawingRepaymentView[] = [
  { id: "repay-1", amountMinor: 100000, occurredAt: "2026-08-09T10:00:00.000Z", reversed: false },
  { id: "repay-2", amountMinor: 50000, occurredAt: "2026-08-05T10:00:00.000Z", reversed: true },
];

const drawingDebtOutstanding: DrawingDebtState = { status: "ready", outstandingMinor: 50000 };
const drawingDebtZero: DrawingDebtState = { status: "ready", outstandingMinor: 0 };
const repaymentListReady: RepaymentListState = { status: "ready", repayments: drawingRepayments };

async function fetchDrawingDebtStub(): Promise<DrawingDebtState> {
  return drawingDebtOutstanding;
}

async function fetchDrawingDebtZeroStub(): Promise<DrawingDebtState> {
  return drawingDebtZero;
}

async function fetchDrawingRepaymentsStub(): Promise<RepaymentListState> {
  return repaymentListReady;
}

async function fetchDrawingRepaymentsEmptyStub(): Promise<RepaymentListState> {
  return { status: "ready", repayments: [] };
}

async function submitDrawingRepaymentStub() {
  return { ok: true as const };
}

async function reverseDrawingRepaymentStub() {
  return { ok: true as const };
}

const shared = {
  fetchReceiptsFn: fetchReceiptsStub,
  fetchBalanceFn: fetchBalanceStub,
  onSubmit: submitStub,
  onReverseRequest: reverseStub,
  fetchDrawingDebtFn: fetchDrawingDebtStub,
  fetchDrawingRepaymentsFn: fetchDrawingRepaymentsStub,
  onSubmitDrawingRepayment: submitDrawingRepaymentStub,
  onReverseDrawingRepaymentRequest: reverseDrawingRepaymentStub,
};

export const Default: Story = { args: { ...shared, state: ready } };
export const Loading: Story = { args: { ...shared, state: { status: "loading" } } };
export const Empty: Story = { args: { ...shared, state: { status: "ready", expenses: [] } } };
export const ErrorState: Story = { args: { ...shared, state: { status: "error" } } };
export const Denied: Story = { args: { ...shared, state: { status: "denied" } } };

// Ticket 32 — the repayment flow: outstanding balance, "Record repayment"
// action, and a reversible history list.
export const DrawingRepaymentFlow: Story = {
  args: { ...shared, state: ready },
};

// Ticket 32 — nothing owed: no repayment action, an empty-state message
// instead of a balance to pay down.
export const DrawingRepaymentZeroBalance: Story = {
  args: {
    ...shared,
    state: ready,
    fetchDrawingDebtFn: fetchDrawingDebtZeroStub,
    fetchDrawingRepaymentsFn: fetchDrawingRepaymentsEmptyStub,
  },
};
