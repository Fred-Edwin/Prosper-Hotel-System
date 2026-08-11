"use client";

/**
 * Restaurant handover — staff shell.
 *
 * Adapted from the design-reference worktree's locked prototype
 * (`components/design/staff/handover-body.tsx` + `round.tsx`, commit
 * a977bea) rather than invented — see docs/architecture.md's precedent
 * table. That prototype settled the handover as a **blind count**: the
 * staff member counts cash and M-Pesa without seeing what the till expects,
 * confirms the figures echoed back, then submits. The comparison against
 * the expected figure is the owner's alone (ticket 14's Dashboard) — a
 * shown expectation would give someone short a number to reconcile *to*,
 * defeating the control. Ticket 13 keeps that screen design; only the data
 * layer changed (real expected/actual computed and stored, same-day
 * self-edit) — see cash/logic.ts.
 *
 * Dropped from the prototype: the optional free-text note ("Anything Lucy
 * should know?") — not in ticket 13's acceptance criteria or CONTEXT.md's
 * Handover entry, so left out rather than invented back in.
 *
 * Kept: two MethodBlocks (cash, M-Pesa) with a spoken-amount echo, a
 * confirm step that repeats the totals back before submit, and a result
 * view — the ticket's own addition, since the prototype's static example
 * never had to render post-submit or same-day-reopen states.
 *
 * Ticket 27 extends this to the canteen rather than building a parallel
 * screen — same blind-count shape, only the expected-amount source differs
 * (Takings, not summed sales — see cash/logic.ts's computeExpectedFromTakings).
 * The blind count still applies at the canteen: the attendant never sees
 * the takings-derived expected figure any more than restaurant staff see
 * summed sales, so there is no "agreed/short/over" state here — that
 * comparison stays the owner's alone, in the Dashboard (out of this
 * ticket's scope). The one canteen-only addition is a **blocked** state:
 * if today's takings haven't been recorded yet, there is nothing real to
 * check the handover against, so recording is refused rather than silently
 * comparing against a false zero baseline (proposal.md §5 / CONTEXT.md's
 * Handover canteen case).
 */

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ErrorState, PermissionDenied } from "@/components/patterns/states";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, Info, ClipboardList } from "lucide-react";
import { money } from "@/shared/money";

export type HandoverView = {
  actualCashMinor: number;
  actualMpesaMinor: number;
};

export type LocationCode = "restaurant" | "canteen";

export type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "denied" }
  | {
      status: "ready";
      handover: HandoverView | null;
      locationCode: LocationCode;
      takingsRecordedToday: boolean;
    };

async function fetchTodaysHandover(): Promise<LoadState> {
  try {
    const response = await fetch("/api/handovers/today");
    if (response.status === 403) return { status: "denied" };
    if (!response.ok) return { status: "error" };
    const body = await response.json();
    return {
      status: "ready",
      handover: body.handover ?? null,
      locationCode: body.locationCode,
      takingsRecordedToday: body.takingsRecordedToday,
    };
  } catch {
    return { status: "error" };
  }
}

async function submitHandover(input: {
  cashMinor: number;
  mpesaMinor: number;
}): Promise<
  { ok: true; handover: HandoverView } | { ok: false; error: string }
> {
  try {
    const response = await fetch("/api/handovers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      return { ok: false, error: body?.error ?? "unknown" };
    }
    const body = await response.json();
    return { ok: true, handover: body.handover };
  } catch {
    return { ok: false, error: "network" };
  }
}

export function Handover() {
  const [attempt, setAttempt] = useState(0);
  return <HandoverForAttempt key={attempt} onRetry={() => setAttempt((a) => a + 1)} />;
}

