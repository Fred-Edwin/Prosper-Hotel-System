# 30 — Cancellations visible wherever a closed day's activity is shown

**Type:** plumbing (test-after)
**Blocked by:** 28 (day-close state — a cancellation only needs special
handling once post-close cancellation is even possible; before that,
same-day void already displays correctly per ticket 10)
**Status:** planned

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

- [ ] Today's Sales: void badge/dimming confirmed correct for a sale
      voided by the owner after that day closed for the recorder
      (post-ticket-28 case), not just the pre-28 same-day case.
- [ ] Money-out: a reversed expense is visibly marked (badge + dimmed
      row, matching Today's Sales' pattern) rather than silently absent
      from the list — implement only if the audit confirms this is
      currently missing.
- [ ] Stock count detail: a corrected count line is visibly distinguished
      from an uncorrected one — implement only if the audit finds this
      isn't already true.
- [ ] Handover and Takings: confirmed to have no cancellation state to
      surface (edit-in-place design) — documented in this ticket's
      completion notes as "no change needed," not silently skipped.
- [ ] No new logic, routes, or schema changes — this ticket touches
      `ui/` files only.

## Verification

- No new integration tests required (Type: plumbing, no new logic) —
  existing tests for void/reverse/correction continue to pass unchanged.
- `pnpm lint`, `pnpm exec tsc --noEmit`.
- Manual check against `references/ui-rules.md` for every screen touched.
- Update the relevant Storybook stories (money-out, stock-count-detail)
  with a cancelled/corrected-entry variant wherever one is added.
