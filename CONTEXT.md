# Context — Prosper Hotel

The shared vocabulary for this project. A glossary and nothing else.

Every term here means exactly one thing. Where the client's own word was clear, it
is used unchanged. Where a word was doing more than one job, it was split and the
reason recorded.

---

## Product

Anything with a selling price that can appear on a sale.

Every product has a **kind**, used for grouping and reporting:

- **Goods** — bought and resold as-is. Sodas, biscuits, stationery, airtime.
- **Cooked food** — made in the kitchen from ingredients. Mukimo, chips, tea.
- **Service** — sold but holds no stock. Photocopying, binding, research.
- **Packaging** — containers, envelopes, cups, disposable cutlery.

The kind is a label. The system branches on two behaviours instead:

- **Stocked** — whether there is a quantity to count. True for goods, cooked food
  and packaging. False for services.
- **Costed** — whether a per-unit cost is available. Purchase price gives one for
  bought-in goods and packaging; a [[Recipe]] gives one for cooked food. Cooked food
  without a recipe has no per-unit cost, which limits per-item margin but not
  profit — see `docs/formulas.md`.

A logbook made from paper is a product of the cooked-food shape, not a service:
it is a physical thing, made from an ingredient, held on a shelf and sold.

## Ingredient

Bought and stocked, but never sold on its own. Consumed to produce a [[Product]].

Flour, potatoes, cooking oil, printing paper, toner.

Nothing at Prosper Hotel is both sold as-is and used in production, so a thing is
either a product or an ingredient — never both. Confirmed with the client.

An ingredient has a purchase cost and a stock level, but no selling price and never
appears on a till screen.

## Recipe

The expected conversion of [[Ingredient]]s into a [[Product]], with an expected
yield — a stated quantity of input should produce a stated quantity of output.

Recipes exist only for products where the yield is known and reliable. Most
products have none.

A recipe does two jobs: it gives a cooked [[Product]] a per-unit cost, and it gives
an expectation to check actual output against.

**A recipe is not required for profit.** Cost of goods sold is measured from stock
actually consumed, whether recipes exist or not. What a recipe adds is per-item
margin — the ability to compare one product against another. See `docs/formulas.md`.

## Location

Where trade happens and where stock is held. There are two: the **restaurant** and
the **canteen**.

Location is structural, not a detail. Stock, sales, transfers, cash and staff
postings are all meaningless until the location is known.

Both locations hold stock and both send stock to the other. Both receive deliveries
from suppliers directly.

A location has a **count cycle** — how often its stock is physically counted. The
restaurant counts **daily**. The canteen counts its **cooked food daily** (a short
count of a few items) and its **own packaged goods periodically**, weekly by habit,
their bulk making a daily count impractical.

*Revised 2026-08-13.* The count cycle no longer changes how sales are recorded — both
locations record every [[Sale]] individually, see [[Sale]]. A count is now purely a
**shrinkage check**: counted quantity against what the movements say should be on the
shelf, at whatever cycle suits each location's stock. It is an **event, not a schedule** —
it may be taken on any day — but it no longer determines the period for any revenue or cost
figure, since those now come from sales as recorded.

## Takings — retired 2026-08-13

Removed, not merely redefined. Takings used to be a separate record — cash and M-Pesa totals
declared at close — because the canteen had no other record of what sold. Now that the canteen
records individual [[Sale]]s the same as the restaurant, that separate declaration step no
longer answers a question nothing else already answers: what she is handing over is entered
directly on the [[Handover]] itself (cash held, M-Pesa held), the same single step a
restaurant cashier already goes through. See [[Sale]] and [[Handover]].

## Sale

Goods or services leaving the business in exchange for value, recorded at a
[[Location]] by a [[Staff Member]].

Two independent facts sit on a sale, and neither creates a different kind of sale:

- **Fulfilment** — **counter** (served on the spot) or **delivery** (taken to the
  customer). There is no third case.
- **Payment** — one or more payment lines. A single sale may be settled partly in
  cash and partly by M-Pesa, so payment is a list, not a single value. Cash and
  M-Pesa are never pooled.

Credit is a payment line like any other, settled later. See [[Customer]].

**Sales are recorded per sale at both locations.** *Revised 2026-08-13.* A canteen sale
records product and quantity, the same as a restaurant sale, but carries **no payment line at
the point of entry** — trade is too fast, mid-rush, for payment method to be captured per
sale. It is settled at close instead, when the attendant hands over: the cash and M-Pesa she
is holding are entered directly on the [[Handover]] and checked against the day's recorded
sales as a combined total rather than reconciled line by line. A credit sale
is the one exception: it is still recorded individually with a named [[Customer]] attached, at
either location, because a debt needs a name and cannot be inferred from a total.

## Stock Movement

A single recorded change to the quantity of a [[Product]] or [[Ingredient]] at a
[[Location]], at a point in time, by a [[Staff Member]].

Movements divide into two families, because the two things they move behave
differently and the client reads them as separate records:

- **Product movement** — a [[Product]] moving. Produced, transferred, sold.
  Value is realised at the **selling price**, so these rows carry sales value,
  cost of sales and profit.
