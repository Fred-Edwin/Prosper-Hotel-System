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

*Revised 2026-08-13 — the canteen now records individual sales, the same as the restaurant.
The count is a shrinkage check at both locations: the formula above (`difference = counted −
expected`) is the whole of it. What sold is no longer worked out from a count — it is the sum
of the day's recorded sales, same as §1's "sold" term. A consistent shortfall at a count still
means something worth investigating; it is no longer how the system learns what sold.*

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

*Revised 2026-08-13.* Previously split into an exact part and a part estimated from a rate
measured at the last count, because the canteen's own goods sold without an individual record.
Now every canteen sale is recorded — see §1's `sold` term and `docs/proposal.md` §4 — so the
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

**The canteen's own goods.** Valued at purchase cost — the running average from §3 — the same
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

### The count is now a shrinkage check only

A count no longer corrects an estimate — there is no estimate to correct. It compares counted
stock against what the movements say should be there, exactly as §2 describes, and any
difference is reported as a variance to look into, not applied to a past figure.

**Counting is an event, not a timetable.** It can happen any day. Weekly is the habit for the
canteen's own goods; the restaurant's daily count and the canteen's daily cooked-food count
continue as before.

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

**Sales revenue** is recorded sales at both locations — see `docs/proposal.md` §4.

**Running costs** are gas, charcoal, electricity, rent and wages.

**Gross profit** answers whether pricing is right. **Net profit** answers whether the business
is earning.

**Example, one day.**

```
Sales revenue                    KSh 24,000
Cost of goods sold             − KSh  9,600   (restaurant)
                               − KSh  3,630   (canteen)
Gross profit                    KSh 10,770
Running costs                  − KSh  2,300
Net profit                       KSh  8,470
```

### Not subtracted here

- **Equipment and furniture** — cash converted into something still owned.
- **Owner's drawings** — not a business cost; recorded as a debt to the business.
- **Stock not sold** (wastage, staff meals, complimentary, corrections) — already inside cost
  of goods sold. See §8.

### Nothing here waits on a count

*Revised 2026-08-13.* Profit at both locations, and for the business as a whole, no longer has
a portion awaiting correction at a count. One estimate remains, but it is not count-related:
transferred food without a recorded recipe still uses the §5/§8 60% estimate, same as any
cooked food without a recipe — labelled as such and replaced the moment a recipe is recorded.
The count remains as a shrinkage check (§6), separate from profit.

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

**Canteen profit is final daily, the same as the restaurant's**, since this revision — see §7.

**Item detail at the canteen is current as at the last recorded movement**, the same as the
restaurant — no longer only as current as the last count.

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
