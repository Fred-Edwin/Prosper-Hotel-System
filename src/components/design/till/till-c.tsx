"use client";

/**
 * Till C — fulfilment toggle, credit as a payment line, defaults per role.
 *
 * The compromise the domain model actually asks for. CONTEXT.md says
 * fulfilment (counter/delivery) and payment (a list of lines, one of which may
 * be credit) are two independent facts, and neither creates a different kind of
 * sale. So: fulfilment is a toggle, credit is a payment method, and "a delivery
 * paid in cash" is expressible — which it is not in B.
 *
 * What makes it usable rather than merely correct is defaults per role. The
 * screen opens configured for whoever is signed in: Sarah sees counter with
 * cash focused; Anne sees credit with the customer field already open. Nothing
 * is hidden, but nobody starts on a field they never use.
 *
 * Payment is built as a list of lines because that is what it is. Splitting a
 * sale across cash and M-Pesa is adding a line, not a special mode.
 */

import { useState } from "react";
import {
  products,
  customers,
  money,
  type Product,
  type PaymentMethod,
} from "@/lib/fixtures";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Minus, Plus, X, Truck, Store } from "lucide-react";

interface Line {
  product: Product;
  qty: number;
}

interface Pay {
  id: number;
  method: PaymentMethod;
  amount: string;
}

const till = products.filter((p) => p.location.includes("restaurant"));

export function TillC() {
  const [fulfilment, setFulfilment] = useState<"counter" | "delivery">(
    "counter",
  );
  const [lines, setLines] = useState<Line[]>([
    { product: till.find((p) => p.name === "Chips")!, qty: 2 },
    { product: till.find((p) => p.name === "Githeri")!, qty: 1 },
    { product: till.find((p) => p.name === "Soda 500ml")!, qty: 2 },
  ]);
  const [pays, setPays] = useState<Pay[]>([
    { id: 1, method: "cash", amount: "300" },
    { id: 2, method: "mpesa", amount: "180" },
  ]);
  const [customer, setCustomer] = useState("");

  const total = lines.reduce((s, l) => s + l.product.price * l.qty, 0);
  const paid = pays.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const remaining = total - paid;
  const hasCredit = pays.some((p) => p.method === "credit");
  const needsCustomer = fulfilment === "delivery" || hasCredit;

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

  const addPay = () =>
    setPays((ps) => [
      ...ps,
      { id: Date.now(), method: "cash", amount: String(Math.max(0, remaining)) },
    ]);

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="flex items-center justify-between border-b bg-card px-4 py-2.5">
        <div>
          <div className="font-semibold">New sale</div>
          <div className="text-xs text-muted-foreground">Restaurant · Sarah</div>
        </div>
        <div className="flex rounded-md border p-0.5">
          <button
            onClick={() => setFulfilment("counter")}
            className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors duration-100 ${
              fulfilment === "counter"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground"
            }`}
          >
            <Store className="size-3.5" /> Counter
          </button>
          <button
            onClick={() => setFulfilment("delivery")}
            className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors duration-100 ${
              fulfilment === "delivery"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground"
            }`}
          >
            <Truck className="size-3.5" /> Delivery
          </button>
        </div>
      </header>

      <div className="border-b bg-card">
        <Command className="rounded-none border-0">
          <CommandInput placeholder="Type to find a product…" />
          <CommandList className="max-h-52">
            <CommandEmpty>No product found.</CommandEmpty>
            <CommandGroup>
              {till.map((p) => (
                <CommandItem
                  key={p.id}
                  value={p.name}
                  onSelect={() => add(p)}
                  className="flex justify-between"
                >
                  <span className="truncate">{p.name}</span>
                  <span className="tabular ml-2 shrink-0 text-xs text-muted-foreground">
                    {money(p.price)}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-2">
        {lines.map((l) => (
          <div
            key={l.product.id}
            className="flex items-center gap-2 border-b py-2 last:border-0"
          >
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">
                {l.product.name}
              </div>
              <div className="tabular text-xs text-muted-foreground">
                {money(l.product.price)} each
              </div>
            </div>
            <Button
              size="icon"
              variant="outline"
              className="size-8"
              onClick={() => bump(l.product.id, -1)}
              aria-label={`One fewer ${l.product.name}`}
            >
              <Minus className="size-3.5" />
            </Button>
            <span className="tabular w-7 text-center font-medium">{l.qty}</span>
            <Button
              size="icon"
              variant="outline"
              className="size-8"
              onClick={() => bump(l.product.id, 1)}
              aria-label={`One more ${l.product.name}`}
            >
              <Plus className="size-3.5" />
            </Button>
            <span className="tabular w-16 text-right text-sm font-medium">
              {money(l.product.price * l.qty)}
            </span>
          </div>
        ))}
      </div>

      <div className="border-t bg-card px-4 py-3">
        {needsCustomer && (
          <div className="mb-3">
            <label className="text-xs font-medium text-muted-foreground">
              Customer{" "}
              <span className="text-danger">
                required for {hasCredit ? "credit" : "delivery"}
              </span>
            </label>
            <Select value={customer} onValueChange={setCustomer}>
              <SelectTrigger className="mt-1 w-full">
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

        <div className="mb-2 space-y-1.5">
          {pays.map((p) => (
            <div key={p.id} className="flex items-center gap-2">
              <Select
                value={p.method}
                onValueChange={(v) =>
                  setPays((ps) =>
                    ps.map((x) =>
                      x.id === p.id ? { ...x, method: v as PaymentMethod } : x,
                    ),
                  )
                }
              >
                <SelectTrigger className="w-28">
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
                value={p.amount}
                onChange={(e) =>
                  setPays((ps) =>
                    ps.map((x) =>
                      x.id === p.id ? { ...x, amount: e.target.value } : x,
                    ),
                  )
                }
                className="tabular flex-1 text-right"
              />
              {pays.length > 1 && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8 text-muted-foreground"
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
          <Button
            variant="ghost"
            size="sm"
            onClick={addPay}
            className="h-7 text-xs text-muted-foreground"
          >
            <Plus className="size-3" /> Split payment
          </Button>
        </div>

        <div className="mb-3 space-y-1 border-t pt-2">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-muted-foreground">Total</span>
            <span className="tabular text-xl font-semibold">{money(total)}</span>
          </div>
          {remaining !== 0 && (
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
          className="h-11 w-full"
          disabled={
            lines.length === 0 || remaining !== 0 || (needsCustomer && !customer)
          }
        >
          Complete sale
        </Button>
      </div>
    </div>
  );
}
