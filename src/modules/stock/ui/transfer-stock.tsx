"use client";

import { useEffect, useState } from "react";
import { ErrorState } from "@/components/patterns/states";
import { Skeleton } from "@/components/ui/skeleton";
import { TransferVariant, type TransferDraftItem } from "./transfer-variants";

type State = { status: "loading" } | { status: "error" } | { status: "ready"; items: TransferDraftItem[]; toLocationId: string };

export function TransferStock() {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<State>({ status: "loading" });
  useEffect(() => {
    fetch("/api/stock/transfer").then(async (response) => {
      const body = await response.json();
      if (!response.ok || !Array.isArray(body.items) || !body.toLocation) return setState({ status: "error" });
      setState({ status: "ready", toLocationId: body.toLocation.id, items: body.items.map((item: { itemId: string; name: string; quantityOnHand: number; unit: string; itemType: "product" | "ingredient" }) => ({ id: item.itemId, name: item.name, available: item.quantityOnHand, unit: item.unit, type: item.itemType === "product" ? "Product" : "Ingredient" })) });
    }).catch(() => setState({ status: "error" }));
  }, [attempt]);
  if (state.status === "loading") return <div className="space-y-3 p-3"><Skeleton className="h-12 w-full" /><div className="grid grid-cols-2 gap-2">{Array.from({ length: 8 }).map((_, index) => <Skeleton key={index} className="h-24" />)}</div></div>;
  if (state.status === "error") return <ErrorState what="stock" onRetry={() => { setState({ status: "loading" }); setAttempt((value) => value + 1); }} />;
  return <TransferVariant variant="inline" items={state.items} onTransfer={async (lines) => {
    const response = await fetch("/api/stock/transfer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ toLocationId: state.toLocationId, lines: lines.map((line) => ({ itemType: line.type.toLowerCase(), itemId: line.id, quantity: line.quantity })) }) });
    return response.ok;
  }} />;
}
