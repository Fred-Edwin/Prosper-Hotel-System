"use client";

/**
 * Shared figure treatment for the round-two dashboards.
 *
 * Locked after round one: C's approach — a figure with its own arithmetic
 * beneath it, and a link out to the ledger to verify. "Very good visual
 * hierarchy, and I can see what makes up those figures... I like the UI that
 * tells them, open the ledger, so she can go and verify."
 *
 * Extracted so the three round-two variants disagree about *layout* only, and
 * cannot accidentally re-litigate a settled decision.
 *
 * Cost of goods sold and running costs are given weight deliberately —
 * "I would argue that the cost of goods sold and the running costs matter
 * more, they matter very much." They are the two terms Lucy can actually act
 * on: revenue is the market's answer, but what she pays for stock and what she
 * burns on gas and charcoal are hers to change.
 */

import { money } from "@/lib/fixtures";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Info } from "lucide-react";

export function FigureBlock({
  label,
  value,
  size = "lg",
  provisional,
  tone,
  sub,
  children,
}: {
  label: string;
  value: number;
  size?: "sm" | "lg" | "xl";
  provisional?: boolean;
  tone?: "danger" | "success";
  sub?: string;
  children?: React.ReactNode;
}) {
  const valueSize =
    size === "xl" ? "text-3xl" : size === "lg" ? "text-2xl" : "text-xl";
  const toneClass =
    tone === "danger"
      ? "text-danger"
      : tone === "success"
        ? "text-success"
        : "";

  return (
    <div>
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        {label}
        {provisional && (
          <span title="Canteen own-goods cost is estimated between counts">
            <Info className="size-3" />
          </span>
        )}
      </div>
      <div className={`tabular mt-0.5 font-semibold ${valueSize} ${toneClass}`}>
        {value < 0 ? `−${money(Math.abs(value))}` : money(value)}
      </div>
      {sub && (
        <div className="tabular mt-0.5 text-xs text-muted-foreground">{sub}</div>
      )}
      {children}
    </div>
  );
}

/** One term in an arithmetic breakdown. */
export function Term({
  label,
  value,
  sign,
  rule,
  strong,
  muted,
  note,
}: {
  label: string;
  value: number;
  sign?: "+" | "−";
  rule?: boolean;
  strong?: boolean;
  muted?: boolean;
  note?: string;
}) {
  return (
    <div
      className={`flex items-baseline justify-between gap-3 py-1 text-sm ${
        rule ? "mt-1 border-t pt-2" : ""
      } ${strong ? "font-semibold" : ""}`}
    >
      <span className={muted ? "text-muted-foreground" : ""}>
        {label}
        {note && (
          <Badge variant="outline" className="ml-1.5 text-[10px] font-normal">
            {note}
          </Badge>
        )}
      </span>
      <span className="tabular whitespace-nowrap">
        {sign === "−" ? "−" : ""}
        {money(Math.abs(value))}
      </span>
    </div>
  );
}

export function LedgerLink({ label = "Open the ledger" }: { label?: string }) {
  return (
    <button className="mt-2 flex items-center gap-1 text-xs text-muted-foreground transition-colors duration-100 hover:text-foreground">
      {label} <ArrowRight className="size-3" />
    </button>
  );
}

export function ProvisionalNote({ lastCount }: { lastCount: string }) {
  return (
    <p className="text-xs text-muted-foreground">
      Canteen own-goods cost is estimated from the rate measured at the last
      count on {lastCount}. Replaced by a measured figure at the next count, and
      the correction is reported rather than applied silently.
    </p>
  );
}

export function SectionHeader({
  title,
  action,
  badge,
}: {
  title: string;
  action?: React.ReactNode;
  badge?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between border-b px-4 py-2.5">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-medium">{title}</h2>
        {badge}
      </div>
      {action}
    </div>
  );
}
