# 54 — Overselling guard on sales

**Type:** logic (test-first)
**Blocked by:** 53 (needs the sellable-at-location product set and its
`quantityOnHand` data to show/check against)
**Status:** planned

## Goal

New Sale shows on-hand quantity per product and the backend rejects a
sale line that exceeds it, closing BUG-15.

## Context

- Relevant modules: `src/modules/sales/logic.ts`
  (`priceAndCreateSale`/`recordCounterSale`), `src/modules/stock/logic.ts`
  (the guard pattern to mirror), `src/modules/sales/ui/new-sale.tsx`.
- `docs/bugs.md` BUG-15 — full description of both gaps this closes (no
  UX signal, no backend check). Read in full; it lays out the exact
  contrast with `recordTransfer`'s correct existing pattern.
- The pattern to mirror: `recordTransfers`
  (`src/modules/stock/logic.ts:437-541`) — inside a `db.$transaction`,
  sums existing movements at the source location per line, returns
  `{ ok: false, reason: "insufficient_stock" }` before writing anything
  if any line is short. `priceAndCreateSale` currently writes the sale
  record and stock movements with no such check and no surrounding
  transaction (`sales/logic.ts:61-160`).
- Visual precedent for the soft signal: `admin-stock-table.tsx`'s
  `isLow`/`TriangleAlert` low-stock badge pattern.
- Ticket 53's new sellable-at-location function already returns
  `quantityOnHand` per item (same shape `getTransferableItems` uses) —
  reuse that data for the tile display rather than a second fetch.

## Scope

**In:**
- `priceAndCreateSale` (`sales/logic.ts`) wrapped in a `db.$transaction`
  together with its `recordStockMovement` calls; before writing
  anything, sums current stock per product line at the sale's location
  and returns `{ ok: false, reason: "insufficient_stock", productId,
  available }` (or equivalent) if any line's requested quantity exceeds
  what's on hand.
- `new-sale.tsx` shows on-hand quantity per product tile, reusing the
  existing low-stock visual pattern; a quantity stepper cannot be pushed
  above what's available for that product.
- On a rejected sale, the UI surfaces an inline error naming the
  specific item and quantity available — not a generic failure message
  (the class of problem BUG-04 already flagged once).

**Out:**
- Ingredient-level overselling — ingredients aren't sold directly, only
  consumed via production/issuing, which already have their own checks
  where relevant; not this ticket's concern.
- Any change to `recordTransfer`'s existing guard — it's already
  correct, only referenced here as the pattern to mirror.
- Race-condition handling beyond what the transaction already gives
  (e.g. no optimistic-locking/retry layer) — Postgres's transaction
  isolation is sufficient for this business's real concurrency, per
  `docs/architecture.md`'s non-functionals section (five users, a few
  hundred sales a day).

## Acceptance criteria

- [ ] A sale line requesting more than current on-hand stock at the
      sale's location is rejected before any sale or stock-movement
      record is written — verified by checking no rows exist after a
      rejected attempt, not just that the response was an error.
- [ ] The rejection reason identifies which product and how much is
      actually available.
- [ ] New Sale shows on-hand quantity per tile; attempting to increase a
      line's quantity past that amount is prevented in the UI, and if
      bypassed (direct API call), the backend still rejects it.
- [ ] A sale within available stock succeeds exactly as before — no
      regression to the existing happy path, credit sales, or delivery
      fulfilment.
- [ ] Storybook: `new-sale.tsx`'s story gains a low/at-limit-stock tile
      state and an insufficient-stock inline error state.

## Verification

- Integration tests, test-first: a sale line within stock succeeds; a
  sale line exceeding stock is rejected with no rows written; a
  multi-line sale where only one line is short rejects the whole sale
  (all-or-nothing, matching `recordTransfers`' batch behavior); a
  canteen no-payment-line sale still gets the same stock check as a
  restaurant sale (the check is location-agnostic, payment-line
  presence is unrelated).
- `pnpm lint`, `pnpm exec tsc --noEmit`.
- Manual check against `references/ui-rules.md` for the new inline error
  and tile-quantity display.
- Update `docs/bugs.md`: mark BUG-15 fixed, referencing this ticket.
