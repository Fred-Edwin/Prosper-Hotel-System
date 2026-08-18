# 0001 — Stock is a movement ledger, not a stored quantity

**Date:** 2026-08-05
**Status:** Accepted

## Context

The business needs to answer, for any item on any past day: what it opened with, what was
added, what was transferred in or out, what was sold, what was wasted or otherwise consumed,
and what should therefore have been left at close. This is the shape of the owner's existing
Excel sheets, built over years of running the business, and it works. Any replacement has to
be at least as good at answering "what happened to this item that day."

Stock also leaves through several routes the owner distinguishes clearly — sold, wasted,
consumed internally, given away, corrected — and she wants them kept apart rather than lumped
together as "missing."

## Decision

There is no stored stock quantity. A stock level is the sum of a single append-only list of
**stock movements**, each carrying a reason, a location, a timestamp and the person who
recorded it.

For speed, a **daily closing balance per item per location** is frozen at close of day.
Current stock is last night's close plus today's movements.

## Alternatives considered

**A stored quantity, updated on each transaction.** The conventional design. Rejected because
a stored number can drift out of agreement with the events that produced it, and when it
does there is no way to find out why. It also cannot answer the Excel question without a
separate history table — which is this decision, arrived at more expensively.

**A separate table per movement reason** — receipts, wastage, transfers, corrections. Rejected
because every read of an item's history would have to merge eight sources in date order, and
a ninth reason would mean a new table plus a change to every one of those reads.

## Consequences

**Good.** The stock level cannot disagree with its own history, because it *is* its own
history. A new movement reason is one new value, and everything that reads stock picks it up
for free. The daily close is simultaneously the performance mechanism, the client's existing
mental model, and the figure a physical count is checked against.

**Bad, and accepted.** The reasons genuinely differ in what they carry — a receipt has a
supplier and a cost, a transfer has two locations, a correction has a counted figure. Some
fields therefore apply only to some reasons. This is the real cost of one list, and it is
smaller than the alternative.

Closing a day becomes a real event that someone must trigger. A day closes even when it does
not balance; the discrepancy is recorded rather than blocking the next day's trading.

**Hard to reverse.** Every report, every screen and every correction in the system reads
through this shape. Changing to a stored quantity later would mean rewriting all of them and
discarding the history that makes corrections truthful.

---

## Amendment — 2026-08-18 (editable-ledger T10)

**The decision stands. Stock is still the sum of its movements, and there is still no
stored stock quantity.** ADR 0008 makes ledger figures editable in place, and this
decision is what made that affordable rather than what it overturns: because a quantity
is derived, correcting a past day requires writing one `corrected` movement and nothing
else. Every following day, along with cost of goods sold and profit, moves on the next
read. A stored quantity would have made the same feature a fan-out write across every
affected day, and would have reintroduced exactly the drift this ADR exists to prevent.

Two things above need correcting against what was actually built.

**The frozen daily closing balance was never implemented, and is not planned.** The
Consequences section describes each location freezing a daily closing balance per item at
close, and treats "closing a day" as a real event someone must trigger. Neither exists in
the code. Stock is summed live from movements on every read, and days are derived
windows rather than records that get closed. The performance concern that motivated the
freeze has not materialised at this data volume; the Excel-shaped ledger (opening, in,
out, closing) that the freeze was also meant to provide is produced by the reporting
layer directly from movements.

The withdrawal is load-bearing for ADR 0008 rather than incidental: had the frozen close
existed, an amendment to a past day would have had to invalidate and rebuild every frozen
balance after it, which is the version of this feature that would have been genuinely
hard.

**"A day closes even when it does not balance" survives in substance,** since a
discrepancy is still recorded rather than blocking trading — but it is a property of how
counts and handovers are recorded, not of a close event.

**What "correction" means here has changed.** Where this ADR lists corrections among the
movement reasons, that is still accurate — `corrected` is a reason like any other. But the
*route* by which one is created is now an in-place ledger edit (ADR 0008), not a
backdated compensating entry carrying a past effective date. The movement written is the
same shape; what changed is the motion the owner performs and the fact that every such
edit now carries an `Amendment` trail entry recording both values.
