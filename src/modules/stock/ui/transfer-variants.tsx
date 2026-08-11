"use client";

import { useMemo, useState } from "react";
import { ChevronRight, Minus, Package, Plus, Search, Store, Trash2, Utensils } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export type TransferDraftItem = { id: string; name: string; available: number; unit: string; type: "Product" | "Ingredient" };
type DraftLine = TransferDraftItem & { quantity: number };

const defaultInventory: TransferDraftItem[] = ([
  ["sodas", "Sodas (500ml)", 36, "units", "Product"], ["chips", "Chips", 18, "units", "Product"],
  ["buns", "Mandazi", 24, "units", "Product"], ["water", "Bottled water (500ml)", 42, "units", "Product"],
  ["flour", "Flour", 24, "kg", "Ingredient"], ["sugar", "Sugar", 15, "kg", "Ingredient"],
  ["oil", "Cooking oil", 18, "litres", "Ingredient"], ["tea", "Tea leaves", 8, "packets", "Ingredient"],
  ["rice", "Rice", 30, "kg", "Ingredient"], ["beans", "Baked beans", 20, "tins", "Product"],
  ["bread", "Bread loaves", 12, "loaves", "Product"], ["milk", "Fresh milk", 18, "litres", "Ingredient"],
  ["eggs", "Eggs", 10, "trays", "Ingredient"], ["paper", "Printing paper", 16, "reams", "Ingredient"],
  ["biscuits", "Biscuits", 40, "packs", "Product"], ["salt", "Salt", 12, "kg", "Ingredient"],
  ["tomatoes", "Tomatoes", 18, "kg", "Ingredient"], ["potatoes", "Potatoes", 32, "kg", "Ingredient"],
  ["cabbage", "Cabbage", 16, "heads", "Ingredient"], ["cooking-fat", "Cooking fat", 10, "tins", "Ingredient"],
  ["juice", "Fruit juice (300ml)", 28, "units", "Product"], ["cups", "Paper cups", 50, "sleeves", "Ingredient"],
  ["tissue", "Tissue paper", 22, "rolls", "Ingredient"], ["charcoal", "Charcoal", 14, "bags", "Ingredient"],
] as [string, string, number, string, TransferDraftItem["type"]][]).map(([id, name, available, unit, type]) => ({
  id,
  name,
  available,
  unit,
  type,
}));

export type TransferVariantKind = "inline" | "tray" | "review";

export function TransferVariant({ variant, items = defaultInventory, onTransfer }: { variant: TransferVariantKind; items?: TransferDraftItem[]; onTransfer?: (lines: DraftLine[]) => Promise<boolean> }) {
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<DraftLine[]>([]);
  const [reviewOpen, setReviewOpen] = useState(false);

  const shown = useMemo(() => {
    const term = query.trim().toLowerCase();
    return term ? items.filter((item) => item.name.toLowerCase().includes(term)) : items;
  }, [items, query]);

  const add = (item: TransferDraftItem) => {
    setDraft((current) => {
      const line = current.find((entry) => entry.id === item.id);
      if (line) return current.map((entry) => entry.id === item.id ? { ...entry, quantity: Math.min(entry.quantity + 1, item.available) } : entry);
      return [...current, { ...item, quantity: 1 }];
    });
  };
  const setQuantity = (id: string, quantity: number) => setDraft((current) => current.map((line) => line.id === id ? { ...line, quantity: Math.max(1, Math.min(quantity, line.available)) } : line));
  const remove = (id: string) => setDraft((current) => current.filter((line) => line.id !== id));
  const restore = (lines: DraftLine[]) => setDraft(lines);
  const lineCount = draft.length;

  const complete = async () => {
    const completed = draft;
    if (onTransfer && !(await onTransfer(completed))) {
      toast.error("Couldn't complete the transfer", {
        description: "Stock at your location may have changed. Check the quantities and try again.",
      });
      return;
    }
    setReviewOpen(false);
    setDraft([]);
    toast.success(`${completed.length} ${completed.length === 1 ? "item" : "items"} transferred`, {
      description: "Stock moved from Restaurant to Canteen immediately.",
      action: { label: "Undo", onClick: () => restore(completed) },
    });
  };

  return (
    <div className="flex min-h-full flex-col" data-testid={`transfer-variant-${variant}`}>
      <RouteHeader />
      <section className="border-b bg-card p-3">
        <div className="relative">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} className="h-11 pl-9" placeholder="Search stock" aria-label="Search stock" autoFocus />
        </div>
      </section>
      {variant === "inline" && <DraftRows draft={draft} onQuantity={setQuantity} onRemove={remove} />}
      <section className="flex-1 overflow-y-auto p-3">
        <div className="mb-2 flex items-baseline justify-between">
          <p className="text-sm font-medium">Stock on hand</p>
          <p className="text-xs text-muted-foreground">{shown.length} items</p>
        </div>
        {shown.length === 0 ? <p className="py-12 text-center text-sm text-muted-foreground">Nothing matches “{query}”.</p> : (
          <div className="grid grid-cols-2 gap-2">
            {shown.map((item) => {
              const quantity = draft.find((line) => line.id === item.id)?.quantity;
              return <ItemTile key={item.id} item={item} quantity={quantity} onAdd={() => add(item)} />;
            })}
          </div>
        )}
      </section>
      {variant === "review" && lineCount > 0 && <ReviewPreview draft={draft} />}
      <DraftBar count={lineCount} onReview={() => setReviewOpen(true)} />
      <ReviewSheet open={reviewOpen} onOpenChange={setReviewOpen} draft={draft} onQuantity={setQuantity} onRemove={remove} onComplete={complete} />
    </div>
  );
}

