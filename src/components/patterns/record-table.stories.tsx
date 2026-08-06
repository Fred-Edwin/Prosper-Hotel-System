import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  RecordTable,
  Num,
  Truncate,
  Spine,
  ChildCell,
  RowAction,
  type Column,
} from "./record-table";
import { EmptyFiltered, LoadingTable } from "./states";
import { money, productLedger, type ProductLedgerRow } from "@/lib/fixtures";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";

/**
 * The record table. Used by Stock, Money out, Activity and People.
 *
 * The rules it enforces so a caller cannot get them wrong: numbers right and
 * tabular, text left, an unknown value as "—" rather than zero, long text
 * truncated with a title, and child rows carrying a spine and a closing edge.
 */
const meta = {
  title: "Patterns/RecordTable",
  component: RecordTable,
  parameters: { layout: "padded" },
} satisfies Meta<typeof RecordTable>;

export default meta;

const rows = productLedger.slice(0, 6);

const columns: Column<ProductLedgerRow>[] = [
  {
    key: "item",
    header: "Item",
    align: "left",
    sortable: true,
    cell: (r) => <Truncate>{r.item}</Truncate>,
  },
  {
    key: "location",
    header: "Location",
    align: "left",
    cell: (r) => (
      <span className="text-muted-foreground capitalize">{r.location}</span>
    ),
  },
  {
    key: "onHand",
    header: "On hand",
    group: true,
    sortable: true,
    cell: (r) => <Num value={r.closingQty} strong />,
  },
  {
    key: "unitCost",
    header: "Unit cost",
    cell: (r) => <Num value={r.unitCost} money />,
  },
  {
    key: "value",
    header: "Value",
    cell: (r) => (
      <Num value={r.unitCost === null ? null : r.unitCost * r.closingQty} money />
    ),
  },
];

export const Default: StoryObj = {
  render: () => (
    <RecordTable rows={rows} columns={columns} rowKey={(r) => r.id} minWidth={640} />
  ),
};

/**
 * An unknown value renders "—", never zero.
 *
 * Beef stew has no recipe, so its per-unit cost is genuinely unknown and its
 * value cannot be stated. Showing zero would assert something false — this is
 * the distinction the whole costing model rests on.
 */
export const UnknownValues: StoryObj = {
  render: () => (
    <RecordTable
      rows={productLedger.filter((r) => r.unitCost === null).slice(0, 3)}
      columns={columns}
      rowKey={(r) => r.id}
      minWidth={640}
      footnote="A dash means the cost is unknown, not that it is zero."
    />
  ),
};

/** A 200-character name must not break the row, and must stay readable. */
export const LongText: StoryObj = {
  render: () => (
    <RecordTable
      rows={[
        {
          ...rows[0],
          id: "long",
          item: "Large capacity insulated food flask with double-walled stainless steel interior and locking clip lid, supplied by the Nakuru wholesaler, used for the school delivery run on Tuesdays and Thursdays only",
        },
        rows[1],
      ]}
      columns={columns}
      rowKey={(r) => r.id}
      minWidth={640}
    />
  ),
};

/**
 * Expanding a row: a spine anchored under the parent's chevron, recessive type,
 * and a closing edge beneath the last child. Without the closing edge an
 * expanded block in a long table bleeds into the next parent.
 */
export const Expandable: StoryObj = {
  render: function Render() {
    const [open, setOpen] = useState<string | null>(rows[0].id);
    return (
      <RecordTable
        rows={rows.slice(0, 3)}
        columns={columns}
        rowKey={(r) => r.id}
        minWidth={640}
        expandedKey={open}
        onToggle={(k) => setOpen(open === k ? null : k)}
        expandable={(r) =>
          r.days.map((d) => (
            <>
              <ChildCell align="left">
                <Spine label={d.date} muted />
              </ChildCell>
              <ChildCell align="left" />
              <ChildCell group>
                <Num value={d.closing} />
              </ChildCell>
              <ChildCell />
              <ChildCell />
            </>
          ))
        }
      />
    );
  },
};

/** Column groups, for tables wide enough that the eye needs regions. */
export const Grouped: StoryObj = {
  render: () => (
    <RecordTable
      rows={rows}
      columns={columns}
      groups={[
        { label: "Identity", span: 2 },
        { label: "Stock", span: 3 },
      ]}
      rowKey={(r) => r.id}
      minWidth={640}
    />
  ),
};

/**
 * A row action is outline, never filled. A filled button repeated down forty
 * rows is forty accent elements, and the page's one accent belongs to its
 * primary action.
 */
export const WithRowActions: StoryObj = {
  render: () => (
    <RecordTable
      rows={rows.slice(0, 4)}
      columns={[
        ...columns.slice(0, 3),
        {
          key: "status",
          header: "Status",
          align: "left",
          cell: (r) =>
            r.closingQty < 20 ? (
              <Badge
                variant="outline"
                className="border-warning/40 bg-warning-subtle text-[10px] font-normal text-warning"
              >
                Low
              </Badge>
            ) : (
              <span className="text-[11px] text-muted-foreground">Fine</span>
            ),
        },
        {
          key: "action",
          header: "",
          cell: (r) => (r.closingQty < 20 ? <RowAction label="Order" /> : null),
        },
      ]}
      rowKey={(r) => r.id}
      minWidth={640}
    />
  ),
};

/** A totals row, for tables that sum. */
export const WithTotals: StoryObj = {
  render: () => (
    <RecordTable
      rows={rows}
      columns={columns}
      rowKey={(r) => r.id}
      minWidth={640}
      footer={
        <tr className="bg-muted/40 font-medium">
          <td className="px-2 py-2" colSpan={2}>
            Total
          </td>
          <td className="border-l px-2 py-2 text-right">
            <Num value={rows.reduce((s, r) => s + r.closingQty, 0)} strong />
          </td>
          <td />
          <td className="px-2 py-2 text-right">
            <Num
              value={rows.reduce(
                (s, r) => s + (r.unitCost ?? 0) * r.closingQty,
                0,
              )}
              money
              strong
            />
          </td>
        </tr>
      }
    />
  ),
};

/** Nothing matches the filters — a different message from first use. */
export const FilteredEmpty: StoryObj = {
  render: () => (
    <RecordTable
      rows={[]}
      columns={columns}
      rowKey={(r) => r.id}
      empty={<EmptyFiltered onClear={() => {}} noun="stock items" />}
    />
  ),
};

/** The skeleton holds the same row height, so nothing jumps on arrival. */
export const Loading: StoryObj = {
  render: () => <LoadingTable summary={0} rows={6} columns={5} />,
};
