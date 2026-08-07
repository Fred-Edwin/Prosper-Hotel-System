# 08 — Credit sales, named customer required

**Type:** logic (test-first)
**Blocked by:** 06 (Customer record), 07 (sale + payment lines)

## What this delivers

Adds `credit` as a third payment-line method alongside cash and M-Pesa
(ticket 07). CONTEXT.md: "Any staff member may extend credit provided the
customer is named... Credit is a payment line like any other, settled
later." A credit payment line requires a customer — either picked from
the existing list (ticket 06) or created inline in the same flow, since
requiring the cashier to leave the sale to create a customer first would
make the common case slower than the spreadsheet it replaces.

This ticket also introduces the customer's **derived balance** — the sum
of their unsettled credit payment lines — since this is the first ticket
that produces data to derive it from. Ticket 06 deliberately deferred
this for exactly this reason.

## Lifecycle

- **Create:** a credit payment line is created same as cash/M-Pesa
  (ticket 07's model), but requires `customerId`. If the customer doesn't
  exist yet, the same flow can create one (ticket 06's create) inline
  before attaching it.
- **Read:** a customer's derived balance (sum of unsettled credit lines)
  is computable via `people`. No statement/history screen yet — that's a
  People-destination concern, out of scope here.
- **Update:** not applicable — credit lines aren't edited after creation,
  same as the sale they belong to.
- **Delete:** not allowed, same as ticket 07's sales.
- **Undo:** settling a credit line (the customer paying it off) is out of
  scope for this ticket — recording repayment is a People-stage concern
  proposal.md hasn't reached yet. This ticket only records the debt; it
  does not yet record it being paid down. Void (ticket 10) still applies
  to a whole sale including its credit line, the same as any other
  payment method.

## Acceptance criteria

- [ ] A sale's payment lines may include `credit`, alongside or instead
      of cash/M-Pesa (still must sum to the sale total per ticket 07's
      rule).
- [ ] A `credit` payment line requires a `customerId`; a sale with a
      credit line and no customer is rejected.
- [ ] The "New sale" payment step gains a "Credit" option: pick an
      existing customer (search/select) or create one inline (name
      required, phone optional per ticket 06) without leaving the sale.
- [ ] A customer's balance (sum of their credit payment lines across all
      non-void sales) can be read via `people`.
- [ ] Confirmation view (from ticket 07) shows the customer name against
      any credit line in the breakdown.

## Out of scope

- Recording repayment / settling a credit balance.
- A customer statement or balance screen — People's own destination
  ticket.
- Delivery fulfilment (still deferred; a later ticket, though it will
  also require a named customer once built).
