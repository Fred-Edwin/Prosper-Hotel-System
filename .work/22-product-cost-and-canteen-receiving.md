# 22 — Product cost tracking and canteen direct-delivery receiving

**Type:** logic (test-first)
**Blocked by:** None (extends the existing `Product` model and
`recordIngredientReceipt`'s pattern; does not depend on ticket 21)
**Status:** in-review

## What this delivers

proposal.md §4: "records deliveries made directly to the canteen by
suppliers." Today, `receive` (ticket 12) only records ingredient
deliveries at any location — there is no path to receive **products**
(the canteen's own goods: sodas, biscuits, stationery, bought and
resold as-is) anywhere in the system.

Closing that requires a schema addition first: `Product` currently has
no purchase-cost field, only `priceMinor` (selling price). Ingredient
already has `lastKnownCostMinor`, updated by a running weighted average
each time more is bought (formulas.md §3). Product needs the same field
and the same update rule — canteen goods need a cost to compute margin
and, later (ticket 25), the canteen's own-goods cost-estimate rate.

## Context

- Relevant modules: `src/modules/catalogue/` (schema change, cost
  recording), `src/modules/stock/` (receiving logic, extends ticket 12's
  `recordIngredientReceipt`).
- Precedent: `Ingredient.lastKnownCostMinor` in `prisma/schema.prisma`;
  `recordIngredientCost` and `setIngredientLastKnownCost` in
  `src/modules/catalogue/logic.ts` / `queries.ts` for the running-average
  update; `recordIngredientReceipt` in `src/modules/stock/logic.ts` for
  the receiving-flow shape (location gate via `canReceive`/
  `canAccessLocation`, per-line active check, shared receipt id across
  lines in one call).
- formulas.md §3 ("What an ingredient costs") — same formula applies to
  products of kind `goods` (and any other stocked, purchased product).
- Storybook precedent: `src/modules/stock/ui/receive-delivery.stories.tsx`
  (ticket 12's screen) — this ticket extends it, not duplicates it.
- Conventions: `docs/conventions.md#data-access`.

## Scope

**In:**
- Migration: add `lastKnownCostMinor Int?` to `Product` in
  `prisma/schema.prisma`, mirroring `Ingredient`'s field (nullable,
  minor units, convenience figure not authoritative history — same
  comment precedent).
- A `recordProductCost` logic function mirroring `recordIngredientCost`:
  not owner-gated (frequent store-manager/attendant action, matches the
  existing `recordIngredientCost` reasoning), applies the same
  running-average formula from §3 using current
  `lastKnownCostMinor`/quantity-on-hand and the new delivery's quantity
  and price.
- Extend `recordIngredientReceipt`'s screen and underlying route to
  accept **either** ingredients or products in one delivery (a supplier
  drop-off may include both, e.g. the canteen receiving printer paper
  (ingredient) and airtime scratch cards (product) in one visit) —
  writes `received` movements down the appropriate family
  (`StockMovement` for products, `IngredientMovement` for ingredients),
  same shared receipt id.
- Reject: non-positive quantity, negative cost, inactive item — same
  validation `recordIngredientReceipt` already applies.

**Out:**
- Transfers (ticket 21 — a different reason and a different screen).
- The canteen's own-goods cost-estimate rate used in the provisional
  daily cost calc (ticket 25 — this ticket only makes the *unit* cost
  recordable; the estimate formula is a separate concern).
- Recipe-based costing for cooked food — unaffected, still uses
  `Recipe.perUnitCostMinor`, not this field.

## Acceptance criteria

- [x] `Product.lastKnownCostMinor` exists, nullable, minor units.
- [x] `recordProductCost` recalculates the running average correctly
      given existing quantity-on-hand at the location and the new
      delivery's quantity/price (same worked-example arithmetic as
      formulas.md §3, applied to a product instead of an ingredient).
- [x] Receiving a delivery accepts a mix of product and ingredient lines
      in one call, all sharing one receipt id.
- [x] Each product line writes a `received` `StockMovement` and updates
      `Product.lastKnownCostMinor` via the running average; each
      ingredient line behaves exactly as ticket 12 already does
      (unchanged).
- [x] Rejected: non-positive quantity, negative cost, inactive product
      or ingredient — per line, in a mixed delivery.
- [x] `canAccessLocation()` + the existing `canReceive` role gate apply
      unchanged (owner, store manager, attendant).
- [x] **Screen:** the existing `receive` screen (ticket 12) gains an
      item-type toggle or combined picker so a canteen attendant can add
      product lines alongside (or instead of) ingredient lines in the
      same delivery form.
- [x] Storybook: extend `ReceiveDelivery`'s story with a canteen/product
      variant (product-only delivery, and a mixed delivery).

## Review findings (rejected — see PR #6) — addressed

- **Blocking, fixed.** `recordIngredientReceipt` (`src/modules/stock/logic.ts`)
  computed each item's quantity-on-hand once, up front, before the write
  loop. Two lines for the *same* product/ingredient within one delivery
  call both read the same stale pre-delivery quantity, so the second
  line's running average was wrong (it ignored the first line's delivery
  entirely). Fixed by updating `productQuantityOnHand`/
  `ingredientQuantityOnHand` in place after each line is written, so a
  later line for the same item sees the accumulated on-hand quantity —
  matching what two sequential `recordIngredientReceipt` calls produce.
  Two regression tests added to `receiving.integration.test.ts` (one
  product, one ingredient): two lines for the same item in one call, now
  asserting the same result as the existing sequential-calls test.
- **Non-blocking, noted for awareness.** `findReceiptsAtLocation`
  (`src/modules/stock/queries.ts`) values a historical product line using
  the product's *current* `lastKnownCostMinor`, not the price paid on
  that specific delivery — a receipt's displayed total can drift after a
  later delivery changes the running average. Disclosed in the code
  comment; inherent to `StockMovement` having no per-line `unitCostMinor`
  (unlike `IngredientMovement`). Not required to fix for this ticket, but
  worth being aware of if cash's Stock-expense screen ever needs the
  actual paid total.

## Notes from implementation

- `recordIngredientCost` (ticket 12) never actually computed the running
  average — it only overwrote `lastKnownCostMinor` with the price just
  paid, ignoring quantity on hand. Fixed alongside `recordProductCost`
  (same shared helper) since the ticket cites it as the pattern to mirror
  and the bug would otherwise ship twice. Signature grew a
  `quantityOnHand`/`quantityBought` input; its only caller
  (`recordIngredientReceipt`) was updated accordingly.
- `findReceiptsAtLocation`/`findReceipt` (stock module, read by cash's
  Stock-category expense form) were extended to union `StockMovement` and
  `IngredientMovement` rows sharing a `receiptId` — otherwise a
  product-only delivery (e.g. a canteen buying only sodas, no ingredients)
  would exist but never be selectable/payable from the cash screen.
  Confirmed with the user before implementing.
- `StockMovement.receiptId` added (mirroring `IngredientMovement`'s
  existing field) so product lines can share a receipt id with ingredient
  lines in the same delivery.

## Verification

- Integration tests, test-first: running-average correctness (including
  the exact formulas.md §3 worked example, applied to a product),
  mixed-line delivery, per-line rejection cases.
- `pnpm lint`, `pnpm exec tsc --noEmit`.
- Prisma migration runs cleanly against `TEST_DATABASE_URL`.
- Manual check against `references/ui-rules.md` for the extended screen.
- Update `docs/screens.md`'s `ReceiveDelivery` row status/description if
  the story file name changes; otherwise no new row needed.
