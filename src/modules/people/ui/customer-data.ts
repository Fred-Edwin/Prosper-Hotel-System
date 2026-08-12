"use client";

/**
 * Fetch layer for the Customers tab. One GET lists customers; balance and
 * history are fetched per customer through sales's owner-gated exports —
 * the first people → sales cross-module read, ticket 36.
 */

import type { Customer } from "../schema";

export type CustomerWithBalance = Customer & { balanceMinor: number };

export type CustomersState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "denied" }
  | { status: "ready"; customers: CustomerWithBalance[]; totalOwedMinor: number };

export async function fetchCustomers(): Promise<CustomersState> {
  try {
    // listCustomersRoute is not owner-gated (any staff can name a customer
    // at the till) — the total-owed read is, so it is the signal for
    // whether this tab's balances are visible to the current session.
    const totalResponse = await fetch("/api/dashboard/owed-to-you");
    if (totalResponse.status === 403) return { status: "denied" };
    if (!totalResponse.ok) return { status: "error" };
    const totalBody = await totalResponse.json();
    if (typeof totalBody?.totalMinor !== "number") return { status: "error" };

    const listResponse = await fetch("/api/people/customers");
    if (!listResponse.ok) return { status: "error" };
    const listBody = await listResponse.json();
    if (!Array.isArray(listBody?.customers)) return { status: "error" };

    const customers: Customer[] = listBody.customers;
    const withBalances = await Promise.all(
      customers.map(async (customer) => {
        const balanceResponse = await fetch(`/api/sales/customers/${customer.id}/balance`);
        if (!balanceResponse.ok) return { ...customer, balanceMinor: 0 };
        const balanceBody = await balanceResponse.json();
        return { ...customer, balanceMinor: balanceBody.balanceMinor ?? 0 };
      }),
    );

    return { status: "ready", customers: withBalances, totalOwedMinor: totalBody.totalMinor };
  } catch {
    return { status: "error" };
  }
}

export type CreditHistoryEntry = {
  kind: "credit" | "repayment";
  amountMinor: number;
  occurredAt: string;
};

export type CustomerHistoryState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; entries: CreditHistoryEntry[] };

export async function fetchCustomerHistory(customerId: string): Promise<CustomerHistoryState> {
  try {
    const response = await fetch(`/api/sales/customers/${customerId}/history`);
    if (!response.ok) return { status: "error" };
    const body = await response.json();
    if (!Array.isArray(body?.entries)) return { status: "error" };
    return { status: "ready", entries: body.entries };
  } catch {
    return { status: "error" };
  }
}
