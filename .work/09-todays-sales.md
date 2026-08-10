# 09 — Today's sales (staff shell)

**Type:** plumbing (test-after)
**Blocked by:** 07 (a sale to list)
**Status:** done

## What this delivers

Right now the only way to see a sale is the confirmation view shown once,
immediately after recording it — there's no way to look back at anything
recorded earlier in the shift. This ticket adds a **Today's sales**
screen: a list, for the current staff member, of every sale they've
recorded today at their location, each showing its total, payment
breakdown, and status (voided or not).

This is read-only. It exists so a later ticket (10) can wire voiding into
it — a cashier needs to find a past sale before they can void it — and so
a cashier can answer "how much have I taken so far today" without waiting
for handover. (Handover's own expected-amount figure is assembled from
recorded sales later, per proposal.md §5 — this list is the same
underlying data, viewed by the person who made it, not yet the handover
check itself.)

This is a new staff-nav destination, not an extension of New sale — the
`sell` link opens the till; this is a separate link for looking back at
what's already been recorded, matching design.md's "destinations are
expensive, views are cheap" only where the two are genuinely different
tasks (recording vs. reviewing), which they are.

## Lifecycle

No new record type — this reads existing `Sale`s. No
create/update/delete/undo surface of its own.

- **Read:** list view only — sales recorded today, by this staff member,
  at their location, newest first. Selecting one shows its full detail
  (lines, payment breakdown, status) inline or as a drill-down, per
  design.md's "views are cheap" — not a new destination.

## Acceptance criteria

- [ ] A new staff-nav destination lists today's sales for the signed-in
      staff member at their location only (not other staff, not other
      locations, not other days).
- [ ] Each row shows the sale total, payment method(s), and whether it's
      voided.
- [ ] Selecting a sale shows its full detail — lines, quantities, payment
      breakdown, who recorded it, any credit customer attached.
- [ ] An empty day (no sales recorded yet) shows `EmptyFirstUse`, not a
      blank list.
- [ ] Loading and error states follow `components/patterns/states.tsx`.
- [ ] `canAccessLocation()` gates the read, same pattern as `stock` and
      `sales`' existing checks.
- [ ] Storybook stories cover the list's states (empty, loaded, with a
      voided sale shown distinctly).

## Out of scope

- Voiding a sale from this list — ticket 10 wires that in once this list
  exists to wire it into.
- Any other staff member's sales, or any other day's sales.
- Totals/summary figures beyond what's naturally visible per-row (no
  running cash/M-Pesa subtotal here — that's handover's job, a later
  stage).
- An admin/owner-facing version of this (Ledger) — separate destination,
  separate ticket, once there's reason to build a cross-cutting view.
