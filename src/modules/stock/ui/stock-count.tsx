"use client";

/**
 * Stock count — the two-step flow: record a count, then land on its
 * read view. Composes RecordStockCount and StockCountDetail rather than
 * either component owning both halves, same split as issue-to-kitchen's
 * record/confirm.
 *
 * Staff-shell only. The read view is counted-only for the restaurant — the
 * expected/difference comparison stays owner-only there regardless of who
 * recorded the count (see stock-count-detail.tsx), and the owner's own
 * comparison table lives under the admin Stock destination instead
 * (stock-count-review.tsx). 2026-08-15: the canteen is the one exception —
 * isCanteen threads through to RecordStockCount for its expected-quantity
 * display and post-submit "this count means you sold" review, and to
 * StockCountDetail so the read view shows the same detail afterward.
 */

import { useState } from "react";
import { RecordStockCount } from "./record-stock-count";
import { StockCountDetail } from "./stock-count-detail";

export function StockCount({ locationId, isCanteen = false }: { locationId: string; isCanteen?: boolean }) {
  const [countId, setCountId] = useState<string | null>(null);

  if (countId) {
    return <StockCountDetail countId={countId} isCanteen={isCanteen} />;
  }

  return <RecordStockCount onRecorded={setCountId} locationId={locationId} isCanteen={isCanteen} />;
}
