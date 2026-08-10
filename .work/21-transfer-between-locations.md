# 21 â€” Transfer stock between locations

**Type:** logic (test-first)
**Blocked by:** None (`transferred` already exists in `StockMovementReason`
and `IngredientMovementReason`, unused by any ticket so far;
`canAccessLocation()` and the existing product/ingredient movement
queries are all this needs)
**Status:** blocked

**Claimed:** /root — 2026-08-10 (Africa/Nairobi)

**Blocked:** 2026-08-10 — The design-reference worktree contains no transfer
screen or comparable staff stock-operation screen. The closest available
implemented pattern is `src/modules/stock/ui/receive-delivery.tsx`: its
item-picker/form-and-confirm flow can be adapted for a transfer. Please
approve that adaptation, or ask for 2–3 transfer-screen variants to choose
from before implementation.

## What this delivers

A new `transfer` staff-nav link (store manager and attendant both get
it) that lets either location send stock to the other. CONTEXT.md's
Location entry: "Both locations hold stock and both send stock to the
other." Stock Movement's `Transferred` reason: "Sent from one location
to the other. Runs in both directions."

**Deliberately generic â€” not restaurant-food-out / canteen-printing-back
only.** proposal.md's examples (food to the canteen, printing back to
the restaurant) are the typical case, not a constraint. Any product or
ingredient a location currently holds can be transferred to the other
location, in either direction, by any staff member with access to the
sending location. This is what makes ticket 24's "transferred out" term
in the count-derived-sales formula meaningful regardless of what moved.

A transfer is one movement out at the sending location and one movement
in at the receiving location, both reason `transferred`, both carrying
the same product/ingredient and quantity, linked so the pair is
readable as one event (same `receiptId`-style linking pattern
`recordIngredientReceipt` already uses to group lines from one call).

## Context

- Relevant module: `src/modules/stock/`
- Existing precedent: `recordIngredientReceipt` (`src/modules/stock/logic.ts`)
  for the receiving-side pattern (location gate, active-item check,
  grouping multiple lines under one shared id); `recordStockMovement` /
  `createStockMovement` for the product-family movement path;
  `createIngredientMovement` for the ingredient-family path.
- `StockMovementReason.transferred` and the ingredient movement
  equivalent already exist in `prisma/schema.prisma` â€” unused until now.
- `canAccessLocation()` â€” `src/modules/people/index.ts`.
- Conventions: `docs/conventions.md#data-access`, `#location-scoping`.
- Nav: `src/components/layout/staff-nav.ts` â€” add a `transfer` entry to
  the shared `all` map, wire it into both `store-manager` and
  `attendant` arrays (cashier does not transfer stock).
- Storybook precedent for a two-sided flow:
  `src/modules/stock/ui/receive-delivery.stories.tsx`.

## Scope

**In:**
- A `recordTransfer` logic function taking `{ fromLocationId,
  toLocationId, itemType: "product" | "ingredient", itemId, quantity }`,
  gated by `canAccessLocation()` against `fromLocationId` (the sender
  must be able to access where the stock currently is; the destination
  needs no access check â€” a transfer's whole point is moving stock to
  the *other* location).
- Writes two linked movements: quantity negative, reason `transferred`,
  at `fromLocationId`; quantity positive, reason `transferred`, at
  `toLocationId`. Both attributed to the recording staff member.
- Rejects a transfer where quantity is not positive, the item is
  inactive, `fromLocationId === toLocationId`, or the sending location's
  current stock for that item is insufficient (can't transfer what
  isn't there â€” check `getCurrentStockAtLocation`).
- A "transfer" screen: item picker (scoped to what the sender's location
  currently holds, product or ingredient), destination is fixed to "the
  other location" (only two locations exist â€” no picker needed), quantity,
  confirm.
- A read view of transfers involving the staff member's own location,
  both directions (sent and received) â€” CONTEXT.md's architecture note:
  "transfers are visible at both ends... own location, plus transfers
  involving it."

**Out:**
- Direct-delivery receiving from a supplier (ticket 22 â€” a different
  reason, `received`, not `transferred`).
- Count-derived sales / the canteen's own goods cost estimate (ticket
  24/25) â€” this ticket only makes the movement mechanic real.
- A transfer confirmation/acceptance step at the receiving end (out of
  scope per proposal.md â€” a transfer is recorded and immediately
  reflected, not queued for approval).

## Acceptance criteria

- [ ] `recordTransfer` writes one negative movement at the source
      location and one positive movement at the destination, same
      product/ingredient, same quantity, both reason `transferred`.
- [ ] Works for both products and ingredients.
- [ ] Works in both directions (restaurantâ†’canteen and canteenâ†’restaurant)
      for any active product or ingredient, not a hardcoded subset.
- [ ] Rejected: non-positive quantity, inactive item, same source and
      destination, insufficient stock at the source.
- [ ] `canAccessLocation()` gates on the source location; a cashier
      (no stock-operations access) is denied at the route regardless of
      location.
- [ ] `getCurrentStockAtLocation` reflects the transfer at both
      locations immediately after recording.
- [ ] **Screen:** new `transfer` staff-nav link (store manager,
      attendant) opens a form â€” item picker limited to what the sender's
      location holds, quantity, confirm â€” then a read view of transfers
      involving the staff member's location (sent and received, both
      directions).
- [ ] Empty, loading (skeleton), error, and permission-denied states via
      `components/patterns/states.tsx`.
- [ ] Storybook story covers: empty transfer list, a sent transfer, a
      received transfer, insufficient-stock error, confirm flow.

## Verification

- Integration tests against `TEST_DATABASE_URL` per
  `stock/tests/stock.integration.test.ts`'s pattern â€” test-first for the
  logic (rejection cases, both-direction movement pairing, insufficient
  stock).
- `pnpm lint`, `pnpm exec tsc --noEmit`.
- Manual check against `references/ui-rules.md` for the new screen.
- Add the new Storybook story to `docs/screens.md`'s Stock section.
