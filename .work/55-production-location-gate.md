# 55 — Production gated to a product's home location

**Type:** logic (test-first)
**Blocked by:** 53 (needs `Product.locationId` to exist)
**Status:** planned

## Goal

A location can only record production for a product whose home location
it is — the canteen can no longer "produce" a restaurant-owned
cooked-food item.

## Context

- Relevant module: `src/modules/stock/logic.ts` (`recordProduction`,
  around line 1124), `src/modules/stock/ui/record-production.tsx`.
- `docs/architecture.md`'s "Product home location" note — states this
  gate explicitly as part of the design: "a location may only produce a
  product whose home location it is — production is the restaurant
  kitchen's act, not a generic one."
- `docs/scope.md`'s 2026-08-13 entry, "Production is hard-gated to home
  location" bullet.
- Ticket 5's earlier fix to `recordProduction`/`recordProductionRoute`
  (see `docs/bugs.md` BUG-05's fix notes) already extended this
  function to accept `lines: { productId, quantity }[]` and validate
  every line upfront, failing the whole batch on any invalid line —
  this ticket adds one more per-line validation to that same upfront
  pass, not a separate mechanism.

## Scope

**In:**
- `recordProduction` rejects the whole batch (matching the existing
  all-or-nothing validation for missing recipes) if any line's product
  home location doesn't match the location producing it. New reason,
  e.g. `wrong_location_for_product`.
- `record-production.tsx` only offers products whose home location
  matches the requester's location in its picker — a location should
  never be offered a product it can't produce in the first place, not
  just rejected after picking it.
- Route/UI error messaging names which product doesn't belong at this
  location, consistent with ticket 54's inline-error approach rather
  than a generic failure.

**Out:**
- Any change to the recipe/yield validation already in
  `recordProduction` — untouched, this is an additional independent
  check.
- Ingredient location scoping — out of scope for this feature
  (see ticket 53's Out section).

## Acceptance criteria

- [ ] Attempting to record production for a product whose home location
      differs from the requester's location is rejected, with no
      movements written, and the reason names the specific product.
- [ ] `record-production.tsx`'s picker only shows products belonging to
      the requester's own location — a mismatched product is never
      offered, not merely rejected after selection.
- [ ] Production of a product that does belong to the requester's
      location succeeds exactly as before (no regression to ticket 5's
      multi-line batch behavior or existing recipe-cost validation).
- [ ] Storybook: `record-production.tsx`'s story reflects the
      location-filtered picker (no story change needed if the picker
      already only shows this location's products by construction —
      confirm and note either way).

## Verification

- Integration tests, test-first: production of a home-location product
  succeeds; production of a non-home-location product is rejected with
  no movements written; a multi-line batch with one mismatched line
  rejects the whole batch (all-or-nothing, matching existing behavior).
- `pnpm lint`, `pnpm exec tsc --noEmit`.
- Manual check against `references/ui-rules.md` if the picker's visual
  presentation changes.
