"use client";

/**
 * Till — round two.
 *
 * The combination Edwin settled after round one:
 *
 *   From A — the product grid with large tap targets ("very easy for the user
 *     just to tap easily"), the search bar at the top, and the live summary at
 *     the bottom that updates as items are added.
 *   From B — the mode switch, kept as a concept.
 *   From C — the mode switch's visual treatment, and payment as a list of
 *     lines with a method dropdown ("covers the most scenarios").
 *   New   — category pills below the search bar.
 *
 * Two corrections carried from round one:
 *
 *   No customer field in the counter flow. "It should not be part of this
 *   flow" — it appears only when the mode or a credit line actually requires
 *   a named customer.
 *
 *   Payment amounts are typed directly, never behind a "split" step. A's
 *   inputs were "there and they were ready"; B's split button made the common
 *   case slower. Two lines are present from the start, so splitting a payment
 *   is typing in the second box rather than clicking to reveal it.
 *
 * The header carries page, location and account with deliberate hierarchy.
 * Location is heaviest because architecture.md calls it the cutting dimension —
 * it decides what stock exists and which day the entry belongs to. The accent
 * rail down the left edge is coloured per location so the answer is available
 * pre-attentively, before anything is read: it exists to stop a canteen sale
 * being recorded against the restaurant.
 */

import { useMemo, useState } from "react";
import {
  products,
  customers,
  categories,
  money,
  type Product,
  type Category,
  type PaymentMethod,
  type Location,
} from "@/lib/fixtures";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Minus, Plus, Search, Trash2, X, Store, Truck, CreditCard } from "lucide-react";

type Mode = "counter" | "delivery" | "credit";

interface Line {
  product: Product;
  qty: number;
}

interface Pay {
  id: number;
  method: PaymentMethod;
  amount: string;
}

const modes: { key: Mode; label: string; icon: typeof Store }[] = [
  { key: "counter", label: "Counter", icon: Store },
  { key: "delivery", label: "Delivery", icon: Truck },
  { key: "credit", label: "Credit", icon: CreditCard },
];

/** Per-location accent, so which location you are in is legible before reading. */
const locationAccent: Record<Location, string> = {
  restaurant: "var(--color-brand-600)",
  canteen: "var(--color-success)",
};

