"use client";

/**
 * The record table. Used by Stock, Money out and Activity.
 *
 * Extracted from two places that had independently arrived at the same shape:
 * the ledger's four sub-ledgers, and Stock. Where they agreed, that agreement
 * is the template; where only the ledger needed something — sixteen columns,
 * header spans, a frozen first column — it is here as an option rather than as
 * the default, because a five-column table that freezes its first column is
 * solving a problem it does not have.
 *
 * The rules that are not options, because the settled work depends on them:
 *
 *   **Numbers right, text left, and every number tabular.** Money is compared
 *   down a column here.
 *
 *   **An unknown value renders as "—", never as zero.** Cooked food without a
 *   recipe has no per-unit cost, so its profit cannot be stated; showing zero
 *   would assert something false. `Num` takes `null` and does this itself, so a
 *   caller cannot get it wrong by accident.
 *
 *   **Child rows carry a spine, recessive type and a closing edge.** Without
 *   the closing edge an expanded block in the middle of a long table bleeds
 *   into the next parent and the hierarchy is lost.
 *
 *   **Long text truncates with a title.** A 200-character product name must not
 *   break the row, and must still be readable on hover.
 */

import { Fragment, type ReactNode } from "react";
import { money as fmtMoney } from "@/shared/money";
import { Button } from "@/components/ui/button";
import { ChevronRight, ArrowDownUp } from "lucide-react";

/* ------------------------------------------------------------- primitives -- */

/** Frozen first column: identity survives horizontal scrolling. */
const FROZEN = "sticky left-0 z-20 bg-card group-hover:bg-muted/40 border-r";
const FROZEN_HEAD = "sticky left-0 z-30 bg-muted/60 border-r";
const CHILD_ROW = "bg-muted/25 text-[12px]";
const CHILD_FROZEN = "sticky left-0 z-20 bg-muted/25 border-r";
const CHILD_LAST = "border-b-2 border-b-neutral-300";

/**
 * A number in a cell. Null renders as "—" because the value is unknown, which
 * is not the same as zero — the distinction the whole costing model rests on.
 */
export function Num({
  value,
  money,
  /** Renders a real zero as "—" too, where zero means "nothing happened". */
  muted,
  tone,
  strong,
  suffix,
}: {
  value: number | null;
  money?: boolean;
  muted?: boolean;
  tone?: "danger" | "success" | "warning";
  strong?: boolean;
  suffix?: string;
}) {
  if (value === null) return <span className="text-muted-foreground">—</span>;
  if (value === 0 && muted)
    return <span className="text-muted-foreground">—</span>;

  const tones = {
    danger: "text-danger",
    success: "text-success",
    warning: "text-warning",
  };

  return (
    <span
      className={`tabular ${tone ? tones[tone] : ""} ${strong ? "font-medium" : ""}`}
    >
      {money ? fmtMoney(value) : value}
      {suffix && (
        <span className="ml-0.5 text-[11px] text-muted-foreground">{suffix}</span>
      )}
    </span>
  );
}

/** Long text that must not break the row, and must still be readable. */
export function Truncate({ children }: { children: string }) {
  return (
    <span className="block max-w-[28ch] truncate" title={children}>
      {children}
    </span>
  );
}

export function Chevron({ open }: { open: boolean }) {
  return (
    <ChevronRight
      className={`size-3.5 shrink-0 text-muted-foreground transition-transform duration-100 ${
        open ? "rotate-90" : ""
      }`}
    />
  );
}

/** Ties children to the parent they expanded from. */
export function Spine({ label, muted }: { label: string; muted?: boolean }) {
  return (
    <span className="flex items-stretch gap-2 pl-[7px]">
      <span className="w-px shrink-0 bg-neutral-300" aria-hidden />
      <span className={`py-0.5 pl-2 ${muted ? "text-muted-foreground" : ""}`}>
        {label}
      </span>
    </span>
  );
}

/* ---------------------------------------------------------------- columns -- */

export interface Column<T> {
  key: string;
  header: ReactNode;
  /** Defaults to right for numbers; set explicitly for text. */
  align?: "left" | "right";
  /** Starts a column group — draws the divider. */
  group?: boolean;
  sortable?: boolean;
  width?: string;
  cell: (row: T) => ReactNode;
}

/** A header span above the columns, for tables wide enough to need regions. */
export interface ColumnGroup {
  label: string;
  span: number;
}

/* ------------------------------------------------------------------ table -- */

