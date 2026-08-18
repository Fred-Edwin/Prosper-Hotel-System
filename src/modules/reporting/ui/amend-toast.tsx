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

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { confirmMessage, type PendingEdit } from "./amend-feedback";

export type AmendToastState = { message: string; undo: () => void };

export type AmendConfirmState = {
  edit: PendingEdit;
  proceed: () => void;
  /**
   * T12 — asks the server what else this edit would move.
   *
   * Resolves to a sentence when the cascade reaches beyond the edited
   * cell, and to null when it does not. Optional so a caller that has no
   * preview to offer (a story, or a tab where the edit cannot cascade)
   * simply renders the short dialog.
   */
  previewCascade?: () => Promise<string | null>;
};

/**
 * The confirm step, shared by every tab for the same reason the toast is:
 * it is the same dialog, and four copies would drift.
 *
 * **Every edit passes through here** (owner decision, 2026-08-18). It is
 * still a disclosure rather than a permission gate — she is the
 * authority, and there is no threshold at which an edit is refused (D6).
 * Cancelling leaves the figure untouched and nothing is written.
 *
 * It always names the cell and both figures. A confirm that asks only
 * "are you sure?" costs a click without buying a check, because she
 * cannot see what she is agreeing to — and the whole reason for the step
 * is that she should be able to catch a wrong number here rather than
 * afterwards.
 *
 * Cancel is focused on open, not Change it: the safe option should be the
 * one a reflexive Enter lands on.
 */
export function AmendConfirm({
  confirming,
  onCancel,
}: {
  confirming: AmendConfirmState | null;
  onCancel: () => void;
}) {
  if (!confirming) return null;
  return <AmendConfirmDialog confirming={confirming} onCancel={onCancel} />;
}

/**
 * Split from `AmendConfirm` so the preview fetch lives in a component
 * that mounts when the dialog opens and unmounts when it closes — which
 * is what makes "fetch once, for this edit" the natural behaviour rather
 * than something a dependency array has to be talked into.
 */
function AmendConfirmDialog({
  confirming,
  onCancel,
}: {
  confirming: AmendConfirmState;
  onCancel: () => void;
}) {
  const message = confirmMessage(confirming.edit);

  /**
   * T12 — the cascade, fetched when the dialog opens.
   *
   * **The dialog is never blocked on this.** It appears immediately with
   * the cell and both figures, which is the information she needs most
   * and which is already known locally; the cascade arrives a moment
   * later. Waiting for the server before showing anything would make
   * every edit feel slow to serve the minority of edits that cascade.
   *
   * "absent" is a real state and not the same as "none": before the
   * answer arrives the app does not yet know whether anything else moves,
   * and saying "nothing else changes" while still asking would be a claim
   * it cannot support.
   */
  const fetchCascade = confirming.previewCascade;

  // A caller with no preview to offer is not "still loading" — it is
  // already known that nothing will be said. Derived rather than pushed
  // through an effect, so there is no render that briefly claims to be
  // checking something it will never check.
  const [fetched, setFetched] = useState<
    { state: "loading" } | { state: "done"; message: string | null } | { state: "failed" }
  >({ state: "loading" });
  const cascade = fetchCascade ? fetched : ({ state: "done", message: null } as const);

  useEffect(() => {
    if (!fetchCascade) return;
    let live = true;
    fetchCascade()
      .then((m) => live && setFetched({ state: "done", message: m }))
      // A failed preview is not a failed edit. She can still confirm —
      // the dialog just stops claiming to know what else moves, and says
      // so rather than silently showing the short form.
      .catch(() => live && setFetched({ state: "failed" }));
    return () => {
      live = false;
    };
  }, [fetchCascade]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="amend-confirm-title"
        className="max-w-md rounded-lg border bg-card p-4 shadow-lg"
        data-testid="amend-confirm"
      >
        <h2 id="amend-confirm-title" className="text-sm font-medium">
          {message.title}
        </h2>

        {/* The figures, which are the point of the step. Old struck
            through, new in full weight, so the change is legible at a
            glance rather than read as prose. */}
        <div className="mt-3 rounded-md border bg-muted/40 px-3 py-2">
          <p className="text-[12px] text-muted-foreground">{message.label}</p>
          <p className="tabular mt-0.5 text-[13px]">
            <span className="text-muted-foreground line-through">{message.from}</span>
            <span className="mx-2 text-muted-foreground" aria-hidden>
              →
            </span>
            <span className="font-medium" data-testid="amend-confirm-to">
              {message.to}
            </span>
          </p>
        </div>

        {/* T12 — "this also changes", and *only* when something does.
            A section that appears on every edit to report nothing is
            noise that trains her to skip it, and then it is missed on
            the edit that moves twenty figures. */}
        {cascade.state === "loading" && (
          <p
            className="mt-3 text-[13px] text-muted-foreground"
            data-testid="amend-confirm-cascade-loading"
          >
            Checking what else this changes…
          </p>
        )}
        {cascade.state === "done" && cascade.message && (
          <div
            className="mt-3 rounded-md border border-dashed px-3 py-2"
            data-testid="amend-confirm-cascade"
          >
            <p className="text-[12px] font-medium">This also changes</p>
            <p className="mt-0.5 text-[13px] text-muted-foreground">{cascade.message}</p>
          </div>
        )}
        {cascade.state === "failed" && (
          <p
            className="mt-3 text-[13px] text-muted-foreground"
            data-testid="amend-confirm-cascade-failed"
          >
            Couldn&apos;t check what else this changes. The edit will still work.
          </p>
        )}

        {message.body && (
          <p className="mt-3 text-[13px] text-muted-foreground">{message.body}</p>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onCancel}
            autoFocus
            className="rounded-md border px-3 py-1.5 text-[13px] focus-visible:ring-2 focus-visible:ring-ring/50"
            data-testid="amend-confirm-cancel"
          >
            Cancel
          </button>
          <button
            onClick={confirming.proceed}
            className="rounded-md bg-primary px-3 py-1.5 text-[13px] font-medium text-primary-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
            data-testid="amend-confirm-proceed"
          >
            {message.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

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