export function TillR2({
  location = "restaurant",
  staffName = "Sarah",
}: {
  location?: Location;
  staffName?: string;
}) {
  const [mode, setMode] = useState<Mode>("counter");
  const [category, setCategory] = useState<Category | "all">("all");
  const [query, setQuery] = useState("");
  const [lines, setLines] = useState<Line[]>([
    { product: products.find((p) => p.name === "Chips")!, qty: 2 },
    { product: products.find((p) => p.name === "Githeri")!, qty: 1 },
    { product: products.find((p) => p.name === "Soda 500ml")!, qty: 2 },
  ]);
  const [pays, setPays] = useState<Pay[]>([
    { id: 1, method: "cash", amount: "" },
    { id: 2, method: "mpesa", amount: "" },
  ]);
  const [customer, setCustomer] = useState("");

  const total = lines.reduce((s, l) => s + l.product.price * l.qty, 0);
  const itemCount = lines.reduce((s, l) => s + l.qty, 0);
  const paid = pays.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const remaining = total - paid;

  const hasCredit = pays.some(
    (p) => p.method === "credit" && Number(p.amount) > 0,
  );
  const needsCustomer = mode !== "counter" || hasCredit;

  const atLocation = useMemo(
    () => products.filter((p) => p.location.includes(location)),
    [location],
  );

  // Categories with nothing in them at this location are never offered.
  const available = useMemo(
    () => categories.filter((c) => atLocation.some((p) => p.category === c.key)),
    [atLocation],
  );

  const shown = useMemo(() => {
    const byCategory =
      category === "all"
        ? atLocation
        : atLocation.filter((p) => p.category === category);
    if (!query.trim()) return byCategory;
    const q = query.toLowerCase();
    return byCategory.filter((p) => p.name.toLowerCase().includes(q));
  }, [atLocation, category, query]);

  const add = (p: Product) =>
    setLines((ls) => {
      const hit = ls.find((l) => l.product.id === p.id);
      return hit
        ? ls.map((l) => (l.product.id === p.id ? { ...l, qty: l.qty + 1 } : l))
        : [...ls, { product: p, qty: 1 }];
    });

  const bump = (id: string, d: number) =>
    setLines((ls) =>
      ls
        .map((l) => (l.product.id === id ? { ...l, qty: l.qty + d } : l))
        .filter((l) => l.qty > 0),
    );

  const accent = locationAccent[location];
  const canComplete =
    lines.length > 0 &&
    (mode === "credit" || remaining === 0) &&
    (!needsCustomer || !!customer);

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      {/* Identity. Location heaviest; page and account quiet but findable. */}
      <header
        className="flex items-center gap-3 border-b bg-card px-4 py-2.5"
        style={{ borderLeft: `3px solid ${accent}` }}
      >
        <div className="min-w-0 flex-1">
          <div className="text-[15px] leading-tight font-semibold capitalize">
            {location}
          </div>
          <div className="text-[11px] leading-tight text-muted-foreground">
            Sell · {staffName}
          </div>
        </div>

        {itemCount > 0 && (
          <div className="text-right">
            <div className="tabular text-[15px] leading-tight font-medium">
              {money(total)}
            </div>
            <div className="text-[11px] leading-tight text-muted-foreground">
              {itemCount} {itemCount === 1 ? "item" : "items"}
            </div>
          </div>
        )}

        <div
          className="flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
          style={{ background: accent }}
          title={`Signed in as ${staffName}`}
        >
          {staffName[0]}
        </div>
      </header>

      {/* Mode. The one interactive thing up here, so it gets its own row. */}
      <div className="border-b bg-card px-3 py-2">
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          {modes.map((m) => {
            const Icon = m.icon;
            const on = mode === m.key;
            return (
              <button
                key={m.key}
                onClick={() => setMode(m.key)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 text-[13px] font-medium transition-colors duration-100 ${
                  on ? "text-white shadow-sm" : "text-muted-foreground"
                }`}
                style={on ? { background: accent } : undefined}
                aria-pressed={on}
              >
                <Icon className="size-3.5" />
                {m.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Search, then categories. */}
      <div className="border-b bg-card px-3 pt-2 pb-2">
        <div className="relative">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products"
            className="h-10 pl-8"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground"
              aria-label="Clear search"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        <div className="-mx-3 mt-2 flex gap-1.5 overflow-x-auto px-3 pb-0.5">
          <Pill on={category === "all"} onClick={() => setCategory("all")} accent={accent}>
            All
          </Pill>
          {available.map((c) => (
            <Pill
              key={c.key}
              on={category === c.key}
              onClick={() => setCategory(c.key)}
              accent={accent}
            >
              {c.label}
            </Pill>
          ))}
        </div>
      </div>

      {/* Products. Large tap targets, three across. */}
      <div className="flex-1 overflow-y-auto p-3">
        {shown.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-muted-foreground">
              Nothing matches {query ? `“${query}”` : "this category"}.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => {
                setQuery("");
                setCategory("all");
              }}
            >
              Clear filters
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {shown.map((p) => {
              const inBasket = lines.find((l) => l.product.id === p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => add(p)}
                  title={p.name}
                  className="relative flex h-[76px] flex-col items-start justify-between rounded-lg border bg-card p-2 text-left transition-colors duration-100 active:bg-accent"
                  style={inBasket ? { borderColor: accent } : undefined}
                >
                  <span className="line-clamp-2 text-[13px] leading-tight font-medium">
                    {p.name}
                  </span>
                  <span className="tabular text-[11px] text-muted-foreground">
                    {money(p.price)}
                  </span>
                  {inBasket && (
                    <span
                      className="tabular absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full text-[11px] font-semibold text-white"
                      style={{ background: accent }}
                    >
                      {inBasket.qty}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Live summary, basket, payment. */}
      <div className="border-t bg-card">
        {lines.length > 0 && (
          <div className="max-h-40 overflow-y-auto px-4 py-1.5">
            {lines.map((l) => (
              <div
                key={l.product.id}
                className="flex items-center gap-2 border-b py-1.5 last:border-0"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium">
                    {l.product.name}
                  </div>
                  <div className="tabular text-[11px] text-muted-foreground">
                    {money(l.product.price)} each
                  </div>
                </div>
                <Button
                  size="icon"
                  variant="outline"
                  className="size-8 shrink-0"
                  onClick={() => bump(l.product.id, -1)}
                  aria-label={`One fewer ${l.product.name}`}
                >
                  <Minus className="size-3.5" />
                </Button>
                <span className="tabular w-6 text-center text-sm font-medium">
                  {l.qty}
                </span>
                <Button
                  size="icon"
                  variant="outline"
                  className="size-8 shrink-0"
                  onClick={() => bump(l.product.id, 1)}
                  aria-label={`One more ${l.product.name}`}
                >
                  <Plus className="size-3.5" />
                </Button>
                <span className="tabular w-16 shrink-0 text-right text-[13px] font-medium">
                  {money(l.product.price * l.qty)}
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7 shrink-0 text-muted-foreground"
                  onClick={() => bump(l.product.id, -l.qty)}
                  aria-label={`Remove ${l.product.name}`}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-2.5 border-t px-4 py-3">
          {needsCustomer && (
            <div>
              <label className="text-[11px] font-medium text-muted-foreground">
                Customer — required for {hasCredit ? "credit" : mode}
              </label>
              <Select value={customer} onValueChange={setCustomer}>
                <SelectTrigger className="mt-1 h-10 w-full">
                  <SelectValue placeholder="Choose a customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                      {c.balance > 0 && (
                        <span className="tabular ml-2 text-xs text-muted-foreground">
                          owes {money(c.balance)}
                        </span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {mode === "credit" ? (
            <div className="rounded-md border border-dashed px-3 py-2 text-center text-[11px] text-muted-foreground">
              No payment taken — recorded against the customer&apos;s account
            </div>
          ) : (
            <div className="space-y-1.5">
              {pays.map((p) => (
                <div key={p.id} className="flex items-center gap-2">
                  <Select
                    value={p.method}
                    onValueChange={(v) =>
                      setPays((ps) =>
                        ps.map((x) =>
                          x.id === p.id
                            ? { ...x, method: v as PaymentMethod }
                            : x,
                        ),
                      )
                    }
                  >
                    <SelectTrigger className="h-10 w-28 shrink-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="mpesa">M-Pesa</SelectItem>
                      <SelectItem value="credit">Credit</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    inputMode="numeric"
                    placeholder="0"
                    value={p.amount}
                    onChange={(e) =>
                      setPays((ps) =>
                        ps.map((x) =>
                          x.id === p.id ? { ...x, amount: e.target.value } : x,
                        ),
                      )
                    }
                    className="tabular h-10 flex-1 text-right"
                  />
                  {pays.length > 2 && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-8 shrink-0 text-muted-foreground"
                      onClick={() =>
                        setPays((ps) => ps.filter((x) => x.id !== p.id))
                      }
                      aria-label="Remove this payment line"
                    >
                      <X className="size-3.5" />
                    </Button>
                  )}
                </div>
              ))}
              <button
                onClick={() =>
                  setPays((ps) => [
                    ...ps,
                    { id: Date.now(), method: "credit", amount: "" },
                  ])
                }
                className="text-[11px] text-muted-foreground underline-offset-2 hover:underline"
              >
                Add another payment method
              </button>
            </div>
          )}

          <div className="space-y-1 border-t pt-2">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="tabular text-xl font-semibold">
                {money(total)}
              </span>
            </div>
            {mode !== "credit" && remaining !== 0 && lines.length > 0 && (
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">
                  {remaining > 0 ? "Still to pay" : "Change"}
                </span>
                <Badge variant={remaining > 0 ? "destructive" : "secondary"}>
                  <span className="tabular">{money(Math.abs(remaining))}</span>
                </Badge>
              </div>
            )}
          </div>

          <Button
            className="h-12 w-full text-[15px]"
            style={canComplete ? { background: accent } : undefined}
            disabled={!canComplete}
          >
            {mode === "credit" ? "Record on account" : "Complete sale"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Pill({
  on,
  onClick,
  accent,
  children,
}: {
  on: boolean;
  onClick: () => void;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors duration-100 ${
        on ? "text-white" : "bg-card text-muted-foreground"
      }`}
      style={on ? { background: accent, borderColor: accent } : undefined}
      aria-pressed={on}
    >
      {children}
    </button>
  );
}
