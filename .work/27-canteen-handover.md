# 27 — Canteen handover check

**Type:** logic (test-first)
**Blocked by:** 23 (takings — the canteen's expected figure comes from
the day's declared takings, not summed sales; this ticket cannot exist
until that figure is recordable)
**Status:** planned

## Goal

Make the `handover` screen real at the canteen — today the `attendant`
role's nav already links to `handover` (`staff-nav.ts` line 131), but
ticket 13 built that screen restaurant-only and explicitly deferred the
canteen half ("Canteen is explicitly out of scope — its expected figure
comes from Takings, Stage 4, not built"). Takings (ticket 23) is now
built, so the canteen's expected figure exists and this gap can close.

## Context

- Relevant module: `src/modules/cash/logic.ts` — `recordHandover`,
  `getTodaysHandoverForStaff`, `dayBounds()` (restaurant precedent,
  ticket 13) and `getTodaysTakingsForStaff` / `getTakingsAtLocation`
  (canteen data, ticket 23) already live in this same module — no new
  cross-module read needed.
- proposal.md §5's Canteen subsection (lines 193–205): expected amount
  is "the takings recorded by the attendant at close," not a sum of
  individual sales — this is a materially different expected-amount
  source than the restaurant's, not just a different location filter.
  M-Pesa is described as "a real check" (verifiable against payment
  messages); cash is explicitly "a weaker check... confirms she handed
  over what she declared, not that she declared everything she took" —
  copy on the canteen result view should reflect this distinction, not
  present both figures as equally strong the way the restaurant's do.
- formulas.md §10 confirms the same: "At the canteen, expected is the
  takings the attendant declared at close."
- `src/modules/cash/ui/handover.tsx` (ticket 13's screen) — this ticket
  extends it to branch on location rather than building a parallel
  screen, since the shape (expected vs. actual, cash/M-Pesa separately,
  same-day edit) is otherwise identical.
- Credit sales are excluded from the handover check at both locations
  (proposal.md §5) — already true for canteen by construction, since
  Takings never includes credit (ticket 23's scope) and ticket 26's
  canteen credit sales are recorded separately from Takings.

## Scope

**In:**
- `recordHandover`'s expected-amount computation branches by location:
  restaurant reads summed sales (ticket 13's existing behaviour,
  unchanged); canteen reads that day's `Takings` record
  (`getTodaysTakingsForStaff`/`getTakingsAtLocation`) as the expected
  cash and expected M-Pesa figures directly.
- If no takings have been recorded yet today at the canteen, expected is
  treated as zero/unavailable with a clear "record today's takings
  first" state, rather than silently comparing against zero as if that
  were a real expected figure (mirrors ticket 24's first-count-caveat
  reasoning: don't compute against a false baseline).
- Same-day upsert/edit behaviour, identical to ticket 13's restaurant
  rule (no special permission, editable same day, owner-only-after-close
  deferred the same way ticket 13 deferred it — "closed day" still
  isn't a real state).
- Extend `handover.tsx`'s screen to show the canteen's weaker-cash-check
  framing (proposal.md §5) somewhere in the result view when at the
  canteen — a one-line note, not a new component.
- `canAccessLocation()` gates recording, same pattern as every other
  location-scoped write.

**Out:**
- Amending a closed day / any "closed day" state — that's the harder
  half of proposal.md §8, still blocked on a real "closed" concept that
  doesn't exist yet (per ticket 13's own deferral, unchanged by this
  ticket).
- The stock-count cross-check ("the weekly stock count provides the
  corresponding check on cash," proposal.md §5) — that's a reporting-
  level correlation across ticket 24's derived-sales data and this
  ticket's handover data, not something this ticket computes or
  displays.
- Any dashboard/owner cross-person view — ticket 14 already covers
  restaurant; extending it to canteen, if wanted, is a follow-on, not
  bundled here (keeps this ticket to the attendant's own recording flow,
  matching ticket 13's original cut).

## Acceptance criteria

- [ ] At the canteen, `recordHandover`'s expected cash/M-Pesa equal that
      day's recorded Takings cash/M-Pesa exactly (not summed sales).
- [ ] At the restaurant, behaviour is byte-for-byte unchanged from
      ticket 13 (existing tests must still pass unmodified).
- [ ] Canteen handover attempted before today's takings are recorded
      shows an explicit "record takings first" state rather than an
      expected figure of zero.
- [ ] Same-day edit of actual amounts works identically to ticket 13's
      restaurant rule.
- [ ] `canAccessLocation()` gates read and write at the canteen the same
      way it already does at the restaurant.
- [ ] **Screen:** `handover.tsx` renders correctly for the canteen
      (expected from takings, weaker-cash-check note) without
      regressing the restaurant's existing rendering.
- [ ] Storybook: extend `handover.stories.tsx` with canteen variants
      (agreed, short, over, takings-not-yet-recorded).

## Verification

- Integration tests, test-first: canteen expected-amount computation
  against a constructed takings record, the no-takings-yet case,
  restaurant behaviour unchanged (regression), same-day edit at the
  canteen.
- `pnpm lint`, `pnpm exec tsc --noEmit`.
- Manual check against `references/ui-rules.md` for the extended screen.
- Confirm `docs/screens.md`'s Cash section entry for
  `Modules/Cash/Handover` still points at the same story file (no rename
  expected, since this extends rather than replaces it).
