# 37 — Product stock value

**Type:** logic (test-first)
**Blocked by:** None (mirrors `getIngredientStockValueAtLocation`,
already built for ticket 25 — this ticket is the product-side
equivalent)
**Status:** done

## Goal

Close the other half of proposal.md §7's "Stock on hand and its value,
by item and by location" — `stock` currently values ingredients only
(`getIngredientStockValueAtLocation`, built for ticket 25's cost-of-
goods-sold); products (the sellable goods actually on shelves/counters)
have no equivalent, so the admin Stock table shows quantities only,
never value. `admin-stock-table.tsx`'s own top comment already names
this exact gap: "Design's stock-body.tsx... is the full valuation view:
cost, value... It can't be built yet — the stock module exposes
quantities only, not per-unit cost."

## Context

- formulas.md §12: `stock value = quantity on hand × unit cost`. §4's
  cost-per-unit table applies: bought-in goods use the running average
  (§3), cooked food with a recipe uses ingredients-used ÷ yield, cooked
  food without a recipe uses the labelled 60%-of-selling-price estimate
  — **every product-value figure computed here must carry the same
  "estimate" label formulas.md requires wherever the 60% rule applies**,
  not present as a real cost.
- Relevant module: `src/modules/stock/logic.ts` —
  `getIngredientStockValueAtLocation` (line ~1291) is the direct
  precedent to mirror: same shape (quantity × unit cost, per location),
  swapping the ingredient cost source (`IngredientCost`'s running
  average) for the product cost source described in formulas.md §4.
- Product cost sourcing: `catalogue`'s `recordProductCost` (ticket 01)
  and `getCurrentRecipe`/recipe cost (ticket 02) are the "real" cost
  sources; the 60% estimate is the fallback when neither applies — check
  how ticket 25's canteen cost-of-goods-sold work already resolved this
  same three-way branch (real cost vs. recipe cost vs. estimate) and
  reuse that logic rather than re-deriving it.
- `admin-stock-table.tsx` / the design-reference's `stock-body.tsx`
  (`../prosper-hotel-design-reference/src/components/design/shell/
  stock-body.tsx`) — the full target valuation table (cost, value,
  filters). **This ticket does not have to build the whole thing** — see
  Out below — but should extend the current minimal table toward it by
  adding the value column, not replace it wholesale.

## Scope

**In:**
- A function (e.g. `getProductStockValueAtLocation`) returning quantity
  × unit cost per product at a location, using the three-way cost source
  (real recorded cost, recipe cost, or the labelled 60% estimate) —
  matching whatever branch ticket 25 already established for canteen
  cost-of-goods-sold, reused rather than reimplemented.
- Each returned figure carries an `isEstimate` (or equivalent) flag
  wherever the 60% fallback was used, so the UI can label it.
- Extends `admin-stock-table.tsx` with a value column (and a location
  total), reusing `RecordTable`'s existing column shape — not a full
  rebuild of the design-reference's richer `stock-body.tsx` (filters,
  low-stock, category grouping stay out, per below).
- Owner-only read, same gate as the rest of the admin Stock destination.

**Out:**
- Low-stock warnings — a related but separate Stage 8 piece
  (proposal.md §7's "Low stock" is its own bullet, not part of "value"),
  not bundled here.
- Category/location filters or any other part of `stock-body.tsx`'s
  fuller shape beyond the value column itself — a later ticket if
  wanted, once this ticket proves the underlying value figure is right.
- Combined ingredient + product total value in one figure — this ticket
  adds the product side; combining both into one "total stock value"
  read (if wanted) is a small follow-on once both exist, not assumed
  here.
- Any change to how product cost itself is recorded (`recordProductCost`,
  recipes) — this ticket only reads existing cost sources.

## Acceptance criteria

- [x] `getProductStockValueAtLocation` returns quantity × unit cost per
      product, matching formulas.md §4's cost-source table exactly
      (recipe cost, real recorded cost, or labelled 60% estimate, in that
      priority). Note: recipe cost is checked first since it only applies
      to cooked_food, mirroring the existing (now-fixed) call sites.
- [x] A product valued via the 60% estimate is flagged as such in the
      returned data.
- [x] The figure matches `getCurrentStockAtLocation`'s quantity exactly
      (same quantity source, no drift between the two reads).
- [x] **Screen:** `admin-stock-table.tsx` gains a value column (and
      total), with estimated values visibly labelled as estimates, not
      presented as exact.
- [x] Loading and error states unchanged from the existing table's
      pattern.
- [x] Storybook: extend the existing admin stock table story with value
      figures visible, including at least one estimated-cost row.

### Scope note: cost-source bug fixed alongside this ticket

Ticket 25's existing product cost-source branch (inlined in both
`recordNonSalesConsumption` and `correctStockCount`) only implemented two
of formulas.md §4's three tiers — it checked `product.kind ===
"cooked_food"` for recipe cost, then fell straight to the 60% estimate
for everything else, silently skipping `Product.lastKnownCostMinor` (the
running-average cost `recordProductCost` writes) for bought-in
goods/packaging. This was a real bug: a bought-in soda with a recorded
cost would have been valued at a 60% estimate instead of its real cost.
Flagged to and confirmed by Edwinfred — fixed by extracting a shared
`resolveProductCostBasis` helper implementing the correct three-tier
order, used by both existing call sites and this ticket's new function.
Covered by a new test in `wastage.integration.test.ts`. Existing tests
were unaffected (their fixtures never set `lastKnownCostMinor`).

## Verification

- Integration tests, test-first: value calculation against constructed
  scenarios for each of the three cost sources (real, recipe, estimate),
  the estimate flag set correctly, quantity matching
  `getCurrentStockAtLocation`.
- `pnpm lint`, `pnpm exec tsc --noEmit`.
- Manual check against `references/ui-rules.md`.
- Update `docs/screens.md` if the story file changes.
