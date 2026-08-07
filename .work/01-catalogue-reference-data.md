# 01 — Catalogue reference data: ingredients, product CRUD, product price

**Type:** plumbing (test-after)
**Blocked by:** None

## What this delivers

The backend for owner-managed reference data in `catalogue`. No UI in this
ticket — screens for all of this land together in ticket 03, deliberately
held back so the catalogue UI gets one focused design pass rather than
being bolted on piecemeal.

**Ingredients.** `catalogue` gains `Ingredient` as a distinct record type
from `Product`, matching CONTEXT.md's split: an ingredient is bought and
stocked but never sold on its own, and never appears on a till screen. An
ingredient carries a name, a unit of measure (e.g. kg, litre, packet —
whatever the owner enters; not a fixed enum), and a last-known cost. The
last-known cost is a convenience figure only — it exists so a recipe
(ticket 02) can be costed before any delivery has been recorded against
the ingredient yet. It is not the authoritative cost history; that lives
in `stock`'s movement ledger once receiving is built (a later stage), and
this ticket does not build that connection.

**Product CRUD.** The tracer slice only reads products (`listProducts`,
`findProductsByIds`). This ticket adds create, edit, deactivate, and
reactivate — replacing the current state where products can only be
seeded, not managed through the app. Product kind (goods / cooked food /
service / packaging, per CONTEXT.md) is set at creation and determines the
`stocked` behaviour `stock` already branches on; this ticket exposes kind
as a field the owner sets, it does not change that branching logic.

**Product selling price.** `Product` gains a selling price, owner-gated.
Price is a simple current-value field, edited directly — not
effective-dated, unlike recipes (ticket 02), which design.md deliberately
versions because a recipe's cost feeds every derived profit figure
silently. scope.md's "still to establish" list notes price-change cadence
is unconfirmed; building version history for an unconfirmed cadence is
premature. Past and future sales record the price at the time of sale as
part of the sale itself (`sales`, a later stage), so a price change here
never rewrites what a historical sale showed, even without a version
history on `Product`. A product with no price set cannot be sold — this
ticket does not build selling, but establishes the constraint the till
(stage 2) will enforce.

## Lifecycle — Ingredient

- **Create:** owner enters name, unit of measure, and an optional starting
  last-known cost (may be unknown until the first delivery, later stage).
- **Read:** owner-visible only — ingredients are never shown on a
  staff-facing screen since they never appear on a till.
- **Update:** owner can edit name, unit of measure, and last-known cost at
  any time, in place (CONTEXT.md/architecture.md's data-lifecycle rule:
  typos and reference-data corrections are edited in place, not reversed)
  — no history is kept for the ingredient record itself. Distinct from
  movement/cost history, which this ticket does not touch.
- **Delete:** not allowed. Deactivate instead — once a recipe or a future
  stock movement can reference an ingredient, deleting it would orphan
  that reference. A deactivated ingredient no longer appears in pickers
  for new recipes but existing references remain readable.
- **Undo:** deactivation can be reversed (reactivate) by the owner. No
  financial consequence to reverse since ingredients carry no movement
  history yet.

## Lifecycle — Product

- **Create:** owner enters name, kind, and optionally selling price.
- **Read:** owner sees all products, active and inactive. Staff-facing
  product pickers (till, later stage) show active products only. Where no
  price is set, it renders as "—" wherever price would appear, never
  zero — matching design.md's rule that an unknown figure must never be
  shown as zero.
- **Update:** owner can edit name, kind, and price at any time, in place —
  a reference-data correction, not a financial transaction.
- **Delete:** not allowed. Deactivate instead — matching `StaffMember`'s
  pattern (architecture.md: "deactivated, never deleted... a former
  employee's sales must stay attributed to them"). A product already sold
  must remain readable on historical sales even after it's withdrawn from
  sale. Deactivating a product does not affect a recipe that names it as
  an output — the recipe becomes unusable for new sales but its own
  history stays intact.
- **Undo:** deactivation can be reversed (reactivate) by the owner. A
  price edit has nothing to undo — sales already made at the prior price
  remain correct because they snapshot price at sale time.

## Acceptance criteria

- [ ] Owner can create an ingredient with a name and unit of measure;
      last-known cost is optional at creation.
- [ ] Owner can list, edit, deactivate, and reactivate ingredients.
- [ ] Ingredient name is unique, matching the uniqueness pattern already
      used for `StaffMember.name` (ADR 0007).
- [ ] Owner can create a product with a name and kind; price is optional
      at creation.
- [ ] Owner can edit an existing product's name, kind, and price.
- [ ] Owner can deactivate and reactivate a product; a deactivated product
      no longer appears in staff-facing pickers but remains visible to the
      owner, marked inactive.
- [ ] Product name is unique, same pattern as `StaffMember.name` and
      `Ingredient.name`.
- [ ] A product with no price set is distinguishable from one priced at
      zero at the data layer (e.g. nullable field, not a sentinel `0`).
- [ ] Price is stored as a whole-shilling or minor-unit integer (match the
      convention already used, or establish one if none exists yet) —
      never a floating-point type, to avoid rounding drift in money
      figures.
- [ ] A non-owner role attempting any ingredient or product write receives
      a permission-denied result.
- [ ] Changing kind on a product that already has stock movements does not
      corrupt or hide that history (existing movements keep referencing
      the product as it now is — this ticket does not need to snapshot
      kind per movement, since `stock` reads product kind live through
      `catalogue`'s interface and no ticket so far depends on kind being
      historical).

## Out of scope

- Any UI — screens for all of this are built together in ticket 03.
- Any connection to stock movements, receiving, or purchase-cost history
  (later stage — `stock`'s receiving ticket).
- Recipes (ticket 02).
- Selling / the till (stage 2).
- Price version history or effective dating.
