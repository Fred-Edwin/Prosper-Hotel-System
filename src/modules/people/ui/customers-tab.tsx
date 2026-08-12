"use client";

/**
 * Customers tab — list, search, "owing only" filter, select a customer to
 * see the detail view. Ticket 36; adapted from the design-reference's
 * `list.tsx`/`CustomerTab`, built from the same real templates
 * (`TableToolbar`, `RecordTable`, `SummaryStrip`) StaffTab already uses.
 *
 * Selecting a row renders `CustomerDetail` in place, same pattern as the
 * Days worked tab's select→detail flow — no separate route.
 */

import { useMemo, useState } from "react";
import { RecordTable, Num, Truncate, type Column } from "@/components/patterns/record-table";
import { TableToolbar } from "@/components/patterns/table-toolbar";
import { SummaryStrip } from "@/components/patterns/summary-strip";
import { EmptyFirstUse, EmptyFiltered } from "@/components/patterns/states";
import { UserRound } from "lucide-react";
import { money } from "@/shared/money";
import { CustomerDetail } from "./customer-detail";
import type { CustomerWithBalance, CustomerHistoryState } from "./customer-data";

// Creating a customer happens at the till when credit or a delivery is
// first recorded (ticket 06/07/08) — this tab reads and manages existing
// customers, it does not create them.
export function CustomersTab({
  customers,
  totalOwedMinor,
  onFetchHistory,
  onRecordRepayment,
}: {
  customers: CustomerWithBalance[];
  totalOwedMinor: number;
  onFetchHistory: (customerId: string) => Promise<CustomerHistoryState>;
  onRecordRepayment: (
    customerId: string,
    amountMinor: number,
  ) => Promise<{ ok: boolean; reason?: string }>;
}) {
  const [query, setQuery] = useState("");
  const [owingOnly, setOwingOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return customers.filter(
      (c) => (!owingOnly || c.balanceMinor > 0) && (!q || c.name.toLowerCase().includes(q)),
    );
  }, [customers, query, owingOnly]);

  const owing = customers.filter((c) => c.balanceMinor > 0);

  if (selectedId) {
    const customer = customers.find((c) => c.id === selectedId);
    if (customer) {
      return (
        <CustomerDetail
          customer={customer}
          onBack={() => setSelectedId(null)}
          onFetchHistory={() => onFetchHistory(customer.id)}
          onRecordRepayment={(amountMinor) => onRecordRepayment(customer.id, amountMinor)}
        />
      );
    }
  }

  const columns: Column<CustomerWithBalance>[] = [
    {
      key: "name",
      header: "Customer",
      align: "left",
      cell: (c) => (
        <button onClick={() => setSelectedId(c.id)} className="text-left font-medium">
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
      key: "balance",
      header: "Owes",
      cell: (c) => <Num value={c.balanceMinor} money muted strong />,
    },
  ];

  return (
    <div>
      <div className="mb-4">
        <SummaryStrip
          columns={2}
          items={[
            {
              label: "Owed to the business",
              value: money(totalOwedMinor),
              sub: `${owing.length} of ${customers.length} customers, both locations`,
            },
            {
              label: "Largest balance",
              value: owing.length ? money(Math.max(...owing.map((c) => c.balanceMinor))) : money(0),
              sub: owing.length
                ? owing.reduce((a, b) => (a.balanceMinor > b.balanceMinor ? a : b)).name
                : "nobody owes right now",
            },
          ]}
        />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <TableToolbar
          query={query}
          onQuery={setQuery}
          placeholder="Search customers"
          noun="customers"
          count={rows.length}
          total={customers.length}
          testIdPrefix="customer"
          toggles={[
            {
              key: "owing",
              label: "Owing",
              on: owingOnly,
              onChange: setOwingOnly,
              count: owing.length,
            },
          ]}
        />
      </div>

      <RecordTable
        rows={rows}
        columns={columns}
        rowKey={(c) => c.id}
        testIdPrefix="customer"
        minWidth={480}
        footnote="A balance is credit extended less repayments — it is never edited directly. Taking a repayment happens on the customer."
        empty={
          customers.length === 0 ? (
            <EmptyFirstUse
              icon={<UserRound className="size-4" />}
              title="No customers yet"
              body="A customer is created the first time credit is extended or a delivery is recorded, at the till."
            />
          ) : (
            <EmptyFiltered
              onClear={() => {
                setQuery("");
                setOwingOnly(false);
              }}
              noun="customers"
            />
          )
        }
      />
    </div>
  );
}
