"use client";

/**
 * People — the list. Two tabs: staff and customers.
 *
 * Customers moved here from Catalogue in round E, so this destination now holds
 * two kinds of person: **who the business owes, and who owes the business.**
 * Tabs rather than one typed list, because the useful columns barely overlap —
 * a staff member has a daily rate and days worked, a customer has a balance and
 * an age. Half of every row in a combined table would be blank.
 *
 * Built entirely from the templates: `TableToolbar`, `RecordTable`,
 * `SummaryStrip`, the five states. Nothing here decides layout.
 *
 * The two summary strips deliberately answer different questions, because the
 * tabs are different questions. Staff: what is owed out, and is anything
 * unexplained. Customers: what is owed in, and how old is the oldest — the
 * figure that decides who to chase.
 */

import { useMemo, useState } from "react";
import {
  staff,
  staffDetail,
  customers,
  customerDetail,
  roleLabel,
  money,
  type Staff,
  type Customer,
} from "@/lib/fixtures";
import { SummaryStrip } from "@/components/patterns/summary-strip";
import { TableToolbar } from "@/components/patterns/table-toolbar";
import {
  RecordTable,
  Num,
  Truncate,
  type Column,
} from "@/components/patterns/record-table";
import { EmptyFiltered } from "@/components/patterns/states";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { TriangleAlert } from "lucide-react";

export function PeopleList({ onOpen }: { onOpen: (id: string) => void }) {
  const [tab, setTab] = useState("staff");
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("all");
  const [owingOnly, setOwingOnly] = useState(false);

  const clear = () => {
    setQuery("");
    setRole("all");
    setOwingOnly(false);
  };

  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList className="mb-3">
        <TabsTrigger value="staff">Staff</TabsTrigger>
        <TabsTrigger value="customers">
          Customers
          <Badge variant="secondary" className="tabular ml-1.5 h-4 px-1.5 text-[10px]">
            {customers.filter((c) => c.balance > 0).length}
          </Badge>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="staff">
        <StaffTab
          query={query}
          onQuery={setQuery}
          role={role}
          onRole={setRole}
          onClear={clear}
          onOpen={onOpen}
        />
      </TabsContent>

      <TabsContent value="customers">
        <CustomerTab
          query={query}
          onQuery={setQuery}
          owingOnly={owingOnly}
          onOwing={setOwingOnly}
          onClear={clear}
          onOpen={onOpen}
        />
      </TabsContent>
    </Tabs>
  );
}

/* ------------------------------------------------------------------ staff -- */

function StaffTab({
  query,
  onQuery,
  role,
  onRole,
  onClear,
  onOpen,
}: {
  query: string;
  onQuery: (v: string) => void;
  role: string;
  onRole: (v: string) => void;
  onClear: () => void;
  onOpen: (id: string) => void;
}) {
  const working = staff.filter((s) => s.role !== "owner");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return working.filter(
      (s) =>
        (role === "all" || s.role === role) &&
        (!q || s.name.toLowerCase().includes(q)),
    );
  }, [query, role, working]);

  const totals = working.reduce(
    (a, s) => {
      const d = staffDetail[s.id];
      const owed = d ? d.owedToStaff - d.advances : 0;
      const short = d ? d.shortfalls.filter((x) => !x.resolved).length : 0;
      return { owed: a.owed + owed, short: a.short + short };
    },
    { owed: 0, short: 0 },
  );

  const columns: Column<Staff>[] = [
    {
      key: "name",
      header: "Person",
      align: "left",
      sortable: true,
      cell: (s) => {
        const d = staffDetail[s.id];
        const short = d ? d.shortfalls.filter((x) => !x.resolved).length : 0;
        return (
          <button
            onClick={() => onOpen(s.id)}
            className="flex items-center gap-1.5 text-left font-medium"
          >
            {s.name}
            {short > 0 && (
              <TriangleAlert
                className="size-3.5 text-warning"
                aria-label="Unexplained shortfall"
              />
            )}
          </button>
        );
      },
    },
    {
      key: "role",
      header: "Role",
      align: "left",
      cell: (s) => (
        <span className="text-muted-foreground">{roleLabel[s.role]}</span>
      ),
    },
    {
      key: "location",
      header: "Location",
      align: "left",
      cell: (s) => (
        <span className="text-muted-foreground capitalize">{s.location}</span>
      ),
    },
    {
      key: "rate",
      header: "Daily rate",
      group: true,
      cell: (s) => <Num value={s.dailyRate} money />,
    },
    {
      key: "days",
      header: "Days worked",
      cell: (s) => {
        const d = staffDetail[s.id];
        return (
          <Num value={d ? d.daysWorked.filter((x) => x.worked).length : null} />
        );
      },
    },
    {
      key: "owed",
      header: "Owed to them",
      sortable: true,
      cell: (s) => {
        const d = staffDetail[s.id];
        return <Num value={d ? d.owedToStaff - d.advances : null} money strong />;
      },
    },
  ];

  return (
    <>
      <div className="mb-4">
        <SummaryStrip
          columns={3}
          items={[
            {
              label: "Owed to staff",
              value: money(totals.owed),
              sub: `${working.length} people, not yet paid`,
            },
            {
              label: "Unexplained shortfalls",
              value: String(totals.short),
              sub: totals.short ? "handovers that did not agree" : "all agreed",
              tone: totals.short > 0 ? "warning" : undefined,
              link: totals.short
                ? { label: "See handovers", href: "/design/ledger" }
                : undefined,
            },
            {
              label: "Last paid",
              value: "31 Jul",
              sub: "everyone, end of month",
            },
          ]}
        />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <TableToolbar
          query={query}
          onQuery={onQuery}
          placeholder="Search staff"
          noun="people"
          count={rows.length}
          total={working.length}
          filters={[
            {
              key: "role",
              value: role,
              onChange: onRole,
              allLabel: "All roles",
              options: [
                { value: "store-manager", label: "Store manager" },
                { value: "cashier", label: "Cashier" },
                { value: "attendant", label: "Attendant" },
              ],
              width: "10rem",
            },
          ]}
        />
      </div>

      <RecordTable
        rows={rows}
        columns={columns}
        rowKey={(s) => s.id}
        minWidth={720}
        empty={<EmptyFiltered onClear={onClear} noun="staff" />}
      />
    </>
  );
}

