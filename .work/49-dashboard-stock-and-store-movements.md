# 49 — Dashboard stock and store movement summaries

**Type:** plumbing (test-after)
**Blocked by:** 39 (Product ledger — Stock movements card summarizes the
same data), 42 (Store ledger — Store movements card summarizes the same
data)
**Status:** done

**Claimed:** Claude Code — 2026-08-12.

## Goal

Replace the Dashboard's "Stock movements" and "Restaurant store" cards'
`SectionNotBuilt` placeholders with today's summary — the last two
placeholder cards on the Dashboard, completing the screen.

## Context

- Design precedent: `~/prosper-hotel-design-reference/src/components/design/dashboard/sections.tsx`'s
  `StockMovements` (today's movements by reason and location, wasted/
  consumed/given-away highlighted) and `StoreMovements` (per-ingredient
  received/to-kitchen/to-canteen/closing, restaurant only per its
  "Restaurant store" title).
- Current placeholders: `src/app/dashboard/dashboard-body.tsx`'s "Stock
  movements" and "Store movements" `Card`s — swap `SectionNotBuilt`,
  position/chrome already locked.
- **This is a thin summary over already-built logic, not new
  calculation.** `StockMovements` is today's slice of ticket 39's
  `getProductLedger` (grouped by reason instead of by product); `Store
  Movements` is today's slice of ticket 42's `getStoreLedger`. Reuse
  those functions' underlying data rather than re-querying
  `StockMovement`/`IngredientMovement` directly — if today's-slice
  grouping-by-reason isn't a shape either function already returns,
  add the narrowest possible new function/parameter rather than
  duplicating the query logic.
- Both cards link to "Open the ledger" (matching the reference) — wire
  that link to `/ledger` with today's period and the relevant tab
  pre-selected, reusing whatever query-param convention the Ledger shell
  (ticket 38) already established for its period picker, if any; a plain
  link to `/ledger` is an acceptable fallback if no such convention
  exists yet.

## Scope

**In:**
- "Stock movements" card: today's product movements grouped by reason
  (produced, received, transferred in/out, sold, wasted, consumed,
  given-away) and location, with wasted/consumed/given-away visually
  flagged (danger tone), matching the reference.
- "Store movements" card: today's per-ingredient received/issued-to-
  kitchen/transferred-to-canteen/closing quantities, restaurant only.
- "Open the ledger" links on both cards.
- Loading, empty (no movements today), and error states.

**Out:**
- Any period other than today — these are Dashboard "at a glance" cards;
  history browsing is the Ledger's job (already built).
- Canteen store movements — the reference's card is explicitly
  restaurant-only ("Restaurant store" title); canteen's ingredient-
  equivalent movements, if any, are out of scope here.

## Acceptance criteria

- [x] "Stock movements" shows today's movements grouped by reason and
      location, reconciling with ticket 39's Product ledger for the same
      day, for a constructed fixture.
- [x] Wasted/consumed/given-away rows are visually flagged, matching the
      reference's danger tone.
- [x] "Store movements" shows today's per-ingredient flow, reconciling
      with ticket 42's Store ledger for the same day.
- [x] Both cards' "Open the ledger" links navigate to the Ledger — plain
      link to `/ledger` (no query-param convention exists yet in the
      Ledger shell for period/tab; confirmed by reading `ledger-shell.tsx`,
      which manages preset/tab as local `useState`, not URL params — the
      ticket's documented fallback).
- [x] Empty state (no movements today) and error state are present for
      both cards.
- [x] Owner-only, same gate as the rest of the Dashboard.
- [x] Storybook stories for both cards: populated, empty, loading, error
      (plus denied, matching the DashboardExceptions precedent).

## Verification

- Integration tests, test-after (composition over tickets 39/42's
  already-tested logic, narrowed to today): both cards' data reconciling
  with the corresponding Ledger tab's figures for the same day, against a
  constructed fixture.
- `pnpm lint`, `pnpm exec tsc --noEmit`.
- Manual check against `references/ui-rules.md`.
- Update `docs/screens.md` only if the story files' states materially
  change (no new destination to add).
