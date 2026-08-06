"use client";

/**
 * The five states every list, table and detail view must have.
 *
 * Built on Stock in the frame round and extracted here so no page has to invent
 * them. A page that renders records renders one of these instead when it has
 * none to show, and the distinctions between them are load-bearing:
 *
 *   **First use** and **no filter results** are different messages. Never offer
 *   "create your first one" to someone who has four hundred and filtered wrong —
 *   it tells them the system lost their data.
 *
 *   **Loading** is a skeleton at the real dimensions, not a spinner. A skeleton
 *   that holds the shape of what is coming means the page does not jump when it
 *   arrives, and it tells the user what kind of thing to expect.
 *
 *   **Error** preserves what the user had — filters, form input — and says so.
 *   A page that clears on failure is unforgivable in a system people enter
 *   money into.
 *
 *   **Permission-denied** states a reason and who to ask. Never an enabled
 *   control that errors on click, and never a silently missing section: a gap
 *   with no explanation reads as a bug, and the user will go looking for it.
 */

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Lock, RotateCw, SearchX } from "lucide-react";

function Frame({
  icon,
  title,
  body,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border bg-card px-6 py-16 text-center">
      <div className="mb-3 flex size-9 items-center justify-center rounded-full bg-muted text-muted-foreground">
        {icon}
      </div>
      <p className="text-sm font-medium">{title}</p>
      {/* Capped so prose stays readable — roughly 60–75 characters. */}
      <p className="mt-1 max-w-sm text-[13px] text-muted-foreground">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** First use. Says what goes here and how to create the first one. */
export function EmptyFirstUse({
  icon,
  title,
  body,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return <Frame icon={icon} title={title} body={body} action={action} />;
}

/** No results from a filter. A different message, and a way back. */
export function EmptyFiltered({
  onClear,
  noun = "records",
}: {
  onClear: () => void;
  noun?: string;
}) {
  return (
    <Frame
      icon={<SearchX className="size-4" />}
      title="Nothing matches these filters"
      body={`There are ${noun} here, but none match what you have selected.`}
      action={
        <Button variant="outline" size="sm" className="h-8" onClick={onClear}>
          Clear filters
        </Button>
      }
    />
  );
}

/** Plain language, a retry, and a promise that nothing was lost. */
export function ErrorState({
  what = "this page",
  onRetry,
  preserved = "Your filters are still set.",
}: {
  what?: string;
  onRetry?: () => void;
  preserved?: string;
}) {
  return (
    <Frame
      icon={<RotateCw className="size-4" />}
      title={`Couldn't load ${what}`}
      body={`The connection dropped while fetching it. ${preserved}`}
      action={
        <Button variant="outline" size="sm" className="h-8" onClick={onRetry}>
          <RotateCw className="size-3.5" /> Try again
        </Button>
      }
    />
  );
}

/** Hidden or disabled with a stated reason — never a control that errors. */
export function PermissionDenied({
  title,
  body,
}: {
  title: string;
  /** Say what they *can* see, and who to ask. Not just "denied". */
  body: string;
}) {
  return <Frame icon={<Lock className="size-4" />} title={title} body={body} />;
}

/**
 * Skeleton at the real dimensions of a summary strip and a table.
 *
 * `rows` and `columns` should match what is actually coming, so the page does
 * not reflow when it arrives.
 */
export function LoadingTable({
  summary = 4,
  rows = 10,
  columns = 6,
}: {
  summary?: number;
  rows?: number;
  columns?: number;
}) {
  const widths = [120, 70, 60, 60, 60, 70, 60, 60];

  return (
    <>
      {summary > 0 && (
        <div className="mb-4 grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: summary }).map((_, i) => (
            <div key={i} className="bg-card p-4">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="mt-2 h-6 w-28" />
              <Skeleton className="mt-2 h-3 w-20" />
            </div>
          ))}
        </div>
      )}
      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="flex h-9 items-center gap-4 border-b bg-muted/60 px-3">
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton
              key={i}
              className="h-2.5"
              style={{ width: widths[i % widths.length] }}
            />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="flex h-[41px] items-center gap-4 border-b px-3 last:border-0"
          >
            {Array.from({ length: columns }).map((_, j) => (
              <Skeleton
                key={j}
                className="h-3"
                style={{ width: widths[j % widths.length] }}
              />
            ))}
          </div>
        ))}
      </div>
    </>
  );
}

/** The detail page's loading shape — two columns, not a table. */
export function LoadingDetail() {
  return (
    <div className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
      <div className="space-y-4">
        <div className="rounded-lg border bg-card p-4">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-2 h-8 w-32" />
          <Skeleton className="mt-4 h-3 w-full" />
          <Skeleton className="mt-2 h-3 w-4/5" />
          <Skeleton className="mt-4 h-8 w-full" />
        </div>
        <div className="rounded-lg border bg-card p-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex justify-between gap-3 py-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-4">
        <LoadingTable summary={0} rows={4} columns={4} />
        <LoadingTable summary={0} rows={6} columns={4} />
      </div>
    </div>
  );
}
