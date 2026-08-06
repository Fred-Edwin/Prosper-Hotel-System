"use client";

/**
 * Ledger A — tabs across the top.
 *
 * The literal reading of the merge: six former screens become six tabs. One
 * filter bar sits above the tabs and applies to all of them.
 *
 * What this variant is really testing: whether six tabs reads as one coherent
 * page or as a filing cabinet with a nav bar. If Lucy has to remember which tab
 * holds which answer, the merge has moved the navigation problem rather than
 * solved it.
 */

import { useState } from "react";
import {
  movements,
  sales,
  money,
  reasonLabel,
  type MovementReason,
} from "@/lib/fixtures";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarDays, Download } from "lucide-react";

const notSold: MovementReason[] = ["wasted", "consumed", "given-away"];

export function LedgerA() {
  const [location, setLocation] = useState("all");

  const filtered = movements.filter(
    (m) => location === "all" || m.location === location,
  );

  return (
    <div className="mx-auto max-w-[1400px] p-6">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Ledger</h1>
          <p className="text-sm text-muted-foreground">
            Every movement of stock and money, and where each figure comes from.
          </p>
        </div>
        <Button variant="outline" size="sm">
          <Download className="size-4" /> Export
        </Button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-md border bg-card p-3">
        <Button variant="outline" size="sm">
          <CalendarDays className="size-4" /> 1 – 6 August 2026
        </Button>
        <Select value={location} onValueChange={setLocation}>
          <SelectTrigger className="w-40" size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Both locations</SelectItem>
            <SelectItem value="restaurant">Restaurant</SelectItem>
            <SelectItem value="canteen">Canteen</SelectItem>
          </SelectContent>
        </Select>
        <Input placeholder="Filter by item or person" className="h-8 max-w-64" />
        <span className="ml-auto text-xs text-muted-foreground">
          {filtered.length} movements
        </span>
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All movements</TabsTrigger>
          <TabsTrigger value="item">Item history</TabsTrigger>
          <TabsTrigger value="sales">Sales</TabsTrigger>
          <TabsTrigger value="notsold">Not sold</TabsTrigger>
          <TabsTrigger value="transfers">Transfers</TabsTrigger>
          <TabsTrigger value="counts">Counts</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-3">
          <div className="rounded-md border bg-card">
            <Table>
              <TableHeader className="sticky top-0 bg-card">
                <TableRow>
                  <TableHead className="w-24">Date</TableHead>
                  <TableHead className="w-16">Time</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead className="w-28">Location</TableHead>
                  <TableHead className="w-32">Reason</TableHead>
                  <TableHead className="w-20 text-right">Qty</TableHead>
                  <TableHead className="w-28 text-right">Value</TableHead>
                  <TableHead className="w-24">By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((m) => (
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
                    <TableCell className="tabular text-muted-foreground">
                      {m.time}
                    </TableCell>
                    <TableCell className="max-w-56 truncate font-medium" title={m.itemName}>
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
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="item" className="mt-3">
          <ItemHistory />
        </TabsContent>

        <TabsContent value="sales" className="mt-3">
          <div className="rounded-md border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Ref</TableHead>
                  <TableHead className="w-16">Time</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead className="w-40">Payment</TableHead>
                  <TableHead className="w-28">Customer</TableHead>
                  <TableHead className="w-28 text-right">Total</TableHead>
                  <TableHead className="w-24">By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sales.map((s) => (
                  <TableRow
                    key={s.id}
                    className={s.voided ? "text-muted-foreground" : ""}
                  >
                    <TableCell className="tabular font-medium">
                      {s.ref}
                      {s.voided && (
                        <Badge variant="outline" className="ml-1.5 text-[10px]">
                          void
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="tabular text-muted-foreground">
                      {s.time}
                    </TableCell>
                    <TableCell className="max-w-64 truncate">
                      {s.lines.map((l) => `${l.qty}× ${l.name}`).join(", ")}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {s.payments.map((p, i) => (
                          <Badge
                            key={i}
                            variant={p.method === "credit" ? "outline" : "secondary"}
                            className="text-[10px]"
                          >
                            {p.method === "mpesa" ? "M-Pesa" : p.method}{" "}
                            <span className="tabular ml-1">{p.amount}</span>
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {s.customerName ?? "—"}
                    </TableCell>
                    <TableCell className="tabular text-right font-medium">
                      {money(s.total)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {s.staffName}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="notsold" className="mt-3">
          <div className="rounded-md border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Date</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead className="w-32">Reason</TableHead>
                  <TableHead className="w-20 text-right">Qty</TableHead>
                  <TableHead className="w-28 text-right">At cost</TableHead>
                  <TableHead className="w-32 text-right">At selling price</TableHead>
                  <TableHead className="w-24">By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements
                  .filter((m) => notSold.includes(m.reason))
                  .map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="tabular text-muted-foreground">
                        {m.date}
                      </TableCell>
                      <TableCell className="font-medium">{m.itemName}</TableCell>
                      <TableCell>
                        <ReasonBadge reason={m.reason} />
                      </TableCell>
                      <TableCell className="tabular text-right">{m.qty}</TableCell>
                      <TableCell className="tabular text-right">
                        {m.value === null ? "—" : money(m.value)}
                        {m.unitCost === null && m.value !== null && (
                          <span
                            className="ml-1 text-xs text-muted-foreground"
                            title="No recipe — cost estimated at 60% of selling price"
                          >
                            est
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="tabular text-right text-muted-foreground">
                        {m.value === null ? "—" : money(Math.round(m.value * 1.67))}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {m.staffName}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="transfers" className="mt-3">
          <div className="rounded-md border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Date</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead className="w-44">Direction</TableHead>
                  <TableHead className="w-20 text-right">Qty</TableHead>
                  <TableHead className="w-28 text-right">Value</TableHead>
                  <TableHead className="w-24">By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements
                  .filter((m) => m.reason.startsWith("transferred"))
                  .map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="tabular text-muted-foreground">
                        {m.date}
                      </TableCell>
                      <TableCell className="font-medium">{m.itemName}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {m.reason === "transferred-out"
                          ? m.location === "restaurant"
                            ? "Restaurant → Canteen"
                            : "Canteen → Restaurant"
                          : m.location === "canteen"
                            ? "Restaurant → Canteen"
                            : "Canteen → Restaurant"}
                      </TableCell>
                      <TableCell className="tabular text-right">{m.qty}</TableCell>
                      <TableCell className="tabular text-right">
                        {m.value === null ? "—" : money(m.value)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {m.staffName}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="counts" className="mt-3">
          <div className="rounded-md border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Date</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead className="w-28">Location</TableHead>
                  <TableHead className="w-24 text-right">Expected</TableHead>
                  <TableHead className="w-24 text-right">Counted</TableHead>
                  <TableHead className="w-28 text-right">Difference</TableHead>
                  <TableHead className="w-24">By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="tabular text-muted-foreground">2026-08-05</TableCell>
                  <TableCell className="font-medium">Crisps</TableCell>
                  <TableCell className="text-muted-foreground">Canteen</TableCell>
                  <TableCell className="tabular text-right">84</TableCell>
                  <TableCell className="tabular text-right">78</TableCell>
                  <TableCell className="tabular text-right text-danger">−6</TableCell>
                  <TableCell className="text-muted-foreground">Lucy</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="tabular text-muted-foreground">2026-08-05</TableCell>
                  <TableCell className="font-medium">Biscuits</TableCell>
                  <TableCell className="text-muted-foreground">Canteen</TableCell>
                  <TableCell className="tabular text-right">120</TableCell>
                  <TableCell className="tabular text-right">120</TableCell>
                  <TableCell className="tabular text-right text-muted-foreground">0</TableCell>
                  <TableCell className="text-muted-foreground">Anne</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ItemHistory() {
  return (
    <div className="rounded-md border bg-card">
      <div className="flex items-center gap-2 border-b px-4 py-2.5">
        <Select defaultValue="p2">
          <SelectTrigger className="w-56" size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="p2">Chips</SelectItem>
            <SelectItem value="p1">Mukimo</SelectItem>
            <SelectItem value="i1">Potatoes</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">
          Restaurant · the shape the Excel sheet already uses
        </span>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-28">Date</TableHead>
            <TableHead className="text-right">Opening</TableHead>
            <TableHead className="text-right">Received</TableHead>
            <TableHead className="text-right">Produced</TableHead>
            <TableHead className="text-right">Transferred</TableHead>
            <TableHead className="text-right">Sold</TableHead>
            <TableHead className="text-right">Wasted</TableHead>
            <TableHead className="text-right">Closing</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[
            { d: "2026-08-02", o: 8, r: 0, p: 40, t: -10, s: -26, w: -2, c: 10 },
            { d: "2026-08-03", o: 10, r: 0, p: 38, t: -12, s: -30, w: 0, c: 6 },
            { d: "2026-08-04", o: 6, r: 0, p: 42, t: -12, s: -28, w: -1, c: 7 },
            { d: "2026-08-05", o: 7, r: 0, p: 40, t: -14, s: -25, w: 0, c: 8 },
            { d: "2026-08-06", o: 8, r: 0, p: 45, t: -12, s: -3, w: 0, c: 38 },
          ].map((r) => (
            <TableRow key={r.d}>
              <TableCell className="tabular text-muted-foreground">{r.d}</TableCell>
              <TableCell className="tabular text-right">{r.o}</TableCell>
              <TableCell className="tabular text-right text-muted-foreground">
                {r.r || "—"}
              </TableCell>
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
