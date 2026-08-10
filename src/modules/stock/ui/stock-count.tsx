"use client";

/**
 * Stock count — the two-step flow: record a count, then land on its
 * read view. Composes RecordStockCount and StockCountDetail rather than
 * either component owning both halves, same split as issue-to-kitchen's
 * record/confirm — except here "confirm" is the real read view, not a
 * static summary, since the count exists to be compared against.
 */

import { useState } from "react";
import { RecordStockCount } from "./record-stock-count";
import { StockCountDetail } from "./stock-count-detail";

export function StockCount({ isOwner }: { isOwner: boolean }) {
  const [countId, setCountId] = useState<string | null>(null);

  if (countId) {
    return <StockCountDetail countId={countId} isOwner={isOwner} />;
  }

  return <RecordStockCount onRecorded={setCountId} />;
}
