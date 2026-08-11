"use client";

/**
 * Canteen takings — staff shell. Ticket 23.
 *
 * Structurally the same shape as Handover (handover.tsx): two amount
 * fields, a confirm step, a read/done view with same-day re-entry. Built
 * from that precedent rather than a new pattern, since the data shape is
 * identical (cash + M-Pesa totals, one record per location per day).
 *
 * The one deliberate divergence: this is not a blind count. proposal.md
 * §4 — at close, the attendant "records" the day's cash and M-Pesa totals
 * from the payment messages and cash in hand; there is no till figure to
 * defeat by showing it, because nothing was recorded per-sale to expect
 * against. So the confirm step here is a plain double-check ("does this
 * match what's in front of you"), not handover's "the owner checks this
 * against what the till recorded" framing — that line doesn't apply here
 * and would misstate what's being verified.
 */

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ErrorState, PermissionDenied } from "@/components/patterns/states";
import { Skeleton } from "@/components/ui/skeleton";
import { Check } from "lucide-react";
import { money } from "@/shared/money";

export type TakingsView = {
  cashMinor: number;
  mpesaMinor: number;
};

export type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "denied" }
  | { status: "ready"; takings: TakingsView | null };

async function fetchTodaysTakings(): Promise<LoadState> {
  try {
    const response = await fetch("/api/takings/today");
    if (response.status === 403) return { status: "denied" };
    if (!response.ok) return { status: "error" };
    const body = await response.json();
    return { status: "ready", takings: body.takings ?? null };
  } catch {
    return { status: "error" };
  }
}

async function submitTakings(input: {
  cashMinor: number;
  mpesaMinor: number;
}): Promise<{ ok: true; takings: TakingsView } | { ok: false; error: string }> {
  try {
    const response = await fetch("/api/takings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      return { ok: false, error: body?.error ?? "unknown" };
    }
    const body = await response.json();
    return { ok: true, takings: body.takings };
  } catch {
    return { ok: false, error: "network" };
  }
}

export function Takings() {
  const [attempt, setAttempt] = useState(0);
  return <TakingsForAttempt key={attempt} onRetry={() => setAttempt((a) => a + 1)} />;
}

