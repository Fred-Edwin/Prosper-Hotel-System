# Formulas — Prosper Hotel

Every financial figure the system produces, how it is calculated, and a worked example of each.

Vocabulary is in `CONTEXT.md`.

**Two rules hold everywhere:**

- Cash and M-Pesa are never added together. Every money figure exists separately for each.
- Cancelled entries count nowhere. They stay readable, but no calculation includes them.

**The idea underneath all of it:** profit counts what was **consumed**; cash counts what was
**paid**. A freezer is paid but not consumed. Ingredients still on the shelf are paid but not
consumed. That gap is the whole difference between the two.

---

## 1. Expected stock

**What it answers:** what should be on the shelf right now.

```
closing = opening
        + received + produced + transferred in
        − sold − wasted − consumed − given away − issued − transferred out
        ± corrections
```

Yesterday's closing is today's opening. Once a day is closed its figures never change — a later
correction is a new entry carrying a past date, not an edit.

**Example.** Sodas at the canteen: opened with 40, received 24, sold 30, one broke.

```
40 + 24 − 30 − 1 = 33 expected
```

*Revised 2026-08-15.* At the restaurant, "sold" here means individually recorded sales, as
always. At the canteen, "sold" is not recorded separately from breakage or any other shrinkage
— see §2. The formula above still describes what the restaurant's daily count checks against;
the canteen no longer has a same-day "expected" to check, since a count there **produces** the
sold figure rather than being compared against one — see §2's revision.

---

## 2. Stock count

**What it answers:** does reality match the record.

```
difference = counted − expected
```

Negative means short. The count never changes the record on its own — it records what was
counted and shows the gap. Only the owner may correct.

**Example, restaurant.** 33 expected, 31 counted. Short by 2.

*Revised 2026-08-13, revised again 2026-08-15.* At the **restaurant**, the 2026-08-13 wording
still holds unchanged: the count is a pure shrinkage check, `difference = counted − expected`,
and has no bearing on what sold — that comes from individually recorded sales.

**At the canteen**, this section no longer applies as written. A count is how the system learns
what sold, not a check against an independent sales figure:

```
sold = expected − counted   (only where counted is short of expected)
```

There is no separate "difference" to report at the canteen — the shortfall itself *is* the
sold quantity, written as a real `sold` movement (§1). A shortfall no longer means "investigate
a possible loss"; it means "this is what sold since the last count," the same reading the
client's own manual process always gave it. A **surplus** (counted above expected) produces no
sale and is not itself explained — treated the same as any other unexplained gap, resolved by
the owner if it recurs, not by this formula.

**Example, canteen.** 40 expected, 33 counted.

```
40 − 33 = 7 sold
```

**Booked on the count's own date.** Whatever a count implies about the days since the previous
one is recorded entirely on the day the count was taken — not spread across the intervening
days, which show no canteen sales until that count lands. See `docs/scope.md`'s 2026-08-15
entry.

---

## 3. What an ingredient costs

**What it answers:** flour was bought three times at three prices — what is it worth now?

**The price paid on the most recent delivery.** The price the owner types *is* the cost.
Nothing is blended into it.

**Example.** 10kg on hand at KSh 80. Buy 20kg at KSh 95. The cost is **KSh 95** per kg.

**Stock already on hand keeps what it cost.** A new price applies from its own delivery
forward and never reaches backwards. So the 10kg bought at 80 stays valued at 80 until it is
used up; only the 20kg newly bought is worth 95. Stock leaving is drawn down oldest-first.

**Why this replaced a running average (2026-08-17).** §6 values stock at a period's two
boundaries using each item's cost, and purchases enter that formula at the price actually
paid. A blended average made those two figures disagree: newly delivered stock was valued at
the average rather than at what was paid for it.

Potatoes carried the owner's own hand-entered KSh 326.79 on 3.5 units; 12 arrived at KSh 300;
the average became KSh 306.05. The 12 new units cost 300 each but were valued at 306.05, and
that gap surfaced as a reported **cost of goods sold of −72.6 on a day nothing was sold**:

```
12 × (306.05 − 300)  =  KSh 72.60
```

Taking the delivery price literally closes it — purchases now enter and are valued at the
same figure, so the two sides cancel exactly.

The original objection to per-delivery costing was that it requires knowing which sack was
used, and deliveries are received mid-service on a phone. That objection was about *issuing*
stock, and it still stands — which is why nobody is asked, and consumption simply draws down
the oldest delivery first. It was never a reason to average on the way in.

