# 07 — Record a counter sale, cash and M-Pesa, split across payment lines

**Type:** logic (test-first)
**Blocked by:** 06 (payment lines will need a customer to exist as a
concept for ticket 08, though this ticket itself only uses cash/M-Pesa)
**Status:** done

## What this delivers

The first real sale. A cashier or store manager at the restaurant can
open "New sale" (currently the `sell` staff-nav placeholder showing
`NotBuilt`) and record one: pick products and quantities, settle in cash,
M-Pesa, or a mix of both against a single sale total, and see stock
decrement for real.

CONTEXT.md is explicit that payment is a **list**, not a single value —
"a single sale may be settled partly in cash and partly by M-Pesa" — so
this ticket builds payment lines as a list from the start rather than a
single-method field extended later.

**Not every product decrements stock.** CONTEXT.md: a product is
"stocked" (goods, cooked food, packaging) or not (services — "sold but
holds no stock"). A sale line for a stocked product creates a
`sold`-reason stock movement (via `stock`'s existing ledger, through
`stock/index.ts`); a service line does not.

Only **counter** fulfilment is built here — delivery (which requires a
named customer) is deliberately deferred, see Out of scope.

## Lifecycle

- **Create:** a sale is created with one or more lines (product,
  quantity) and one or more payment lines (method, amount) whose amounts
  sum exactly to the sale total. Recorded by the authenticated staff
  member, at their session's location. Rejected if payment lines don't
  sum to the total, if any line quantity is not positive, or if a
  referenced product is inactive.
- **Read:** the cashier sees a confirmation of what was just recorded
  immediately after. A list/ledger view of past sales is out of scope
  here — Ledger is still `NotBuilt` and gets its own ticket once there's
  reason to build a cross-cutting sales view.
- **Update:** not allowed — a sale is not edited after recording (matches
  architecture.md's "nothing that moved stock or money is ever deleted"
  and its reversal-only correction model).
- **Delete:** not allowed.
- **Undo:** out of scope for this ticket — same-day void is ticket 10.
  This ticket's sales are permanent once recorded; void lands as its own
  slice so this one stays focused on getting a sale recorded correctly
  first.

## Acceptance criteria

- [ ] A sale can be recorded with one or more product lines (product,
      quantity) and one or more payment lines (`cash` or `mpesa`, amount).
- [ ] Payment line amounts must sum exactly to the sale's total (sum of
      line quantity × product price); a sale is rejected otherwise.
- [ ] Recording a sale for a stocked product creates a `sold` stock
      movement at the recording staff member's location, decrementing
      current stock (verified via `stock`'s existing
      `getCurrentStockAtLocation`).
- [ ] Recording a sale for a service product creates no stock movement.
- [ ] A sale for an inactive product is rejected.
- [ ] A sale with a non-positive quantity on any line is rejected.
- [ ] `canAccessLocation()` gates recording — a staff member can only
      record a sale at their own accessible location, same pattern as
      `stock/logic.ts`.
- [ ] **Screen:** the staff shell's "New sale" (replacing the `sell`
      `NotBuilt` placeholder) — product grid (large tap targets, per
      design.md's mobile rules) → quantity per selection → payment step
      (add one or more cash/M-Pesa lines, running total shown against
      sale total) → confirm. On success, shows a confirmation view (sale
      total, lines, payment breakdown).
- [ ] Confirmation, loading, and error states follow
      `components/patterns/states.tsx`.
- [ ] Storybook stories cover the New sale flow's states.

## Out of scope

- Credit as a payment method (ticket 08).
- Delivery fulfilment (needs a named customer; separate ticket after 08).
- Same-day void (ticket 10).
- Any sales list/ledger/history screen.
- Wastage, internal consumption, complimentary items — these are stock
  concepts, not sales.
