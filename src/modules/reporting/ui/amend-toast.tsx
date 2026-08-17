"use client";

/**
 * Editable-ledger T6.5 — the one amendment toast, shared by every ledger
 * tab.
 *
 * Extracted from `product-ledger.tsx`, where it was inline, when the owner
 * decided that **no edit on any tab is accepted silently** (2026-08-17).
 * Two tabs rendering two copies of this markup would have drifted, and
 * four would certainly have.
 *
 * It stays in `reporting/ui/` rather than `components/patterns/`: it is
 * specific to the ledger's amendment flow, not a page template, and
 * CLAUDE.md's UI rules ask before anything is added to the shared pattern
 * folders.
 *
 * C7 stage two — real figures, and Undo carrying the screen's one accent
 * (docs/design.md: editable cells stay neutral so this can be the primary
 * thing on the page when it appears).
 *
 * Undo is itself an amendment (C8) — the caller re-submits the previous
 * value rather than deleting anything, so the trail records both moves.
 */

import { X } from "lucide-react";

export type AmendToastState = { message: string; undo: () => void };

export function AmendToast({
  toast,
  onDismiss,
}: {
  toast: AmendToastState | null;
  onDismiss: () => void;
}) {
  if (!toast) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-lg border bg-card px-4 py-2.5 text-[13px] shadow-lg"
      data-testid="amend-toast"
    >
      <span>{toast.message}</span>
      <button
        onClick={toast.undo}
        className="rounded-md bg-primary px-2.5 py-1 text-[13px] font-medium text-primary-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
        data-testid="amend-undo"
      >
        Undo
      </button>
      <button
        onClick={onDismiss}
        aria-label="Dismiss"
        className="text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