- **Store movement** — an [[Ingredient]] or supply moving through the store.
  Purchased, issued to the kitchen, spoiled. Value is carried at **cost**, and
  nothing here has a selling price because none of it is sold.

The families share the reason list below; what differs is how they are valued
and therefore how they are read.

Every movement carries a **reason**, and the reasons are kept apart rather than
lumped together:

- **Received** — arrived from a supplier, at either location. Carries the price paid, which
  feeds the weighted-average cost.
- **Issued** — raw ingredients given to the kitchen.
- **Produced** — the kitchen's output, made from issued ingredients.
- **Transferred** — sent from one location to the other. Runs in both directions.
- **Sold** — left through a [[Sale]], at either location.
- **Wasted** — spoiled or ruined.
- **Consumed** — used by the business rather than sold.
- **Given away** — complimentary.
- **Corrected** — a physical count disagreed with the record and the record was
  adjusted to reality.

A stock level is not a number that is maintained. It is the sum of the movements.
This is what makes the historical record in the client's own Excel shape possible:
the history of an item on a day is simply its movements for that day, in order.

## Non-sales Stock Consumption

Stock that left without being sold: **wasted**, **consumed** by staff, or
**given away**. One category, because the act is the same — stock went, no money
came — and the client reads them together.

Valued two ways, because both answer something: **at cost**, the expenditure
incurred; and **at selling price**, the sale that was missed.

Where a per-unit cost is known — a purchase price, or a [[Recipe]] — that is the
cost. Where none exists, cost is estimated at **60% of the selling price**, per
the figure given in discovery, and such rows are marked as estimated. The
estimate is for this report only and never feeds profit.

**A stock correction is not part of this.** Non-sales consumption is stock that
left; a correction is the *record* being wrong, it may be positive, and only the
owner may make one. Grouping them would make a correction that finds extra stock
read as negative consumption. They sit adjacent and stay distinct.

**These amounts are not deducted from profit a second time.** Stock no longer
present at the closing count is already counted as used up in cost of goods sold.
This record shows where stock went; it does not change the profit figure.

## Handover

Money physically passed from one [[Staff Member]] to the owner, for one
[[Location]] on one day.

A handover holds an **expected** amount and an **actual** amount, being what was
really handed over. The difference between them is the control the client asked for,
and it is checked per person and per day.

*Revised 2026-08-13 — expected is now built the same way at both locations.*

The expected amount is the sum of that person's recorded [[Sale]]s for the day, at either
location. An independent expectation, because it was built from individually recorded sales
rather than from what the same person later declares.

M-Pesa is additionally verifiable against the payment messages received, evidence the person
handing over does not control. Cash cannot be independently verified the same way at either
location; the periodic count is a secondary shrinkage check, not the primary basis for the
expected figure — see `docs/formulas.md`.

**Restaurant** — cash and M-Pesa are handed over and checked separately, since a restaurant
sale carries a real payment method per line.

**Canteen** — checked as one **combined** figure. A canteen [[Sale]] carries no payment method
at entry, so the split between cash and M-Pesa expected is not knowable from the sale record;
only the combined total is. What she hands over (cash held plus M-Pesa held) is compared
against that one combined expectation, not against each currency separately.

## Cash Movement

Money entering or leaving the owner's own hands, and the basis of the running cash
balance.

Money in is a [[Handover]]. Money out is a payment the owner makes — stock from
suppliers, gas, charcoal, electricity. Only the owner pays money out, which is what
makes a single expected-cash figure meaningful.

Money the owner takes for personal use is recorded as a cash movement out **and** a
debt owed back to the business, so the expected balance stays truthful.

Cash movements form a **running balance**, and the balance is the point. Every
individual movement is a delta; the balance is what makes the expected cash
figure traceable line by line rather than merely asserted. Cash and M-Pesa each
carry their own balance and are never pooled.

## Expense

Money the owner pays out. Every expense is a [[Cash Movement]] out, and carries a
**category**, because the categories behave differently in profit:

- **Stock** — goods and ingredients bought from suppliers. Becomes cost of goods
  sold. Always paired with a `Received` [[Stock Movement]].
- **Running cost** — gas, charcoal, electricity, rent. Subtracted from profit in
  the period it falls.
- **Asset** — furniture, utensils, equipment. **Not subtracted from profit.**
  Buying a freezer converts cash into a thing the business still owns; treating it
  as an expense would make a profitable month look like a loss.
- **Personal drawing** — money the owner takes for herself. Not a business expense.
  Recorded as a debt owed back to the business.

Assets are recorded but not depreciated. Spreading an asset's cost over its useful
life is real accounting and deliberately out of scope for v1; adding it later is an
addition rather than a rework.

## Customer

A named person the business deals with by name rather than anonymously.

Two independent reasons a customer exists, and either alone is enough:

- A [[Sale]] is delivered to them and needs a name attached.
- They owe money and will settle later.

Most trade is anonymous and creates no customer. A delivery customer who always
pays on the spot is a customer with no debt.

## Staff Member

A person who works at Prosper Hotel, including the owner.

Every [[Sale]], [[Stock Movement]] and [[Handover]] is attributable to the staff
member who recorded it. This is the basis of the handover control, not an
incidental detail.

The owner works any position when present, so capability is not fixed by role
alone. See `docs/architecture.md` for how access is decided.
