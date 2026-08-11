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

---

## 2. Stock count

**What it answers:** does reality match the record.

```
difference = counted − expected
```

Negative means short. The count never changes the record on its own — it records what was
counted and shows the gap. Only the owner may correct.

**Example.** 33 expected, 31 counted. Short by 2.

### Where sales are not recorded one by one

The canteen records daily takings rather than individual sales, so what sold is worked out at
each count:

```
sold = previous count + received + transferred in
     − recorded credit sales − wasted − consumed − given away − transferred out
     − this count
```

Everything known is subtracted first. What remains is what sold.

**This is worked out, not observed.** It absorbs genuine sales, breakage, miscounting and
theft together, and cannot separate them. It is stored under its own label so no report
mistakes it for a recorded sale.

**Checking it against the money:**

```
what it should have earned = quantities worked out × selling prices
difference = takings actually recorded − what it should have earned
```

One period's difference means little. The same gap period after period means something.

---

## 3. What an ingredient costs

**What it answers:** flour was bought three times at three prices — what is it worth now?

A running average, recalculated each time more is bought:

```
new average = (quantity on hand × current average + quantity bought × price paid)
              ÷ (quantity on hand + quantity bought)
```

**Example.** 10kg on hand at KSh 80. Buy 20kg at KSh 95.

```
(10 × 80 + 20 × 95) ÷ 30  =  KSh 90 per kg
```

**Why an average rather than tracking each delivery separately.** Tracking each batch at its
own price is more precise, but requires knowing which sack was used. Deliveries are received
mid-service on a phone; that will not hold. An average needs no batch tracking and cannot be
recorded wrongly.

---

## 4. What one item costs

**What it answers:** the cost of a single soda, or a single plate of chips.

**Used for** stock valuation, per-item margin, and valuing stock that was not sold. **It is not
used to work out profit** — see §6.

| | Cost per unit |
|---|---|
| Bought-in goods, packaging | The running average from §3 |
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

The cost travels with the food. Sending it removes cost from the restaurant and adds the same
cost to the canteen.

```
rate = ingredients the kitchen consumed ÷ what its food sold for

cost of the transfer = what the transferred food sells for × rate
```

Where the item has a recipe, its recipe cost is used instead.

**Example.** The kitchen consumed KSh 40,000 of ingredients producing KSh 100,000 of food, so
food costs 40% of its selling price. Food worth KSh 6,000 goes to the canteen.

```
6,000 × 40%  =  KSh 2,400
```

The restaurant's cost drops by 2,400. The canteen's rises by 2,400.

**Why the business total is unaffected.** The same figure is subtracted from one side and added
to the other, so it cancels:

```
Restaurant:  ... − 2,400
Canteen:     ... + 2,400
Business:            0
```

Whatever number is used, the business total is identical. The rate decides only how the cost is
split between the two locations, never how much cost exists. **Both sides must always use the
same figure.**

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

### The canteen — two parts

Its stock is of two kinds, and only one needs counting.

**Food from the restaurant — exact, counted daily.** The ordinary stock formula applies:

```
cost = opening + transferred in − closing − wasted
```

Most days everything sent is sold, so closing is zero and the cost is simply that day's
transfers. Where food is left over it carries forward as the next day's opening, exactly as
stock does anywhere else.

**Example.** Monday: 40 samosas arrive, none carried in, 8 left at close.

```
0 + 40 − 8 = 32 consumed Monday
```

Tuesday those 8 are the opening. 30 more arrive, 5 left at close.

```
8 + 30 − 5 = 33 consumed Tuesday
```

This is a short count — a few items in small numbers — and is done daily. It is not the
boxes-of-packaged-goods problem that makes the canteen's own stock impractical to count daily.

**The canteen's own goods — estimated between counts.** These are not counted daily, so what
sold is unknown. What *is* known is the money taken. Cost is estimated from it, using the rate
measured at the last count:

**Which goods are "own goods."** Nothing on a product record says so directly — it is read from
how the item arrived: a product that reached the canteen via a transfer from the restaurant is
restaurant-supplied (the exact half above); a product received directly from a supplier is the
canteen's own goods. A product can be either at different times depending on how a given batch
arrived, so this is worked out per period (since the last count), not stored as a fixed label.

