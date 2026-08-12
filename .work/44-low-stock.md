# 44 — Low stock

**Type:** logic (test-first)
**Blocked by:** None (extends `catalogue`'s Product/Ingredient records
and `stock`'s existing on-hand quantity queries)
**Status:** blocked

## Blocked — scope gaps found during context read (2026-08-12)

1. **`AdminStockTable`/`getCurrentStockAtLocation` only cover products,
   not ingredients.** `StockLevel` (stock/schema.ts) is
   `{ productId, productName, quantityOnHand }` — there is no
   ingredient-level equivalent feeding the admin stock table today. The
   ticket's Scope says the low-stock filter applies to "items" generally
   and `lowStockLevel` is scoped to both `Product` and `Ingredient`, but
   the table this filter attaches to currently only renders products.
   Options: (a) extend this ticket to also surface ingredients in
   `AdminStockTable` (a materially bigger change than "add a filter
   chip"), or (b) scope this ticket to products only for now and note
   ingredient low-stock as a follow-up ticket once ingredients are
   surfaced on the table at all.

2. **The `/stock` admin page shows one location at a time** (the owner's
   own `session.location.id`, no switcher — `src/app/stock/page.tsx`),
   but the ticket needs restaurant (current on-hand) and canteen
   (latest-count-derived) bases simultaneously, or at least reachable in
   the same filter session. Today there is no way for the owner to view
   the *other* location's stock table at all, low-stock or not. Options:
   (a) this ticket also adds a location switcher to the stock page (bigger
   than "a filter chip"), or (b) the low-stock filter's basis simply
   follows whichever location is currently being viewed once a switcher
   ships (deferred to whatever ticket adds that switcher), and this ticket
   only wires the correct basis (on-hand vs. latest-count) per location
   without adding the switcher itself.

Neither of these is a local implementation call — both change what
"just add a filter chip" means in practice. Surfaced to Edwinfred before
writing any code.

## Goal

Complete proposal.md §7's "Low stock: items below a defined level" —
current at the restaurant, as at the most recent count at the canteen —
surfaced as a filter on the existing Stock table, not a new destination.

## Context

- **Design precedent settles the shape, and it's smaller than a new
  screen:** `~/prosper-hotel-design-reference/src/components/design/shell/stock-body.tsx`'s
  own header comment: *"Low stock is a filter chip, not a separate view
  ... 'A filter is not a destination' was settled at setup."* Also: *"Stock
  on hand links to the product ledger... Low stock does not: it is this
  same table with a filter applied."* Build this as a filter chip/toggle
  on the existing `AdminStockTable`
  (`src/modules/stock/ui/admin-stock-table.tsx`), not a new page or nav
  entry.
- The reference's mockup uses one flat constant (`LOW = 12`) for every
  item — proposal.md instead asks for "a defined level" (implying
  per-item), so this ticket's real logic decision is a per-product/
  per-ingredient threshold field, not a global constant. If a global
  default turns out simpler and Edwinfred agrees it's sufficient, confirm
  that reading before building — don't silently narrow proposal.md's
  wording.
- `ticket 37`'s note in `admin-stock-table.tsx`: *"still deliberately
  stops short of stock-body.tsx's fuller shape — no low-stock warnings"*
  — this ticket is exactly that deferred piece.
- Restaurant vs. canteen basis differs (proposal.md §7): restaurant's
  figure is current on-hand (same source `AdminStockTable` already
  reads); canteen's is "as at the most recent count" — reuse `stock`'s
  `getLatestStockCount`/count-derived quantity (tickets 20/24) rather
  than the canteen's live movement sum, since canteen stock is
  provisional between counts (§10.4) the same way its cost is.
- `prisma/schema.prisma`'s `Product`/`Ingredient` models — need a
  nullable threshold field (e.g. `lowStockLevel`), owner-set, matching
  the nullable-until-set pattern `Product.priceMinor` already uses (null
  means "no threshold defined," not zero).

## Scope

**In:**
- A `lowStockLevel` field (nullable Int) on `Product` and `Ingredient`,
  owner-editable from the existing product/ingredient edit forms
  (`catalogue`'s ticket-01 CRUD) — not a new form, an added field on the
  existing one.
- A low-stock filter chip/toggle on `AdminStockTable`, showing items at
  or below their defined level. Items with no threshold set are never
  "low" (can't compare against nothing) — excluded from the filter, not
  shown as a false positive.
- Restaurant: compares current on-hand quantity (existing data source).
  Canteen: compares quantity as at the most recent count, with the
  count's date shown (same "provisional/as at" framing the dashboard
  already uses for canteen figures) — not live on-hand, since that's not
  what proposal.md asks for here.
- The chip's count badge, matching `docs/design.md`'s general filter-chip
  pattern already used elsewhere (check `TableToolbar`/existing filter
  chips in this codebase for the exact visual convention).

**Out:**
- A separate Low Stock screen, nav entry, or dashboard widget — explicitly
  ruled out by the design precedent above.
- Automatic reorder suggestions, purchase-order generation — not in
  proposal.md's scope.
- Low stock for assets — assets are a distinct concept (docs/scope.md's
  asset register), not stock in this sense.

## Acceptance criteria

- [ ] Owner can set a low-stock level on a product or ingredient from its
      existing edit form; leaving it blank means the item never appears
      as low.
- [ ] The Stock table's low-stock filter shows exactly the items at or
      below their own threshold — a per-item comparison, not a single
      shared number.
- [ ] Restaurant items compare against current on-hand quantity; canteen
      items compare against the quantity as at the most recent count,
      with that count's date visible when the filter is active.
- [ ] A canteen item with no count yet is excluded from the filter (no
      basis to compare), not shown as low or high.
- [ ] The filter chip shows a count of matching items and clears cleanly.
- [ ] Non-owner and non-matching-location roles see the same access
      restriction the Stock table already enforces — no new gate needed,
      this only adds a filter to existing data.
- [ ] Storybook story: the existing `AdminStockTable`/`StockList` stories
      gain a low-stock-filter-active state, plus the edit form's new
      threshold field (set, unset).

## Verification

- Integration tests, test-first: threshold set/unset on a product and an
  ingredient, filter correctness at the restaurant (current quantity) and
  canteen (count-derived quantity) against constructed fixtures including
  an item with no threshold and a canteen item with no count.
- `pnpm lint`, `pnpm exec tsc --noEmit`.
- Manual check against `references/ui-rules.md`.
- Update `docs/screens.md` only if a story file's states materially
  change (no new destination to add).