function TakingsForAttempt({ onRetry }: { onRetry: () => void }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const cancelledRef = useRef(false);

  useEffect(() => {
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  useEffect(() => {
    fetchTodaysTakings().then((result) => {
      if (!cancelledRef.current) setState(result);
    });
  }, []);

  return <TakingsScreen state={state} onRetry={onRetry} />;
}

/** The presentational half, driven by state rather than fetching — what
 * Storybook mounts to show every state without a network. */
export function TakingsScreen({
  state,
  onRetry = () => {},
  onSubmit = submitTakings,
}: {
  state: LoadState;
  onRetry?: () => void;
  onSubmit?: typeof submitTakings;
}) {
  if (state.status === "loading") {
    return (
      <div className="space-y-2.5 p-3" data-testid="takings-loading">
        <Skeleton className="h-16 w-full rounded-lg" />
        <Skeleton className="h-16 w-full rounded-lg" />
      </div>
    );
  }

  if (state.status === "denied") {
    return (
      <div className="p-3">
        <PermissionDenied
          title="You can't record takings here"
          body="Takings are recorded at your own location. Ask the owner if this looks wrong."
        />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="p-3">
        <ErrorState what="today's takings" onRetry={onRetry} />
      </div>
    );
  }

  return <TakingsEntry initial={state.takings} onSubmit={onSubmit} />;
}

type Step =
  | { name: "entry" }
  | { name: "confirm" }
  | { name: "done"; takings: TakingsView };

function TakingsEntry({
  initial,
  onSubmit,
}: {
  initial: TakingsView | null;
  onSubmit: typeof submitTakings;
}) {
  const [cash, setCash] = useState(initial ? String(initial.cashMinor) : "");
  const [mpesa, setMpesa] = useState(initial ? String(initial.mpesaMinor) : "");
  const [step, setStep] = useState<Step>(
    initial ? { name: "done", takings: initial } : { name: "entry" },
  );
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const cashN = Number(cash) || 0;
  const mpesaN = Number(mpesa) || 0;
  const entered = cash.trim() !== "" && mpesa.trim() !== "";

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError(null);
    const result = await onSubmit({ cashMinor: cashN, mpesaMinor: mpesaN });
    setSubmitting(false);
    if (!result.ok) {
      setSubmitError(result.error);
      return;
    }
    setStep({ name: "done", takings: result.takings });
  }

  if (step.name === "done") {
    return (
      <div className="p-3" data-testid="takings-done">
        <div className="rounded-lg border bg-card p-4">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-full bg-success/15 text-success">
              <Check className="size-4" />
            </div>
            <p className="text-[13px] font-medium">Today&apos;s takings recorded</p>
          </div>
          <div className="space-y-2">
            <Row label="Cash" value={step.takings.cashMinor} />
            <Row label="M-Pesa" value={step.takings.mpesaMinor} />
          </div>
          <div className="mt-3 flex items-baseline justify-between border-t pt-2.5">
            <span className="text-[13px] font-medium">Total</span>
            <span className="tabular-nums text-lg font-semibold">
              {money(step.takings.cashMinor + step.takings.mpesaMinor)}
            </span>
          </div>
        </div>
        <button
          onClick={() => setStep({ name: "entry" })}
          className="mt-3 w-full rounded-lg border border-dashed py-2.5 text-[13px] text-muted-foreground"
          data-testid="takings-edit-button"
        >
          Made a mistake? Record again
        </button>
      </div>
    );
  }

  if (step.name === "confirm") {
    return (
      <div className="flex min-h-full flex-col">
        <div className="flex-1 space-y-3 p-3" data-testid="takings-confirm">
          <div className="rounded-lg border bg-card p-4">
            <p className="text-[13px] text-muted-foreground">
              Check these against the payment messages and what&apos;s in
              hand before confirming.
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
            onClick={() => setStep({ name: "entry" })}
            className="w-full rounded-lg border border-dashed py-2.5 text-[13px] text-muted-foreground"
            data-testid="takings-back-button"
          >
            Go back and change these
          </button>

          {submitError === "day_closed" && (
            <p className="text-[12px] text-destructive" data-testid="takings-submit-error">
              This day is closed — ask the owner.
            </p>
          )}
          {submitError && submitError !== "day_closed" && (
            <p className="text-[12px] text-destructive" data-testid="takings-submit-error">
              Couldn&apos;t record today&apos;s takings. Try again.
            </p>
          )}
        </div>

        <div className="sticky bottom-0 border-t bg-card px-4 py-3">
          <Button
            className="h-12 w-full text-[15px]"
            disabled={submitting}
            onClick={handleSubmit}
            data-testid="takings-submit-button"
          >
            {submitting ? "Recording…" : "Record today's takings"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex-1 space-y-2.5 p-3">
        <p className="text-[13px] text-muted-foreground">
          At close, record the day&apos;s cash and M-Pesa totals. Cash and
          M-Pesa are recorded separately.
        </p>

        <MethodBlock
          label="Cash"
          note="Notes and coins taken today"
          value={cash}
          onChange={setCash}
        />

        <MethodBlock
          label="M-Pesa"
          note="From the payment messages received"
          value={mpesa}
          onChange={setMpesa}
        />
      </div>

      <div className="sticky bottom-0 border-t bg-card px-4 py-3">
        <Button
          className="h-12 w-full text-[15px]"
          disabled={!entered}
          onClick={() => setStep({ name: "confirm" })}
          data-testid="takings-check-button"
        >
          Check what I&apos;ve entered
        </Button>
        {!entered && (
          <p className="mt-1.5 text-center text-[11px] text-muted-foreground">
            Enter both totals, even if one is nothing
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
        aria-label={`${label} entered`}
        className="tabular-nums mt-2 h-12 text-right text-lg"
        data-testid={`takings-${label.toLowerCase().replace(/[^a-z]/g, "")}-input`}
      />
    </div>
  );
}
