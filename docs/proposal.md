# Prosper Hotel — System Proposal

**Prepared for:** The Owner, Prosper Hotel
**Prepared by:** Edwin
**Date:** 5 August 2026

---

This document sets out how the proposed system will operate, feature by feature.

It is written to be checked. Where any part does not reflect how the business actually runs,
or where something has been omitted, corrections are welcome and are far less costly to make
at this stage than after the system is built.

Throughout, people are referred to by role rather than by name: the **owner**, the **store
manager**, the **restaurant cashiers**, and the **canteen attendant**.

---

## 1. Purpose

The system replaces the spreadsheets currently used to run the business, and performs
automatically what those spreadsheets require by hand.

It runs on staff members' own phones through a web link. No installation and no additional
hardware are required. Every entry records the person who made it and the time it was made.

Beyond what the spreadsheets provide, the system adds three capabilities:

- **A daily handover check.** For each person, on each day, the system compares what was
  handed over against what the records indicate should have been handed over.
- **A running cash position.** Money received from staff, money paid out for stock and running
  costs, and the balance the owner should be holding at any point.
- **A single view of both locations.** The restaurant and the canteen, the stock moving
  between them, and combined figures for the business as a whole.

---

## 2. Users and permissions

Each staff member has access to their own location only. The owner has access to both.
Transfers between locations are visible at both ends, since both locations are party to them.

Access is by phone number and a four-digit PIN.

### Owner

Full access at both locations. This includes all operational functions — recording sales,
receiving deliveries, recording transfers — so that the owner can work any position when
present on site.

The following are restricted to the owner:

- Setting and amending selling prices
- Recording payments out, including stock purchases and running costs
- Correcting a stock count
- Amending any record after a day has been closed
- Adding and deactivating staff, and setting daily rates

### Store manager — restaurant

Responsible for the store. Receives deliveries from suppliers and records the quantities and
prices paid; issues ingredients to the kitchen and records consumption; records stock
transferred to the canteen.

Records delivery orders. Does not have access to counter sales.

### Restaurant cashiers

Responsible for selling. Counter sales, delivery and takeaway orders, and recording wastage
observed during their shift.

At the end of each day they hand over the takings, which the system then checks.

### Canteen attendant

Responsible for the canteen as a whole. Sells, receives stock transferred from the restaurant,
records stock delivered directly to the canteen by suppliers together with the prices paid,
transfers printing and stationery stock to the restaurant, and maintains the canteen's stock
records.

Recording a delivery is distinct from paying for it. Payments to suppliers remain the owner's,
and appear in the cash position described in section 6.

---

## 3. Restaurant operations

**Receiving deliveries.** The store manager records each delivery: the item, the quantity, and
the price paid on that occasion. Prices are entered per delivery rather than held as a fixed
figure, since purchase costs vary between buying trips. Stock is updated on entry.

**Issuing to the kitchen.** Ingredients taken by the kitchen are recorded and deducted from
the store.

**Production.** The kitchen records its output — plates, portions and pots produced.

**Transfers to the canteen.** Stock sent to the canteen is recorded once and appears at both
locations, removing the need for duplicate entry and allowing the canteen attendant to see
what is in transit.

**Sales.** Cashiers record each sale as it occurs, including the method of payment. A single
sale may be settled partly in cash and partly by M-Pesa; both amounts are recorded against
that sale.

**Credit.** Any staff member may extend credit provided the customer is named. The amount is
recorded against that customer's account until settled.

**Wastage, internal consumption and complimentary items.** Recorded as they occur and held
separately from one another.

**Close of day.** Stock is counted by the owner or the store manager. The system presents the
expected quantity, the counted quantity, and any difference between them.

**Handover.** Each person hands over the day's takings, which the system checks as described
in section 5.

---

## 4. Canteen operations

*Revised 2026-08-13. The canteen no longer trades by declared daily totals with sales inferred
at a count — see the note at the end of this section for why.*