**Where a price is missing.** A stock count records how many, never what they cost. Stock that
enters that way has no delivery price of its own, so it is valued at the item's recorded cost —
the figure the owner entered by hand, which is real data. Where there is no price anywhere, no
valuation is stated at all (§12's "not zero, not a guess"); the quantity still shows on the
Store ledger.

---

## 4. What one item costs

**What it answers:** the cost of a single soda, or a single plate of chips.

**Used for** stock valuation, per-item margin, and valuing stock that was not sold. **It is not
used to work out profit** — see §6.

| | Cost per unit |
|---|---|
| Bought-in goods, packaging | The last delivery price from §3 |
| Cooked food **with** a recipe | Ingredients used ÷ expected yield |
| Cooked food **without** a recipe | Not available — see below |
| Services (printing, binding) | None. Paper and toner are counted as stock instead |

**Example, with a recipe.** 10kg of potatoes at KSh 90 makes 40 plates of chips.

```
(10 × 90) ÷ 40  =  KSh 22.50 per plate
```

### Where there is no recipe

Most cooked food has no recorded yield, so no true unit cost exists. Where a figure is
nonetheless needed, it is estimated:

```
estimated cost = selling price × 60%
```

The 60% is the owner's own figure. Every number based on it is labelled as an estimate.

**This estimate never touches profit.** It is used in exactly two places: valuing stock that
was not sold (§8), and splitting cost between the two locations (§5). Neither changes the
business total. Recording a recipe replaces it with a real figure.

---

## 5. Food sent from the restaurant to the canteen

**What it answers:** the canteen sells the restaurant's food — whose cost is it?

*Revised 2026-08-13.* The cost travels with the food, at the item's own unit cost — the same
recipe cost the restaurant already uses for that item, if one exists. Sending it removes that
cost from the restaurant and adds the same cost to the canteen.

```
cost of the transfer = quantity transferred × the item's recipe cost
```

**Example.** A recipe prices a samosa at KSh 15. 40 samosas go to the canteen.

```
40 × 15  =  KSh 600
```

The restaurant's cost drops by 600. The canteen's rises by 600.

**Why the business total is unaffected.** The same figure is subtracted from one side and added
to the other, so it cancels:

```
Restaurant:  ... − 600
Canteen:     ... + 600
Business:            0
```

**Where the item has no recipe**, its exact unit cost is unavailable — the same limitation §4
describes for any cooked food without a recorded yield. Rather than contribute zero to cost of
goods sold, the same estimate §8 already uses for unsold cooked food without a recipe applies
here: **60% of selling price**. The transfer is recorded at quantity and this estimated cost;
the figure is labelled as estimated wherever it appears (ledger, profit panel), and is
replaced automatically once a recipe is recorded for that item.

```
estimated cost of the transfer = quantity transferred × selling price × 60%
```

**Example.** Chapatis sell at KSh 20, no recipe recorded. 30 go to the canteen.

```
30 × 20 × 60%  =  KSh 360 (estimated)
```

---

## 6. Cost of goods sold

**What it answers:** what did the goods I sold actually cost me?

**Cost of goods sold is what was consumed, not what was paid.** It is worked out from stock
movement, not from adding up costs on individual sales.

### The restaurant — exact, daily

```
opening ingredients + ingredients bought − closing ingredients − food sent to canteen
```

**Example.** Opened with KSh 18,000 of ingredients, bought KSh 9,000, closed with KSh 15,000,
sent KSh 2,400 to the canteen.

```
18,000 + 9,000 − 15,000 − 2,400  =  KSh 9,600
```

The kitchen already records what it consumed daily, so this needs no recipes and no estimates.

### The canteen — same formula as the restaurant

*Revised 2026-08-13, unaffected by the 2026-08-15 return to count-derived canteen sales.* This
formula was previously split into an exact part and a part estimated from a rate measured at
the last count, because the canteen's own goods sold without any record at all. That gap is
what changed on 2026-08-13 and what remains changed now: every canteen sale is a real `sold`
movement, whether it was recorded individually (as it briefly was) or is inferred from a count
(as it is again — see §1/§2). This formula reads `sold` movements directly regardless of which
produced them, so the canteen's return to count-derived sales required no change here — the
same stock formula applies to both kinds of canteen stock, exactly as it does at the
restaurant:

```
cost = opening + received/transferred in − closing − wasted
```

**Food from the restaurant.** Valued at the item's recipe cost, per §5. Leftover food carries
forward as the next day's opening, exactly as stock does anywhere else.

**Example.** Monday: 40 samosas arrive at KSh 15 recipe cost each, none carried in, 8 left at
close.

```
(0 + 40 − 8) × 15 = KSh 480 consumed Monday
```

**The canteen's own goods.** Valued at purchase cost — the last delivery price from §3 — the same
as any bought-in stock. No rate, no estimate: the quantity sold is known directly from recorded
sales, and its cost follows from the purchase price already on record.

**Example.** Sodas cost KSh 45 each on average. 60 opening, 24 received, 70 recorded as sold,
14 counted at close.

```
(60 + 24 − 14) × 45 = KSh 3,150
```

So the canteen's cost for the day is the sum of both parts.

**Which goods are "own goods."** Nothing on a product record says so directly — it is read from
how the item arrived: a product that reached the canteen via a transfer from the restaurant is
restaurant-supplied; a product received directly from a supplier is the canteen's own goods. A
product can be either at different times depending on how a given batch arrived.

### What a count does now differs by location

*Revised 2026-08-13, revised again 2026-08-15.* At the **restaurant**, a count still corrects
nothing — there is no estimate to correct. It compares counted stock against what the movements
say should be there, exactly as §2 describes, and any difference is reported as a variance to
look into.

At the **canteen**, a count is no longer only a shrinkage check — see §2's revision. It is how
that day's canteen sales come to exist at all; a shortfall against expected stock is booked
directly as the sold quantity, not reported as a variance for the owner to investigate
separately.

**Counting is an event, not a timetable, at both locations.** It can happen any day. Weekly is
the habit for the canteen's own goods; the restaurant's daily count and the canteen's daily
cooked-food count continue as before. A canteen count's cadence is independent of Handover's —
see §10.

### For the business

```
business cost of goods sold = restaurant + canteen
```

Transfers cancel between the two, so this total is unaffected by how they are valued.

---

## 7. Profit

**What it answers:** am I making money?

```
sales revenue  −  cost of goods sold  =  gross profit
gross profit   −  operating costs     =  net profit
```

**Sales revenue** is recorded sales at both locations — see `docs/proposal.md` §4.

**Operating costs** are gas, charcoal, electricity, rent and wages.

**Gross profit** answers whether pricing is right. **Net profit** answers whether the business
is earning.

### When each kind of payment reaches profit

The four expense categories (`docs/proposal.md` §8) do not reach profit at the same moment, and
two of them never do. This is the single most misread part of these formulas:

| Payment | Reaches profit | How |
|---|---|---|
| **Operating cost** | When paid | Subtracted directly, in the period it falls |
| **Stock** | When it *sells* | Through cost of goods sold (§6) — never when bought |
| **Equipment** | Never | Cash converted into something still owned |
| **Owner's drawing** | Never | Not a business cost; a debt back to the business |

**Stock is the one that catches people out.** Buying KSh 61,500 of stock does not reduce profit
by KSh 61,500 that day. It reduces cash immediately (§9), and reaches profit only as the stock
sells — measured by movement (opening + bought − closing, §6), not by what the supplier was
paid. Stock bought and still on the shelf has not touched profit at all.

This is why §7 and §9 give different answers from the same payments, and why a stock purchase
appears in both without being counted twice.

**Example, one day.**

```
Sales revenue                    KSh 24,000
Cost of goods sold             − KSh  9,600   (restaurant)
                               − KSh  3,630   (canteen)
Gross profit                    KSh 10,770
Operating costs                − KSh  2,300
Net profit                       KSh  8,470
```

Note what is absent: no line for stock bought that day. Stock enters this calculation only
through cost of goods sold, on the line above.

### Not subtracted here

- **Stock bought but not yet sold** — reaches profit when it sells, through cost of goods sold.
  See the table above and §6.
- **Equipment and furniture** — cash converted into something still owned.
- **Owner's drawings** — not a business cost; recorded as a debt to the business.
- **Stock not sold** (wastage, staff meals, complimentary, corrections) — already inside cost
  of goods sold. See §8.

### Whether profit waits on a count differs by location

*Revised 2026-08-13, revised again 2026-08-15.* At the **restaurant**, profit never has a
portion awaiting correction at a count — sales are individually recorded, and the count is a
pure shrinkage check (§2), separate from profit.

At the **canteen**, profit is final for any day already covered by a count, and simply unknown
— not provisional, not estimated, genuinely not yet computable — for days since the last one.
A count produces that day's canteen sales outright (§1/§2); until it happens, there is nothing
to report for the canteen beyond the last count's date. This is a different kind of gap from
the 2026-08-13 "provisional" figure it replaced: nothing here is a placeholder waiting to be
corrected. It is simply absent until the count that will supply it is taken.

One estimate remains at both locations, unrelated to counts: transferred food without a
recorded recipe still uses the §5/§8 60% estimate, same as any cooked food without a recipe —
labelled as such and replaced the moment a recipe is recorded.

---

## 8. Stock that was not sold

**What it covers:** wastage, staff meals, complimentary items, and corrections where a count
came up short.

### It is reported, not subtracted

Stock that was bought and then wasted appears in "bought" and is absent from "closing" — so §6
already counts it as consumed. **Profit is already lower by its cost.** Subtracting it again
would count the same potatoes twice.

The report shows **where stock went**. It changes no figure.

### What the report shows

Per category, per location, per period, valued two ways:

```
at cost           = quantity × unit cost        ← what was actually lost
at selling price  = quantity × selling price    ← the sale that was missed
```

**Example.** 3 plates wasted, costing KSh 22.50 each, selling at KSh 100.

```
at cost           KSh   67.50
at selling price  KSh  300.00
```

Both are true and answer different questions. Neither changes profit. Where cooked food has no
recipe, the §4 estimate is used and labelled.

---

## 9. Expected cash

**What it answers:** how much should I be holding right now?

```
handovers received
− stock bought
− operating costs
− equipment and furniture
− owner's drawings
= what should be in hand
```

**Example, one month.**

```
Handovers received               KSh 142,000
Stock bought from suppliers    − KSh  61,500
Gas, charcoal, electricity     − KSh  12,300
Freezer                        − KSh  30,000
Owner's drawings               − KSh  15,000
Expected cash                    KSh  23,200
```

**Everything paid out reduces cash**, including equipment and drawings — this question is about
where the money physically is, not about profit. That is why a business can be profitable and
still have cash missing.

All four categories appear here, unlike §7 where only two of them reach profit and stock does
so on a delay. A stock purchase reducing cash here and profit later (as it sells) is one
payment measured by two different questions, not double-counting — see §7's table.

M-Pesa is tracked the same way as its own separate balance.

```
difference = cash counted − expected cash
```

---

## 10. Handover check

**What it answers:** did what was handed over match what was sold?

Per person, per day. Cash and M-Pesa separately.

```
difference = handed over − expected
```

**At the restaurant**, expected is that person's recorded sales for the day, cash and M-Pesa
separately. Because it was built sale by sale during the day, it does not depend on the person
handing over.

```
Cash sales recorded          KSh 8,400
Cash handed over             KSh 8,150
Difference                 − KSh   250
```

**At the canteen** *(revised 2026-08-13, revised again 2026-08-15)*, expected is also that
day's recorded sales — the same basis, not a separately declared figure — but checked as one
**combined** total rather than cash and M-Pesa apart, since a canteen sale carries no payment
method at entry (§1) and the split is not knowable from the record.

```
Sales recorded (combined)    KSh 5,400
Cash + M-Pesa handed over    KSh 5,150
Difference                 − KSh   250
```

There is no separate declare-takings step: handing over *is* entering what she is holding —
cash counted and M-Pesa received — checked against the day's recorded sales the moment she
does.

**Handover and the canteen's stock count run on independent cadences.** Handover happens daily
regardless of whether a count was taken that day. On a day with no count, "sales recorded"
means whatever the most recent count has produced so far — which may be zero for that day
specifically if the count covering it hasn't happened yet. This is a real gap, not a rounding
matter: a handover checked on a day with no covering count yet may show a large, expected-looking
difference simply because the sales side is still incomplete. The count remains the only way the
canteen's sales figure gets filled in — see §6.

Credit sales are excluded — no money changed hands. They appear in §11.

---

## 11. Who owes money

```
owed by a customer = credit given − repayments
total owed         = the sum across all customers, both locations
```

Any staff member may give credit or record a repayment. The total is the owner's view.

---

## 12. Stock value

```
stock value = quantity on hand × unit cost
```

Per location and in total. Uses the §4 estimate where no recipe exists, labelled as such.

---

## 13. Pay

```
pay = days worked × daily rate
```

No tax, deductions or advances in v1 — see `docs/scope.md`.

---

## What these figures cannot tell you

Stated so they are read correctly.

**Profit is measured; per-item margin is not.** Cost of goods sold comes from actual
consumption, so gross and net profit are real figures. What needs a recipe is comparing one
dish against another — "is mukimo better than chips" cannot be answered until yields are
recorded.

**Canteen profit is final for any day already covered by a count, and simply absent until
then** — not provisional, not an estimate awaiting correction, genuinely not yet known. See §7.

**Item detail at the canteen is current as at the last count, not the last recorded movement**
— sales themselves are no longer individually recorded there, so the ledger's picture of
"what sold today" only updates when a count produces it.

**The first period has no measured rate.** Until the canteen's first count, either an opening
estimate is supplied or its cost figures wait for that count.

**Cooked food at the canteen is counted daily and controlled like any other stock.** Leftovers
carry forward as the next day's opening. A shortfall appears the same way it does elsewhere.

**A count difference has several possible causes** — theft, breakage, miscounting — and one
number cannot separate them. One period is noise; a pattern is signal.

**Ingredient consumption is self-reported.** The kitchen records what it used; nothing weighs
it.

**Yields are expectations, not measurements.** A recipe states what a quantity of input should
produce. The gap between expected and actual is informative, and is the point of recording it.

**Wastage is recorded only when noticed**, by the person who noticed it.
