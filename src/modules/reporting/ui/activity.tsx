"use client";

/**
 * Activity — the audit trail (ticket 45). Adapted from the design-reference
 * worktree's locked `ActivityPage` (`activity/page.tsx`): recorded/
 * effective-date columns with a backdated row given the warning treatment,
 * a quiet kind badge except for correction/void, person/kind filters,
 * search including reason text, pagination "1–50 of N" rather than
 * infinite scroll. Same fetching/LoadState/presentational split as
 * cash-ledger.tsx, RecordTable from components/patterns per its own
 * "used by Stock, Money out and Activity" note.
 *
 * The reference has no date-range control in its UI — only kind/who/
 * search — so this doesn't invent one; getActivity's periodStart/periodEnd
 * are wired for a future date-range ticket, defaulting server-side to a
 * trailing window.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { RecordTable, type Column } from "@/components/patterns/record-table";
import { TableToolbar } from "@/components/patterns/table-toolbar";
import {
  ErrorState,
  PermissionDenied,
  EmptyFiltered,
  EmptyFirstUse,
  LoadingTable,
} from "@/components/patterns/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { History, ChevronLeft, ChevronRight } from "lucide-react";
import { money } from "@/shared/money";
import { RecordCorrectionDialog } from "./record-correction-dialog";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export type ActivityKind =
  | "sale"
  | "void"
  | "correction"
  | "movement"
  | "handover"
  | "takings"
  | "expense"
  | "repayment"
  | "days_worked";

export type ActivityRowData = {
  id: string;
  enteredAt: string;
  effectiveOn: string;
  kind: ActivityKind;
  who: string;
  whoId: string | null;
  what: string;
  locationName: string | null;
  amountMinor: number | null;
  reason: string | null;
};

const kindLabel: Record<ActivityKind, string> = {
  sale: "Sale",
  void: "Void",
  correction: "Correction",
  movement: "Stock",
  handover: "Handover",
  takings: "Takings",
  expense: "Money out",
  repayment: "Repayment",
  days_worked: "People",
};

const PAGE_SIZE = 50;

export type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "denied" }
  | { status: "ready"; rows: ActivityRowData[]; total: number };

async function fetchActivity(params: {
  page: number;
  kind?: string;
  personId?: string;
  search?: string;
}): Promise<LoadState> {
  try {
    const query = new URLSearchParams({
      page: String(params.page),
      pageSize: String(PAGE_SIZE),
    });
    if (params.kind && params.kind !== "all") query.set("kind", params.kind);
    if (params.personId && params.personId !== "all") query.set("personId", params.personId);
    if (params.search) query.set("search", params.search);

    const response = await fetch(`/api/activity?${query.toString()}`);
    if (response.status === 403) return { status: "denied" };
    if (!response.ok) return { status: "error" };
    const body = await response.json();
    if (!Array.isArray(body?.rows)) return { status: "error" };
    return { status: "ready", rows: body.rows, total: body.total ?? body.rows.length };
  } catch {
    return { status: "error" };
  }
}

export function Activity() {
  const [attempt, setAttempt] = useState(0);
  const [page, setPage] = useState(1);
  const [kind, setKind] = useState("all");
  const [personId, setPersonId] = useState("all");
  const [query, setQuery] = useState("");

  const clear = () => {
    setQuery("");
    setKind("all");
    setPersonId("all");
    setPage(1);
  };

  return (
    <ActivityForAttempt
      key={`${page}:${kind}:${personId}:${query}:${attempt}`}
      page={page}
      kind={kind}
      personId={personId}
      query={query}
      onPage={setPage}
      onKind={(v) => {
        setKind(v);
        setPage(1);
      }}
      onPerson={(v) => {
        setPersonId(v);
        setPage(1);
      }}
      onQuery={(v) => {
        setQuery(v);
        setPage(1);
      }}
      onClear={clear}
      onRetry={() => setAttempt((a) => a + 1)}
      onCorrectionRecorded={() => setAttempt((a) => a + 1)}
    />
  );
}

function ActivityForAttempt({
  page,
  kind,
  personId,
  query,
  onPage,
  onKind,
  onPerson,
  onQuery,
  onClear,
  onRetry,
  onCorrectionRecorded,
}: {
  page: number;
  kind: string;
  personId: string;
  query: string;
  onPage: (p: number) => void;
  onKind: (v: string) => void;
  onPerson: (v: string) => void;
  onQuery: (v: string) => void;
  onClear: () => void;
  onRetry: () => void;
  onCorrectionRecorded: () => void;
}) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    fetchActivity({ page, kind, personId, search: query }).then((result) => {
      if (!cancelledRef.current) setState(result);
    });
    return () => {
      cancelledRef.current = true;
    };
  }, [page, kind, personId, query]);

  const people = useMemo(() => {
    if (state.status !== "ready") return [];
    const seen = new Map<string, string>();
    for (const row of state.rows) {
      if (row.whoId) seen.set(row.whoId, row.who);
    }
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [state]);

  return (
    <ActivityView
      state={state}
      page={page}
      kind={kind}
      personId={personId}
      query={query}
      people={people}
      onPage={onPage}
      onKind={onKind}
      onPerson={onPerson}
      onQuery={onQuery}
      onClear={onClear}
      onRetry={onRetry}
      onCorrectionRecorded={onCorrectionRecorded}
    />
  );
}

export function ActivityView({
  state,
  page,
  kind,
  personId,
  query,
  people,
  onPage,
  onKind,
  onPerson,
  onQuery,
  onClear,
  onRetry,
  onCorrectionRecorded,
}: {
  state: LoadState;
  page: number;
  kind: string;
  personId: string;
  query: string;
  people: { id: string; name: string }[];
  onPage: (p: number) => void;
  onKind: (v: string) => void;
  onPerson: (v: string) => void;
  onQuery: (v: string) => void;
  onClear: () => void;
  onRetry: () => void;
  onCorrectionRecorded: () => void;
}) {
  const filtered = query !== "" || kind !== "all" || personId !== "all";

  const columns: Column<ActivityRowData>[] = [
    {
      key: "enteredAt",
      header: "Recorded",
      align: "left",
      width: "11rem",
      cell: (r) => <span className="tabular whitespace-nowrap">{formatDateTime(r.enteredAt)}</span>,
    },
    {
      key: "effectiveOn",
      header: "For the day",
      align: "left",
      width: "9rem",
      cell: (r) => {
        const backdated = r.effectiveOn.slice(0, 10) !== r.enteredAt.slice(0, 10);
        return (
          <span
            className={`tabular whitespace-nowrap ${
              backdated ? "font-medium text-warning" : "text-muted-foreground"
            }`}
            title={
              backdated
                ? "Backdated — this entry belongs to an earlier day than the one it was recorded on"
                : undefined
            }
          >
            {formatDateTime(r.effectiveOn)}
          </span>
        );
      },
    },
    {
      key: "kind",
      header: "Kind",
      align: "left",
      width: "7rem",
      cell: (r) => <KindBadge kind={r.kind} />,
    },
    {
      key: "who",
      header: "Who",
      align: "left",
      width: "7rem",
      cell: (r) => <span className="whitespace-nowrap">{r.who}</span>,
    },
    {
      key: "what",
      header: "What",
      align: "left",
      cell: (r) => (
        <div className="min-w-0">
          <div className="truncate" title={r.what}>
            {r.what}
          </div>
          {r.reason && (
            <div className="truncate text-[11px] text-muted-foreground" title={r.reason}>
              {r.reason}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "locationName",
      header: "Where",
      align: "left",
      width: "7rem",
      cell: (r) =>
        r.locationName ? (
          <span className="text-muted-foreground">{r.locationName}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "amountMinor",
      header: "Amount",
      group: true,
      cell: (r) =>
        r.amountMinor === null ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <span className="tabular">{money(r.amountMinor)}</span>
        ),
    },
  ];

  const body = () => {
    if (state.status === "loading")
      return (
        <div data-testid="activity-loading">
          <LoadingTable summary={0} rows={12} columns={7} />
        </div>
      );
    if (state.status === "error") return <ErrorState what="the activity trail" onRetry={onRetry} />;
    if (state.status === "denied")
      return (
        <PermissionDenied
          title="The activity trail is owner-only"
          body="Everything you record appears here under your name, but the full trail across the business is restricted to Lucy."
        />
      );

    if (state.rows.length === 0 && !filtered) {
      return (
        <EmptyFirstUse
          icon={<History className="size-4" />}
          title="Nothing has happened yet"
          body="Every sale, handover, payment and correction will appear here with who made it and when — including anything backdated."
        />
      );
    }

    return (
      <>
        <RecordTable
          rows={state.rows}
          columns={columns}
          rowKey={(r) => r.id}
          minWidth={1000}
          empty={<EmptyFiltered onClear={onClear} noun="entries" />}
        />
        {state.rows.length > 0 && <Pager page={page} shown={state.rows.length} total={state.total} onPage={onPage} />}
      </>
    );
  };

  return (
    <div data-testid="activity" className="space-y-3">
      {state.status !== "denied" && (
        <div className="flex flex-wrap items-center gap-2">
          <TableToolbar
            query={query}
            onQuery={onQuery}
            placeholder="Search what happened, who, or why"
            noun="entries"
            count={state.status === "ready" ? state.rows.length : 0}
            total={state.status === "ready" ? state.total : 0}
            disabled={state.status !== "ready"}
            filters={[
              {
                key: "kind",
                value: kind,
                onChange: onKind,
                allLabel: "Everything",
                options: (Object.keys(kindLabel) as ActivityKind[]).map((k) => ({
                  value: k,
                  label: kindLabel[k],
                })),
                width: "9rem",
              },
              {
                key: "who",
                value: personId,
                onChange: onPerson,
                allLabel: "Anyone",
                options: people.map((p) => ({ value: p.id, label: p.name })),
                width: "8rem",
              },
            ]}
          >
            <RecordCorrectionDialog onRecorded={onCorrectionRecorded} />
          </TableToolbar>
        </div>
      )}

      {body()}
    </div>
  );
}

function KindBadge({ kind }: { kind: ActivityKind }) {
  const notable = kind === "correction" || kind === "void";
  return (
    <Badge
      variant="outline"
      className={`text-[10px] font-normal whitespace-nowrap ${
        notable ? "border-warning/40 bg-warning-subtle text-warning" : ""
      }`}
    >
      {kindLabel[kind]}
    </Badge>
  );
}

function Pager({
  page,
  shown,
  total,
  onPage,
}: {
  page: number;
  shown: number;
  total: number;
  onPage: (p: number) => void;
}) {
  const start = (page - 1) * PAGE_SIZE + 1;
  const end = start + shown - 1;
  return (
    <div className="mt-3 flex items-center justify-between">
      <span className="tabular text-xs text-muted-foreground">
        {start}–{end} of {total.toLocaleString()}
      </span>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          <ChevronLeft className="size-3.5" /> Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          disabled={end >= total}
          onClick={() => onPage(page + 1)}
        >
          Next <ChevronRight className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
