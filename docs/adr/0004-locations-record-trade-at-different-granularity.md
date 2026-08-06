# 0004 — The two locations record trade at different granularity

**Date:** 2026-08-05
**Status:** Accepted

## Context

The restaurant and the canteen trade differently, and the difference is physical rather than
preferential.

At the restaurant, cashiers can record each sale as it happens. Stock is counted daily by the
store manager, who does not work the till and has time to count.

At the canteen, students arrive in a rush. The attendant works alone, serving and handling
money at the same time; she reads M-Pesa messages as she distributes items. She cannot operate
a phone mid-rush. Her stock is packaged goods in quantity — boxes of biscuits, cartons of
sweets — and counting them daily is a chore with no daily payoff.

Requiring per-sale entry at the canteen would not produce per-sale data. It would produce
figures reconstructed from memory after the fact, entered as though observed.

## Decision

Granularity of recording is a property of the location.

**Restaurant** — individual sales, counted daily. Stock discrepancy is the difference between
the count and what the recorded sales predicted.

**Canteen** — daily **takings** (cash and M-Pesa totals only), counted weekly. Item-level
sales are **derived** at each count: everything known is subtracted from the movement between
counts, and the remainder is recorded as `Sold, derived`.

Derived sales are stored under their own reason and never merged with recorded sales, so no
report can present an inference as an observation.

Credit sales are recorded individually at both locations regardless, because a debt needs a
named customer and cannot wait for a count.

## Alternatives considered

**Require per-sale recording at both locations.** Uniform, and every figure available daily
everywhere. Rejected because the attendant physically cannot do it during trade. The data
would be invented, and invented data that looks measured is worse than data honestly labelled
coarse — it would corrupt profit, stock and the handover control simultaneously.

**Take no item-level data at the canteen at all**, tracking only money. Simpler, and honest.
Rejected because it abandons stock control at the location most exposed to it: a shop of small
packaged goods, run single-handed, where the daily cash check is self-reported. The weekly
count is the only thing that tests whether declared takings match what actually left the
shelf.

**Count the canteen daily but still skip per-sale entry.** Would give daily derived figures.
Rejected on the client's evidence that daily counting of boxed goods is impractical, and
because a daily derived figure would be dominated by counting noise rather than signal.

## Consequences

**Good.** Each location records what it can actually record. The canteen keeps a real stock
control — weekly rather than daily, but genuine. M-Pesa remains independently verifiable at
both locations, because the paybill messages are evidence the attendant does not author. Two
controls run at two frequencies: money daily, stock weekly.

**Bad, and accepted.**

- **The canteen has no meaningful daily profit.** Its cash position is daily and exact;
  anything requiring item detail is only true as at the last count. Reports must not offer a
  daily canteen profit figure.
- **The canteen's daily cash check is weaker than the restaurant's.** The same person states
  the expectation and hands over the money. It verifies the handover, not the declaration.
  Sustained under-declaration surfaces only at the weekly count.
- **Derived sales absorb several causes at once** — genuine sales, breakage, miscounting,
  theft — and cannot separate them. A single week's variance is noise; a pattern is signal.
- **Low-stock warnings at the canteen are stale between counts.**

**Every report touching the canteen must carry the granularity distinction**, permanently.
This is a presentation burden that does not go away.

**Hard to reverse.** Granularity runs through stock, sales, reporting and the handover
control. Moving the canteen to per-sale recording later would be a business change first — the
constraint is how the canteen trades, not how the software is written — and any historical
comparison would span two incompatible bases.
