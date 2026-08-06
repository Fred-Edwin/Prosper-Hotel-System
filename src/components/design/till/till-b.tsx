"use client";

/**
 * Till B — three modes.
 *
 * The sale declares its kind up front and the form changes to suit:
 *   Counter  — items, then payment. No customer field at all.
 *   Delivery — items, customer required, then payment.
 *   Credit   — items, customer required, no payment step.
 *
 * Each person lands in their own mode and mostly never switches. Anne would
 * only ever see Credit, so she is never offered cash buttons she must not press.
 *
 * The risk this variant exists to test: CONTEXT.md says fulfilment and payment
 * are two independent facts, and three modes fuses them. "A delivery paid in
 * cash" has nowhere obvious to go here — which is surely common.
 */

import { useState } from "react";
import { products, customers, money, type Product } from "@/lib/fixtures";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Minus, Plus, Search } from "lucide-react";

type Mode = "counter" | "delivery" | "credit";

interface Line {
  product: Product;
  qty: number;
}

const till = products.filter((p) => p.location.includes("restaurant"));

export function TillB() {
  const [mode, setMode] = useState<Mode>("counter");
  const [lines, setLines] = useState<Line[]>([
    { product: till.find((p) => p.name === "Chips")!, qty: 2 },
    { product: till.find((p) => p.name === "Soda 500ml")!, qty: 2 },
  ]);
  const [query, setQuery] = useState("");
  const [customer, setCustomer] = useState("");
  const [tendered, setTendered] = useState<"cash" | "mpesa" | "split">("cash");

  const total = lines.reduce((s, l) => s + l.product.price * l.qty, 0);
  const needsCustomer = mode !== "counter";
  const takesPayment = mode !== "credit";

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
      <header className="border-b bg-card px-4 pt-3 pb-0">
        <div className="mb-2 flex items-center justify-between">
          <div className="font-semibold">New sale</div>
          <div className="text-xs text-muted-foreground">Restaurant · Sarah</div>
        </div>
        <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
          <TabsList className="w-full">
            <TabsTrigger value="counter" className="flex-1">
              Counter
            </TabsTrigger>
            <TabsTrigger value="delivery" className="flex-1">
              Delivery
            </TabsTrigger>
            <TabsTrigger value="credit" className="flex-1">
              Credit
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </header>

      {needsCustomer && (
        <div className="border-b bg-warning-subtle px-4 py-2">
          <label className="text-xs font-medium">
            Customer <span className="text-danger">required</span>
            <Select value={customer} onValueChange={setCustomer}>
              <SelectTrigger className="mt-1 w-full bg-card">
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
          </label>
        </div>
      )}

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

      <div className="grid grid-cols-2 gap-2 overflow-y-auto p-3">
        {shown.map((p) => (
          <button
            key={p.id}
            onClick={() => add(p)}
            className="flex items-center justify-between rounded-md border bg-card px-3 py-2.5 text-left transition-colors duration-100 hover:bg-accent active:bg-accent"
          >
            <span className="truncate text-sm font-medium">{p.name}</span>
            <span className="tabular ml-2 shrink-0 text-xs text-muted-foreground">
              {money(p.price)}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-auto border-t bg-card">
        <div className="max-h-40 overflow-y-auto px-4 py-2">
          {lines.map((l) => (
            <div
              key={l.product.id}
              className="flex items-center gap-2 border-b py-1.5 last:border-0"
            >
              <span className="flex-1 truncate text-sm">{l.product.name}</span>
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
              <span className="tabular w-16 text-right text-sm">
                {money(l.product.price * l.qty)}
              </span>
            </div>
          ))}
        </div>

        <div className="space-y-3 border-t px-4 py-3">
          {takesPayment ? (
            <div className="grid grid-cols-3 gap-2">
              {(["cash", "mpesa", "split"] as const).map((t) => (
                <Button
                  key={t}
                  variant={tendered === t ? "default" : "outline"}
                  onClick={() => setTendered(t)}
                  className="h-10 capitalize"
                >
                  {t === "mpesa" ? "M-Pesa" : t}
                </Button>
              ))}
            </div>
          ) : (
            <div className="rounded-md border border-dashed px-3 py-2 text-center text-xs text-muted-foreground">
              No payment taken — recorded against the customer&apos;s account
            </div>
          )}

          <div className="flex items-baseline justify-between">
            <span className="text-sm text-muted-foreground">Total</span>
            <span className="tabular text-xl font-semibold">{money(total)}</span>
          </div>

          <Button
            className="h-11 w-full"
            disabled={lines.length === 0 || (needsCustomer && !customer)}
          >
            {mode === "credit" ? "Record on account" : "Take payment"}
          </Button>
        </div>
      </div>
    </div>
  );
}
