"use client";

/**
 * The handover, as content. Shared by all three staff frames.
 *
 * This is the hardest staff screen and the reason it was chosen to prove the
 * shell. Everything else a cashier does adds a record; this one **compares two
 * numbers that are supposed to agree and often do not**, and the disagreement
 * has to be resolvable by the person who caused it, on a phone, with customers
 * waiting.
 *
 * Four decisions the domain forces:
 *
 *   **Cash and M-Pesa are counted separately and never pooled.** CONTEXT.md is
 *   explicit. A single "total handed over" box would let a cash shortfall hide
 *   behind an M-Pesa surplus, which is exactly the control the client asked for
 *   being defeated by a layout choice.
 *
 *   **The count is blind.** The client asked for this explicitly: she sees the
 *   expected figure, the staff member does not. A shown expectation is a target
 *   to reconcile *to* — someone short by 250 who can see 8,400 has been handed
 *   the number to type. The count has to be an independent observation or the
 *   comparison proves nothing, which is the whole basis of the handover
 *   control.
 *
 *   This costs something real and the design has to absorb it: the staff member
 *   cannot self-correct a miscount, so the screen must make counting careful
 *   rather than making disagreement visible. Hence a confirm step that repeats
 *   the figure back before it is committed, and no difference shown anywhere.
 *
 *   **A shortfall does not block the handover.** architecture.md: a day closed
 *   while not balancing is recorded, not blocked. Blocking would produce a
 *   staff member who quietly adjusts the count until it agrees, destroying the
 *   record. With a blind count there is nothing to adjust *toward*, which makes
 *   the recorded figure more trustworthy, not less.
 *
 *   **The staff member is told the comparison happens.** Not the result — the
 *   fact. Concealing that the count is checked would be a trick, and a control
 *   the staff know about is a deterrent as well as a detector.
 */

import { useState } from "react";
import { money } from "@/lib/fixtures";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Check, TriangleAlert, Info } from "lucide-react";

/** Sarah's day — the stress case from the fixtures. Cash short by 250. */
export const expected = { cash: 8400, mpesa: 6200 };

export interface HandoverState {
  cash: string;
  mpesa: string;
  reason: string;
}

export function useHandover() {
  const [cash, setCash] = useState("");
  const [mpesa, setMpesa] = useState("");
  const [note, setNote] = useState("");
  /** The confirm step. It replaces the self-correction a blind count removes. */
  const [confirming, setConfirming] = useState(false);

  const cashN = Number(cash) || 0;
  const mpesaN = Number(mpesa) || 0;
  const counted = cash.trim() !== "" && mpesa.trim() !== "";

  return {
    cash,
    setCash,
    mpesa,
    setMpesa,
    note,
    setNote,
    confirming,
    setConfirming,
    cashN,
    mpesaN,
    counted,
    canSubmit: counted,
  };
}

/**
 * One method. What was counted — and nothing else.
 *
 * No expected figure and no running difference, because the count has to be an
 * independent observation. The only feedback is the amount echoed back in
 * words, which catches the failure a blind count actually has: a typo. "Eight
 * thousand one hundred and fifty" is checkable against a hand full of notes in
 * a way that `8150` is not.
 *
 * Large inputs — this is thumb-driven, and a mistyped digit becomes a shortfall
 * someone has to explain tomorrow.
 */
export function MethodBlock({
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
  const n = Number(value) || 0;

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
        className="tabular mt-2 h-12 text-right text-lg"
      />

      {/* The echo. The only check available when the count is blind. */}
      {value.trim() !== "" && (
        <div className="mt-1.5 text-right text-[11px] text-muted-foreground">
          {inWords(n)}
        </div>
      )}
    </div>
  );
}

/** Kenyan shillings, spoken. Caps at the range a day's takings can reach. */
function inWords(n: number): string {
  if (n === 0) return "nothing";
  const ones = [
    "", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
    "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen",
    "seventeen", "eighteen", "nineteen",
  ];
  const tens = [
    "", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty",
    "ninety",
  ];

  const under1000 = (v: number): string => {
    if (v < 20) return ones[v];
    if (v < 100)
      return tens[Math.floor(v / 10)] + (v % 10 ? `-${ones[v % 10]}` : "");
    return (
      `${ones[Math.floor(v / 100)]} hundred` +
      (v % 100 ? ` and ${under1000(v % 100)}` : "")
    );
  };

  const thousands = Math.floor(n / 1000);
  const rest = n % 1000;
  const parts = [
    thousands ? `${under1000(thousands)} thousand` : "",
    rest ? under1000(rest) : "",
  ].filter(Boolean);

  return `${parts.join(" ")} shillings`;
}

/**
 * Optional context, always available rather than triggered by a disagreement.
 *
 * With a blind count the screen cannot know whether anything is wrong, so the
 * note cannot appear in response to it. Making it always present is also
 * better: someone who gave change from their own pocket should say so at the
 * moment it is true, not be prompted after a comparison they cannot see.
 */
export function NoteBlock({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <label className="text-[13px] font-medium">
        Anything Lucy should know?{" "}
        <span className="font-normal text-muted-foreground">Optional</span>
      </label>
      <p className="mt-0.5 text-[11px] text-muted-foreground">
        A refund, change given from your own money, a customer who paid later.
      </p>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Leave blank if it was an ordinary shift"
        className="mt-2 min-h-16 text-[13px]"
      />
    </div>
  );
}

/**
 * The confirm step. This is what replaces the self-correction a blind count
 * takes away: the figures are repeated back, large, with one way forward and
 * one way back.
 *
 * The staff member is told the comparison happens — not its result. Concealing
 * that a count is checked would be a trick, and a control people know about
 * deters as well as detects.
 */
export function ConfirmBlock({
  cashN,
  mpesaN,
  onBack,
}: {
  cashN: number;
  mpesaN: number;
  onBack: () => void;
}) {
  return (
    <div className="space-y-3 p-3">
      <div className="rounded-lg border bg-card p-4">
        <p className="text-[13px] text-muted-foreground">
          Check these against what is in your hand before you hand it over.
        </p>
        <div className="mt-3 space-y-3">
          <Big label="Cash" value={cashN} />
          <Big label="M-Pesa" value={mpesaN} />
        </div>
        <div className="mt-3 flex items-baseline justify-between border-t pt-2.5">
          <span className="text-[13px] font-medium">Total</span>
          <span className="tabular text-lg font-semibold">
            {money(cashN + mpesaN)}
          </span>
        </div>
      </div>

      <button
        onClick={onBack}
        className="w-full rounded-lg border border-dashed py-2.5 text-[13px] text-muted-foreground"
      >
        Go back and change these
      </button>

      <div className="flex items-start gap-2 px-1">
        <Info className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
        <p className="text-[11px] text-muted-foreground">
          Lucy checks this against what the till recorded. Once handed over it
          cannot be edited — a correction is a new entry, so the day stays
          readable exactly as it happened.
        </p>
      </div>
    </div>
  );
}

function Big({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-[13px] text-muted-foreground">{label}</span>
      <div className="text-right">
        <div className="tabular text-2xl font-semibold">{money(value)}</div>
        <div className="text-[11px] text-muted-foreground">{inWords(value)}</div>
      </div>
    </div>
  );
}
