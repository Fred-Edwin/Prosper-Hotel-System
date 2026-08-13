# 53 — Product home location

**Type:** logic (test-first)
**Blocked by:** None (extends `catalogue`'s existing `Product` model and CRUD)
**Status:** in-progress (claimed 2026-08-13 12:27, session: /build)

## Goal

Every product has a required home location, set by the owner at
creation and editable after, and New Sale at each location offers only
that location's own products plus anything currently held there via a
confirmed transfer in — closing BUG-14.

## Context

- Relevant modules: `src/modules/catalogue/` (schema, logic, routes,
  `ui/product-form.tsx`), `src/modules/stock/` (read the "sellable at
  location" set from), `src/modules/sales/ui/new-sale.tsx` (consumer).
- `docs/architecture.md`'s new "Product home location" note (Data
  lifecycle section) — the full reasoning for this field and why
  sellability is the union of home-location match and ledger-positive
  stock, not either alone. Read this before writing the query.
- `docs/scope.md`'s 2026-08-13 "Product home location, and an
  overselling guard" entry — the full definition-of-done this and
  tickets 54-57 together satisfy.
- Precedent for the field shape: `StaffMember.locationId` in
  `prisma/schema.prisma` — required, named `location` relation. Do not
  make it nullable.
- Precedent for the "combined" query shape: `getTransferableItems`
  (`src/modules/stock/logic.ts:359-384`) — sums movements at a location
  via `sumMovementsByProductAtLocation`, then looks up only the products
  with a positive sum. This ticket's new function is the same shape,
  unioned with a plain `locationId` match on `Product`.
- `docs/bugs.md` BUG-14 — the bug this closes; update its status once
  this ticket lands.

## Scope

**In:**
- `Product.locationId` (required, `String`, `@relation` to `Location`)
  added to `prisma/schema.prisma`, migration generated.
- `catalogue`'s `createProduct`/`updateProduct` logic and
  `product-form.tsx` gain a required location select — same edit
  affordance as price/category, no special lock after creation.
- A new `catalogue` (or `stock`, whichever module already owns
  `sumMovementsByProductAtLocation` — check before deciding, don't
  duplicate the query) function returning the sellable-at-location
  product set: `product.locationId === locationId` **OR**
  `sumMovementsByProductAtLocation` is positive for that product at
  that location. Exported from that module's `index.ts`.
- `activeProductsRoute` (`catalogue/routes.ts`) gains a required
  `locationId` query param and calls the new combined function instead
  of returning every active product unconditionally.
- `new-sale.tsx`, `credit-sale.tsx`, `receive-delivery.tsx`, and
  `record-wastage.tsx` all pass the requester's own `locationId` to the
  products fetch. `new-sale.tsx` (and `credit-sale.tsx`, which shares
  the same picker concerns) visually distinguishes transferred-in items
  from the location's own products (a badge or grouped section — reuse
  the canteen Stock page's existing "My stock / From restaurant" visual
  convention, check `stock-list.tsx` for the exact pattern rather than
  inventing a new one). `receive-delivery.tsx` and `record-wastage.tsx`
  get the same combined-set filtering but don't need the visual
  own-vs-transferred distinction unless Edwinfred asks for it — they're
  not till/basket screens, just apply the filter.
- Seed data (`prisma/seed.ts`): assign each of the 13 existing products
  a `locationId` matching whichever location its existing seeded
  `StockMovement` rows are already recorded at.

**Out:**
- `Ingredient` location scoping — not in this feature's scope per
  `docs/scope.md`'s entry; ingredients keep their current
  every-location visibility.
- The overselling guard itself (on-hand quantity display, the
  `insufficient_stock` check on sale recording) — ticket 54.
- Production's home-location gate — ticket 55.
- The correction dialog's product scoping — ticket 56.
- `record-production.tsx` and `record-correction-dialog.tsx` — left on
  the old unfiltered fetch here; they get their own distinct scoping
  rules in tickets 55 and 56 respectively (production is home-location
  only, no transferred-in; corrections use the combined set but that
  wiring is ticket 56's job, not this one's).

## Note: other product-picker screens

The codebase survey behind this feature found six screens fetching
`/api/catalogue/products/active` with no location filter: `new-sale.tsx`,
`credit-sale.tsx`, `record-production.tsx`, `receive-delivery.tsx`,
`record-wastage.tsx`, `record-correction-dialog.tsx`. Since this ticket
makes `activeProductsRoute`'s `locationId` param required (no unfiltered
fallback), every one of these six screens must keep working — this
ticket's scope therefore includes updating `credit-sale.tsx`,
`receive-delivery.tsx`, and `record-wastage.tsx` to pass the requester's
own `locationId` through (they already know it), which gives them the
same combined-scope filtering `new-sale.tsx` gets — not left on old
behavior, and not a separate ticket. `record-production.tsx` and
`record-correction-dialog.tsx` are excluded here only because they need
a *different* filter rule than the plain combined set (see tickets 55
and 56), not because they're deferred without reason.

## Acceptance criteria

- [ ] Creating or editing a product requires selecting a home location;
      the form will not submit without one.
- [ ] `GET /api/catalogue/products/active?locationId=<id>` returns only
      that location's own products plus products with positive current
      stock there — never the full global catalogue.
- [ ] A product transferred to a location and confirmed received
      appears in that location's New Sale list even though its home
      location differs, visually marked as not native to that location.
- [ ] A product with no home-location match and no stock history at a
      location never appears in that location's New Sale list (the
      literal BUG-14 repro — Mukimo must not appear at the canteen
      before any transfer).
- [ ] Seed data's 13 products each carry a real `locationId` matching
      their seeded movement history.
- [ ] `credit-sale.tsx`, `receive-delivery.tsx`, and `record-wastage.tsx`
      all still function end-to-end after `locationId` becomes a
      required param on `activeProductsRoute` — none silently break.
- [ ] Storybook: `ProductForm` gains a location-select state;
      `new-sale.tsx`'s story gains a state showing a mix of own and
      transferred-in tiles, visually distinguished.

## Verification

- Integration tests, test-first: the combined sellable-set query
  against constructed fixtures — a location's own product, a
  transferred-in-and-confirmed product, a product with neither
  (excluded), a product transferred but not yet confirmed (excluded,
  per the existing two-step transfer model).
- `pnpm lint`, `pnpm exec tsc --noEmit`.
- Manual check against `references/ui-rules.md` for the new form field
  and the picker's grouped/badged display.
- Update `docs/bugs.md`: mark BUG-14 fixed, referencing this ticket.