export function RecordTable<T>({
  rows,
  columns,
  groups,
  rowKey,
  /** Frozen first column and a min width — for tables past ~8 columns. */
  wide,
  minWidth,
  /** Expanding a row renders this beneath it, as child rows. */
  expandable,
  expandedKey,
  onToggle,
  onSort,
  sortKey,
  /** A totals row pinned at the foot. */
  footer,
  /** A caveat under the table, inside the border. */
  footnote,
  empty,
  /** Namespaces this table's row testid so screens sharing this component
   * don't collide — e.g. "products-table" vs. "staff-table". */
  testIdPrefix,
}: {
  rows: T[];
  columns: Column<T>[];
  groups?: ColumnGroup[];
  rowKey: (row: T) => string;
  wide?: boolean;
  minWidth?: number;
  expandable?: (row: T) => ReactNode[];
  expandedKey?: string | null;
  onToggle?: (key: string) => void;
  onSort?: (key: string) => void;
  sortKey?: string;
  footer?: ReactNode;
  footnote?: string;
  /** Shown in place of the table when there is nothing. */
  empty?: ReactNode;
  testIdPrefix?: string;
}) {
  if (rows.length === 0 && empty)
    return <div className="overflow-hidden rounded-lg border bg-card">{empty}</div>;

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="overflow-x-auto">
        <table
          className="w-full text-[13px]"
          style={minWidth ? { minWidth } : undefined}
        >
          <thead className="sticky top-0 z-10">
            {groups && (
              <tr className="border-b bg-muted/60 text-[11px] text-muted-foreground">
                {wide && (
                  <th className={`${FROZEN_HEAD} px-3 py-1.5 text-left font-medium`} />
                )}
                {groups.map((g, i) => (
                  <th
                    key={g.label}
                    colSpan={g.span}
                    className={`px-2 py-1.5 text-center font-medium ${
                      i > 0 || wide ? "border-l" : ""
                    }`}
                  >
                    {g.label}
                  </th>
                ))}
              </tr>
            )}
            <tr className="border-b bg-muted/60 text-[11px] text-muted-foreground">
              {columns.map((c, i) => {
                const align = c.align ?? "right";
                const frozen = wide && i === 0;
                return (
                  <th
                    key={c.key}
                    style={c.width ? { width: c.width } : undefined}
                    className={`px-2 py-2 font-medium whitespace-nowrap ${
                      align === "right" ? "text-right" : "text-left"
                    } ${c.group ? "border-l" : ""} ${
                      frozen ? `${FROZEN_HEAD} px-3` : ""
                    }`}
                  >
                    {c.sortable && onSort ? (
                      <button
                        onClick={() => onSort(c.key)}
                        className={`inline-flex items-center gap-1 hover:text-foreground ${
                          sortKey === c.key ? "text-foreground" : ""
                        }`}
                      >
                        {c.header} <ArrowDownUp className="size-3" />
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => {
              const key = rowKey(row);
              const open = expandedKey === key;
              const children = open && expandable ? expandable(row) : [];

              return (
                <Fragment key={key}>
                  <tr
                    className="group border-b hover:bg-muted/40"
                    data-testid={testIdPrefix ? `${testIdPrefix}-row` : undefined}
                  >
                    {columns.map((c, i) => {
                      const align = c.align ?? "right";
                      const frozen = wide && i === 0;
                      return (
                        <td
                          key={c.key}
                          className={`px-2 py-2 whitespace-nowrap ${
                            align === "right" ? "text-right" : "text-left"
                          } ${c.group ? "border-l" : ""} ${
                            frozen ? `${FROZEN} px-3` : ""
                          }`}
                        >
                          {i === 0 && expandable && onToggle ? (
                            <button
                              onClick={() => onToggle(key)}
                              className="flex items-center gap-1.5 text-left"
                              aria-expanded={open}
                            >
                              <Chevron open={open} />
                              <span>{c.cell(row)}</span>
                            </button>
                          ) : (
                            c.cell(row)
                          )}
                        </td>
                      );
                    })}
                  </tr>

                  {children.map((child, ci) => (
                    <tr
                      key={`${key}-${ci}`}
                      className={`${CHILD_ROW} ${
                        ci === children.length - 1 ? CHILD_LAST : "border-b"
                      }`}
                    >
                      {child}
                    </tr>
                  ))}
                </Fragment>
              );
            })}

            {footer}
          </tbody>
        </table>
      </div>

      {footnote && (
        <p className="border-t px-3 py-2 text-[11px] text-muted-foreground">
          {footnote}
        </p>
      )}
    </div>
  );
}

/** A child row's cells, so callers do not re-derive the treatment. */
export function ChildCell({
  children,
  align = "right",
  group,
  frozen,
}: {
  children?: ReactNode;
  align?: "left" | "right";
  group?: boolean;
  frozen?: boolean;
}) {
  return (
    <td
      className={`px-2 py-1.5 whitespace-nowrap ${
        align === "right" ? "text-right" : "text-left"
      } ${group ? "border-l" : ""} ${frozen ? `${CHILD_FROZEN} px-3` : ""}`}
    >
      {children}
    </td>
  );
}

/** The totals row. Same treatment wherever a table sums. */
export function TotalsRow({
  children,
  wide,
}: {
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <tr className="bg-muted/40 font-medium">
      {wide ? children : children}
    </tr>
  );
}

/**
 * A row action. Outline, never filled — the page's one accent belongs to the
 * primary action, and a filled button repeated down forty rows is forty accent
 * elements.
 */
export function RowAction({
  label,
  onClick,
  testId,
}: {
  label: string;
  onClick?: () => void;
  testId?: string;
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      className="h-6 text-[11px]"
      onClick={onClick}
      data-testid={testId}
    >
      {label}
    </Button>
  );
}

export { FROZEN, FROZEN_HEAD, CHILD_FROZEN };
