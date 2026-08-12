# 46 — Profit by day, week, month, and per location

**Type:** logic (test-first)
**Blocked by:** None (extends `reporting`'s existing `getDashboardProfit`
and the Dashboard's Profit panel, both already built)
**Status:** in-progress (claimed by /build, 2026-08-12)

## Goal

Complete proposal.md §7's "Profitability. By day, week or month, per
location and for the business as a whole" — the Dashboard's Profit panel
already has Day/Week/Month tabs in its markup, but they don't switch the
period, and every figure shown is combined-business-total only, never
per-location.

## Context

- `src/modules/reporting/ui/dashboard-profit.tsx`'s `Tabs` (`<TabsList>`
  with Day/Week/Month `TabsTrigger`s, around line 212) is currently inert
  — `defaultValue="day"` with no `onValueChange`, no state, always
  fetching today's figures via `/api/dashboard/profit`. This ticket wires
  it up rather than replacing it.
- `reporting`'s `getDashboardProfit` (`src/modules/reporting/logic.ts`)
  already takes `{ dayStart, dayEnd }` — check whether it's already
  period-agnostic (ticket 38 generalized `getLedgerSummary` from a
  day-shaped input to an arbitrary period; this function may need the
  same treatment, or may already support it if 38's generalization
  touched shared internals — read both before assuming new work is
  needed) — and currently returns one combined `revenue`/`costOfGoods`
  object, not split by location.
- **Per-location profit is the actual gap.** proposal.md's own worked
  example (§10.3) shows profit as one whole-business figure, but §7
  explicitly asks for "per location and for the business as a whole" —
  `computeRestaurantCostOfGoods` and `computeCanteenCostOfGoods` already
  compute each location's cost of goods separately (that's how the
  combined total is built today); this ticket's real work is exposing
  that existing per-location split in the result and the UI, not
  recomputing anything new.
- **Canteen figures are provisional for any period that includes time
  since the last count** (§10.4) — the existing `correction`/
  `canteenCostRate`/`lastCanteenCount` provisional-marking already in
  `DashboardProfitResult` must still apply per period, not just for
  "today".
- Week/month period boundaries — use ISO week (Monday start) and
  calendar month unless `docs/conventions.md` already states a
  convention elsewhere; confirm with Edwinfred if genuinely ambiguous
  rather than guessing silently.

## Scope

**In:**
- Extend `getDashboardProfit` (or add a sibling function reusing its
  internals) to accept an arbitrary period and return revenue/cost-of-
  goods/gross-profit/net-profit both combined and split by location
  (restaurant, canteen).
- Wire the Dashboard Profit panel's Day/Week/Month tabs to actually
  refetch and display the selected period's figures.
- Add a location toggle/split to the Profit panel — combined view
  (existing default) plus the ability to see restaurant-only or
  canteen-only figures, reusing the panel's existing waterfall/expandable-
  detail shape rather than inventing a new component.
- Provisional marking (canteen own-goods estimate, count correction)
  carries over correctly for week/month periods, same visual treatment
  as today's day view.

**Out:**
- A dedicated Profit destination/screen beyond the Dashboard panel —
  proposal.md §7 doesn't ask for a separate page, and the Ledger (ticket
  38) already gives a period-scoped cost-of-goods-sold view; this ticket
  only completes the Dashboard's own panel.
- Custom/arbitrary date-range picker beyond day/week/month — not asked
  for by the existing tab set; if Edwinfred wants a custom range later
  it's a small follow-on, not silently added here.
- Any change to `getLedgerSummary` or the Ledger screens (tickets 38-43)
  — this ticket only touches the Dashboard's Profit panel and its
  backing function.

## Acceptance criteria

- [ ] Selecting Week or Month on the Profit panel refetches and displays
      that period's figures — verified against a constructed fixture
      spanning more than one day with different revenue/cost each day.
- [ ] Combined and per-location (restaurant/canteen) profit figures are
      both correct and reconcile: restaurant + canteen = combined, for a
      constructed multi-location, multi-day fixture.
- [ ] Canteen's own-goods cost portion remains marked provisional at
      every period length, with the correct "since last count" framing
      when the period spans a count.
- [ ] Non-owner roles remain denied, unchanged from the existing gate.
- [ ] Switching period preserves whichever detail term was expanded
      (or resets cleanly — pick one, document the choice, don't leave it
      inconsistent).
- [ ] Storybook story: the existing `dashboard-profit.stories.tsx` gains
      Week/Month variants and a per-location view, rather than a new
      story file.

## Verification

- Integration tests, test-first: `getDashboardProfit`'s period
  generalization and per-location split against constructed fixtures
  covering a day, a week, and a month, checking restaurant + canteen
  reconciles to the combined total and provisional marking is correct at
  each period length.
- `pnpm lint`, `pnpm exec tsc --noEmit`.
- Manual check against `references/ui-rules.md`.
- Update `docs/screens.md` only if the story file's states materially
  change (no new destination to add).