The canteen trades principally as a retail shop. The majority of its sales are goods bought
and resold without alteration — soft drinks, confectionery, snacks, stationery,
over-the-counter remedies and airtime — each with a known purchase price and margin. It also
sells prepared food transferred in from the restaurant each day.

The attendant receives transfers from the restaurant, records deliveries made directly to the
canteen by suppliers, and transfers printing and stationery stock to the restaurant as
required.

### Receiving stock

Stock reaching the canteen — whether transferred from the restaurant or delivered by a
supplier direct to the canteen — is **received, not merely credited**. The sending or
supplying side records what was sent; the attendant separately confirms, at the canteen, what
she actually received. Until she confirms, the stock is in transit and counts at neither
location. Where the confirmed quantity is less than what was sent, the gap is recorded as its
own discrepancy, distinct from wastage.

An unconfirmed transfer from the restaurant is surfaced to the attendant immediately and
prominently — she cannot reach her ordinary screens without seeing it. This applies to a
transfer in either direction: the restaurant confirms what it receives back from the canteen
the same way.

### Recording of sales

The attendant records each sale as it happens: the product and the quantity sold — the same
motion a restaurant cashier uses. No payment method is recorded against the individual sale.
Trade at the canteen happens in a rush, most of it students paying small amounts in cash or
M-Pesa in quick succession; asking her to key in a payment method per sale mid-rush would slow
her down for no benefit, so that detail is deliberately not captured line by line.

This applies equally to the canteen's own goods and to food transferred in from the
restaurant — one recording action, one stock ledger, regardless of which stock the item came
from. Her stock screen distinguishes the two only for her own reference (what's hers to
reorder versus what the restaurant supplies), not because they are recorded differently.

**Credit sales are recorded the same way, with a customer attached.** Where a sale is on
credit, she additionally names the customer at the point of entry — one flow, not a separate
screen, matching how a restaurant cashier already records credit within the till.

At the close of each day the attendant hands over — the same single step a restaurant cashier
already goes through, no separate declaration beforehand. She enters what she is physically
holding, the day's **cash total** and **M-Pesa total**, read from the cash in hand and the
M-Pesa messages received, and the system checks that combined figure against the day's
recorded sales. See section 5.

Stock is counted **periodically**, weekly by expectation, though a count may be taken on any
day. With sales now recorded directly, the count is no longer how the system learns what
sold — it exists purely as a **shrinkage check**: does the counted quantity match what the
records say should be on the shelf, the same question the restaurant's daily count already
answers. A consistent shortfall is the signal, whatever its cause — theft, breakage,
miscounting.

### Reporting implications

- The canteen's **revenue, cost of goods sold, cash position and profit are daily and exact**,
  on the same basis as the restaurant — recorded sales, not declared totals. See section 10.
- **Stock levels** reflect actual movements — sales, receipts, transfers, corrections — as they
  happen, the same as the restaurant. They are current, not stale between counts.
- **The count is a shrinkage check, not a revenue source.** It no longer produces an
  item-by-item trading record; that record now comes from the sales themselves.

The canteen maintains its own paybill, stock and figures. These are reported separately from
the restaurant's except where figures for the business as a whole are requested.

### Why this changed

The original design (declared daily totals, sales inferred at a weekly count) assumed the
attendant could not record a sale mid-service. In practice this produced double-counting —
where a sale was recorded and the same stock movement was separately inferred at the next
count — and the underlying assumption did not hold once payment method was dropped from the
per-sale entry: recording *what* sold, without *how it was paid*, is fast enough for a rush of
small cash and M-Pesa sales, and produces a real, attributable record instead of an estimate
corrected after the fact.

---

## 5. Daily handover check

The check is performed per person and per day. Cash and M-Pesa are checked separately, as they
are received and handed over separately.

### Restaurant

The expected amount is the total of the sales that person recorded during the day:

```
Restaurant cashier — Tuesday

  Cash sales recorded          KSh 8,400
  Cash handed over             KSh 8,150
  Difference                 − KSh   250

  M-Pesa sales recorded        KSh 6,200
  M-Pesa received              KSh 6,200
  Agreed
```

