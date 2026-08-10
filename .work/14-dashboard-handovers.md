# 14 — Dashboard: today's handovers at a glance

**Type:** plumbing (test-after)
**Blocked by:** 13 (a handover to show)

## What this delivers

The Dashboard admin destination (currently `NotBuilt`) gets its first
real content — the owner's first live number, replacing the placeholder
every admin destination has shown since the shell tranche. design.md
frames Dashboard as "today's figures and what needs you" and specifically
calls out handover discrepancies as the kind of thing that belongs there
("counts": handovers that disagree).

Shows today's restaurant handovers across all staff who've recorded one:
per person, expected vs. actual, cash and M-Pesa, and whether they agree.
Someone short or over is visually distinguished (design.md's "tone:
danger" pattern already exists in the nav — same idea here) so the owner
notices without reading every row.

Canteen is not included — no Takings, no canteen handover exists yet.
The screen should read as "restaurant handovers today," not imply
canteen coverage that doesn't exist.

## Lifecycle

No new record type — reads `Handover`s (ticket 13) already written. No
create/update/delete/undo surface of its own.

- **Read:** today's handovers, restaurant only, all staff who've
  recorded one, refreshed on load.

## Acceptance criteria

- [ ] Dashboard route shows today's restaurant handovers, one row per
      staff member who has recorded one: name, expected cash/actual
      cash/difference, expected M-Pesa/actual M-Pesa/difference.
- [ ] A handover that doesn't agree (cash or M-Pesa) is visually flagged
      distinctly from one that agrees.
- [ ] Staff who haven't handed over yet today are not shown as a row
      (not the same as a zero/agreed handover) — or are shown distinctly
      as "not yet handed over," whichever reads more honestly; decide
      during the ticket and note which was chosen.
- [ ] No canteen data appears or is implied.
- [ ] Empty state (no handovers recorded yet today) uses
      `EmptyFirstUse`, not a blank dashboard.
- [ ] Loading and error states follow `components/patterns/states.tsx`.
- [ ] Owner-only, or reachable by any admin-capable role — match whatever
      gating the rest of Dashboard's eventual content will need; if
      undecided, default to owner-only and note it as a stopgap.
- [ ] Storybook story covers the dashboard's states (empty, agreed rows,
      a flagged mismatch row).

## Out of scope

- Canteen handovers.
- Any other Dashboard content (profit, cash position, low stock) —
  those depend on modules not yet built; this ticket is handover-only.
- Historical (non-today) handover viewing — Ledger's territory, later.
