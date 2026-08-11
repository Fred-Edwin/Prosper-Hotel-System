# 18 — Issuing ingredients to the kitchen

**Type:** logic (test-first)
**Blocked by:** None (`stock`'s ingredient ledger and `received` reason
already exist from tickets 12/15; this ticket adds a sibling reason the
same way ticket 15 added `consumed`/`given_away`)
**Status:** done

## What this delivers

The `issue` staff-nav placeholder (currently `NotBuilt`) becomes real.
proposal.md §3: "Ingredients taken by the kitchen are recorded and
deducted from the store." This is the first of two remaining Stage 3
verbs (the other is production, ticket 19) — issuing has to exist before
production can consume from it meaningfully, so it's built first even
though the two aren't a hard data dependency of each other yet.

This is a **store movement** (CONTEXT.md's Stock Movement split) — an
ingredient leaving the store, not a product being created. Adds an
`issued` reason to `StockMovementReason`, alongside the `wasted` /
`consumed` / `given_away` / `received` / `transferred` / `sold` /
`corrected` values already there.

Role: **store manager and owner only** — same as receiving (ticket 12),
proposal.md's role table gives the store manager "issues ingredients to
the kitchen and records consumption."

## Lifecycle

No new record type — writes an `IngredientMovement` using the new
`issued` reason.

- **Create:** an entry records one or more lines (ingredient, quantity)
  issued from the recording staff member's location. Rejected if
  quantity is non-positive or the ingredient is inactive.
- **Read:** current stock reflects the reduction immediately via
  `getCurrentStockAtLocation`. No issuing-history list — same deferral
  reasoning as receiving (ticket 12) and wastage (ticket 15).
- **Update:** not allowed.
- **Delete:** not allowed.
- **Undo:** not built in this ticket — same deferral pattern as
  receiving and wastage.

## Acceptance criteria

- [ ] An entry can be recorded with one or more lines (ingredient,
      quantity), at the recording staff member's location.
- [ ] Recording an entry creates an `issued` ingredient movement per
      line, verified via `getCurrentStockAtLocation` decreasing by the
      recorded quantity.
- [ ] An entry line for an inactive ingredient is rejected.
- [ ] An entry line with non-positive quantity is rejected.
- [ ] `canAccessLocation()` gates recording, same pattern as receiving.
- [ ] Only store manager and owner roles can record an issue; a cashier
      attempting to is denied at the route, not just hidden from nav.
- [ ] **Screen:** the `issue` staff-nav placeholder becomes real —
      ingredient picker → quantity per line → confirm, mirroring
      Receiving's line-entry pattern.
- [ ] Confirmation, loading, and error states follow
      `components/patterns/states.tsx`.
- [ ] Storybook stories cover the issuing flow's states.

## Out of scope

- Production (ticket 19) — recording what the kitchen made from issued
  ingredients.
- Cost/selling-value figures on the issued movement — unlike wastage,
  issuing isn't a loss and CONTEXT.md doesn't ask for a report-facing
  valuation here; the ingredient simply relocates conceptually from
  store to kitchen. If this turns out to be wrong once production needs
  to trace cost back to specific issues, revisit then.
- An issuing-history list/screen.
- Undo of a recorded entry.
