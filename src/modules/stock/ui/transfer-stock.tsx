"use client";

import { useEffect, useState } from "react";
import { PackageOpen } from "lucide-react";
import { EmptyFirstUse, ErrorState, PermissionDenied } from "@/components/patterns/states";
import { Skeleton } from "@/components/ui/skeleton";
import { TransferVariant, type TransferDraftItem } from "./transfer-variants";

type State =
  | { status: "loading" }
  | { status: "error" }
  | { status: "denied" }
  | { status: "ready"; items: TransferDraftItem[]; toLocationId: string };

export function TransferStock() {
  const [attempt, setAttempt] = useState(0);
  return <TransferStockForAttempt key={attempt} onRetry={() => setAttempt((value) => value + 1)} />;
}

function TransferStockForAttempt({ onRetry }: { onRetry: () => void }) {
  const [state, setState] = useState<State>({ status: "loading" });
  useEffect(() => {
    let cancelled = false;
    fetch("/api/stock/transfer").then(async (response) => {
      if (cancelled) return;
      if (response.status === 403) return setState({ status: "denied" });
      const body = await response.json();
      if (!response.ok || !Array.isArray(body.items) || !body.toLocation) return setState({ status: "error" });
      setState({ status: "ready", toLocationId: body.toLocation.id, items: body.items.map((item: { itemId: string; name: string; quantityOnHand: number; unit: string; itemType: "product" | "ingredient" }) => ({ id: item.itemId, name: item.name, available: item.quantityOnHand, unit: item.unit, type: item.itemType === "product" ? "Product" : "Ingredient" })) });
    }).catch(() => {
      if (!cancelled) setState({ status: "error" });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === "loading") {
    return (
      <div className="space-y-3 p-3" data-testid="transfer-stock-loading">
        <Skeleton className="h-12 w-full" />
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  if (state.status === "denied") {
    return (
      <div className="p-3">
        <PermissionDenied title="You can't transfer stock" body="Ask the owner if you need access to transfers." />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="p-3">
        <ErrorState what="stock" onRetry={onRetry} />
      </div>
    );
  }

  if (state.items.length === 0) {
    return (
      <div className="p-3">
        <EmptyFirstUse
          icon={<PackageOpen className="size-4" />}
          title="Nothing to transfer"
          body="Your location has no stock on hand yet — record a delivery or count first."
        />
      </div>
    );
  }

  return (
    <TransferVariant
      variant="inline"
      items={state.items}
      onTransfer={async (lines) => {
        const response = await fetch("/api/stock/transfer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ toLocationId: state.toLocationId, lines: lines.map((line) => ({ itemType: line.type.toLowerCase(), itemId: line.id, quantity: line.quantity })) }),
        });
        return response.ok;
      }}
    />
  );
}
