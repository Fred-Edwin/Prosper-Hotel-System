# 19 — Production: recording kitchen output

**Status:** in-review (Claude Sonnet 5, 2026-08-10)

**Type:** logic (test-first)
**Blocked by:** 18 (issuing to the kitchen) — production records what
the kitchen made from ingredients that reached it; building production
after issuing keeps Stage 3's store→kitchen→plate flow in the order it
actually happens, even though the two aren't a hard data dependency (see
below)

## What this delivers

The final unbuilt verb of proposal.md §3. "The kitchen records its
output — plates, portions and pots produced." This is a **product
movement** (CONTEXT.md's Stock Movement split) — cooked food coming into
existence, priced at selling value, cost of sales, and profit, unlike
issuing's plain ingredient relocation.

**Not a hard consumption link to a specific issue.** This ticket does not
require production to reference which issued batch it came from — that
would need lot-tracking this project doesn't have. Instead, producing a
product **consumes ingredients according to its current recipe**
(`catalogue`'s `getCurrentRecipe`), the same relationship recipes already
express for costing. Recording production of N units deducts each recipe
line's ingredient quantity × N from the store, and adds N units of the
product at selling location, using the recipe's `perUnitCostMinor` as the
product movement's cost basis.

A product with no recipe cannot be produced through this flow — it has
nothing to deduct or cost against. (Recipes are catalogue's territory;
this ticket doesn't create one on the fly.)

Role: **store manager and owner** — same actors as issuing; proposal.md
doesn't give cashiers a production role. Confirmed with the user: the
store manager is in charge of production, same as issuing and receiving.

## Lifecycle

No new record type — writes a `produced`-reason `StockMovement` (new
enum value, product side) and one `issued`-reason `IngredientMovement`
per recipe line consumed (reusing ticket 18's reason — the ingredients
really did leave the store for this production run, whether or not they
were issued as a separate prior step).

- **Create:** an entry records a product and a quantity produced, at the
  recording staff member's location. Rejected if quantity is
  non-positive, the product is inactive, the product has no current
  recipe, or insufficient ingredient stock exists for the deduction
  (decide during the ticket whether insufficient stock blocks the entry
  or is allowed to go negative — state which was chosen; wastage's
  precedent doesn't block on negative product stock, so producing likely
  shouldn't block on negative ingredient stock either, but confirm
  against `getCurrentStockAtLocation`'s existing behaviour before
  assuming).
- **Read:** current stock reflects the addition (product) and reduction
  (ingredients) immediately via `getCurrentStockAtLocation`. No
  production-history list — same deferral reasoning as issuing.
- **Update:** not allowed.
- **Delete:** not allowed.
- **Undo:** not built in this ticket — same deferral pattern as issuing.

## Acceptance criteria

- [ ] An entry can be recorded for a product and a quantity produced, at
      the recording staff member's location.
- [ ] Recording an entry creates a `produced` stock movement for the
      product, verified via `getCurrentStockAtLocation` increasing by
      the recorded quantity.
- [ ] Recording an entry creates an ingredient movement per recipe line,
      deducting quantity × units produced from the store, verified via
      `getCurrentStockAtLocation` for each ingredient.
- [ ] The produced movement's cost basis is the recipe's
      `perUnitCostMinor` × quantity; its selling value is the product's
      price × quantity (mirroring wastage's cost/selling-value pair, but
      without the 60%-estimate fallback — a recipe either has a known
      cost or production is rejected, see below).
- [ ] An entry for a product with no current recipe is rejected.
- [ ] An entry for an inactive product is rejected.
- [ ] An entry with non-positive quantity is rejected.
- [ ] `canAccessLocation()` gates recording.
- [ ] Only store manager and owner roles can record production; a
      cashier attempting to is denied at the route.
- [ ] **Screen:** a new `production` staff-nav destination, alongside
      `receive` and `issue` in the store manager's link set (no existing
      slot covers this — confirmed with the user this is a new nav key,
      not folded into `issue`) — product picker → quantity → confirm.
- [ ] Confirmation, loading, and error states follow
      `components/patterns/states.tsx`.
- [ ] Storybook stories cover the production flow's states.

## Out of scope

- Lot-tracking which specific issued ingredients a production run
  consumed — deduction is recipe-derived, not batch-linked.
- Transfers to the canteen — deliberately deferred until the canteen
  module exists (see ticket 20's sibling discussion).
- A production-history list/screen.
- Undo of a recorded entry.
- Recipe creation/editing — `catalogue`'s territory, already built.