Because the expected figure is assembled from sales recorded during the day, it is independent
of the person handing over.

### Canteen

*Revised 2026-08-13, alongside section 4.*

The expected amount is the total of the sales the attendant recorded during the day — the
same basis as the restaurant, with one difference: it is checked as a **single combined
figure**, not cash and M-Pesa separately. A canteen sale carries no payment method at the
point of entry (section 4 — too slow for rush trade), so the split between the two is not
knowable from the sale record itself; only the combined total is. This is a deliberate, known
narrowing from the restaurant's two-currency check, not an oversight.

```
Canteen attendant — Tuesday

  Sales recorded                   KSh 5,400
  Cash + M-Pesa handed over        KSh 5,150
  Difference                     − KSh   250
```

The M-Pesa portion can additionally be verified against the payment messages received on the
paybill, evidence she does not control. Cash cannot be independently verified in the same way,
but the weekly stock count remains a secondary check: stock leaving without a corresponding
sale being recorded appears as a shortfall at the next count, the same shrinkage check the
restaurant already relies on.

Credit sales are excluded from the handover check, as no money changes hands at the point of
sale. These appear under amounts owed.

Differences are reported on the day they arise. No transaction is blocked as a result.

---

## 6. Recording money paid out

Money enters the business through staff handovers and leaves through payments made by the
owner. As the owner is the only person who makes payments out, the system maintains a single
running cash balance. The calculation is set out in section 10.

Each payment is recorded under one of four headings, as they are treated differently:

- **Stock** — goods and ingredients purchased from suppliers.
- **Running costs** — gas, charcoal, electricity, rent and wages.
- **Equipment and furniture** — items the business retains after purchase.
- **Owner's drawings** — money taken by the owner for personal use.

All four reduce the cash the owner should be holding. Only stock and running costs reduce
reported profit; the reasons are given in section 10.

Owner's drawings are additionally recorded as an amount owed to the business, and the
outstanding balance is available at any time.

---

## 7. Reporting

**Profitability.** By day, week or month, per location and for the business as a whole:
revenue, less the cost of goods sold, less running costs. Available daily and exact at both
locations, as described in section 10.

**Daily handover.** Amounts handed over against amounts expected, by person and by day, with
cash and M-Pesa reported separately.

**Cash position.** The expected cash and M-Pesa balances at any point, together with the
outstanding balance of owner's drawings. Calculated as set out in section 10.6.

**Amounts owed.** Outstanding balances by customer across both locations.

**Stock on hand and its value.** By item and by location.

**Low stock.** Items below a defined level. Current at the restaurant; as at the most recent
count at the canteen.

**Staff and pay.** Days worked per person and the resulting pay.

**Activity record.** Actions taken, by person and by date, as described in section 9.

---

## 8. Corrections

**Same day, before close.** A staff member may cancel an entry they made. Stock and takings
are restored to their previous position. No authorisation is required.

**After close of day.** Amendments are restricted to the owner.

Entries affecting stock or money are not deleted. A cancelled entry is retained and marked as
cancelled, recording who cancelled it and when. Non-financial corrections — a misspelled name
or an incorrect telephone number — are amended directly, with the previous value retained.

Cancellations appear on the daily summary.

### Amending a closed day

Where a day has been closed and a correction is subsequently required, the original figures
are retained and the correction is recorded as a separate entry carrying the date to which it
applies, the reason, and the person who made it.

For example, where a closed day is later found to omit a sale, the omission is recorded as a
correction effective on that day and entered on the date it was identified. Current stock is
adjusted accordingly, while the day's original figures remain as they stood.

This ensures that figures against which a handover has already been checked are not amended
retrospectively, and that the position at any past date remains available as it was recorded.

---

## 9. Historical records

**Stock history.** For any item on any date: opening quantity, quantities received,
transferred in and out, sold, wasted or otherwise consumed, and the resulting closing
quantity. This corresponds to the record currently maintained in the spreadsheets and is
produced without manual upkeep.