function RouteHeader() {
  return <section className="flex items-center gap-3 bg-card p-3">
    <div className="flex min-w-0 flex-1 items-center gap-2"><Store className="size-5 text-primary" /><div><p className="text-xs text-muted-foreground">From</p><p className="text-sm font-medium">Restaurant</p></div></div>
    <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
    <div className="flex min-w-0 flex-1 items-center justify-end gap-2 text-right"><div><p className="text-xs text-muted-foreground">To</p><p className="text-sm font-medium">Canteen</p></div><Utensils className="size-5 text-primary" /></div>
  </section>;
}

function ItemTile({ item, quantity, onAdd }: { item: TransferDraftItem; quantity?: number; onAdd: () => void }) {
  return <button onClick={onAdd} className={`relative flex min-h-24 flex-col justify-between rounded-lg border bg-card p-3 text-left transition-colors duration-100 active:bg-muted ${quantity ? "border-primary" : ""}`}>
    <span className="line-clamp-2 text-sm font-medium">{item.name}</span>
    <span className="text-xs text-muted-foreground">{item.available} {item.unit} on hand</span>
    {quantity && <span className="absolute top-2 right-2 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">{quantity}</span>}
  </button>;
}

function DraftRows({ draft, onQuantity, onRemove }: { draft: DraftLine[]; onQuantity: (id: string, value: number) => void; onRemove: (id: string) => void }) {
  if (!draft.length) return null;
  return <section className="border-b bg-muted/40 p-3"><p className="mb-2 text-xs font-medium text-muted-foreground">Transfer draft</p><div className="space-y-2">{draft.map((line) => <DraftLineRow key={line.id} line={line} onQuantity={onQuantity} onRemove={onRemove} />)}</div></section>;
}

function DraftLineRow({ line, onQuantity, onRemove }: { line: DraftLine; onQuantity: (id: string, value: number) => void; onRemove: (id: string) => void }) {
  return <div className="flex items-center gap-2 rounded-lg border bg-card p-2"><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{line.name}</p><p className="text-xs text-muted-foreground">{line.available} {line.unit} available</p></div><Button variant="outline" size="icon-sm" onClick={() => onQuantity(line.id, line.quantity - 1)} aria-label={`Decrease ${line.name}`}><Minus /></Button><Input value={String(line.quantity)} onChange={(event) => onQuantity(line.id, Number(event.target.value) || 1)} inputMode="numeric" className="h-7 w-12 px-1 text-center text-sm" aria-label={`Quantity for ${line.name}`} /><Button variant="outline" size="icon-sm" onClick={() => onQuantity(line.id, line.quantity + 1)} aria-label={`Increase ${line.name}`}><Plus /></Button><Button variant="ghost" size="icon-sm" onClick={() => onRemove(line.id)} aria-label={`Remove ${line.name}`}><Trash2 /></Button></div>;
}

function DraftBar({ count, onReview }: { count: number; onReview: () => void }) {
  return <div className="border-t bg-card p-3"><Button className="h-12 w-full" disabled={!count} onClick={onReview}>{count ? `Review ${count} ${count === 1 ? "item" : "items"}` : "Select items to transfer"}</Button></div>;
}

function ReviewPreview({ draft }: { draft: DraftLine[] }) {
  return <section className="border-t bg-primary/5 p-3"><div className="flex gap-3"><Package className="size-5 shrink-0 text-primary" /><p className="text-sm"><span className="font-medium">{draft.length} items</span> will leave Restaurant and arrive at Canteen immediately.</p></div></section>;
}

function ReviewSheet({ open, onOpenChange, draft, onQuantity, onRemove, onComplete }: { open: boolean; onOpenChange: (open: boolean) => void; draft: DraftLine[]; onQuantity: (id: string, value: number) => void; onRemove: (id: string) => void; onComplete: () => void }) {
  return <Sheet open={open} onOpenChange={onOpenChange}><SheetContent side="bottom" className="max-h-dvh rounded-t-xl"><SheetHeader><SheetTitle>Review transfer</SheetTitle><SheetDescription>Stock moves from Restaurant to Canteen immediately.</SheetDescription></SheetHeader><div className="min-h-0 overflow-y-auto px-4">{draft.map((line) => <DraftLineRow key={line.id} line={line} onQuantity={onQuantity} onRemove={onRemove} />)}</div><SheetFooter><Button className="h-12" disabled={!draft.length} onClick={onComplete}>Transfer {draft.length} {draft.length === 1 ? "item" : "items"}</Button></SheetFooter></SheetContent></Sheet>;
}
