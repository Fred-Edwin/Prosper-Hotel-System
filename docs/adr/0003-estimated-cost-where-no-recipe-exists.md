# 0003 — Cooked food without a recipe is costed by estimate, not left at zero

**Date:** 2026-08-05
**Status:** Superseded by [0005](0005-cost-of-goods-sold-from-consumption.md)

## Context

Cooked food has no purchase price. Its cost lies in the ingredients consumed to produce it,
and the client was clear that the relationship between the two is not formally measured today.

Recipes with expected yields solve this — but only for the items where a reliable yield is
known, which the client said is *some* items, not all. Most cooked food will have no recipe,
certainly at launch and probably for a long time afterwards.

This leaves a hole in every figure that depends on cost: cost of goods sold, gross profit, net
profit, stock value, and the value of wastage and staff meals.

## Decision

Where a cooked product has no recipe, its unit cost is estimated as a fixed proportion of its
selling price:

```
estimated_unit_cost = selling_price × 0.60
```

The proportion is a single configurable number, taken from the client's own working
assumption about her margins. It is not set per product.

**Every figure derived from an estimated cost is labelled as estimated wherever it appears.**

## Alternatives considered

**Leave the cost at zero.** Honest, and wrong in a damaging direction: revenue from cooked
food would count in full while its cost counted not at all, making gross profit look far
better than reality. A number that is confidently wrong about money is worse than one that is
admittedly approximate.

**Require a recipe for every cooked product before it can be sold.** Would give real costs
throughout. Rejected as unusable — the client does not know reliable yields for most of her
menu, and blocking sales on data she does not have would stop the business trading.

**Estimate per product rather than globally.** More accurate in principle, but it asks the
client to guess a margin for roughly a hundred items, and a guessed per-item figure is no more
trustworthy than one guessed figure applied consistently. Rejected as false precision.

## Consequences

**Good.** Profit is approximately right rather than flatteringly wrong. Every recipe added
moves figures from estimated to real, which makes the work of building recipes visibly
valuable rather than invisible housekeeping. The proportion of a report resting on estimates
is itself a number worth showing.

**Bad, and accepted.** Where an item's true margin differs from the assumed proportion, its
profit is wrong in proportion. The estimate cannot be validated without the recipe that would
have made it unnecessary.

Reports must carry an estimated/measured distinction throughout, which is a permanent
presentation burden — no figure touching cooked food can be shown as a bare number.

**Cash figures are unaffected.** Money in and money out are measured, never estimated. When
profit and cash disagree, the estimate is the likely cause, and the cash figure is the one to
trust.

**Reversible in principle, but not cheaply.** The fallback path runs through costing,
reporting and every screen that displays a cost. Removing it later would require every cooked
product to have a recipe first — which is the condition that does not hold today and is the
reason this decision exists.
