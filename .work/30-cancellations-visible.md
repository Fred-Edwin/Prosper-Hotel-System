# 30 — Cancellations visible wherever a closed day's activity is shown

**Type:** plumbing (test-after)
**Blocked by:** 28 (day-close state — a cancellation only needs special
handling once post-close cancellation is even possible; before that,
same-day void already displays correctly per ticket 10)
**Status:** done

## Goal

proposal.md §8: "Cancellations appear on the daily summary." Confirm and
close any remaining gaps in showing a voided/cancelled entry, marked as
such, on every screen where that day's activity is visible — not hidden,
not indistinguishable from an entry that never happened.

## Context

- `src/modules/sales/ui/todays-sales.tsx` (ticket 10) **already does
  this** for sales: a voided sale shows a destructive "Voided" badge and
  a dimmed row (lines 210, 228–229) rather than disappearing. This
  ticket's job for sales is to verify this still holds correctly once
  ticket 28 allows an owner to void a sale on a day that's closed for
  everyone else — confirm the badge/dimming logic doesn't depend on an
  assumption that void only ever happens same-day.
- Handovers (`handover.tsx`) and takings (`takings.tsx`) are **edited in
  place**, not voided (ticket 13/23's explicit design: "corrected by
  re-entry, not a reversing entry... there is nothing to reverse, only a
  figure to correct"). They have no cancellation state to surface —
  confirm this reading holds before assuming there's a gap here; if so,
  no changes needed to either screen for this ticket.
- Stock counts (`stock-count-detail.tsx`, ticket 20) — a count itself
  isn't voided, but a count *line's* owner-applied correction already
  has its own display (`correctedAt`, per `prisma/schema.prisma` line
  511) via ticket 20. Confirm this already reads as "shown, not hidden"
  per proposal.md §8, or extend it minimally if not.
- Money-out / expenses (`src/modules/cash/ui/money-out-destination.tsx`)
  — `reverseExpense` exists in `cash/logic.ts` (ticket 16). Check whether
  a reversed expense is currently marked visibly in this screen the same
  way a voided sale is; this is the most likely real gap, since ticket
  16 predates ticket 10's badge pattern and may not have copied it.

## Scope

**In:**
- Audit each screen listed above against proposal.md §8's requirement;
  for any that currently hide, rather than mark, a cancelled/reversed
  entry, add the same visible-badge-plus-dimmed-row treatment
  `todays-sales.tsx` already established (reuse that pattern, don't
  invent a new one).
- Fix confirmed via manual check against `references/ui-rules.md`,
  since this is a display consistency pass, not new logic.

**Out:**
- Any new correction/amendment mechanism — this ticket only ensures
  *existing* cancellation states (void, reverse) are visible; it does
  not add new ones. Owner-initiated corrections against a closed day are
  Stage 8 (Ledger), per `docs/roadmap.md`'s Stage 5 revision note.
- A dedicated "cancellations" list/report — that's Activity (Stage 8),
  not a daily-summary concern.
- Any change to `reverseExpense`, `voidSale`, or count-correction logic
  itself — display only.

## Acceptance criteria

- [x] Today's Sales: void badge/dimming confirmed correct for a sale
      voided by the owner after that day closed for the recorder
      (post-ticket-28 case), not just the pre-28 same-day case.
- [x] Money-out: a reversed expense is visibly marked (badge + dimmed
      row, matching Today's Sales' pattern) rather than silently absent
      from the list — implement only if the audit confirms this is
      currently missing.
- [x] Stock count detail: a corrected count line is visibly distinguished
      from an uncorrected one — implement only if the audit finds this
      isn't already true.
- [x] Handover and Takings: confirmed to have no cancellation state to
      surface (edit-in-place design) — documented in this ticket's
      completion notes as "no change needed," not silently skipped.
- [x] No new logic, routes, or schema changes — this ticket touches
      `ui/` files only.

## Completion notes

Audit found every display gap the ticket speculated about already
implemented, plus one real logic bug blocking the case the ticket
asked to confirm:

- **Today's Sales** (`todays-sales.tsx`): badge (line 231–235) and
  dimmed row (line 213) key off `sale.voided` alone, with no same-day
  assumption — already correct for the post-close case. But
  `voidSale` (`sales/logic.ts`) itself had an unconditional
  `occurredAt < dayStart → not_same_day` check running *before* the
  owner bypass, so the owner could never actually void a previous-day
  sale — contradicting its own comment ("Post-close is owner-only") and
  ticket 28's intent. Flagged to Edwinfred as a scope question (ticket
  28's own cited precedent was broken); approved to fix here. Moved the
  `not_same_day` check inside the `role !== "owner"` branch, mirroring
  the existing `day_closed` bypass. Added a logic test: "the owner can
  void a sale from a previous day" (`sales.integration.test.ts`).
  Existing "voiding a sale from a previous day is rejected" test
  (non-owner) still passes unchanged.
- **Money-out** (`money-out-list.tsx`): already has a "Reversed" badge
  (line 128–134) and a dimmed/muted amount (line 111, `muted={e.reversed}`)
  — ticket 16 did copy ticket 10's pattern after all. No change needed.
- **Stock count review** (`stock-count-review.tsx`, the owner's
  comparison screen where `correctedAt` lives): a corrected line already
  shows a "Corrected" label (line 296–297) distinguishing it from an
  uncorrected disagreement. No change needed. (`stock-count-detail.tsx`,
  the staff view, never receives expected/correction data at all by
  design — not applicable here.)
- **Handover / Takings**: confirmed no void/cancel/reversed state exists
  on either screen — genuinely edit-in-place per tickets 13/23. No
  change needed.

Net result: no UI files changed. One logic fix (`sales/logic.ts`) plus
its test, approved by Edwinfred as an exception to this ticket's
"display only" scope since it blocked AC #1 from being true.

## Verification

- No new integration tests required (Type: plumbing, no new logic) —
  existing tests for void/reverse/correction continue to pass unchanged.
- `pnpm lint`, `pnpm exec tsc --noEmit`.
- Manual check against `references/ui-rules.md` for every screen touched.
- Update the relevant Storybook stories (money-out, stock-count-detail)
  with a cancelled/corrected-entry variant wherever one is added.
