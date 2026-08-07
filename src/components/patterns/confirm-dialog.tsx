"use client";

/**
 * A confirmation for an irreversible or hard-to-notice action.
 *
 * UI-RULES.md: the confirm names the specific thing — "Delete invoice
 * INV-2024-0142?" not "Are you sure?" — and irreversible actions are marked
 * before, not after. Composed from the base `Dialog` primitive rather than
 * inventing a new one; this is the pattern every lifecycle toggle (a
 * product's active switch, a staff member's status, and so on) reuses
 * instead of each module building its own.
 */

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function ConfirmDialog({
  open,
  onOpenChange,
  /** Names the specific record and action — "Deactivate Chips?" */
  title,
  description,
  confirmLabel = "Confirm",
  /** Destructive actions get the danger treatment; a lifecycle toggle that's
   * easily reversed (reactivating is one click) does not need to alarm. */
  destructive,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
