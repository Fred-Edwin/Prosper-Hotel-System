"use client";

/**
 * Ledger C — sidebar sections, and a reconciliation strip.
 *
 * Starts from what the page is *for* rather than from what data it holds.
 * Edwin's framing: "where if she needs to make sense of financial data, she
 * should be able to come to this ledger page and look at all those tables and
 * understand how the financial values come to what they are."
 *
 * So the page leads with the figure being explained. The strip across the top
 * carries the day's profit arithmetic, each term clickable; clicking one
 * selects the section below that accounts for it. The left rail is a
 * persistent map rather than tabs, so Lucy can always see what else is here.
 *
 * The bet: her question is never "show me transfers", it is "why is cost of
 * goods 14,880". Navigation by figure rather than by record type.
 */

import { useState } from "react";
import {
  movements,
  dashboard,
  money,
  reasonLabel,
  type MovementReason,
} from "@/lib/fixtures";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CalendarDays, Info } from "lucide-react";

const sections = [
  { key: "cogs", label: "Cost of goods sold", hint: "What stock was used up" },
  { key: "movements", label: "All movements", hint: "Every change, every reason" },
  { key: "item", label: "Item history", hint: "One item, day by day" },
  { key: "notsold", label: "Not sold", hint: "Wastage, staff meals, giveaways" },
  { key: "transfers", label: "Between locations", hint: "Both directions" },
  { key: "counts", label: "Counts & corrections", hint: "Where records met reality" },
];

export function LedgerC() {
  const [section, setSection] = useState("cogs");

  return (
    <div className="mx-auto max-w-[1400px] p-6">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Ledger</h1>
          <p className="text-sm text-muted-foreground">
            Where every figure comes from.
          </p>
        </div>
        <Button variant="outline" size="sm">
          <CalendarDays className="size-4" /> 1 – 6 August 2026
        </Button>
      </div>

      {/* The arithmetic, as navigation. Each term explains itself below. */}
      <div className="mb-5 flex flex-wrap items-stretch gap-px overflow-hidden rounded-md border bg-border">
        <Term label="Revenue" value={dashboard.revenue.total} />
        <Operator>−</Operator>
        <Term
          label="Cost of goods sold"
          value={dashboard.costOfGoods.total}
          active={section === "cogs"}
          provisional
          onClick={() => setSection("cogs")}
        />
        <Operator>−</Operator>
        <Term label="Running costs" value={dashboard.runningCosts} />
        <Operator>=</Operator>
        <Term label="Net profit" value={dashboard.netProfit} emphasis />
      </div>

      <div className="flex gap-5">
        <nav className="w-52 shrink-0">
          {sections.map((s) => (
            <button
              key={s.key}
              onClick={() => setSection(s.key)}
              className={`mb-0.5 block w-full rounded-md px-3 py-2 text-left transition-colors duration-100 ${
                section === s.key
                  ? "bg-accent font-medium"
                  : "text-muted-foreground hover:bg-accent/60"
              }`}
            >
              <div className="text-sm">{s.label}</div>
              <div className="text-xs text-muted-foreground">{s.hint}</div>
            </button>
          ))}
        </nav>

        <div className="min-w-0 flex-1">
          {section === "cogs" ? (
            <CostOfGoods />
          ) : section === "item" ? (
            <ItemHistory />
          ) : (
            <MovementTable section={section} />
          )}
        </div>
      </div>
    </div>
  );
}

function Term({
  label,
  value,
  active,
  emphasis,
  provisional,
  onClick,
}: {
  label: string;
  value: number;
  active?: boolean;
  emphasis?: boolean;
  provisional?: boolean;
  onClick?: () => void;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className={`flex-1 px-4 py-3 text-left transition-colors duration-100 ${
        active ? "bg-accent" : "bg-card"
      } ${onClick ? "hover:bg-accent cursor-pointer" : ""}`}
    >
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        {label}
        {provisional && (
          <span title="Canteen own-goods cost is estimated between counts">
            <Info className="size-3" />
          </span>
        )}
      </div>
      <div
        className={`tabular ${emphasis ? "text-xl font-semibold" : "text-lg font-medium"}`}
      >
        {money(value)}
      </div>
      {provisional && (
        <Badge variant="outline" className="mt-0.5 text-[10px] font-normal">
          provisional
        </Badge>
      )}
    </Tag>
  );
}

function Operator({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center bg-card px-2 text-muted-foreground">
      {children}
    </div>
  );
}