function HandoverForAttempt({ onRetry }: { onRetry: () => void }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const cancelledRef = useRef(false);

  useEffect(() => {
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  useEffect(() => {
    fetchTodaysHandover().then((result) => {
      if (!cancelledRef.current) setState(result);
    });
  }, []);

  return <HandoverView state={state} onRetry={onRetry} />;
}

/** The presentational half, driven by state rather than fetching — what
 * Storybook mounts to show every state without a network. */
export function HandoverView({
  state,
  onRetry = () => {},
  onSubmit = submitHandover,
}: {
  state: LoadState;
  onRetry?: () => void;
  onSubmit?: typeof submitHandover;
}) {
  if (state.status === "loading") {
    return (
      <div className="space-y-2.5 p-3" data-testid="handover-loading">
        <Skeleton className="h-16 w-full rounded-lg" />
        <Skeleton className="h-16 w-full rounded-lg" />
      </div>
    );
  }

  if (state.status === "denied") {
    return (
      <div className="p-3">
        <PermissionDenied
          title="You can't record a handover here"
          body="Handovers are recorded at your own location. Ask the owner if this looks wrong."
        />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="p-3">
        <ErrorState what="today's handover" onRetry={onRetry} />
      </div>
    );
  }

  // Canteen only: no takings recorded yet today means there is nothing
  // real to check the handover against — same reasoning as ticket 24's
  // first-count caveat. Recording is blocked at the data layer too
  // (cash/logic.ts), this just gets ahead of it before the attendant
  // starts a count that can't be submitted.
  if (state.handover === null && !state.takingsRecordedToday) {
    return (
      <div className="p-3" data-testid="handover-takings-not-recorded">
        <div className="flex flex-col items-center justify-center rounded-lg border bg-card px-6 py-16 text-center">
          <div className="mb-3 flex size-9 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <ClipboardList className="size-4" />
          </div>
          <p className="text-sm font-medium">Record today&apos;s takings first</p>
          <p className="mt-1 max-w-sm text-[13px] text-muted-foreground">
            The handover is checked against today&apos;s takings. Record
            those first, then come back here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <HandoverCount
      initial={state.handover}
      locationCode={state.locationCode}
      onSubmit={onSubmit}
    />
  );
}

type Step =
  | { name: "count" }
  | { name: "confirm" }
  | { name: "done"; handover: HandoverView };

function HandoverCount({
  initial,
  locationCode,
  onSubmit,
}: {
  initial: HandoverView | null;
  locationCode: LocationCode;
  onSubmit: typeof submitHandover;
}) {
  const [cash, setCash] = useState(initial ? String(initial.actualCashMinor) : "");
  const [mpesa, setMpesa] = useState(initial ? String(initial.actualMpesaMinor) : "");
  const [step, setStep] = useState<Step>(
    initial ? { name: "done", handover: initial } : { name: "count" },
  );
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const cashN = Number(cash) || 0;
  const mpesaN = Number(mpesa) || 0;
  const counted = cash.trim() !== "" && mpesa.trim() !== "";

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError(null);
    const result = await onSubmit({ cashMinor: cashN, mpesaMinor: mpesaN });
    setSubmitting(false);
    if (!result.ok) {
      setSubmitError(result.error);
      return;
    }
    setStep({ name: "done", handover: result.handover });
  }

  if (step.name === "done") {
    return (
      <div className="p-3" data-testid="handover-done">
        <div className="rounded-lg border bg-card p-4">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-full bg-success/15 text-success">
              <Check className="size-4" />
            </div>
            <p className="text-[13px] font-medium">Handover recorded</p>
          </div>
          <div className="space-y-2">
            <Row label="Cash" value={step.handover.actualCashMinor} />
            <Row label="M-Pesa" value={step.handover.actualMpesaMinor} />
          </div>
        </div>
        <button
          onClick={() => setStep({ name: "count" })}
          className="mt-3 w-full rounded-lg border border-dashed py-2.5 text-[13px] text-muted-foreground"
          data-testid="handover-edit-button"
        >
          Made a mistake? Record again
        </button>
      </div>
    );
  }

  if (step.name === "confirm") {
    return (
      <div className="flex min-h-full flex-col">
        <div className="flex-1 space-y-3 p-3" data-testid="handover-confirm">
          <div className="rounded-lg border bg-card p-4">
            <p className="text-[13px] text-muted-foreground">
              Check these against what is in your hand before you hand it over.
            </p>
            <div className="mt-3 space-y-3">
              <Row label="Cash" value={cashN} big />
              <Row label="M-Pesa" value={mpesaN} big />
            </div>
            <div className="mt-3 flex items-baseline justify-between border-t pt-2.5">
              <span className="text-[13px] font-medium">Total</span>
              <span className="tabular-nums text-lg font-semibold">
                {money(cashN + mpesaN)}
              </span>
            </div>
          </div>

          <button
            onClick={() => setStep({ name: "count" })}
            className="w-full rounded-lg border border-dashed py-2.5 text-[13px] text-muted-foreground"
            data-testid="handover-back-button"
          >
            Go back and change these
          </button>

          <div className="flex items-start gap-2 px-1">
            <Info className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
            <p className="text-[11px] text-muted-foreground">
              {locationCode === "canteen"
                ? "The owner checks this against today's takings. You can still change it later today if you need to."
                : "The owner checks this against what the till recorded. You can still change it later today if you need to."}
            </p>
          </div>

          {submitError === "takings_not_recorded" && (
            <p className="text-[12px] text-destructive" data-testid="handover-submit-error">
              Today&apos;s takings haven&apos;t been recorded yet. Record those
              first, then come back here.
            </p>
          )}
          {submitError === "day_closed" && (
            <p className="text-[12px] text-destructive" data-testid="handover-submit-error">
              This day is closed — ask the owner.
            </p>
          )}
          {submitError && submitError !== "takings_not_recorded" && submitError !== "day_closed" && (
            <p className="text-[12px] text-destructive" data-testid="handover-submit-error">
              Couldn&apos;t record the handover. Try again.
            </p>
          )}
        </div>

        <div className="sticky bottom-0 border-t bg-card px-4 py-3">
          <Button
            className="h-12 w-full text-[15px]"
            disabled={submitting}
            onClick={handleSubmit}
            data-testid="handover-submit-button"
          >
            {submitting ? "Handing over…" : "Hand over"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex-1 space-y-2.5 p-3">
        <p className="text-[13px] text-muted-foreground">
          Count what you are handing over. Cash and M-Pesa are counted
          separately.
        </p>

        <MethodBlock
          label="Cash"
          note="Notes and coins in the drawer"
          value={cash}
          onChange={setCash}
        />

        <MethodBlock
          label="M-Pesa"
          note="Check against the paybill messages"
          value={mpesa}
          onChange={setMpesa}
        />
      </div>

      <div className="sticky bottom-0 border-t bg-card px-4 py-3">
        <Button
          className="h-12 w-full text-[15px]"
          disabled={!counted}
          onClick={() => setStep({ name: "confirm" })}
          data-testid="handover-check-button"
        >
          Check what I&apos;ve counted
        </Button>
        {!counted && (
          <p className="mt-1.5 text-center text-[11px] text-muted-foreground">
            Enter both amounts, even if one is nothing
          </p>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, big }: { label: string; value: number; big?: boolean }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-[13px] text-muted-foreground">{label}</span>
      <span className={big ? "tabular-nums text-2xl font-semibold" : "tabular-nums text-[15px] font-semibold"}>
        {money(value)}
      </span>
    </div>
  );
}

function MethodBlock({
  label,
  note,
  value,
  onChange,
}: {
  label: string;
  note: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-[13px] font-medium">{label}</div>
      <div className="text-[11px] text-muted-foreground">{note}</div>
      <Input
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0"
        aria-label={`${label} counted`}
        className="tabular-nums mt-2 h-12 text-right text-lg"
        data-testid={`handover-${label.toLowerCase().replace(/[^a-z]/g, "")}-input`}
      />
    </div>
  );
}
