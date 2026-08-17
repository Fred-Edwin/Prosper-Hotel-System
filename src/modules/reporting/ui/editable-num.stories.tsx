import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { EditableNum } from "./editable-num";

/**
 * Editable-ledger T4 — the editable ledger cell, in every state.
 *
 * **The affordance is nothing at rest** — a dotted underline appears only
 * on hover or focus. An always-visible underline was built first and
 * rejected on review (2026-08-17): fourteen marked columns made the widest
 * table in the app hard to read, and reading is what it is mostly for.
 *
 * See "In a ledger row" below, which is the story worth looking at; the
 * isolated states above it are for checking each treatment on its own.
 *
 * Interaction to try: move the cursor across the row (the underline
 * follows), click a cell (focus ring, nothing changed yet), then type a
 * digit — the editor opens with that digit. Enter commits and drops to the
 * cell below. Escape reverts.
 */
const meta = {
  title: "Reporting/EditableNum",
  component: EditableNum,
  parameters: { layout: "centered" },
} satisfies Meta<typeof EditableNum>;

export default meta;
type Story = StoryObj<typeof meta>;

export const IdleEditable: Story = {
  name: "Idle — editable",
  args: { value: 42, onCommit: () => {}, label: "received" },
};

export const IdleMoney: Story = {
  name: "Idle — money",
  args: { value: 520000, asMoney: true, onCommit: () => {}, label: "sales value" },
};

export const Saving: Story = {
  name: "Saving — dimmed, never a spinner",
  args: { value: 42, state: "saving", onCommit: () => {}, label: "received" },
};

export const ErrorState: Story = {
  name: "Error — on the cell, not in a toast",
  args: {
    value: 42,
    state: "error",
    errorMessage: "Couldn't save. The figure is unchanged.",
    onCommit: () => {},
    label: "received",
  },
};

export const NotEditable: Story = {
  name: "Not editable — with a reason",
  args: {
    value: 306800,
    asMoney: true,
    notEditableReason: "Profit is calculated. Edit the quantity or price.",
  },
};

export const ReadOnlyPhone: Story = {
  name: "Read-only — phone",
  args: { value: 42, readOnly: true, onCommit: () => {}, label: "received" },
};

export const Dashed: Story = {
  name: "Zero, dashed out",
  args: { value: 0, muted: true, onCommit: () => {}, label: "produced" },
};

export const SignedCorrection: Story = {
  name: "Correction — signed",
  args: { value: 4, signed: true, muted: true, onCommit: () => {}, label: "corrected" },
};

/**
 * **The story that matters.** A real ledger row at the real density
 * (`px-2 py-2`, ~32px). At rest it is byte-identical to the read-only
 * table — no marks at all — and the affordance follows the cursor.
 *
 * Editing is live: hover a cell, type, and the value updates. The
 * calculated columns (Sales value, Cost of sales, Profit) stay plain on
 * hover too, and carry a tooltip naming what to edit instead.
 */
export const InALedgerRow: Story = {
  name: "In a ledger row — the density question",
  render: () => <LedgerRowDemo />,
  args: { value: 0 },
};

const COLUMNS = [
  { key: "opening", label: "Opening", editable: true },
  { key: "produced", label: "Produced", editable: true },
  { key: "received", label: "Received", editable: true },
  { key: "transferredIn", label: "Transf. in", editable: true },
  { key: "sold", label: "Sold", editable: true },
  { key: "transferredOut", label: "Transf. out", editable: true },
  { key: "nonSales", label: "Non-sales", editable: true },
  { key: "corrected", label: "Corrected", editable: true, signed: true },
  { key: "salesValueMinor", label: "Sales value", editable: false, money: true },
  { key: "unitCostMinor", label: "Unit cost", editable: true, money: true },
  { key: "sellingPriceMinor", label: "Price", editable: true, money: true },
  { key: "costOfSalesMinor", label: "Cost of sales", editable: false, money: true },
  { key: "profitMinor", label: "Profit", editable: false, money: true },
  { key: "closing", label: "Closing", editable: true },
] as const;

const SEED: Record<string, number> = {
  opening: 24,
  produced: 40,
  received: 0,
  transferredIn: 0,
  sold: 52,
  transferredOut: 5,
  nonSales: 2,
  corrected: 0,
  salesValueMinor: 520000,
  unitCostMinor: 4100,
  sellingPriceMinor: 10000,
  costOfSalesMinor: 213200,
  profitMinor: 306800,
  closing: 5,
};

function LedgerRowDemo() {
  const [rows, setRows] = useState<
    { name: string; location: string; values: Record<string, number> }[]
  >([
    { name: "Chips", location: "restaurant", values: { ...SEED } },
    { name: "Sodas (500ml)", location: "restaurant", values: { ...SEED, opening: 60, sold: 18 } },
    { name: "Beef stew", location: "canteen", values: { ...SEED, opening: 12, sold: 9 } },
  ]);

  return (
    <div className="w-[1100px] overflow-hidden rounded-lg border bg-card">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b bg-muted text-[11px] text-muted-foreground">
            <th className="px-3 py-2 text-left font-medium">Product</th>
            {COLUMNS.map((c) => (
              <th key={c.key} className="px-2 py-2 text-right font-medium whitespace-nowrap">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={row.name} className="border-b hover:bg-muted/40">
              <td className="px-3 py-2">
                <span className="font-medium">{row.name}</span>
                <span className="block text-[11px] text-muted-foreground">{row.location}</span>
              </td>
              {COLUMNS.map((c) => (
                <td key={c.key} className="px-2 py-2 text-right whitespace-nowrap">
                  <EditableNum
                    value={row.values[c.key] ?? null}
                    asMoney={"money" in c ? c.money : undefined}
                    signed={"signed" in c ? c.signed : undefined}
                    muted={!("money" in c)}
                    label={`${c.label} for ${row.name}`}
                    notEditableReason={
                      c.editable
                        ? undefined
                        : "This is calculated. Edit the quantity or the price instead."
                    }
                    onCommit={
                      c.editable
                        ? (next) =>
                            setRows((current) =>
                              current.map((r, i) =>
                                i === rowIndex
                                  ? { ...r, values: { ...r.values, [c.key]: next } }
                                  : r,
                              ),
                            )
                        : undefined
                    }
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
