"use client";

/**
 * Stock count — the two-step flow: record a count, then land on its
 * read view. Composes RecordStockCount and StockCountDetail rather than
 * either component owning both halves, same split as issue-to-kitchen's
 * record/confirm.
 *
 * Staff-shell only. The read view here is always counted-only — the
 * expected/difference comparison is owner-only regardless of who recorded
 * the count (see stock-count-detail.tsx), and the owner's comparison table
 * lives under the admin Stock destination instead (stock-count-review.tsx).
 */

import { useState } from "react";
import { RecordStockCount } from "./record-stock-count";
import { StockCountDetail } from "./stock-count-detail";

export function StockCount({ locationId }: { locationId: string }) {
  const [countId, setCountId] = useState<string | null>(null);

  if (countId) {
    return <StockCountDetail countId={countId} />;
  }

  return <RecordStockCount onRecorded={setCountId} locationId={locationId} />;
}
