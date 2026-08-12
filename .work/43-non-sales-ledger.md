# 43 — Non-sales ledger

**Type:** logic (test-first)
**Blocked by:** 38 (needs the Ledger shell to host this tab in — already
built and merged)
**Status:** in-progress (claimed by build session, 2026-08-12 13:08)

## Goal

Make the Ledger's Non-sales tab real: one row per wastage/staff-meal/
complimentary entry in the selected period, valued at cost and at selling
price, completing proposal.md §10.5's "stock that was not sold" report as
a browsable line-level record rather than the single total ticket 38's
waterfall already shows.

## Context

- Design precedent: `~/prosper-hotel-design-reference/src/components/design/ledger/tables.tsx`'s
  `NonSalesLedgerTable` — one row per entry (item, date, location, reason
  badge, qty, at-cost, at-selling-price, recorded-by), reason filter
  (wasted/staff meals/complimentary), search by item or person, a totals
  footer row, and a caption clarifying these amounts aren't deducted from
  profit a second time.
- **This is mostly a query, not new valuation logic** —
  `StockMovement.costBasisMinor`/`sellingValueMinor`/`isEstimated` are
  already snapshotted at record time for `wasted`/`consumed`/
  `given_away` movements (ticket 15), per `prisma/schema.prisma`'s
  comment: "populated only for wasted/consumed/given_away... snapshotted
  at record time... a later price/cost change never reshapes a past
  entry." Read those columns directly rather than re-deriving cost via
  `resolveProductCostBasis` — the snapshot is the source of truth for a
  historical entry, current cost is not.
- `stock`'s existing `getNonSalesConsumptionValue` /
  `sumNonSalesValueAtLocationInPeriod` return only a period total, not
  line-level rows — this ticket needs a new line-level query alongside
  (or instead of) that aggregate; check whether the aggregate can be
  derived by summing this ticket's new line-level rows instead of kept as
  a separate code path, to avoid the two ever disagreeing.
- `staffMemberId` on `StockMovement` is who recorded the entry — join
  through `people` for the display name, per the module-boundary rule
  (`people`'s `index.ts` only).
- Ingredient-side non-sales entries (`IngredientMovement`'s
  wasted/consumed/given_away) — check whether ticket 15's wastage
  recording covers ingredients as well as products; if so, this ledger's
  "item" column spans both, matching the reference's single item column.

## Scope

**In:**
- A `getNonSalesLedger` reporting function: given a period and optional
  location/reason filters, returns one row per wastage/consumption/
  complimentary entry — item, date, location, reason, quantity, cost-basis
  value (with an "estimated" flag where `isEstimated` is true), selling
  value, recorded-by.
- Route + wiring the Non-sales ledger tab in the Ledger shell to this real
  data, replacing its placeholder state.
- Reason filter, search by item/recorded-by, totals footer row, matching
  the reference.
- The "not deducted from profit twice" caption, matching the reference
  and proposal.md §10.5's own wording.

**Out:**
- Product, Store, Cash ledgers — other tickets.
- Editing or reversing a non-sales entry from this view — read-only,
  same-day void (ticket 10/28's existing mechanism) is the correction
  path, not this report.

## Acceptance criteria

- [ ] Every wasted/consumed/given-away entry in the period appears as one
      row, valued using its own snapshotted cost/selling values (not a
      recomputed current value), for a constructed fixture spanning both
      products and ingredients (if ingredient wastage exists) and all
      three reasons.
- [ ] Entries valued at the 60%-of-selling-price estimate (no recipe) are
      marked as estimated in the UI, matching the reference's "est"
      indicator.
- [ ] The totals footer sums exactly what the filtered rows show — "N of
      M" style, filtering changes the total, not just the row count.
- [ ] Filtering by reason and searching by item/person combine (AND) and
      narrow correctly.
- [ ] Non-owner roles cannot reach this data (route-level check, same
      gate as the rest of `reporting`).
- [ ] Storybook story: populated table with all three reasons, an
      estimated-cost row, empty, filtered-empty, loading.

## Verification

- Integration tests, test-first: `getNonSalesLedger` against constructed
  fixtures covering each reason, a recipe-costed entry, an estimated
  entry, and (if applicable) an ingredient-side entry — checking the
  line-level total reconciles with `getNonSalesConsumptionValue`'s
  existing aggregate for the same period.
- `pnpm lint`, `pnpm exec tsc --noEmit`.
- Manual check against `references/ui-rules.md`.
- Add the story to `docs/screens.md`'s Reporting section.
