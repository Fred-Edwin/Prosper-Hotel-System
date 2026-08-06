"use client";

/**
 * Activity — the audit trail.
 *
 * The last destination, and the one that tests the record table at volume:
 * 1,284 entries today and growing every shift. Built from the templates, so
 * what is worth reading here is the two things volume forces that no other page
 * needed.
 *
 * **Two dates, and the gap between them is the information.** architecture.md:
 * every entry carries an effective date and an entered date. Normally
 * identical; for a correction they differ, and that difference distinguishes
 * "what Tuesday looked like on Tuesday" from "what Tuesday looks like now".
 * So the table shows both, and marks the rows where they disagree — a
 * correction is the single most important row type in an audit trail and it
 * cannot be allowed to look like an ordinary edit.
 *
 * **Pagination, not infinite scroll.** A trail people search is a trail people
 * need to return to, and an infinite scroll has no addresses — "it was about
 * two hundred rows down" is not a location. Counts are stated as "1–50 of
 * 1,284" rather than "page 1", because the question is always how much is left.
 *
 * A reason is shown inline rather than behind a hover, because a correction
 * without its reason is the thing the audit trail exists to prevent.
 */

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AccentSwitcher } from "@/components/design/accent-switcher";
import { AdminShell } from "@/components/design/shell/admin-shell";
import { TableToolbar } from "@/components/patterns/table-toolbar";
import {
  RecordTable,
  Num,
  type Column,
} from "@/components/patterns/record-table";
import {
  LoadingTable,
  ErrorState,
  PermissionDenied,
  EmptyFirstUse,
  EmptyFiltered,
} from "@/components/patterns/states";
import {
  activity,
  activityKindLabel,
  activityTotal,
  type ActivityEntry,
  type ActivityKind,
} from "@/lib/fixtures";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, History, ChevronLeft, ChevronRight } from "lucide-react";

type State = "ready" | "loading" | "error" | "denied" | "first-use";
const states: State[] = ["ready", "loading", "error", "denied", "first-use"];

const PAGE = 50;

