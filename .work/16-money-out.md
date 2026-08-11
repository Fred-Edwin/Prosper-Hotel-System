# 16 — Money out: recording payments in four categories

**Type:** logic (test-first)
**Blocked by:** 12 (receiving) — the Stock category is defined as always
paired with a `Received` stock movement, so this ticket needs a real
receipt to pair against rather than inventing that link speculatively
**Status:** done

## What this delivers

The `money-out` admin destination (currently `NotBuilt`) becomes real.
proposal.md §6 / CONTEXT.md's Payment: every payment the owner makes out
carries one of four categories, which behave differently in profit:

- **Stock** — goods/ingredients bought from suppliers. Becomes cost of
  goods sold. **Always paired with a Received stock movement** (ticket
  12) — recording a Stock-category payment references the receipt it
  pays for.
- **Running cost** — gas, charcoal, electricity, rent. Subtracted from
  profit in the period it falls.
- **Asset** — furniture, utensils, equipment. **Not subtracted from
  profit** — converts cash into a retained thing, not an expense.
- **Personal drawing** — money the owner takes for herself. Not a
  business expense; recorded as a debt owed back to the business.

Only the owner records payments (proposal.md's role list: "recording
payments out... including stock purchases and running costs" is
owner-restricted).

This ticket records payments and their categorization; it does **not**
build the running cash balance (CONTEXT.md's Cash Movement — "every
individual movement is a delta; the balance is what makes the expected
cash figure traceable") — that reads across handovers-in and payments-out
together, which belongs in a follow-on ticket once both sides exist.

## Lifecycle

- **Create:** a payment is recorded with an amount, a category, and (for
  Stock) a reference to the receipt it pays for. Drawings additionally
  create an amount-owed entry back to the business (CONTEXT.md: "recorded
  as a cash movement out and a debt owed back"). Rejected if amount is
  non-positive, or if a Stock-category payment references a receipt that
  doesn't exist or belongs to a different location.
- **Read:** a list of payments, filterable by category — this is the
  bulk of what `money-out`'s screen shows. No running-balance figure yet
  (deferred, see above).
- **Update:** not edited in place — corrected by reversal, same
  principle as ticket 10's sale void: a wrong payment is reversed, the
  original stays readable and marked reversed, never silently changed.
- **Delete:** not allowed.
- **Undo:** a payment can be reversed, same day, owner-only (the same
  role already required to create one). Reversing a Stock-category
  payment does not touch the paired receipt's stock movement — the
  goods still arrived; only the payment record is wrong. Reversing a
  Personal-drawing payment also reverses the debt entry it created.
  Post-close reversal is out of scope, same stopgap as tickets 10/13
  (no "closed day" state exists yet).

## Acceptance criteria

- [ ] A payment can be recorded with an amount and one of the four
      categories.
- [ ] A Stock-category payment requires referencing an existing receipt
      (ticket 12); rejected without one.
- [ ] A Personal-drawing payment additionally creates an amount owed back
      to the business, readable as a running total per owner-drawings
      (or noted as a single, ever-growing figure if a "settled" concept
      doesn't exist yet — decide the simplest honest shape and state it).
- [ ] Assets are recorded but never subtracted from any profit figure —
      this ticket doesn't compute profit, but the category is stored so
      a later reporting ticket can honor this rule without re-deriving
      it.
- [ ] A payment with non-positive amount is rejected.
- [ ] Only the owner can record a payment; other roles are denied at the
      route.
- [ ] A payment can be reversed the same day by the owner: a reversing
      entry is written, the original is marked reversed and stays fully
      readable (amount, category, receipt reference if any), and it is
      excluded from any running total the same way the drawing debt or
      stock pairing would otherwise still count it.
- [ ] Reversing a Personal-drawing payment also reverses the amount-owed
      entry it created.
- [ ] Reversing an already-reversed payment is rejected.
- [ ] **Screen:** the `money-out` admin destination becomes real — a list
      of recorded payments (filterable by category, reversed ones shown
      distinctly) plus a form to record a new one, with the Stock
      category's receipt picker, and a reverse action per payment.
- [ ] Loading, empty, and error states follow
      `components/patterns/states.tsx`.
- [ ] Storybook stories cover the destination's states, including each
      category's form shape.

## Out of scope

- The running cash balance (money in minus money out) — CONTEXT.md's
  Cash Movement concept; a follow-on ticket once handover (in) and this
  ticket (out) both exist to read across.
- Post-close reversal (owner-only-after-close) — no "closed day" state
  exists yet; this ticket implements same-day reversal only.
- Settling an owner's drawing debt.
- Any profit calculation — later reporting-stage concern.
