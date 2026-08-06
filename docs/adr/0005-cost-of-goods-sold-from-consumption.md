# 0005 — Cost of goods sold is measured from consumption, not accumulated per sale

**Date:** 2026-08-05
**Status:** Accepted
**Supersedes:** [0003](0003-estimated-cost-where-no-recipe-exists.md)

## Context

ADR 0003 decided that cooked food without a recipe would be costed at 60% of its selling
price, and that this cost would be stamped onto each sale to build cost of goods sold.

Review of that decision found two defects.

**It double-counts.** Ingredients consumed by the kitchen already reduce ingredient stock and
therefore already constitute a cost. Applying a further estimated cost to the resulting sale
counts the same potatoes twice — once as consumption, once as an estimated cost of sale.
Reported profit is understated, and stock valuation and cost of goods sold no longer agree.

**It is circular.** Deriving cost from selling price is a retail estimation technique used for
interim figures in the absence of a physical count. It is not a method for costing production,
because selling price is supposed to be set from cost rather than the reverse.

Meanwhile, the business already records the figure that solves this: the kitchen records
ingredient consumption daily, and both locations count stock.

## Decision

**Cost of goods sold is derived from stock movement, not from individual sales.**

```
COGS = opening stock + purchases − closing stock   (± transfers)
```

Applied per location, daily at the restaurant and weekly at the canteen.

Recipes are demoted from a costing prerequisite to what they properly are: a source of
per-unit cost and of yield variance. They do not participate in cost of goods sold.

The 60% estimate is retained for two narrow purposes only — valuing non-sales consumption for
reporting, and valuing cooked food transferred between locations. Neither affects the
business-wide total.

## Alternatives considered

**Retain ADR 0003.** Rejected on the defects above. The error is not marginal: it affects every
profit figure the system produces.

**Require recipes for all cooked products before profit can be reported.** Would permit
per-sale costing throughout. Rejected for the reason given in ADR 0003 — reliable yields are
not known for most of the menu — and now unnecessary, since consumption-based costing needs no
recipes at all.

**Report profit for the business only, never per location.** Would avoid valuing transfers
entirely, since transfers cancel at the business level. Rejected because the client asked for
per-location profitability explicitly during discovery.

**Credit revenue to the producing location rather than the selling location**, so that cooked
food sold at the canteen counts as restaurant revenue and no cost transfer is needed. Rejected
because the money follows the sale: the attendant receives cash and M-Pesa for those items,
and they appear in her takings and her handover. Booking the revenue elsewhere would break the
reconciliation between takings and recorded revenue, which is the client's principal control.

## Consequences

**Good.** Gross and net profit are measured rather than estimated, at both locations and for
the business. The method is standard practice and requires no data the business does not
already record. Stock valuation and cost of goods sold are derived from the same movements and
cannot disagree.

**Bad, and accepted.** Per-plate profitability is unavailable for cooked food without a
recipe, since that genuinely requires a unit cost. The client cannot ask which menu item earns
most until yields are recorded. This is a real loss of insight, but the totals she asked for
are unaffected.

**Transfers must be valued** so that per-location profit is meaningful. The value is estimated
where no recipe exists, using the restaurant's own measured food-cost rate. Because the same
value is subtracted from one location and added to the other, it cancels: the business total
is identical whatever rate is used, and an error moves profit between locations rather than
creating or destroying it. Both sides must always use the same figure.

**Cooked food at the canteen has no stock control.** It is never present at a count, so no
closing balance exists against which a shortfall could appear. The weekly count controls
packaged goods only. This follows from the stock being perishable rather than from the costing
method, and it is stated to the client rather than concealed.

---

## Amendment, 2026-08-05

**The final consequence above is withdrawn.** It rested on an assumption that proved false:
that cooked food transferred to the canteen is always sold or discarded the same day.

The client confirmed that leftovers do occur, and that they are held and sold the following day
rather than written off. Cooked food at the canteen therefore has a closing balance like any
other stock, and the ordinary formula applies — opening, plus transfers in, less closing, less
wastage. Where nothing is left, closing is zero and the result equals that day's transfers,
which is the case the original text mistook for the rule.

**Two consequences follow.** Cooked food at the canteen is counted daily and is subject to the
same stock control as anything else, so the gap described above does not exist. And the
attendant counts cooked food daily — a short count of a few items, distinct from the packaged
goods whose bulk makes daily counting impractical.

The decision itself is unaffected: cost of goods sold remains derived from consumption rather
than accumulated per sale.