function CostOfGoods() {
  return (
    <div className="space-y-4">
      <div className="rounded-md border bg-card p-4">
        <h2 className="mb-3 font-medium">How cost of goods sold is reached</h2>
        <table className="w-full text-sm">
          <tbody>
            <Row label="Opening ingredients" value={18000} />
            <Row label="Ingredients bought" value={9000} sign="+" />
            <Row label="Closing ingredients" value={15000} sign="−" />
            <Row label="Food sent to canteen" value={2400} sign="−" />
            <Row label="Restaurant cost" value={9600} total />
          </tbody>
        </table>
      </div>

      <div className="rounded-md border bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="font-medium">Canteen</h2>
          <Badge variant="outline" className="text-[10px] font-normal">
            partly provisional
          </Badge>
        </div>
        <table className="w-full text-sm">
          <tbody>
            <Row label="Food from the restaurant — exact" value={2400} />
            <Row
              label={`Own goods — takings of ${money(4000)} × ${dashboard.canteenCostRate * 100}%`}
              value={2880}
              estimated
            />
            <Row label="Canteen cost" value={5280} total />
          </tbody>
        </table>
        <p className="mt-3 text-xs text-muted-foreground">
          The {dashboard.canteenCostRate * 100}% is the rate measured at the last
          count on {dashboard.lastCanteenCount}. It is replaced by a measured
          figure at the next count, and the correction is reported rather than
          applied silently.
        </p>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  sign,
  total,
  estimated,
}: {
  label: string;
  value: number;
  sign?: string;
  total?: boolean;
  estimated?: boolean;
}) {
  return (
    <tr className={total ? "border-t font-medium" : ""}>
      <td className={`py-1.5 ${total ? "pt-2" : ""}`}>
        {label}
        {estimated && (
          <Badge variant="outline" className="ml-2 text-[10px] font-normal">
            estimated
          </Badge>
        )}
      </td>
      <td className="w-8 py-1.5 text-right text-muted-foreground">{sign}</td>
      <td className={`tabular py-1.5 text-right ${total ? "pt-2" : ""}`}>
        {money(value)}
      </td>
    </tr>
  );
}

function MovementTable({ section }: { section: string }) {
  const filters: Record<string, MovementReason[]> = {
    movements: [],
    notsold: ["wasted", "consumed", "given-away"],
    transfers: ["transferred-in", "transferred-out"],
    counts: ["corrected"],
  };
  const reasons = filters[section] ?? [];
  const rows = movements.filter(
    (m) => reasons.length === 0 || reasons.includes(m.reason),
  );

  return (
    <div className="rounded-md border bg-card">
      <div className="flex items-center gap-2 border-b px-4 py-2.5">
        <Input placeholder="Filter by item or person" className="h-8 max-w-64" />
        <span className="ml-auto text-xs text-muted-foreground">
          {rows.length} movements
        </span>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-28">Date</TableHead>
            <TableHead>Item</TableHead>
            <TableHead className="w-28">Location</TableHead>
            <TableHead className="w-32">Reason</TableHead>
            <TableHead className="w-20 text-right">Qty</TableHead>
            <TableHead className="w-28 text-right">Value</TableHead>
            <TableHead className="w-24">By</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((m) => (
            <TableRow key={m.id}>
              <TableCell className="tabular text-muted-foreground">
                {m.effectiveDate ? (
                  <span title={`Entered ${m.date}, applies to ${m.effectiveDate}`}>
                    {m.effectiveDate}
                    <Badge variant="outline" className="ml-1.5 text-[10px]">
                      correction
                    </Badge>
                  </span>
                ) : (
                  m.date
                )}
              </TableCell>
              <TableCell className="max-w-56 truncate font-medium" title={m.itemName}>
                {m.itemName}
              </TableCell>
              <TableCell className="capitalize text-muted-foreground">
                {m.location}
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="text-[11px] font-normal">
                  {reasonLabel[m.reason]}
                </Badge>
              </TableCell>
              <TableCell className="tabular text-right">
                {m.qty > 0 ? "+" : ""}
                {m.qty}
              </TableCell>
              <TableCell className="tabular text-right">
                {m.value === null ? (
                  <span className="text-muted-foreground">—</span>
                ) : (
                  money(m.value)
                )}
              </TableCell>
              <TableCell className="text-muted-foreground">{m.staffName}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function ItemHistory() {
  return (
    <div className="rounded-md border bg-card">
      <div className="border-b px-4 py-2.5 text-sm font-medium">
        Chips — restaurant
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-28">Date</TableHead>
            <TableHead className="text-right">Opening</TableHead>
            <TableHead className="text-right">Produced</TableHead>
            <TableHead className="text-right">Transferred</TableHead>
            <TableHead className="text-right">Sold</TableHead>
            <TableHead className="text-right">Wasted</TableHead>
            <TableHead className="text-right">Closing</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[
            { d: "2026-08-02", o: 8, p: 40, t: -10, s: -26, w: -2, c: 10 },
            { d: "2026-08-03", o: 10, p: 38, t: -12, s: -30, w: 0, c: 6 },
            { d: "2026-08-04", o: 6, p: 42, t: -12, s: -28, w: -1, c: 7 },
            { d: "2026-08-05", o: 7, p: 40, t: -14, s: -25, w: 0, c: 8 },
            { d: "2026-08-06", o: 8, p: 45, t: -12, s: -3, w: 0, c: 38 },
          ].map((r) => (
            <TableRow key={r.d}>
              <TableCell className="tabular text-muted-foreground">{r.d}</TableCell>
              <TableCell className="tabular text-right">{r.o}</TableCell>
              <TableCell className="tabular text-right">+{r.p}</TableCell>
              <TableCell className="tabular text-right">{r.t}</TableCell>
              <TableCell className="tabular text-right">{r.s}</TableCell>
              <TableCell className="tabular text-right">
                {r.w ? <span className="text-danger">{r.w}</span> : "—"}
              </TableCell>
              <TableCell className="tabular text-right font-medium">{r.c}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
