# 10 — Same-day void

**Type:** logic (test-first)
**Blocked by:** 09 (Today's sales — where a past sale is found and voided
from)

## What this delivers

architecture.md's data-lifecycle rule: "a wrong sale is voided: a
reversing entry returns stock and cash to where they were, and the
original stays readable, marked void, attributed." This ticket builds
that for sales — any role may void their own recorded sale, same day,
before close; after close, owner only. (Close of day itself is a later
stage — until it exists, every day is effectively still open, so this
ticket only needs to implement the same-day/own-entry rule now and the
post-close/owner-only half becomes live once "closed day" is a real
state.)

Voiding a sale reverses every stock movement it created (a compensating
movement, not a deletion — matches `stock`'s existing append-only
ledger) and marks the sale void; it stays visible, attributed, with its
original figures intact.

Void is wired into ticket 09's Today's sales list — a cashier finds the
sale there (whether it's the one just recorded or from earlier in the
shift) and voids it from its detail view. No separate confirmation-view
special case is built; ticket 09 already covers "the sale just
recorded" as the newest row in the same list.

## Lifecycle

- **Create:** a void is a new action against an existing sale, not a
  record type of its own — it flips the sale to void and writes
  compensating stock movements.
- **Read:** a voided sale remains readable with its original lines and
  payment breakdown, plus a void marker (who voided it, when) — shown in
  ticket 09's list and detail view.
- **Update:** not applicable.
- **Delete:** not applicable — nothing is deleted, per the reversal
  model.
- **Undo:** a void itself cannot be un-voided in this ticket — re-doing a
  wrongly-voided sale means recording a new sale. Un-voiding is not
  something proposal.md asks for and isn't invented here.

## Acceptance criteria

- [ ] The staff member who recorded a sale can void it the same day,
      before close, with no special permission required.
- [ ] A different staff member (not the recorder) can also void it the
      same day — architecture.md says "any role," not "only the
      recorder" — confirm this reading holds, since the doc's wording is
      about role, not about who specifically recorded it.
- [ ] Voiding a sale creates compensating stock movements that return
      every stocked line's quantity, verified via
      `getCurrentStockAtLocation` returning to its pre-sale level.
- [ ] A voided sale is marked void and remains fully readable (lines,
      payment breakdown, who recorded it) rather than hidden or deleted.
- [ ] Voiding an already-void sale is rejected.
- [ ] **Screen:** ticket 09's sale detail view gains a "Void" action, and
      the list shows a "Voided" badge on that row afterward.
- [ ] Confirmation/error states for the void action follow
      `components/patterns/states.tsx`.

## Out of scope

- Post-close, owner-only voiding — no "closed day" state exists yet
  (later roadmap stage); this ticket implements the same-day/any-role
  half only, structured so the owner-only-after-close half can be added
  without reshaping this one.
- Any summary/count of a day's voids ("visible... a cashier with fifteen
  voids in a day should be visible") — that's a reporting/summary concern
  for once such a summary screen exists.
- Voiding individual sale lines rather than the whole sale.
