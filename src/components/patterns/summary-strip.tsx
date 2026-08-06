"use client";

/**
 * The summary strip — a row of figures above a record.
 *
 * Used by Stock, Money out, People, Activity and any page that leads with
 * figures. Extracted from the frame round and settled in round C.
 *
 * **A strip states, and links where a link exists.** Stating is the default: a
 * figure that only points elsewhere answers nothing, and on Stock there is no
 * second page to point to. Where a deeper record genuinely explains a figure,
 * the link rides *alongside* it rather than replacing it — which is what the
 * dashboard was already doing, and what makes "the dashboard summarises, the
 * ledger explains" a description of two pages rather than a rule about all of
 * them.
 *
 * **A figure sits directly above its own arithmetic.** Where a figure is
 * composed rather than counted, `detail` renders under it in the same cell.
 * This is why the Aside detail layout beat the tabbed one: tabs cannot put a
 * figure and its composition together without repeating the figure.
 *
 * Cells are a single seamless band — one border, hairline dividers from the
 * grid gap — rather than separate cards. Four bordered boxes read as four
 * unrelated things that happen to be adjacent.
 */

import { ArrowRight } from "lucide-react";

export interface Summary {
  label: string;
  /** Pre-formatted. Money goes through `money()` at the call site. */
  value: string;
  /** One line under the figure — units, scope, or a caveat. */
  sub?: string;
  /** The arithmetic behind the figure, where it is composed rather than counted. */
  detail?: React.ReactNode;
  /** Where a record explains this figure. Omitted when nothing deeper exists. */
  link?: { label: string; href: string };
  tone?: "warning" | "danger" | "success";
  /** Marks a figure derived from an estimate. Never presented as exact. */
  provisional?: boolean;
}

const tones = {
  warning: "text-warning",
  danger: "text-danger",
  success: "text-success",
};

export function SummaryStrip({
  items,
  columns = 4,
}: {
  items: Summary[];
  /** Falls back to four; three and two are the other honest widths. */
  columns?: 2 | 3 | 4;
}) {
  const cols = {
    2: "sm:grid-cols-2",
    3: "sm:grid-cols-2 lg:grid-cols-3",
    4: "sm:grid-cols-2 lg:grid-cols-4",
  }[columns];

  return (
    <div
      className={`grid gap-px overflow-hidden rounded-lg border bg-border ${cols}`}
    >
      {items.map((it) => (
        <div key={it.label} className="flex flex-col bg-card p-4">
          <div className="text-xs text-muted-foreground">
            {it.label}
            {it.provisional && (
              <span
                className="ml-1 cursor-help underline decoration-dotted underline-offset-2"
                title="Derived from an estimate — replaced by a measured figure at the next count"
              >
                est
              </span>
            )}
          </div>

          <div
            className={`tabular mt-0.5 text-2xl font-semibold ${
              it.tone ? tones[it.tone] : ""
            }`}
          >
            {it.value}
          </div>

          {it.sub && (
            <div className="mt-0.5 text-[11px] text-muted-foreground">
              {it.sub}
            </div>
          )}

          {/* The arithmetic, directly under the figure it explains. */}
          {it.detail && (
            <div className="mt-3 border-t pt-2">{it.detail}</div>
          )}

          {/* Alongside the figure, never instead of it. */}
          {it.link && (
            <a
              href={it.link.href}
              className="mt-auto flex items-center gap-1 pt-2 text-xs text-muted-foreground transition-colors duration-100 hover:text-foreground"
            >
              {it.link.label} <ArrowRight className="size-3" />
            </a>
          )}
        </div>
      ))}
    </div>
  );
}
