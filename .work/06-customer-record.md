# 06 — Customer record

**Type:** logic (test-first)
**Blocked by:** None

## What this delivers

`sales` needs a named customer to attach credit to (CONTEXT.md: "Credit is
a payment line like any other, settled later"), and the admin nav's People
destination already assumes customers live there ("Customers live in
People, not Catalogue... a live balance that moves with every credit sale
and repayment"). This ticket stands up the `Customer` record in `people`
so ticket 07/08 (credit sales) aren't blocked on inventing it mid-slice.

No balance is stored here — CONTEXT.md is explicit that a customer's
balance is derived from their unsettled credit sales, not a stored figure.
Since no sale exists yet, this ticket only builds create/list/find; the
derived-balance read is added once a real credit sale exists to derive it
from (ticket 08).

No screen ships in this ticket. Customers become visible once People gets
its own destination ticket (replacing that `NotBuilt` placeholder) — this
ticket only makes the record creatable, so credit sales aren't blocked on
a UI that belongs to a different destination.

## Lifecycle

- **Create:** name required; phone optional. Any authenticated staff
  member may create one inline (a delivery or credit sale is the common
  path in) — no owner gate, matching CONTEXT.md's "most trade is
  anonymous and creates no customer" framing (creating one is a low-
  stakes, frequent staff action, not an admin setup task).
- **Read:** list all customers, find by id. No location scoping — a
  customer is not location-scoped (CONTEXT.md: "the business," not "a
  location," deals with them by name).
- **Update:** name and phone editable in place (non-financial typo
  correction, per architecture.md's data-lifecycle rules — not a
  reversal-worthy change).
- **Delete:** not allowed. A customer with any sale attributed to them
  must remain resolvable from that sale, permanently, same as Product's
  "deactivated, never deleted" rule. No active/inactive flag either,
  since nothing here currently needs to hide a customer from selection —
  add one later if that need appears.
- **Undo:** not applicable — creation and edits are not reversal-worthy
  actions.

## Acceptance criteria

- [ ] A customer can be created with a name (required) and phone
      (optional).
- [ ] Customers can be listed and fetched by id.
- [ ] A customer's name or phone can be edited in place.
- [ ] Two customers may share the same name (no uniqueness constraint —
      names are not identifiers in real life).
- [ ] No delete or deactivate operation exists for customers.

## Out of scope

- Any screen or nav destination — People's own ticket builds that.
- Derived balance / statement of what a customer owes — ticket 08 (credit
  sales) introduces the first data to derive it from.
- Repayment recording — a later People-stage concern.
