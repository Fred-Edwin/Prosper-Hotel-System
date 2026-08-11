# 23 — Record daily takings (canteen)

**Type:** logic (test-first)
**Blocked by:** None (a standalone record type; does not read from
transfers, receiving, or counts)
**Status:** done

## What this delivers

The `takings` staff-nav placeholder (currently `NotBuilt`) becomes real.
proposal.md §4: "at the close of each day the attendant records two
figures: the day's cash total and the day's M-Pesa total." CONTEXT.md's
`Takings`: "The money a Location took on one day, recorded as two
totals — cash and M-Pesa — without a line-by-line record of what was
sold... Takings are what a Handover is checked against."

This is the canteen's structural substitute for the restaurant's
per-sale recording (ticket 07) — CONTEXT.md is explicit the canteen
"cannot record sales as they happen," so takings is not a summary of
individually-recorded sales the way the restaurant's Today's sales
(ticket 09) is. It is its own directly-entered record.

## Context

- Relevant module: `src/modules/cash/` (Takings sits alongside Handover
  as what a handover is checked against — CONTEXT.md places both under
  cash-adjacent concepts) — confirm this module placement against
  `docs/architecture.md`'s ownership table before starting; if
  architecture.md instead assigns Takings to `sales` (the canteen's
  substitute for a recorded sale), follow the doc, not this ticket's
  guess.
- Precedent: `recordHandover` in `src/modules/cash/logic.ts` — same-day
  upsert pattern (`findTodaysHandover` / `updateHandoverActuals`),
  `dayBounds()` helper, cash/M-Pesa kept as separate fields throughout.
- CONTEXT.md's `Takings` and `Handover` entries; formulas.md §10
  ("At the canteen, expected is the takings the attendant declared at
  close").
- Nav: `takings` already exists as a reserved link in
  `src/components/layout/staff-nav.ts`'s attendant array — no nav
  change needed, only the screen behind it.
- Location: canteen-only per proposal.md's structure, but gate by
  `canAccessLocation()` the normal way rather than hardcoding — the
  owner must be able to record/view it too, and the restaurant simply
  never uses this screen (nav already reflects that: `takings` is only
  in the attendant array, not store-manager's).

## Scope

**In:**
- A `recordTakings` logic function: `{ locationId, cashMinor,
  mpesaMinor }`, one record per location per day, editable same-day
  (mirrors `recordHandover`'s upsert-if-exists-today behaviour — a
  miscount corrected by re-entry, not a reversing entry, same reasoning
  ticket 13 already applied to handover actuals).
- Rejects negative amounts.
- `canAccessLocation()` gate, same as every other location-scoped write.
- A read of today's takings (or the most recently recorded, if none
  today) for the requester's location.
- Screen behind the existing `takings` nav link: two amount fields (cash,
  M-Pesa), confirm, then a read view showing what was recorded — editable
  same-day (re-opens the form pre-filled, same UX precedent as ticket
  13's handover-actuals edit).

**Out:**
- The expected-cash/handover check itself (Stage 5 — this ticket only
  makes the declared figure recordable; ticket 13's restaurant-only
  handover is not extended to read this yet, since Stage 5 owns that
  wiring per `docs/roadmap.md`).
- Count-derived item detail / cost (ticket 24/25) — takings is revenue
  only, no item-level breakdown.
- Historical takings list beyond "today's" / "most recent" (a reporting
  concern, Stage 8).

## Acceptance criteria

- [ ] `recordTakings` creates a takings record for a location and day
      with separate cash and M-Pesa totals.
- [ ] A second call the same day, same location, updates the existing
      record rather than creating a duplicate (same upsert pattern as
      `recordHandover`).
- [ ] Rejected: negative cash or M-Pesa amount.
- [ ] `canAccessLocation()` gates read and write.
- [ ] **Screen:** the `takings` nav placeholder becomes real — cash
      amount, M-Pesa amount, confirm; a read view of today's recorded
      takings; re-entry same day edits in place.
- [ ] Empty (nothing recorded yet today), loading, error, and
      permission-denied states via `components/patterns/states.tsx`.
- [ ] Storybook story covers: empty state, entry form, recorded/read
      state, same-day edit.

## Verification

- Integration tests, test-first: upsert-same-day behaviour, negative
  rejection, location gating.
- `pnpm lint`, `pnpm exec tsc --noEmit`.
- Manual check against `references/ui-rules.md`.
- Add the new story to `docs/screens.md` under the module it actually
  lands in.
