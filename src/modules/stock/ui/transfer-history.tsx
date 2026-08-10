"use client";

import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Check, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";

type Entry = {
  id: string;
  direction: "sent" | "received" | "reversed";
  items: { name: string; quantity: string }[];
  counterpart: string;
  time: string;
  reversible?: boolean;
};

const initial: Entry[] = [
  { id: "tr-1", direction: "sent", items: [{ name: "Sodas (500ml)", quantity: "4 units" }, { name: "Flour", quantity: "3 kg" }], counterpart: "Sent to Canteen", time: "2:45 PM", reversible: true },
  { id: "tr-2", direction: "received", items: [{ name: "Eggs", quantity: "6 trays" }], counterpart: "Received from Canteen", time: "11:10 AM" },
  { id: "tr-3", direction: "sent", items: [{ name: "Printing paper", quantity: "2 reams" }], counterpart: "Sent to Canteen", time: "Yesterday, 4:30 PM" },
  { id: "tr-4", direction: "received", items: [{ name: "Cooking oil", quantity: "8 litres" }], counterpart: "Received from Canteen", time: "Yesterday, 10:15 AM" },
];

export function TransferHistoryView() {
  const [entries, setEntries] = useState(initial);
  const [selected, setSelected] = useState<Entry | null>(null);
  const [detail, setDetail] = useState<Entry | null>(null);
  const reverse = () => {
    if (!selected) return;
    setEntries((current) => [
      { id: `undo-${selected.id}`, direction: "reversed", items: selected.items, counterpart: "Transfer reversed", time: "Just now" },
      ...current.map((entry) => entry.id === selected.id ? { ...entry, reversible: false } : entry),
    ]);
    setSelected(null);
    toast.success("Reversal recorded", { description: "Stock has returned to Restaurant and the original transfer remains visible." });
  };
  if (detail) return <TransferDetail entry={detail} onBack={() => setDetail(null)} onUndo={() => setSelected(detail)} />;
  return <div className="flex min-h-full flex-col" data-testid="transfer-history">
    <section className="border-b bg-card p-3"><p className="text-sm font-medium">Transfers involving Restaurant</p><p className="mt-1 text-xs text-muted-foreground">Sent and received stock, including reversals.</p></section>
    <section className="flex-1 p-3"><p className="mb-2 text-xs font-medium text-muted-foreground">TODAY</p><div className="divide-y rounded-lg border bg-card">{entries.map((entry) => <HistoryRow key={entry.id} entry={entry} onOpen={() => setDetail(entry)} onUndo={() => setSelected(entry)} />)}</div></section>
    <UndoSheet selected={selected} onClose={() => setSelected(null)} onReverse={reverse} />
  </div>;
}

function HistoryRow({ entry, onOpen, onUndo }: { entry: Entry; onOpen: () => void; onUndo: () => void }) {
  const Icon = entry.direction === "sent" ? ArrowUpRight : entry.direction === "received" ? ArrowDownLeft : Check;
  return <div role="button" tabIndex={0} onClick={onOpen} onKeyDown={(event) => event.key === "Enter" && onOpen()} className="flex cursor-pointer items-center gap-3 p-3 transition-colors duration-100 hover:bg-muted"><div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><Icon className="size-4" /></div><div className="min-w-0 flex-1"><p className="text-sm font-medium">{entry.counterpart}</p><p className="truncate text-xs text-muted-foreground">{entry.items.length} {entry.items.length === 1 ? "item" : "items"} · {entry.items.map((item) => item.name).join(", ")}</p></div><div className="flex shrink-0 flex-col items-end gap-1"><span className="text-xs text-muted-foreground">{entry.time}</span>{entry.reversible && <Button variant="ghost" size="xs" onClick={(event) => { event.stopPropagation(); onUndo(); }}><RotateCcw /> Undo</Button>}</div></div>;
}

function TransferDetail({ entry, onBack, onUndo }: { entry: Entry; onBack: () => void; onUndo: () => void }) {
  return <div className="flex min-h-full flex-col" data-testid="transfer-detail"><section className="border-b bg-card p-3"><Button variant="ghost" size="sm" onClick={onBack}>Back to transfers</Button><div className="mt-3 flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 p-3"><div><p className="text-xs text-muted-foreground">{entry.direction === "received" ? "Canteen → Restaurant" : "Restaurant → Canteen"}</p><p className="mt-1 text-sm font-medium">{entry.counterpart}</p></div><span className="text-xs text-muted-foreground">{entry.time}</span></div></section><section className="flex-1 p-3"><p className="mb-2 text-xs font-medium text-muted-foreground">ITEMS TRANSFERRED</p><div className="divide-y rounded-lg border bg-card">{entry.items.map((item) => <div key={item.name} className="flex items-center justify-between gap-3 p-3"><span className="text-sm font-medium">{item.name}</span><span className="shrink-0 text-sm font-medium tabular">{item.quantity}</span></div>)}</div><p className="mt-4 text-xs text-muted-foreground">Recorded immediately by Janiffer at Restaurant.</p></section>{entry.reversible && <div className="border-t bg-card p-3"><Button className="h-12 w-full" onClick={onUndo}><RotateCcw /> Undo transfer</Button></div>}</div>;
}

function UndoSheet({ selected, onClose, onReverse }: { selected: Entry | null; onClose: () => void; onReverse: () => void }) {
  return <Sheet open={selected !== null} onOpenChange={(open) => !open && onClose()}><SheetContent side="bottom" className="rounded-t-xl"><SheetHeader><SheetTitle>Undo this transfer?</SheetTitle><SheetDescription>This records a new reversing transfer. The original remains in the history.</SheetDescription></SheetHeader>{selected && <div className="mx-4 rounded-lg border bg-muted/40 p-3"><p className="text-sm font-medium">{selected.items.map((item) => item.quantity + " " + item.name).join(" · ")}</p><p className="mt-1 text-xs text-muted-foreground">Stock will return from Canteen to Restaurant immediately.</p></div>}<SheetFooter><Button className="h-12" onClick={onReverse}>Record reversal</Button><Button variant="outline" className="h-12" onClick={onClose}>Keep transfer</Button></SheetFooter></SheetContent></Sheet>;
}
