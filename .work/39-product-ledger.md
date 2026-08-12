# 39 — Product ledger

**Type:** logic (test-first)
**Blocked by:** 38 (needs the Ledger shell and its period picker to host
this tab in)
**Status:** planned

## Goal

Make the Ledger's Product tab real: one row per product, opening/in/out/
closing quantities and values for the selected period, expandable to
daily detail, matching proposal.md §9's "for any item on any date" stock
history requirement.

## Context

- Design precedent: `~/prosper-hotel-design-reference/src/components/design/ledger/tables.tsx`'s
  `ProductLedgerTable` — the exact column set (opening qty/value, in:
  produced/received/transferred-in, out: sold/transferred-out/non-sales,
  money: sales value/unit cost/price/cost of sales/profit, closing
  qty/value), search, location filter, category filter, day-expansion
  with the spine/recessive-child treatment `docs/design.md` describes.
- Data sources already built, per-product, by reason, at a location, over
  a period: `stock`'s `sumMovementsByProductReasonAtLocationInPeriod` /
  `getProductMovementByReasonInPeriod` (check both — one may be the
  `queries.ts` primitive the other's `logic.ts` wrapper calls) — reuse
  rather than re-querying `StockMovement` directly, per this project's
  `queries.ts`/`logic.ts` split.
- Stock movement reasons in play: `produced`, `received`,
  `transferred` (in/out depending on location), `sold`, `wasted`,
  `consumed`, `given-away`, and count corrections — check
  `prisma/schema.prisma`'s `MovementReason` enum for the authoritative
  list rather than assuming the reference's fixture reasons are complete.
- Unit cost / cost of sales / profit: reuse ticket 37's
  `resolveProductCostBasis` (real cost → recipe cost → 60% estimate) —
  don't re-derive.
- Opening/closing stock value at a location as of a date: `stock`'s
  `getIngredientStockValueAtLocation` is ingredient-shaped; check whether
  an equivalent product-level function exists or needs adding here (this
  ticket's likely real logic work, hence test-first).
- `docs/design.md`'s Ledgers and tables section — one row per subject per
  period (not per movement), day-expansion for investigation, frozen
  first column, "N of M" counts when filtered.

## Scope

**In:**
- A `getProductLedger` reporting function: given a period and optional
  location/category filters, returns one row per product (per location —
  "product rows split by location" per `docs/design.md`) with opening
  qty/value, produced/received/transferred-in, sold/transferred-out/
  non-sales, sales value, unit cost, selling price, cost of sales,
  profit (null where cost basis is unknown — no recipe, no recorded
  cost), closing qty/value, and a day-by-day breakdown for expansion.
- Route + wiring the Product ledger tab in the Ledger shell (ticket 38)
  to this real data, replacing its placeholder state.
- Search (by product name), location filter, category filter, matching
  the reference's toolbar.
- Day-expansion showing the same columns per day within the period.

**Out:**
- Store, Non-sales, Cash ledgers — other tickets.
- Editing/correcting entries from this view — read-only, per proposal.md
  §7's reporting framing. Corrections are Stage 8's separate
  amending-a-closed-day ticket.

## Acceptance criteria

- [ ] Product ledger row's quantities reconcile: opening + in − out =
      closing, for a constructed multi-day fixture with produced,
      received, transferred, sold, and wasted movements.
- [ ] A product with no recipe and no recorded cost shows profit as
      unavailable (not zero, not a guess) — matches the reference's "no
      recipe — per-unit cost unknown" treatment.
- [ ] Filtering by location shows only that location's rows; the same
      product at both locations appears as two separate rows.
- [ ] Filtering by category and searching by name both narrow correctly
      and combine (AND, not OR).
- [ ] Expanding a row shows its per-day breakdown for the selected
      period, and collapses back on second click.
- [ ] Empty state (no movements for any product in this period) and
      filtered-empty state (filters narrow to zero rows) are visually
      distinct, per `components/patterns/states.tsx`.
- [ ] Non-owner roles cannot reach this data (route-level check, same
      gate as the rest of `reporting`).
- [ ] Storybook story: populated table, row expanded, empty, filtered-
      empty, loading.

## Verification

- Integration tests, test-first: `getProductLedger` against constructed
  fixtures covering each movement reason, both locations, a product with
  a recipe, a product with only a recorded cost, a product with neither,
  and the day-expansion breakdown.
- `pnpm lint`, `pnpm exec tsc --noEmit`.
- Manual check against `references/ui-rules.md`.
- Add the story to `docs/screens.md`'s Reporting section.
