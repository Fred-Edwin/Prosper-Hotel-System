# 12 — Receiving deliveries

**Type:** logic (test-first)
**Blocked by:** None (`stock`'s movement ledger already exists from the
tracer slice)

## What this delivers

The first ticket of Stage 3 (restaurant stock operations). Every other
Stage 3 verb — issuing to the kitchen, production, transfers, wastage —
consumes stock that has to enter the store somehow first, so receiving is
this stage's natural opener, the same reasoning that put Customer before
counter sale in Stage 2.

proposal.md §3: "The store manager records each delivery: the item, the
quantity, and the price paid on that occasion. Prices are entered per
delivery rather than held as a fixed figure, since purchase costs vary
between buying trips. Stock is updated on entry."

This is an **ingredient** concern, not a product one — the store receives
supplies, not finished goods (CONTEXT.md's ingredient/product split).
Recording a delivery creates a `received`-reason stock movement (via
`stock`'s existing ledger, through `stock/index.ts`) and updates
`Ingredient.lastKnownCostMinor` to the price just paid, since
CONTEXT.md already marks that field as "a convenience figure... null
until known" — this ticket is what first makes it known.

Role: **store manager and owner only** (proposal.md's role table:
cashiers have no access to receiving).

## Lifecycle

No new record type — this writes a `StockMovement` (already exists,
`received` reason already defined in the `StockMovementReason` enum) and
updates a field on `Ingredient` (already exists).

- **Create:** a receipt records one or more lines (ingredient, quantity,
  price paid for that quantity) at the recording staff member's
  location. Rejected if quantity is non-positive, price is negative, or
  the ingredient is inactive.
- **Read:** current stock (already computed via
  `getCurrentStockAtLocation`) reflects the addition immediately. A
  receiving-history list is out of scope here — same reasoning as
  Today's sales not existing until its own ticket; add one later if
  receiving needs to be reviewed after the fact.
- **Update:** not allowed — a received movement is not edited after
  recording, matching architecture.md's append-only ledger.
- **Delete:** not allowed.
- **Undo:** not built in this ticket. architecture.md's reversal model
  would apply the same way it does to a sale (same-day, any role,
  compensating movement) — deliberately deferred so this ticket stays
  focused on recording correctly first, same reasoning ticket 07 used to
  defer void.

## Acceptance criteria

- [ ] A receipt can be recorded with one or more lines (ingredient,
      quantity, price paid), at the recording staff member's location.
- [ ] Recording a receipt creates a `received` stock movement per line,
      verified via `getCurrentStockAtLocation` increasing by the
      recorded quantity.
- [ ] Recording a receipt updates `Ingredient.lastKnownCostMinor` to the
      price paid on that line (price per unit, derived from quantity and
      total paid, or entered directly — decide the simpler input shape
      during the ticket and state which was chosen).
- [ ] A receipt line for an inactive ingredient is rejected.
- [ ] A receipt line with non-positive quantity or negative price is
      rejected.
- [ ] `canAccessLocation()` gates recording, same pattern as `stock` and
      `sales`.
- [ ] Only store manager and owner roles can record a receipt; a cashier
      attempting to is denied at the route, not just hidden from nav.
- [ ] **Screen:** the `receive` staff-nav placeholder (currently
      `NotBuilt`) becomes real — ingredient picker → quantity → price
      paid per line → confirm, mirroring New sale's line-entry pattern
      where it fits.
- [ ] Confirmation, loading, and error states follow
      `components/patterns/states.tsx`.
- [ ] Storybook stories cover the receiving flow's states.

## Out of scope

- Issuing to the kitchen, production, transfers, wastage — later tickets
  in this stage.
- A receiving-history list/screen.
- Undo/void of a receipt.
- Any change to `Product`'s pricing — receiving only touches `Ingredient`.
