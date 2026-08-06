"use client";

/**
 * The table toolbar — what you are currently looking at.
 *
 * Lives in the header's second band, which is the split settled in the frame
 * round: the header says what the page is, the toolbar says what is currently
 * shown. Extracted from Stock and the ledger, which had built the same row
 * twice.
 *
 * The count sits far right and states both numbers when filtered — "12 of 47",
 * not "12". A bare count after filtering cannot be distinguished from a small
 * table, and the difference matters when someone is wondering where a row went.
 */

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, X, type LucideIcon } from "lucide-react";

export interface FilterDef {
  key: string;
  value: string;
  onChange: (v: string) => void;
  /** The "all" option, always first. */
  allLabel: string;
  options: { value: string; label: string }[];
  width?: string;
}

export function TableToolbar({
  query,
  onQuery,
  placeholder = "Search",
  filters = [],
  toggles,
  count,
  total,
  noun = "rows",
  disabled,
  children,
}: {
  query: string;
  onQuery: (v: string) => void;
  placeholder?: string;
  filters?: FilterDef[];
  /** Filters that are worth making visible rather than burying in a select. */
  toggles?: {
    key: string;
    label: string;
    icon?: LucideIcon;
    on: boolean;
    onChange: (v: boolean) => void;
    count?: number;
  }[];
  count: number;
  total: number;
  noun?: string;
  disabled?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <>
      <div className="relative min-w-48 flex-1 md:max-w-xs">
        <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="h-8 pl-8 text-[13px]"
        />
        {query && (
          <button
            onClick={() => onQuery("")}
            className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground"
            aria-label="Clear search"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {filters.map((f) => (
        <Select
          key={f.key}
          value={f.value}
          onValueChange={f.onChange}
          disabled={disabled}
        >
          <SelectTrigger
            size="sm"
            className="h-8 text-[13px]"
            style={{ width: f.width ?? "9rem" }}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{f.allLabel}</SelectItem>
            {f.options.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ))}

      {/* A filter is not a destination — but a filter worth reaching for
          should be visible rather than buried one level down in a select. */}
      {toggles?.map((t) => {
        const Icon = t.icon;
        return (
          <button
            key={t.key}
            onClick={() => t.onChange(!t.on)}
            disabled={disabled}
            aria-pressed={t.on}
            className={`flex h-8 shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-[13px] transition-colors duration-100 disabled:opacity-50 ${
              t.on
                ? "border-neutral-800 bg-neutral-800 text-white"
                : "bg-card hover:bg-muted"
            }`}
          >
            {Icon && <Icon className={`size-3.5 ${t.on ? "" : "text-warning"}`} />}
            {t.label}
            {t.count !== undefined && (
              <span className="tabular text-[11px] opacity-70">{t.count}</span>
            )}
          </button>
        );
      })}

      {children}

      <span className="tabular ml-auto shrink-0 text-xs text-muted-foreground">
        {count === total ? `${total} ${noun}` : `${count} of ${total}`}
      </span>
    </>
  );
}