export function ActivityPage() {
  const params = useSearchParams();
  const state = (params.get("state") as State) ?? "ready";

  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("all");
  const [who, setWho] = useState("all");

  const clear = () => {
    setQuery("");
    setKind("all");
    setWho("all");
  };

  const people = Array.from(new Set(activity.map((a) => a.who)));

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return activity.filter(
      (a) =>
        (kind === "all" || a.kind === kind) &&
        (who === "all" || a.who === who) &&
        (!q ||
          a.what.toLowerCase().includes(q) ||
          a.who.toLowerCase().includes(q) ||
          (a.reason?.toLowerCase().includes(q) ?? false)),
    );
  }, [query, kind, who]);

  const filtered = query !== "" || kind !== "all" || who !== "all";
  // The real trail is 1,284 rows; the fixture is a page of it.
  const total = filtered ? rows.length : activityTotal;

  const columns: Column<ActivityEntry>[] = [
    {
      key: "when",
      header: "Recorded",
      align: "left",
      sortable: true,
      cell: (a) => (
        <span className="tabular whitespace-nowrap">{a.enteredAt}</span>
      ),
    },
    {
      key: "effective",
      header: "For the day",
      align: "left",
      cell: (a) => {
        const backdated = a.effectiveOn !== a.enteredAt.slice(0, 10);
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
            {a.effectiveOn}
          </span>
        );
      },
    },
    {
      key: "kind",
      header: "Kind",
      align: "left",
      cell: (a) => <KindBadge kind={a.kind} />,
    },
    {
      key: "who",
      header: "Who",
      align: "left",
      cell: (a) => <span className="whitespace-nowrap">{a.who}</span>,
    },
    {
      key: "what",
      header: "What",
      align: "left",
      cell: (a) => (
        <div className="min-w-0">
          <div className="truncate" title={a.what}>
            {a.what}
          </div>
          {/* A correction without its reason is what the trail exists to
              prevent, so the reason is inline rather than on hover. */}
          {a.reason && (
            <div
              className="truncate text-[11px] text-muted-foreground"
              title={a.reason}
            >
              {a.reason}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "location",
      header: "Where",
      align: "left",
      cell: (a) =>
        a.location ? (
          <span className="text-muted-foreground capitalize">{a.location}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "amount",
      header: "Amount",
      group: true,
      cell: (a) => <Num value={a.amount} money />,
    },
  ];

  const body = () => {
    if (state === "loading")
      return <LoadingTable summary={0} rows={12} columns={7} />;
    if (state === "error") return <ErrorState what="the activity trail" />;
    if (state === "denied")
      return (
        <PermissionDenied
          title="The activity trail is owner-only"
          body="Everything you record appears here under your name, but the full trail across the business is restricted to Lucy."
        />
      );
    if (state === "first-use")
      return (
        <EmptyFirstUse
          icon={<History className="size-4" />}
          title="Nothing has happened yet"
          body="Every sale, handover, payment and correction will appear here with who made it and when — including anything backdated."
        />
      );

    return (
      <>
        <RecordTable
          rows={rows}
          columns={columns}
          rowKey={(a) => a.id}
          minWidth={1000}
          empty={<EmptyFiltered onClear={clear} noun="entries" />}
        />
        {rows.length > 0 && <Pager shown={rows.length} total={total} />}
      </>
    );
  };

  return (
    <>
      <AdminShell
        active="activity"
        title="Activity"
        subtitle="Every change, who made it, and when"
        actions={
          <Button variant="outline" size="sm" className="h-8">
            <Download className="size-3.5" /> Export
          </Button>
        }
        toolbar={
          state === "denied" || state === "first-use" ? undefined : (
            <TableToolbar
              query={query}
              onQuery={setQuery}
              placeholder="Search what happened, who, or why"
              noun="entries"
              count={rows.length}
              total={total}
              disabled={state !== "ready"}
              filters={[
                {
                  key: "kind",
                  value: kind,
                  onChange: setKind,
                  allLabel: "Everything",
                  options: (
                    Object.keys(activityKindLabel) as ActivityKind[]
                  ).map((k) => ({ value: k, label: activityKindLabel[k] })),
                  width: "9rem",
                },
                {
                  key: "who",
                  value: who,
                  onChange: setWho,
                  allLabel: "Anyone",
                  options: people.map((p) => ({ value: p, label: p })),
                  width: "8rem",
                },
              ]}
            />
          )
        }
      >
        {body()}
      </AdminShell>

      <AccentSwitcher />
      <StateSwitcher current={state} />
    </>
  );
}

/**
 * Kind is a quiet badge, not a colour-coded one. Eight colours across a
 * thousand rows would be a rainbow that teaches nothing; the two rows that
 * matter — corrections and voids — carry weight instead.
 */
function KindBadge({ kind }: { kind: ActivityKind }) {
  const notable = kind === "correction" || kind === "void";
  return (
    <Badge
      variant="outline"
      className={`text-[10px] font-normal whitespace-nowrap ${
        notable ? "border-warning/40 bg-warning-subtle text-warning" : ""
      }`}
    >
      {activityKindLabel[kind]}
    </Badge>
  );
}

/**
 * Pagination rather than infinite scroll. A trail people search is one they
 * need to return to, and an infinite scroll has no addresses.
 */
function Pager({ shown, total }: { shown: number; total: number }) {
  return (
    <div className="mt-3 flex items-center justify-between">
      <span className="tabular text-xs text-muted-foreground">
        1–{Math.min(shown, PAGE)} of {total.toLocaleString()}
      </span>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="sm" className="h-7 text-xs" disabled>
          <ChevronLeft className="size-3.5" /> Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          disabled={total <= PAGE}
        >
          Next <ChevronRight className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

function StateSwitcher({ current }: { current: State }) {
  if (process.env.NODE_ENV === "production") return null;
  return (
    <div
      style={{
        position: "fixed",
        top: 48,
        right: 12,
        zIndex: 9999,
        display: "flex",
        gap: 2,
        padding: 4,
        borderRadius: 999,
        background: "#18181b",
        border: "2px dashed #52525b",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        fontSize: 11,
        color: "#fafafa",
      }}
    >
      <span style={{ padding: "0 4px 0 6px", opacity: 0.6 }}>state</span>
      {states.map((s) => (
        <a
          key={s}
          href={`?state=${s}`}
          style={{
            padding: "3px 7px",
            borderRadius: 999,
            textDecoration: "none",
            background: current === s ? "#fafafa" : "#3f3f46",
            color: current === s ? "#18181b" : "#fafafa",
          }}
        >
          {s === "first-use" ? "empty" : s}
        </a>
      ))}
    </div>
  );
}