**Activity record.** Actions taken by each person, filterable by person and by date. This
includes actions that do not affect stock quantities, such as price amendments, cancelled
entries, corrected counts and written-off debts. Where a record has been amended, the record
shows that it was amended, by whom, and its previous value.

---

## 10. How the figures are calculated

This section sets out every financial figure the system produces and how each is arrived at.
The worked figures below follow a single day through from sales to profit and cash.

**The principle underlying all of it:** profit counts what was **used up**; cash counts what was
**paid out**. A freezer is paid for but not used up. Ingredients still on the shelf are paid for
but not used up. That difference is why the two figures are not the same, and why both are
needed.

### 10.1 Sales revenue

| Location | Source |
|---|---|
| Restaurant | Each sale as recorded, at its selling price |
| Canteen | Each sale as recorded, at its selling price — see section 4 |

```
Restaurant sales          KSh 18,600
Canteen sales              KSh  5,400
Sales revenue             KSh 24,000
```

### 10.2 Cost of goods sold

Cost of goods sold is the value of stock **used up**, not the value of stock **bought**. Stock
bought and still on the shelf has not yet cost anything.

```
Opening stock  +  Stock bought  −  Closing stock  =  Cost of goods sold
```

**At the restaurant** this is calculated from ingredients, using the consumption the kitchen
already records each day. The result is exact and available daily.

```
Opening ingredients       KSh 18,000
Ingredients bought      + KSh  9,000
Closing ingredients     − KSh 15,000
Food sent to canteen    − KSh  2,400
Restaurant cost           KSh  9,600
```

Food sent to the canteen is deducted because its cost travels with it, so that each location's
profit reflects what it actually sold. The same amount is added to the canteen below. **The
business total is unaffected** — the transfer only determines which location carries the cost.

**At the canteen** the figure is now calculated the same way as the restaurant's: from stock
actually consumed, using each item's own cost.

