"use client";

/**
 * The People destination's Staff tab content — list, create, edit,
 * deactivate/reactivate. Customers (ticket 06's own record) are a
 * separate tab, out of scope for ticket 17.
 *
 * Owner-only: the /people route denies non-owners before this ever
 * mounts, same as CatalogueDestination assumes an owner session.
 */

import { useEffect, useState } from "react";
import { LoadingTable, ErrorState, PermissionDenied } from "@/components/patterns/states";
import { StaffTab } from "./staff-tab";
import { fetchStaff, type StaffState } from "./staff-data";

async function postJson(url: string, method: string, body: unknown) {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) return { ok: false as const, reason: data.error as string };
  return { ok: true as const, data };
}

export function StaffDestination() {
  const [attempt, setAttempt] = useState(0);
  return <StaffDestinationForAttempt key={attempt} onRetry={() => setAttempt((a) => a + 1)} />;
}

function StaffDestinationForAttempt({ onRetry }: { onRetry: () => void }) {
  const [state, setState] = useState<StaffState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    fetchStaff().then((result) => {
      if (!cancelled) setState(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return <StaffDestinationView state={state} onRetry={onRetry} />;
}

/** The presentational half, driven by state rather than fetching — this is
 * what Storybook mounts to show every state without a network. */
export function StaffDestinationView({
  state,
  onRetry = () => {},
}: {
  state: StaffState;
  onRetry?: () => void;
}) {
  if (state.status === "loading") return <LoadingTable summary={0} columns={6} />;
  if (state.status === "denied")
    return (
      <PermissionDenied
        title="Only the owner can manage staff"
        body="Ask the owner if you need a staff member added, edited or deactivated."
      />
    );
  if (state.status === "error") return <ErrorState what="staff" onRetry={onRetry} />;

  return <StaffDestinationReady initial={state} />;
}

/** Owns the live copy of the data, seeded once from the initial fetch and
 * refreshed after every mutation. */
function StaffDestinationReady({
  initial,
}: {
  initial: Extract<StaffState, { status: "ready" }>;
}) {
  const [data, setData] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function refresh() {
    const result = await fetchStaff();
    if (result.status === "ready") setData(result);
  }

  async function withSaving(fn: () => Promise<{ ok: boolean; reason?: string }>) {
    setSaving(true);
    setError(undefined);
    const result = await fn();
    setSaving(false);
    if (!result.ok) {
      setError(
        result.reason === "duplicate_name"
          ? "That name is already in use."
          : result.reason === "invalid_pin"
            ? "PIN must be exactly four digits."
            : "Couldn't save — try again.",
      );
      return;
    }
    await refresh();
  }

  return (
    <StaffTab
      staff={data.staff}
      locations={data.locations}
      saving={saving}
      error={error}
      onCreate={(input) => withSaving(() => postJson("/api/people/staff", "POST", input))}
      onUpdate={(id, input) =>
        withSaving(() => postJson(`/api/people/staff/${id}`, "PATCH", input))
      }
      onSetActive={(id, active) =>
        withSaving(() => postJson(`/api/people/staff/${id}/active`, "PATCH", { active }))
      }
    />
  );
}