```
rate = cost of these goods at the last count ÷ what they sold for over that period

estimated cost = the day's takings from these goods × rate
```

**Example.** The last count showed these goods cost 72% of what they sell for. Today they took
KSh 4,000.

```
4,000 × 72%  =  KSh 2,880 estimated
```

So the canteen's cost for the day is `2,400 + 2,880 = KSh 5,280`.

**"Cost of these goods at the last count" is the cost of what sold, not what's left.** It reads
the quantity the count worked out had been sold since the previous count (§2's derived-sales
formula), valued at cost — not the quantity still counted on the shelf. The parallel revenue term
is the selling value of that same sold quantity, so the ratio is a margin on goods that actually
moved, not a snapshot of unsold stock.

### The count corrects the estimate

At each count the real figure replaces the estimates for that period, and the correction is
shown rather than applied quietly:

```
Estimated since last count    KSh 61,200
Measured at the count         KSh 63,800
Correction                  − KSh  2,600
```

A correction that always leans the same way means either the rate needs adjusting or stock is
leaving unaccounted for. Both are worth seeing.

**"Estimated since last count" uses the rate from the count *before* that** — the rate actually in
force during the period being corrected, not the rate the latest count just measured (using the
latest count's own rate would compare a period against itself and never show a correction). This
needs three counts of history to compute at all; with only two, there is no earlier rate yet to
apply, and the correction is unavailable rather than guessed — same "first period has no measured
rate" reasoning as everywhere else in this document.

**Counting is an event, not a timetable.** It can happen any day; the period is simply the gap
since the last one. Weekly is the habit. Counting more often shortens the estimated stretch and
sharpens every figure that depends on it.

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
gross profit   −  running costs       =  net profit
```

**Sales revenue** is recorded sales at the restaurant, and declared takings at the canteen.

**Running costs** are gas, charcoal, electricity, rent and wages.

**Gross profit** answers whether pricing is right. **Net profit** answers whether the business
is earning.

**Example, one day.**

```
Sales revenue                    KSh 24,000
Cost of goods sold             − KSh  9,600   (restaurant)
                               − KSh  5,280   (canteen)
Gross profit                     KSh  9,120
Running costs                  − KSh  2,300
Net profit                       KSh  6,820
```

### Not subtracted here

- **Equipment and furniture** — cash converted into something still owned.
- **Owner's drawings** — not a business cost; recorded as a debt to the business.
- **Stock not sold** (wastage, staff meals, complimentary, corrections) — already inside cost
  of goods sold. See §8.

### What is provisional

| | Basis | Status |
|---|---|---|
| Restaurant | Measured consumption | Final |
| Canteen — restaurant food | That day's transfers | Final |
| Canteen — its own goods | Estimated from the rate | **Provisional** |

Provisional figures are labelled wherever they appear and are replaced at each count.

The estimated part covers most of the canteen's trade, since packaged goods dominate its sales.
**The count is the authority; the daily figure is a sound indication.**

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
− running costs
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

**At the restaurant**, expected is that person's recorded sales for the day. Because it was
built sale by sale during the day, it does not depend on the person handing over.

```
Cash sales recorded          KSh 8,400
Cash handed over             KSh 8,150
Difference                 − KSh   250
```

**At the canteen**, expected is the takings the attendant declared at close.

- **M-Pesa is a real check** — the payment messages are evidence she does not control.
- **Cash is a weaker check** — the same person declares the figure and hands over the money. It
  confirms she handed over what she declared, not that she declared everything she took.

**The count is what tests the cash.** Takings never declared show up as stock gone without
money arriving.

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

**Daily canteen profit is provisional**, and so is daily business-wide profit. Revenue and cash
are exact daily; the estimated portion is corrected at each count.

**The estimate moves profit between locations, never in or out of the business.** An error in
the transfer rate changes which location carries a cost, not how much cost exists.

**Item detail at the canteen is only current as at the last count.** Stock on hand, stock value
and low-stock warnings reflect that count plus movements recorded since.

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
