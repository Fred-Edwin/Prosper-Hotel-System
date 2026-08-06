"use client";

/**
 * Ledger B — one table, filtered by reason.
 *
 * Rejects the tab structure entirely. There is only one thing here — a
 * movement — and the six "tabs" are six filters over it. Reason chips across
 * the top narrow the same table; nothing is a separate view.
 *
 * The argument: CONTEXT.md says a stock level is the sum of its movements.
 * If that is the model, then one table is the honest representation, and tabs
 * are an invented hierarchy on top of data that has none.
 *
 * What it costs: item history genuinely is a different shape — a row per day
 * with columns per reason, not a row per movement — so it cannot live in this
 * table. Here it is a drill-down from an item, which is a real navigational
 * cost worth seeing.
 */

import { useState } from "react";
import {
  movements,
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarDays, ArrowUpDown, ExternalLink } from "lucide-react";

const groups: { key: string; label: string; reasons: MovementReason[] }[] = [
  { key: "all", label: "Everything", reasons: [] },
  { key: "in", label: "Stock in", reasons: ["received", "produced", "transferred-in"] },
  { key: "out", label: "Sold", reasons: ["sold", "sold-derived"] },
  { key: "notsold", label: "Not sold", reasons: ["wasted", "consumed", "given-away"] },
  { key: "transfers", label: "Transfers", reasons: ["transferred-in", "transferred-out"] },
  { key: "kitchen", label: "Kitchen", reasons: ["issued", "produced"] },
  { key: "counts", label: "Corrections", reasons: ["corrected"] },
];

export function LedgerB() {
  const [group, setGroup] = useState("all");
  const [item, setItem] = useState<string | null>(null);

  const active = groups.find((g) => g.key === group)!;
  const rows = movements.filter(
    (m) => active.reasons.length === 0 || active.reasons.includes(m.reason),
  );

  const totalValue = rows.reduce((s, m) => s + (m.value ?? 0), 0);

  return (
    <div className="mx-auto max-w-[1400px] p-6">
      <div className="mb-1 flex items-start justify-between">
        <h1 className="text-2xl font-semibold">Ledger</h1>
        <Button variant="outline" size="sm">
          <CalendarDays className="size-4" /> 1 – 6 August 2026
        </Button>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        Every movement of stock, in one place. Narrow it until it answers your
        question.
      </p>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {groups.map((g) => (
          <button
            key={g.key}
            onClick={() => setGroup(g.key)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors duration-100 ${
              group === g.key
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground hover:bg-accent"
            }`}
          >
            {g.label}
          </button>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Input placeholder="Filter by item or person" className="h-8 max-w-64" />
        <Select defaultValue="all">
          <SelectTrigger className="w-40" size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Both locations</SelectItem>
            <SelectItem value="restaurant">Restaurant</SelectItem>
            <SelectItem value="canteen">Canteen</SelectItem>
          </SelectContent>
        </Select>
        <div className="ml-auto flex items-baseline gap-4 text-xs">
          <span className="text-muted-foreground">
            {rows.length} of {movements.length} movements
          </span>
          <span>
            <span className="text-muted-foreground">Value </span>
            <span className="tabular font-medium">{money(totalValue)}</span>
          </span>
        </div>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-card">
            <TableRow>
              <TableHead className="w-28">
                <button className="flex items-center gap-1 hover:text-foreground">
                  Date <ArrowUpDown className="size-3" />
                </button>
              </TableHead>
              <TableHead className="w-16">Time</TableHead>
              <TableHead>Item</TableHead>
              <TableHead className="w-28">Location</TableHead>
              <TableHead className="w-32">Reason</TableHead>
              <TableHead className="w-20 text-right">Qty</TableHead>
              <TableHead className="w-28 text-right">Value</TableHead>
              <TableHead className="w-24">By</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((m) => (
              <TableRow key={m.id} className="group">
                <TableCell className="tabular text-muted-foreground">
                  {m.effectiveDate ? (
                    <span
                      title={`Entered ${m.date}, applies to ${m.effectiveDate}`}
                      className="flex items-center gap-1"
                    >
                      {m.effectiveDate}
                      <Badge variant="outline" className="text-[10px]">
                        correction
                      </Badge>
                    </span>
                  ) : (
                    m.date
                  )}
                </TableCell>
                <TableCell className="tabular text-muted-foreground">
                  {m.time}
                </TableCell>
                <TableCell
                  className="max-w-56 truncate font-medium"
                  title={m.itemName}
                >
                  {m.itemName}
                </TableCell>
                <TableCell className="capitalize text-muted-foreground">
                  {m.location}
                </TableCell>
                <TableCell>
                  <ReasonBadge reason={m.reason} />
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
                <TableCell className="text-muted-foreground">
                  {m.staffName}
                </TableCell>
                <TableCell>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7 opacity-0 group-hover:opacity-100"
                    onClick={() => setItem(m.itemName)}
                    aria-label={`History for ${m.itemName}`}
                  >
                    <ExternalLink className="size-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="flex items-center justify-between border-t px-4 py-2 text-xs text-muted-foreground">
          <span>
            1–{rows.length} of {rows.length}
          </span>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" className="h-7" disabled>
              Previous
            </Button>
            <Button variant="outline" size="sm" className="h-7" disabled>
              Next
            </Button>
          </div>
        </div>
      </div>

      <Sheet open={!!item} onOpenChange={(o) => !o && setItem(null)}>
        <SheetContent className="w-[640px] sm:max-w-[640px]">
          <SheetHeader>
            <SheetTitle>{item} — history</SheetTitle>
          </SheetHeader>
          <div className="px-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Date</TableHead>
                  <TableHead className="text-right">Open</TableHead>
                  <TableHead className="text-right">In</TableHead>
                  <TableHead className="text-right">Out</TableHead>
                  <TableHead className="text-right">Sold</TableHead>
                  <TableHead className="text-right">Close</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[
                  { d: "08-02", o: 8, i: 40, t: -10, s: -28, c: 10 },
                  { d: "08-03", o: 10, i: 38, t: -12, s: -30, c: 6 },
                  { d: "08-04", o: 6, i: 42, t: -12, s: -29, c: 7 },
                  { d: "08-05", o: 7, i: 40, t: -14, s: -25, c: 8 },
                  { d: "08-06", o: 8, i: 45, t: -12, s: -3, c: 38 },
                ].map((r) => (
                  <TableRow key={r.d}>
                    <TableCell className="tabular text-muted-foreground">
                      {r.d}
                    </TableCell>
                    <TableCell className="tabular text-right">{r.o}</TableCell>
                    <TableCell className="tabular text-right">+{r.i}</TableCell>
                    <TableCell className="tabular text-right">{r.t}</TableCell>
                    <TableCell className="tabular text-right">{r.s}</TableCell>
                    <TableCell className="tabular text-right font-medium">
                      {r.c}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function ReasonBadge({ reason }: { reason: MovementReason }) {
  const tone =
    reason === "wasted" || reason === "corrected"
      ? "border-danger/30 bg-danger-subtle text-danger"
      : reason === "sold-derived"
        ? "border-warning/40 bg-warning-subtle text-warning"
        : "";
  return (
    <Badge variant="outline" className={`text-[11px] font-normal ${tone}`}>
      {reasonLabel[reason]}
    </Badge>
  );
}
