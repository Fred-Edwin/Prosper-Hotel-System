# 11 — Delivery fulfilment

**Type:** logic (test-first)
**Blocked by:** None (07/08/10 already landed — `Sale.fulfilment` already
carries the `delivery` case in the Prisma enum, anticipated but unused
until now)
**Status:** done

## What this delivers

The last open piece of proposal.md §3 "Sales." CONTEXT.md: fulfilment is
"counter (served on the spot) or delivery (taken to the customer). There
is no third case." This ticket makes `delivery` a real, recordable
fulfilment alongside the `counter` sales ticket 07 built.

**Delivery requires a named customer**, same rule and same UI pattern as
credit (ticket 08) — pick an existing customer or create one inline,
before payment. This is independent of payment method: a delivery sale
can still be settled in cash, M-Pesa, credit, or a mix: the customer
requirement comes from *fulfilment*, not from *payment type*. (A delivery
sale paid by credit only needs one customer, not two — the same customer
covers both.)

**Delivery fee.** Not mentioned anywhere in proposal.md or CONTEXT.md —
this is new ground, resolved as: the sale gains an optional delivery fee,
present only when `fulfilment = delivery`, added on top of the sum of
product lines to form the sale's total. Payment lines must sum to that
combined total (lines + fee), same rule ticket 07 already enforces, just
against a larger total. The fee stays a visibly separate figure wherever
the sale is shown — not blended into product-line revenue — so a later
reporting stage can tell delivery income apart from product revenue.

## Lifecycle

Extends `Sale`'s existing lifecycle (ticket 07) rather than introducing a
new record type.

- **Create:** a delivery sale requires `customerId` (independent of
  whether any payment line is `credit`) and may carry an optional
  `deliveryFeeMinor`. Rejected if `fulfilment = delivery` and no customer
  is attached. Payment lines must sum to (sum of product lines' value +
  delivery fee, if any).
- **Read:** Today's sales (ticket 09) and the confirmation view show
  fulfilment type, the attached customer, and the delivery fee as its own
  line item when present.
- **Update:** not allowed, same as ticket 07.
- **Delete:** not allowed, same as ticket 07.
- **Undo:** same-day void (ticket 10) applies to a delivery sale exactly
  as it does to a counter sale — voiding reverses stock and marks the
  whole sale void, fee included.

## Acceptance criteria

- [ ] A sale with `fulfilment: "delivery"` requires a `customerId`;
      rejected without one, regardless of payment method.
- [ ] A delivery sale may include an optional `deliveryFeeMinor`
      (non-negative); absent means no fee charged, not zero-as-a-value
      distinct from unset.
- [ ] The sale total used to validate payment-line sums is (sum of
      product line values) + delivery fee, when present.
- [ ] A counter sale (`fulfilment: "counter"`) is unaffected — no
      customer requirement, no delivery fee field applies.
- [ ] **Screen:** New sale (ticket 07) gains a fulfilment toggle
      (Counter / Delivery). Selecting Delivery requires picking or
      creating a customer (reusing ticket 08's inline-create pattern)
      before the payment step, and shows a delivery fee input (optional,
      defaults to none).
- [ ] Confirmation view and Today's sales (ticket 09) show fulfilment
      type; delivery sales show the customer and the fee as a distinct
      line, separate from product-line totals.
- [ ] Voiding a delivery sale (ticket 10) reverses it fully, fee
      included, same as any other sale.
- [ ] Storybook stories cover the New sale flow's delivery path
      (customer required, fee optional).

## Out of scope

- Any change to how the delivery fee is treated in reporting/profit
  calculations — that's a later reporting-stage concern; this ticket
  only records the figure.
- A default or owner-configurable delivery fee amount — always entered
  per sale, not stored as a setting.
- Any new stock behaviour — a delivery sale decrements stock the same
  way a counter sale does (ticket 07's rule), nothing about fulfilment
  changes that.