*Revised 2026-08-13.* Previously this was split into an exact part (food from the restaurant)
and an estimated part (the canteen's own goods, priced from a rate measured at the last count),
because the canteen's own goods sold without an individual record. Now that every sale is
recorded — see section 4 — cost of goods sold uses the same basis at both locations:

```
opening stock + received/transferred in − closing stock = cost of goods sold
```

*Food supplied by the restaurant.* Its cost travels with it at the point of transfer, at the
same per-unit cost the restaurant already knows — its recipe cost, where one is recorded.
Where no recipe exists, the transfer is costed at the same estimate section 10.5 already uses
for unsold cooked food without a recipe (60% of selling price), labelled as estimated and
replaced automatically once a recipe is recorded — see section 10.7.

*The canteen's own goods.* Costed from the purchase price recorded when the goods were
received, the same as any bought-in stock at the restaurant. Always exact — every bought-in
good has a purchase price by definition.

```
Food from the restaurant  KSh  2,400   (exact, recipe cost)
Own goods sold            KSh  2,880   (exact, purchase cost)
Canteen cost               KSh  5,280
```

### 10.3 Profit

```
Sales revenue             KSh 24,000
Cost of goods sold      − KSh 14,880
Gross profit              KSh  9,120

Running costs           − KSh  2,300
Net profit                KSh  6,820
```

**Gross profit** shows whether pricing is right. **Net profit** shows whether the business is
earning.

Running costs are gas, charcoal, electricity, rent and wages.

**Three things are not deducted here:**

- **Equipment and furniture**, which convert cash into assets the business retains.
- **Owner's drawings**, which are not a business cost.
- **Stock that was not sold**, which is already included — see 10.5.

### 10.4 What is provisional

*Revised 2026-08-13.* Profit is reported **daily at both locations and for the business as a
whole**, and is no longer provisional on waiting for a count at either:

| | Basis | Status |
|---|---|---|
| Restaurant | Measured consumption | Final |
| Canteen — restaurant food, with a recipe | Cost travels with the transfer, at recipe cost | Final |
| Canteen — restaurant food, no recipe | Cost travels with the transfer, at the 60% estimate | Estimated — same status as any cooked food without a recipe, see 10.5 |
| Canteen — its own goods | Recorded sales, purchase-price cost | Final |

The remaining estimate is not new: it is the same "cooked food without a recipe" gap the
restaurant already has, now applied consistently where that food is also sold at the canteen —
not a canteen-specific weakness, and not something a count corrects. Recording a recipe for the
item replaces the estimate; nothing about counting more often does.

The weekly count remains, as a shrinkage check rather than a source of cost or revenue — see
section 4. A count difference is reported as a variance to investigate, not as a correction to
a previously estimated figure, because no figure was estimated.

**Cash figures are never estimated.** Amounts received, amounts paid out, the expected cash
position, handover comparisons and amounts owed are measured at both locations.

### 10.5 Stock that was not sold

This covers wastage, staff meals, complimentary items and stock corrections — stock that left
without being sold.

It is reported by category, by location and by period, valued two ways:

```
3 plates wasted

  At cost              KSh  67.50    the expenditure incurred
  At selling price     KSh 300.00    the sale that was missed
```

**These amounts are not deducted from profit a second time.** Stock bought and no longer
present at the closing count is already counted as used up in 10.2, and profit is already lower
by its cost. Deducting it again would count the same stock twice. The report shows where stock
is going; it does not change the profit figure.

Where cooked food is valued here and no recipe exists, cost is estimated at **60% of the selling
price**, per the figure provided during discovery. These figures are identified as estimated,
and the estimate is used for this report only.

### 10.6 Expected cash

This is a different question from profit. It asks where the money physically is.

```
Handovers received               KSh 142,000
Stock bought from suppliers    − KSh  61,500
Gas, charcoal, electricity     − KSh  12,300
Freezer                        − KSh  30,000
Owner's drawings               − KSh  15,000
Expected cash held               KSh  23,200
```

**Everything paid out reduces this figure**, including equipment and drawings, because the money
has genuinely left. This is why a business can be profitable and still be short of cash, and
why both figures are reported.

M-Pesa is tracked the same way as a separate balance. The expected figure is what a physical
count of cash in hand is checked against.

### 10.7 The remaining figures

**Handover check.** Per person, per day, cash and M-Pesa separately: the amount handed over
against the amount expected. Section 5 sets out how the expected amount is arrived at at each
location.

**Amounts owed.** Credit extended less repayments, by customer, across both locations.

**Stock value.** Quantity on hand multiplied by unit cost, per location and in total.

**Pay.** Days worked multiplied by the daily rate.

**Per-item cost and margin.** Available for bought-in goods from their purchase price, and for
cooked food where a recipe records the expected yield — for example the number of plates of
chips a given quantity of potatoes produces. Items without a recorded yield contribute to total
profit but cannot be compared against one another individually until a yield is recorded. The
system also reports where actual output differs from the expected yield.

---

## 11. Staff and pay

Staff are added by the owner, with a daily rate set for each. Days worked are recorded.

Pay is calculated as days worked multiplied by the daily rate, from the same record.

Staff who leave are deactivated rather than removed, so that transactions they recorded remain
attributed to them.

---

## 12. Exclusions

The following are outside the scope of this proposal. Each may be added subsequently.

- **M-Pesa statement integration.** M-Pesa payments are entered manually. The system does not
  connect to the paybills or reconcile statements automatically.
- **Offline operation.** An internet connection is required at both locations.
- **Supplier credit.** The system assumes suppliers are paid on delivery.
- **Statutory payroll deductions.** Tax, NHIF, NSSF, advances and deductions are not
  calculated. Pay is days worked multiplied by the daily rate.
- **Depreciation.** Equipment is recorded at the point of purchase and excluded from profit.
  Its cost is not apportioned over its useful life.
- **Customer-facing functions.** No online ordering or customer accounts. Delivery orders are
  recorded by staff.
- **Additional locations.** The system covers the two current locations.

---

Comments and corrections on any part of this document are welcome.
