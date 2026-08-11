# 24 — Count-derived sales (canteen)

**Type:** logic (test-first)
**Blocked by:** 21 (transfer — the formula subtracts "transferred out"
and adds "transferred in," which only exist as movements once 21 lands),
23 (takings — this ticket's item-detail is what the daily takings figure
is checked against in a later stage, and both need to exist for the
canteen's revenue/cost story to be demoable together, though the
computation itself only strictly needs 21 and the existing sale/count
machinery)
**Status:** done

## What this delivers

CONTEXT.md's `Stock Movement` reason `Sold, derived`: "established at a
count rather than recorded at the moment of sale... used at the
canteen." formulas.md §2's second formula:

```
sold = previous count + received + transferred in
     − recorded credit sales − wasted − consumed − given away − transferred out
     − this count
```

Extends the existing stock count (ticket 20, generic expected-vs-counted)
at the canteen specifically: when a count is taken there, work out what
sold since the previous count and write it as a `sold_derived` movement,
distinguishable from `sold` and from `corrected` so no report mistakes an
inference for an observation or a count disagreement for a sale.

This is the canteen's only source of item-by-item trading detail — its
revenue is known daily (takings), but *what* sold is only known at a
count.

## Context

- Relevant module: `src/modules/stock/` (extends ticket 20's
  `recordStockCount`).
- `StockMovementReason` needs a new value: `sold_derived` (does not yet
  exist in `prisma/schema.prisma`'s enum — check the exact name isn't
  already spoken for elsewhere before adding, per CLAUDE.md's naming
  rule).
- formulas.md §2 (full worked reasoning), §6 "The canteen — two parts"
  (cooked food counted daily vs. own goods counted periodically — this
  ticket's formula applies to both, the difference is only how often a
  count happens, not the mechanic).
- Precedent: `recordStockCount` / `getLatestStockCount` /
  `correctStockCount` in `src/modules/stock/logic.ts` — this ticket adds
  a new function alongside them rather than modifying their existing
  behaviour (ticket 20's restaurant-count flow must be unaffected).
- Sales: `listTodaysSalesForStaff` / credit-sale filtering in
  `src/modules/sales/index.ts` for "recorded credit sales" — only
  credit sales are individually recorded at the canteen (CONTEXT.md's
  Sale entry), so this is the only sales-module read this ticket needs.
- Transfers: ticket 21's `recordTransfer` movements (reason
  `transferred`) are what "transferred in"/"transferred out" read from.

## Scope

**In:**
- Add `sold_derived` to `StockMovementReason` (product family only —
  CONTEXT.md is explicit this reason is for products moving via
  inference; ingredients are not sold, so `IngredientMovementReason`
  does not need it — confirm this asymmetry against the existing enum
  split before assuming).
- A function that, given a new canteen stock count and the
  previous count at that location (or none, for the first-ever count —
  formulas.md's "first period has no measured rate" caveat, handle
  gracefully rather than erroring), computes per-item:
  `sold = previous count + received + transferred in − credit sales
  − wasted − consumed − given away − transferred out − this count`,
  reading the other movement reasons already recorded in the period
  between the two counts.
- Writes one `sold_derived` movement per item where the computed
  quantity is non-zero, valued at selling price (this is a Product
  movement, so it carries sales value like `sold` does).
- Extends the existing count-result screen (ticket 20) with a
  "since last count" item-detail section when the count being viewed is
  at the canteen: item, quantity derived-sold, revenue at selling price.
  Not a new nav link.
- Handles the first-count case (no previous count to compare against) by
  showing the detail as unavailable/not yet computable, per formulas.md's
  explicit caveat, rather than computing against a false baseline of
  zero.

**Out:**
- The cost side of this (formulas.md §6's own-goods cost-estimate rate,
  and the correction-shown-not-applied-quietly reconciliation) — ticket
  25.
- Any UI beyond extending ticket 20's existing count-result screen.
- Applying this to the restaurant (restaurant sales are always recorded
  individually — `sold_derived` is canteen-only by construction, since
  the restaurant has no gap between "recorded" and "counted").

## Acceptance criteria

- [x] `sold_derived` exists on `StockMovementReason`.
- [x] Given a canteen count and a prior count, the derived-sold quantity
      per item matches formulas.md §2's formula exactly, verified
      against the doc's own worked reasoning style (construct an
      equivalent worked example in the test).
- [x] Credit sales recorded in the period are subtracted (read from
      `sales`, filtered to non-void credit lines at that location in the
      period between the two counts).
- [x] Transferred in/out, wasted, consumed, given away are each read
      from their respective existing movement reasons in the period and
      applied with the correct sign.
- [x] A `sold_derived` movement is written per item with non-zero
      derived quantity, valued at the product's selling price.
- [x] First-ever count at a location produces no derived-sold detail
      (nothing to compare against) rather than a wrong zero-baseline
      figure.
- [x] `getCurrentStockAtLocation` includes `sold_derived` in its sum
      like any other movement.
- [x] **Screen:** ticket 20's count-result view gains a "since last
      count" item-detail table when the count is at the canteen; absent
      or clearly labelled unavailable for a first count or a restaurant
      count.
- [x] Storybook: extend ticket 20's count-result story with a
      canteen-with-detail variant and a canteen-first-count variant.

## Verification

- Integration tests, test-first: the formula against a constructed
  scenario covering every term (previous count, received, transferred
  in/out, credit sales, wasted/consumed/given-away, this count),
  first-count handling, non-zero-only movement writing.
- `pnpm lint`, `pnpm exec tsc --noEmit`.
- Manual check against `references/ui-rules.md` for the extended screen.
- Update `docs/screens.md`'s Stock section if the story file/name
  changes.
