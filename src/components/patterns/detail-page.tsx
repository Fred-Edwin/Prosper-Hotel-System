"use client";

/**
 * The detail page template. Settled in round C as "Aside".
 *
 * Two columns: **what is true** about the record on the left, **what happened**
 * to it on the right. The split generalises across every record type here — a
 * product has a price and a recipe on the left and movements on the right; a
 * customer has a phone and a balance left, purchases and repayments right; a
 * staff member has a rate and a role left, days worked and handovers right.
 *
 * Chosen over a tabbed layout and an expand-in-place list. The deciding
 * argument: **a figure sits directly above its own arithmetic**, which tabs
 * cannot do without repeating the figure, and which is what this whole design
 * asks for everywhere else.
 *
 * Editing is a sheet over the record, never a separate page or a mode. The
 * record stays visible behind it, there is no navigation to undo, and the same
 * form component serves both create and edit.
 *
 * The left column is fixed at 300px and the right takes the rest. Below `lg`
 * they stack, identity first — on a phone, what a record *is* matters before
 * what happened to it.
 */

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";

export function DetailPage({
  identity,
  history,
}: {
  /** What is true about the record. Figures with their arithmetic. */
  identity: React.ReactNode;
  /** What happened to it. Tables, timelines, exceptions. */
  history: React.ReactNode;
}) {
  return (
    <div className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
      <div className="space-y-4">{identity}</div>
      <div className="space-y-4">{history}</div>
    </div>
  );
}

/**
 * A bordered block with a titled header. The unit both columns are built from,
 * so a detail page never invents its own card treatment.
 */
export function DetailCard({
  title,
  action,
  badge,
  footnote,
  flush,
  children,
}: {
  title: string;
  /** Top-right of the card. Secondary at most — the page's primary lives inside. */
  action?: React.ReactNode;
  badge?: React.ReactNode;
  /** A caveat under the content, inside the border. */
  footnote?: string;
  /** Set when the child is a table and should meet the border directly. */
  flush?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="flex items-center justify-between gap-2 border-b px-4 py-2.5">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-medium">{title}</h2>
          {badge}
        </div>
        {action}
      </div>
      <div className={flush ? "" : "p-4"}>{children}</div>
      {footnote && (
        <p className="border-t px-4 py-2 text-[11px] text-muted-foreground">
          {footnote}
        </p>
      )}
    </div>
  );
}

/**
 * A read-only facts list. Label left, value right, one per row.
 *
 * Values are `ReactNode` so a status can be a badge and a phone can carry an
 * icon, without the caller reaching for a different component.
 */
export function FactList({
  facts,
}: {
  facts: {
    label: string;
    value: React.ReactNode;
    tabular?: boolean;
    capitalize?: boolean;
  }[];
}) {
  return (
    <dl className="divide-y text-[13px]">
      {facts.map((f) => (
        <div
          key={f.label}
          className="flex items-center justify-between gap-3 px-4 py-2 first:pt-0 last:pb-0"
        >
          <dt className="text-muted-foreground">{f.label}</dt>
          <dd
            className={`flex items-center gap-1.5 text-right ${
              f.tabular ? "tabular" : ""
            } ${f.capitalize ? "capitalize" : ""}`}
          >
            {f.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * The edit sheet. One component for create and edit — the difference is the
 * title and what the fields are seeded with, never the layout.
 */
export function EditSheet({
  open,
  onOpenChange,
  title,
  description,
  saveLabel = "Save changes",
  saving,
  children,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  saveLabel?: string;
  /** Disables the submit and says what is happening, rather than going quiet. */
  saving?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle>{title}</SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
        <SheetFooter className="flex-row border-t">
          <Button size="sm" className="h-8" disabled={saving}>
            {saving ? "Saving…" : saveLabel}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8"
            disabled={saving}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
