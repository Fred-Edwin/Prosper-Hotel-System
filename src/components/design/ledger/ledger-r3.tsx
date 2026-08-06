"use client";

/**
 * Ledger — round three. One page.
 *
 * The tabbed layout, settled after round two: "I love the tabbed layout." The
 * sectioned and master–detail alternatives are gone — sectioned scrolled too
 * far and got confusing once rows multiplied, and master–detail put the
 * financial summary in a sidebar where it read as secondary.
 *
 * Four changes from R2A:
 *
 *   Tabs name ledgers, not movements. Each of these is a sub-ledger in the
 *   accounting sense — the complete record for one class of thing — and it is
 *   the word the client's accountant would use.
 *
 *   The cash ledger is one row per day with categories as columns, matching the
 *   product and store ledgers. Previously one row per transaction, which made
 *   cash read as a different sort of record and could not answer "what did I
 *   spend on stock this week" without arithmetic.
 *
 *   The stats bar is a waterfall rather than six equal tiles, with the
 *   reconciliation folded into it. Clicking a term opens the sub-ledger that
 *   explains it.
 *
 *   Child rows carry a spine, recessive weight and a closing edge, so an
 *   expanded block never bleeds into the next parent.
 */

import { useEffect, useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LedgerStats, type StatTerm } from "./stats";
import {
  ProductLedgerTable,
  StoreLedgerTable,
  NonSalesLedgerTable,
  CashLedgerTable,
} from "./tables";
import { CalendarDays, Download, Maximize2, RotateCw, X } from "lucide-react";

const ledgers = [
  {
    key: "products",
    label: "Product ledger",
    hint: "What was sold, and what it earned",
  },
  {
    key: "store",
    label: "Store ledger",
    hint: "Ingredients in, and out to the kitchen",
  },
  {
    key: "nonsales",
    label: "Non-sales ledger",
    hint: "Wastage, staff meals, complimentary",
  },
  { key: "cash", label: "Cash ledger", hint: "In, out, and the balance" },
];

function LedgerFor({ which }: { which: string }) {
  if (which === "store") return <StoreLedgerTable />;
  if (which === "nonsales") return <NonSalesLedgerTable />;
  if (which === "cash") return <CashLedgerTable />;
  return <ProductLedgerTable />;
}

/** Offered on narrow screens, never forced. */
function RotatePrompt({ onExpand }: { onExpand: () => void }) {
  return (
    <button
      onClick={onExpand}
      className="mb-3 flex w-full items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-left lg:hidden"
    >
      <RotateCw className="size-4 shrink-0 text-muted-foreground" />
      <span className="flex-1 text-[13px]">
        <span className="font-medium">More room for the table</span>
        <span className="block text-[11px] text-muted-foreground">
          Turn your phone sideways and tap here
        </span>
      </span>
      <Maximize2 className="size-4 shrink-0 text-muted-foreground" />
    </button>
  );
}

/** Full-width table with the page chrome out of the way. */
function Expanded({ which, onClose }: { which: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const ledger = ledgers.find((l) => l.key === which)!;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <span className="flex-1 text-[13px] font-medium">{ledger.label}</span>
        <Button variant="ghost" size="sm" className="h-8" onClick={onClose}>
          <X className="size-4" /> Close
        </Button>
      </div>
      <div className="flex-1 overflow-auto p-2">
        <LedgerFor which={which} />
      </div>
    </div>
  );
}

export function LedgerR3() {
  const [active, setActive] = useState("products");
  const [statTerm, setStatTerm] = useState<StatTerm | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  // A stat term opens whichever sub-ledger accounts for it.
  const selectTerm = (t: StatTerm, explains: string) => {
    setStatTerm(statTerm === t ? null : t);
    setActive(explains);
  };

  return (
    <div className="mx-auto max-w-[1500px] p-4 lg:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Ledger</h1>
          <p className="text-sm text-muted-foreground">
            Where every figure comes from.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select defaultValue="week">
            <SelectTrigger className="h-8 w-40 text-[13px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Today</SelectItem>
              <SelectItem value="week">This week</SelectItem>
              <SelectItem value="month">This month</SelectItem>
              <SelectItem value="custom">Custom range</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="h-8">
            <CalendarDays className="size-3.5" /> 2 – 6 Aug 2026
          </Button>
          <Button variant="outline" size="sm" className="h-8">
            <Download className="size-3.5" /> Export
          </Button>
        </div>
      </div>

      <div className="mb-5">
        <LedgerStats active={statTerm} onSelect={selectTerm} />
      </div>

      <Tabs value={active} onValueChange={setActive}>
        <TabsList className="mb-3 flex-wrap">
          {ledgers.map((l) => (
            <TabsTrigger key={l.key} value={l.key}>
              {l.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {ledgers.map((l) => (
          <TabsContent key={l.key} value={l.key}>
            <p className="mb-2 hidden text-xs text-muted-foreground lg:block">
              {l.hint}
            </p>
            <RotatePrompt onExpand={() => setExpanded(l.key)} />
            <LedgerFor which={l.key} />
          </TabsContent>
        ))}
      </Tabs>

      {expanded && (
        <Expanded which={expanded} onClose={() => setExpanded(null)} />
      )}
    </div>
  );
}
