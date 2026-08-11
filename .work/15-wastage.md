# 15 — Wastage, consumption, and complimentary items

**Type:** logic (test-first)
**Blocked by:** None (`stock`'s ledger and `wasted` reason already exist;
`corrected` stays untouched — this is a distinct concept, see below)
**Status:** done

## What this delivers

The `wastage` staff-nav placeholder (currently `NotBuilt`) becomes real.
CONTEXT.md's Non-sales Stock Consumption: stock that left without being
sold — **wasted** (spoiled/ruined), **consumed** (used by the business),
or **given away** (complimentary). "One category, because the act is the
same... and the client reads them together," but each recorded entry
still carries which of the three it was.

Both cashiers and store managers can record this (proposal.md: cashiers
record "wastage observed during their shift"; store manager's role
description implies the same for the store side) — unlike receiving,
this isn't restricted to store manager/owner.

**Valuation, at record time:** CONTEXT.md — "at cost, the expenditure
incurred; and at selling price, the sale that was missed." Cost comes
from a purchase price or recipe cost where known; where none exists,
**cost is estimated at 60% of selling price**, and such rows are marked
estimated. The estimate "is for this report only and never feeds
profit" — this ticket only needs to compute and store/display these two
figures per entry, not wire them into a profit calculation (no
`reporting` module work here).

**Distinct from a correction.** CONTEXT.md is explicit these are
different acts — a correction is "the record being wrong" and may be
positive; wastage/consumption/given-away is stock that genuinely left,
always negative, recordable by any staff member. This ticket does not
touch `corrected`.

## Lifecycle

No new record type — this writes `StockMovement`s using the existing
`wasted` reason (the enum currently only distinguishes `wasted`; if
`consumed` and `given away` need their own reason values rather than a
sub-field on `wasted`, decide and extend the enum during this ticket,
noting the choice).

- **Create:** an entry records product/ingredient, quantity, and which
  of the three (wasted / consumed / given away) at the recording staff
  member's location. Rejected if quantity is non-positive or the item is
  inactive.
- **Read:** current stock reflects the reduction immediately via
  `getCurrentStockAtLocation`. A history/list view is out of scope —
  same reasoning as receiving (ticket 12) deferring its own history.
- **Update:** not allowed.
- **Delete:** not allowed.
- **Undo:** not built in this ticket — same deferral pattern as ticket
  12's receiving.

## Acceptance criteria

- [ ] An entry can be recorded for a product or ingredient: item,
      quantity, category (wasted / consumed / given away), at the
      recording staff member's location.
- [ ] Recording an entry creates a stock movement reducing current stock
      by the recorded quantity, verified via `getCurrentStockAtLocation`.
- [ ] Each entry computes and stores its cost-basis value (purchase
      price or recipe cost where known) and its selling-price value
      (product's price, where the item has one).
- [ ] Where no cost is known, cost is estimated at 60% of the item's
      selling price, and the entry is marked as an estimate.
- [ ] An entry for an inactive item is rejected.
- [ ] An entry with non-positive quantity is rejected.
- [ ] Any authenticated staff member (not just store manager/owner) can
      record an entry at their own accessible location.
- [ ] **Screen:** the `wastage` staff-nav placeholder becomes real — item
      picker → quantity → category (wasted/consumed/given away) →
      confirm.
- [ ] Confirmation, loading, and error states follow
      `components/patterns/states.tsx`.
- [ ] Storybook stories cover the flow's states.

## Out of scope

- Stock corrections (`corrected` reason) — a distinct, owner-only
  concept, untouched here.
- Any reporting/profit view of wastage totals — later reporting-stage
  concern; this ticket only produces the per-entry figures.
- A wastage history/list screen.
- Undo of a recorded entry.