/* -------------------------------------------------------------- customers -- */

function CustomerTab({
  query,
  onQuery,
  owingOnly,
  onOwing,
  onClear,
  onOpen,
}: {
  query: string;
  onQuery: (v: string) => void;
  owingOnly: boolean;
  onOwing: (v: boolean) => void;
  onClear: () => void;
  onOpen: (id: string) => void;
}) {
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return customers.filter(
      (c) =>
        (!owingOnly || c.balance > 0) &&
        (!q || c.name.toLowerCase().includes(q)),
    );
  }, [query, owingOnly]);

  const owing = customers.filter((c) => c.balance > 0);
  const total = owing.reduce((s, c) => s + c.balance, 0);
  const oldest = Math.max(
    ...Object.values(customerDetail).map((d) => d.oldestDays),
    0,
  );

  const columns: Column<Customer>[] = [
    {
      key: "name",
      header: "Customer",
      align: "left",
      sortable: true,
      cell: (c) => (
        <button
          onClick={() => onOpen(c.id)}
          className="text-left font-medium"
        >
          <Truncate>{c.name}</Truncate>
        </button>
      ),
    },
    {
      key: "phone",
      header: "Phone",
      align: "left",
      cell: (c) =>
        c.phone ? (
          <span className="tabular text-muted-foreground">{c.phone}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "since",
      header: "Customer since",
      align: "left",
      cell: (c) => {
        const d = customerDetail[c.id];
        return (
          <span className="tabular text-muted-foreground">
            {d ? d.since : "—"}
          </span>
        );
      },
    },
    {
      key: "oldest",
      header: "Oldest unpaid",
      group: true,
      cell: (c) => {
        const d = customerDetail[c.id];
        if (!d || c.balance === 0)
          return <span className="text-muted-foreground">—</span>;
        // Over 60 days is the point at which it stops being ordinary credit.
        const stale = d.oldestDays > 60;
        return (
          <span className={`tabular ${stale ? "text-danger" : ""}`}>
            {d.oldestDays}d
          </span>
        );
      },
    },
    {
      key: "balance",
      header: "Owes",
      sortable: true,
      cell: (c) => <Num value={c.balance} money muted strong />,
    },
  ];

  return (
    <>
      <div className="mb-4">
        <SummaryStrip
          columns={3}
          items={[
            {
              label: "Owed to the business",
              value: money(total),
              sub: `${owing.length} of ${customers.length} customers`,
              link: { label: "See credit and repayments", href: "/design/ledger" },
            },
            {
              label: "Oldest unpaid",
              value: `${oldest} days`,
              sub: "decides who to chase first",
              tone: oldest > 60 ? "danger" : undefined,
            },
            {
              label: "Largest balance",
              value: money(Math.max(...customers.map((c) => c.balance))),
              sub: customers.reduce((a, b) => (a.balance > b.balance ? a : b))
                .name,
            },
          ]}
        />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <TableToolbar
          query={query}
          onQuery={onQuery}
          placeholder="Search customers"
          noun="customers"
          count={rows.length}
          total={customers.length}
          toggles={[
            {
              key: "owing",
              label: "Owing",
              on: owingOnly,
              onChange: onOwing,
              count: owing.length,
            },
          ]}
        />
      </div>

      <RecordTable
        rows={rows}
        columns={columns}
        rowKey={(c) => c.id}
        minWidth={640}
        footnote="A balance is credit extended less repayments — it is never edited directly. Taking a repayment happens on the customer."
        empty={<EmptyFiltered onClear={onClear} noun="customers" />}
      />
    </>
  );
}
