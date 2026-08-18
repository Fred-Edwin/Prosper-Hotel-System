# 0008 — The owner edits ledger figures in place

**Date:** 2026-08-18
**Status:** Accepted

**Supersedes:** `docs/architecture.md`'s "Changing a closed day", and the part of
ADR 0001's consequences that treats a correction as a new movement carrying a past
effective date. ADR 0001's central decision — stock is the sum of its movements —
is **not** superseded and is what makes this one cheap.

## Context

The rule was that the owner does not edit a closed figure. She recorded a *new
entry carrying an effective date in the past*, and the closed day kept its
original numbers. Every entry carried two dates, effective and entered, and the
gap between them was the information: what Tuesday looked like on Tuesday, versus
what Tuesday looks like now.

The reasoning was sound and it did not survive contact with the product.

**The mechanism was half-broken in a way that made it worse than nothing.** The
one place it was implemented — `recordSaleCorrection` — stamped a past
`effectiveAt` that **no report read**. Every revenue and profit aggregate filters
on `occurredAt`. So a correction for last Tuesday landed in *today's* profit while
presenting itself as a correction to Tuesday. The doctrine's whole promise is that
the past stays readable exactly as it happened; the implementation quietly broke
the present instead.

**It asked her to think in a vocabulary she does not have.** The system replaces
spreadsheets that already work (`docs/design.md`). In a spreadsheet a wrong number
is corrected by typing over it. "Record a compensating entry with an effective
date" is an accountant's motion, and she is not an accountant — she is the owner
looking at a figure she knows is wrong.

**The audit argument turned out to point the other way.** The original reasoning
was that "an audit trail over figures that move silently is worthless". True — but
the answer to that is a trail, not immobility. A figure that moves *and says so*
is strictly better than one she cannot correct at all, because the uncorrectable
one gets worked around outside the system, where there is no trail of any kind.

## Decision

**The owner edits any figure she can see, in place, from the ledger.** One click on
a cell, type the new value. Corrections cascade forward automatically, because
quantity is still derived rather than stored.

Six decisions fix the shape (D1–D6 in `docs/plan-editable-ledger.md`):

- **D1 — in-place editing replaces the effective-date doctrine.** Superseded, not
  relaxed.
- **D2 — handovers are frozen and outside the cascade.** `expectedCashMinor` and
  `expectedMpesaMinor` are never recomputed by anything, ever. They record an event
  between two people, and the owner is not the authority on what was in a cashier's
  hand last Tuesday. Her *actual* figures stay editable — a typo about a real event
  is still a typo. Where a later edit moves that day's sales, the handover row says
  so **in words, showing both figures**, rather than silently recomputing.
- **D3 — a full amendment trail, captured silently.** What changed, from what, to
  what, by whom, when. She is never asked to type a reason. Asking for one would
  train her to type "correction" into every box, which is a worse record than the
  automatic one and costs her time to produce.
- **D4 — quantity stays derived.** ADR 0001 holds. No stored stock quantity is
  introduced. This is the reason the cascade is nearly free.
- **D5 — the old backdated-correction feature is deleted, not kept alongside.** Two
  mechanisms for correcting one figure would drift.
- **D6 — far-back edits warn, never block.** Beyond 31 days the confirm names the
  span. A disclosure, not a permission gate: she remains the authority and there is
  no threshold at which an edit is refused.

### Two rules added after the plan was written

**Every edit confirms before it is written** (owner decision, 2026-08-18). T4
originally reserved the dialog for three escalations, reasoning that a dialog
firing constantly gets clicked through unread. The owner overrode it: that worry is
a guess about behaviour, whereas "a figure changed because I pressed Enter while
reading" is the failure she actually named. The escalations stopped deciding
*whether* to confirm and became extra warning text on a dialog that appears
regardless. The dialog always names the cell and both figures — a confirm asking
only "are you sure?" costs a click without buying a check.

**The confirm shows the real cascade before she agrees** (T12). An edit to a day's
opening moves closing on every following day, and cost of sales and profit with it.
The figures come from the server, which runs the real amend inside a transaction and
rolls it back — never from a prediction computed in the browser, which would have the
client re-implement the largest calculation in the app and quote a number that might
turn out slightly different. The "this also changes" section appears **only** when
something beyond the edited cell moves; a section that appears every time to report
nothing is noise that trains her to skip it.

## Alternatives considered

**Keep the effective-date doctrine and fix its implementation** — make the reports
read `effectiveAt`. Rejected. It would have corrected the bug while leaving the
larger problem: the motion is still foreign to her, and the two-date model exists
to answer a question ("what did Tuesday look like on Tuesday?") that nobody has
ever asked in this business. Building it correctly would have been paying full
price for a feature whose value was assumed rather than observed.

**Run both mechanisms side by side**, in-place editing for convenience and
backdated entries for the audit-sensitive cases. Rejected as D5. Two write paths
onto one figure is exactly where BUG-10 came from, and a reader of the data would
have to know which mechanism produced a given row to interpret it.

**Ask for a reason on every edit.** Rejected as D3. A required free-text reason
produces "correction" a hundred times and a real explanation approximately never,
while making the common case slower. The trail records the facts that are actually
reliable — the two figures, the person, the time — and Activity is where a reason
gets attached in the rare case one matters.

**Store the corrected quantity rather than deriving it.** Rejected as D4, and it
is the decision this feature most depends on. A stored quantity would make every
amendment a fan-out write across every affected day, and reintroduce exactly the
drift ADR 0001 exists to prevent.

## Consequences

**Good.** She corrects a wrong figure the way she already corrects one in a
spreadsheet, and the system records more about the change than the old doctrine
ever did — because the trail is automatic rather than typed. The cascade is
computed, so a corrected opening cannot leave the following days disagreeing with
it. And because the confirm previews the real consequence, the disclosure arrives
*before* the decision rather than in a toast afterwards.

**Bad, and accepted.** The past is now genuinely mutable: "what Tuesday looked
like on Tuesday" is no longer answerable from the figures alone. It is answerable
from the amendment trail, which records both values — but reconstructing a whole
day as it originally stood means replaying amendments rather than reading a
column. This is a real loss, and it was accepted because nobody has needed that
reconstruction and everybody has needed to fix a wrong number.

Handovers are the deliberate exception, and they create the one place in the
system where two figures are *meant* to disagree. That has to be explained in
words wherever it surfaces, or it reads exactly like a bug.

**Reversible, at a cost.** The amendment trail records every edit with both
values, so the edits themselves could in principle be replayed or unwound. But
`Sale.effectiveAt`, `isCorrection` and `correctionReason` are dropped by T11's
migration, so restoring the old doctrine would mean restoring those columns and
their reads. The data to reconstruct is retained; the mechanism is not.
