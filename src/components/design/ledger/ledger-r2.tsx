"use client";

/**
 * Ledger — round two. Three layouts over the same four tables.
 *
 * The tables and the stats bar are shared, so these disagree about structure
 * only: how she gets between four dense tables, and what is visible at once.
 *
 * Mobile: portrait is the default and degrades to cards plus horizontally
 * scrolling tables with a frozen first column. Landscape is offered rather
 * than assumed — a rotate prompt appears on narrow screens, and taking it
 * gives the table the full width with the page chrome collapsed. Rotation is
 * the user's choice, never forced, because she may be holding the phone one-
 * handed for a reason.
 */

import { useEffect, useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LedgerStats, ReconciliationNote } from "./stats";
import {
  ProductMovements,
  StoreMovementsTable,
  NonSalesConsumption,
  CashMovements,
} from "./tables";
import { CalendarDays, Download, Maximize2, RotateCw, X } from "lucide-react";

const tables = [
  {
    key: "products",
    label: "Product movements",
    hint: "What was sold, and what it earned",
  },
  {
    key: "store",
    label: "Store movements",
    hint: "Ingredients in, and out to the kitchen",
  },
  {
    key: "nonsales",
    label: "Non-sales consumption",
    hint: "Wastage, staff meals, complimentary",
  },
  { key: "cash", label: "Cash movements", hint: "In, out, and the balance" },
];

function TableFor({ which }: { which: string }) {
  if (which === "store") return <StoreMovementsTable />;
  if (which === "nonsales") return <NonSalesConsumption />;
  if (which === "cash") return <CashMovements />;
  return <ProductMovements />;
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
function Expanded({
  which,
  onClose,
}: {
  which: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const table = tables.find((t) => t.key === which)!;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <span className="flex-1 text-[13px] font-medium">{table.label}</span>
        <Button variant="ghost" size="sm" className="h-8" onClick={onClose}>
          <X className="size-4" /> Close
        </Button>
      </div>
      <div className="flex-1 overflow-auto p-2">
        <TableFor which={which} />
      </div>
    </div>
  );
}

function Header({ children }: { children?: React.ReactNode }) {
  return (
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
        {children}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- A: tabs */

/**
 * A — tabbed. One table at a time, closest to what round one had.
 * Cheapest to scan; you cannot compare two tables without switching.
 */
export function LedgerR2A() {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [active, setActive] = useState("products");

  return (
    <div className="mx-auto max-w-[1500px] p-4 lg:p-6">
      <Header />
      <div className="mb-4">
        <LedgerStats />
      </div>
      <div className="mb-4">
        <ReconciliationNote />
      </div>

      <Tabs value={active} onValueChange={setActive}>
        <TabsList className="mb-3 flex-wrap">
          {tables.map((t) => (
            <TabsTrigger key={t.key} value={t.key}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {tables.map((t) => (
          <TabsContent key={t.key} value={t.key}>
            <RotatePrompt onExpand={() => setExpanded(t.key)} />
            <TableFor which={t.key} />
          </TabsContent>
        ))}
      </Tabs>

      {expanded && (
        <Expanded which={expanded} onClose={() => setExpanded(null)} />
      )}
    </div>
  );
}

/* -------------------------------------------------------- B: sectioned scroll */

/**
 * B — all four stacked, with a sticky sub-nav that jumps between them.
 * Everything is present and nothing is hidden behind a tab; the cost is a long
 * page, which is what the sticky nav exists to make survivable.
 */
export function LedgerR2B() {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-[1500px] p-4 lg:p-6">
      <Header />
      <div className="mb-4">
        <LedgerStats />
      </div>
      <div className="mb-4">
        <ReconciliationNote />
      </div>

      <div className="sticky top-0 z-30 -mx-4 mb-4 border-y bg-background/95 px-4 py-2 backdrop-blur lg:-mx-6 lg:px-6">
        <div className="flex gap-1.5 overflow-x-auto">
          {tables.map((t) => (
            <a
              key={t.key}
              href={`#${t.key}`}
              className="shrink-0 rounded-full border bg-card px-3 py-1 text-[12px] font-medium text-muted-foreground transition-colors duration-100 hover:bg-accent"
            >
              {t.label}
            </a>
          ))}
        </div>
      </div>

      <div className="space-y-6">
        {tables.map((t) => (
          <section key={t.key} id={t.key} className="scroll-mt-16">
            <div className="mb-2 flex items-baseline justify-between">
              <div>
                <h2 className="font-medium">{t.label}</h2>
                <p className="text-xs text-muted-foreground">{t.hint}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs lg:hidden"
                onClick={() => setExpanded(t.key)}
              >
                <Maximize2 className="size-3.5" /> Expand
              </Button>
            </div>
            <TableFor which={t.key} />
          </section>
        ))}
      </div>

      {expanded && (
        <Expanded which={expanded} onClose={() => setExpanded(null)} />
      )}
    </div>
  );
}

/* --------------------------------------------------------- C: master–detail */

/**
 * C — a left rail of tables with the stats folded into it, and the active
 * table filling the right. Round-one C's layout, which Edwin liked.
 *
 * The rail keeps the four tables and the period visible at all times, so the
 * page never hides what else is available. On mobile the rail collapses to the
 * same pill row B uses, since a sidebar on a phone is a drawer nobody opens.
 */
export function LedgerR2C() {
  const [active, setActive] = useState("products");
  const [expanded, setExpanded] = useState<string | null>(null);
  const table = tables.find((t) => t.key === active)!;

  return (
    <div className="mx-auto max-w-[1600px] p-4 lg:p-6">
      <Header />

      <div className="flex gap-5">
        <nav className="hidden w-56 shrink-0 lg:block">
          <div className="mb-4">
            {tables.map((t) => (
              <button
                key={t.key}
                onClick={() => setActive(t.key)}
                className={`mb-0.5 block w-full rounded-md px-3 py-2 text-left transition-colors duration-100 ${
                  active === t.key
                    ? "bg-accent font-medium"
                    : "text-muted-foreground hover:bg-accent/60"
                }`}
              >
                <div className="text-[13px]">{t.label}</div>
                <div className="text-[11px] text-muted-foreground">{t.hint}</div>
              </button>
            ))}
          </div>
          <div className="rounded-lg border bg-card p-3">
            <h3 className="mb-2 text-[11px] font-medium text-muted-foreground">
              This period
            </h3>
            <LedgerStats compact />
          </div>
        </nav>

        <div className="min-w-0 flex-1">
          <div className="mb-3 flex gap-1.5 overflow-x-auto lg:hidden">
            {tables.map((t) => (
              <button
                key={t.key}
                onClick={() => setActive(t.key)}
                className={`shrink-0 rounded-full border px-3 py-1 text-[12px] font-medium transition-colors duration-100 ${
                  active === t.key
                    ? "border-neutral-800 bg-neutral-800 text-white"
                    : "bg-card text-muted-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="mb-3 lg:hidden">
            <LedgerStats compact />
          </div>

          <div className="mb-3 hidden items-baseline justify-between lg:flex">
            <div>
              <h2 className="font-medium">{table.label}</h2>
              <p className="text-xs text-muted-foreground">{table.hint}</p>
            </div>
            <Badge variant="outline" className="text-[10px] font-normal">
              2 – 6 August 2026
            </Badge>
          </div>

          <RotatePrompt onExpand={() => setExpanded(active)} />
          <TableFor which={active} />

          <div className="mt-4">
            <ReconciliationNote />
          </div>
        </div>
      </div>

      {expanded && (
        <Expanded which={expanded} onClose={() => setExpanded(null)} />
      )}
    </div>
  );
}
