# 13 — Record a restaurant handover

**Type:** logic (test-first)
**Blocked by:** None (Today's sales, ticket 09, already computes the exact
figure this needs)
**Status:** done

## What this delivers

The `handover` staff-nav placeholder (currently `NotBuilt`) becomes real,
for the restaurant only. proposal.md §5 / CONTEXT.md's `Handover`: money
physically handed to the owner, for one location, one day, checked
against an **expected** amount.

For the restaurant, expected is "the sum of that person's recorded sales
for the day" (CONTEXT.md) — cash sales sum to expected cash, M-Pesa sales
sum to expected M-Pesa, credit is excluded entirely ("no money changes
hands at the point of sale," proposal.md §5). This is the same
computation Today's sales (ticket 09) already performs per staff member,
per day — this ticket reuses it rather than re-deriving it.

The handover records what was **actually** handed over and shows the
difference. It never blocks — proposal.md §5: "No transaction is blocked
as a result." A void sale (ticket 10) is excluded from the expected
figure, same as Today's sales already excludes it from view.

**Editable the same day.** Recording actuals is a fast, count-as-you-go
action, and miscounts are the common case — the same reasoning ticket 10
applied to a wrong sale applies here: same-day, no special permission,
edit in place (not a reversing entry, since a handover's actual amount
carries no downstream stock/cash effects the way a sale does — there is
nothing to reverse, only a figure to correct). After the day closes, this
becomes owner-only, mirroring the sale-void rule, once "closed day" is a
real state (a later stage) — until then every day is still open, same
stopgap ticket 10 already uses.

Canteen is explicitly out of scope — its expected figure comes from
Takings (Stage 4, not built).

## Lifecycle

- **Create:** a handover is recorded once per staff member, per day, per
  location — actual cash amount and actual M-Pesa amount. Expected
  amounts are computed at record time, not entered.
- **Read:** the staff member sees their own handover (expected vs.
  actual vs. difference, cash and M-Pesa separately) after recording.
  Cross-person/cross-day viewing is ticket 14's Dashboard, not this
  ticket.
- **Update:** the actual cash and/or actual M-Pesa amount can be edited,
  same day, before close, by the staff member who recorded it — no
  special permission needed, matching ticket 10's same-day void rule.
  The difference is recomputed against the same expected figures. Editing
  after close is out of scope (see Out of scope) until "closed day"
  exists as a real state.
- **Delete:** not allowed.
- **Undo:** covered by Update above — a handover is corrected in place,
  same day, rather than reversed. There is no downstream stock/cash
  effect to reverse, unlike a sale.

## Acceptance criteria

- [ ] A staff member can record a handover for their own current day at
      their own location: actual cash amount, actual M-Pesa amount.
- [ ] Expected cash = sum of that staff member's non-void `counter`- and
      `delivery`-fulfilled sales' cash payment lines, recorded today, at
      their location. Same for expected M-Pesa. Credit payment lines are
      excluded from both.
- [ ] The difference (actual − expected) is computed and shown for cash
      and M-Pesa separately, matching proposal.md §5's example shape
      (recorded, handed over, difference — or "Agreed" when they match).
- [ ] A mismatch does not block recording — the handover is saved
      regardless of whether it balances.
- [ ] A second handover attempt for the same staff member, same day,
      same location edits the existing one in place (updates actual
      amounts, recomputes the difference) rather than creating a second
      record.
- [ ] The actual amounts can be edited same-day, before close, with no
      special permission required.
- [ ] `canAccessLocation()` gates recording, same pattern as other
      location-scoped writes.
- [ ] **Screen:** the `handover` staff-nav placeholder becomes real —
      shows expected cash/M-Pesa (read-only, computed), actual-amount
      inputs, confirm, then a result view showing the difference per
      proposal.md §5's shape.
- [ ] Loading, confirmation, and error states follow
      `components/patterns/states.tsx`.
- [ ] Storybook stories cover the handover flow's states (agreed, short,
      over).

## Out of scope

- Canteen handover (needs Takings, Stage 4).
- Post-close, owner-only editing — no "closed day" state exists yet;
  this ticket implements the same-day/own-entry edit rule only,
  structured so the owner-only-after-close half can be added without
  reshaping this one.
- Any cross-person or historical view — ticket 14 (Dashboard) covers the
  owner's view.
- The cash running balance / money paid out (ticket 16).
