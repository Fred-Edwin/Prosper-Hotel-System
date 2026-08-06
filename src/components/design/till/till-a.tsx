"use client";

/**
 * Till A — one screen, no modes.
 *
 * Everything present at once: an optional customer field, and credit sitting
 * alongside cash and M-Pesa as a payment method. The simplest build, and the
 * one that treats fulfilment and payment as the two independent facts
 * CONTEXT.md says they are.
 *
 * The cost: a cashier under time pressure carries a customer field they never
 * use, and Anne is offered cash and M-Pesa buttons she is not supposed to press.
 */

import { useState } from "react";
import { products, customers, money, type Product } from "@/lib/fixtures";
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
import { Minus, Plus, Trash2, Search } from "lucide-react";

interface Line {
  product: Product;
  qty: number;
}

const till = products.filter((p) => p.location.includes("restaurant"));

export function TillA() {
  const [lines, setLines] = useState<Line[]>([
    { product: till.find((p) => p.name === "Mukimo")!, qty: 1 },
    { product: till.find((p) => p.name === "Chapati")!, qty: 2 },
  ]);
  const [query, setQuery] = useState("");
  const [cash, setCash] = useState("");
  const [mpesa, setMpesa] = useState("");
  const [credit, setCredit] = useState("");
  const [customer, setCustomer] = useState<string>("");

  const total = lines.reduce((s, l) => s + l.product.price * l.qty, 0);
  const paid =
    (Number(cash) || 0) + (Number(mpesa) || 0) + (Number(credit) || 0);
  const remaining = total - paid;

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

  const shown = query
    ? till.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()))
    : till;

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="flex items-center justify-between border-b bg-card px-4 py-3">
        <div>
          <div className="font-semibold">New sale</div>
          <div className="text-xs text-muted-foreground">Restaurant · Sarah</div>
        </div>
        <Badge variant="secondary">Counter</Badge>
      </header>

      <div className="border-b bg-card px-4 py-2">
        <div className="relative">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products"
            className="pl-8"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 overflow-y-auto p-3">
        {shown.map((p) => (
          <button
            key={p.id}
            onClick={() => add(p)}
            className="flex h-20 flex-col items-start justify-between rounded-md border bg-card p-2 text-left transition-colors duration-100 hover:bg-accent active:bg-accent"
          >
            <span className="line-clamp-2 text-xs leading-tight font-medium">
              {p.name}
            </span>
            <span className="tabular text-xs text-muted-foreground">
              {money(p.price)}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-auto border-t bg-card">
        <div className="max-h-44 overflow-y-auto px-4 py-2">
          {lines.map((l) => (
            <div
              key={l.product.id}
              className="flex items-center gap-2 border-b py-1.5 last:border-0"
            >
              <span className="flex-1 truncate text-sm">{l.product.name}</span>
              <div className="flex items-center gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7"
                  onClick={() => bump(l.product.id, -1)}
                  aria-label={`One fewer ${l.product.name}`}
                >
                  <Minus className="size-3.5" />
                </Button>
                <span className="tabular w-6 text-center text-sm">{l.qty}</span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7"
                  onClick={() => bump(l.product.id, 1)}
                  aria-label={`One more ${l.product.name}`}
                >
                  <Plus className="size-3.5" />
                </Button>
              </div>
              <span className="tabular w-16 text-right text-sm">
                {money(l.product.price * l.qty)}
              </span>
              <Button
                size="icon"
                variant="ghost"
                className="size-7 text-muted-foreground"
                onClick={() => bump(l.product.id, -l.qty)}
                aria-label={`Remove ${l.product.name}`}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>

        <div className="space-y-2 border-t px-4 py-3">
          <Select value={customer} onValueChange={setCustomer}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Customer (optional)" />
            </SelectTrigger>
            <SelectContent>
              {customers.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="grid grid-cols-3 gap-2">
            <label className="text-xs text-muted-foreground">
              Cash
              <Input
                inputMode="numeric"
                value={cash}
                onChange={(e) => setCash(e.target.value)}
                className="tabular mt-1"
              />
            </label>
            <label className="text-xs text-muted-foreground">
              M-Pesa
              <Input
                inputMode="numeric"
                value={mpesa}
                onChange={(e) => setMpesa(e.target.value)}
                className="tabular mt-1"
              />
            </label>
            <label className="text-xs text-muted-foreground">
              Credit
              <Input
                inputMode="numeric"
                value={credit}
                onChange={(e) => setCredit(e.target.value)}
                className="tabular mt-1"
              />
            </label>
          </div>

          <div className="flex items-baseline justify-between pt-1">
            <span className="text-sm text-muted-foreground">Total</span>
            <span className="tabular text-xl font-semibold">{money(total)}</span>
          </div>
          {remaining !== 0 && (
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-muted-foreground">
                {remaining > 0 ? "Remaining" : "Change"}
              </span>
              <span className="tabular text-sm font-medium">
                {money(Math.abs(remaining))}
              </span>
            </div>
          )}

          <Button className="h-11 w-full" disabled={lines.length === 0}>
            Complete sale
          </Button>
        </div>
      </div>
    </div>
  );
}
