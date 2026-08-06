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
their bulk making a daily count impractical. This is not a preference but a fact of
how each trades, and it changes how sales are recorded at each. See [[Sale]] and
[[Takings]].

A count is an **event, not a schedule**. It may be taken on any day, and the period
for any figure derived from it is simply the interval since the previous count.
Counting more often shortens the estimated period and sharpens every figure that
depends on it.

## Takings

The money a [[Location]] took on one day, recorded as two totals — cash and M-Pesa
— without a line-by-line record of what was sold.

Takings exist because the canteen cannot record sales as they happen. Students
arrive in a rush and the attendant is serving, not operating a phone. What she can
do at close is read her M-Pesa messages and count her drawer.

Takings are recorded daily at the canteen. The restaurant records individual
[[Sale]]s instead and its takings are the sum of them.

Takings are what a [[Handover]] is checked against.

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

**Sales are recorded per sale at the restaurant only.** The canteen records
[[Takings]] daily and has its item detail derived at the weekly count instead — see
[[Stock Movement]]. A credit sale at the canteen is still recorded individually,
because a debt needs a named [[Customer]] and cannot wait for a count.

## Stock Movement

A single recorded change to the quantity of a [[Product]] or [[Ingredient]] at a
[[Location]], at a point in time, by a [[Staff Member]].

Every movement carries a **reason**, and the reasons are kept apart rather than
lumped together:

- **Received** — arrived from a supplier, at either location. Carries the price paid, which
  feeds the weighted-average cost.
- **Issued** — raw ingredients given to the kitchen.
- **Produced** — the kitchen's output, made from issued ingredients.
- **Transferred** — sent from one location to the other. Runs in both directions.
- **Sold** — left through a [[Sale]].
- **Sold, derived** — established at a count rather than recorded at the moment of
  sale. The difference between what a count found and what the records expected,
  where individual sales are not captured. Used at the canteen. Attributed to the
  count, not to a person's moment-by-moment entry, and always distinguishable from
  `Sold` so no report mistakes an inference for an observation.
- **Wasted** — spoiled or ruined.
- **Consumed** — used by the business rather than sold.
- **Given away** — complimentary.
- **Corrected** — a physical count disagreed with the record and the record was
  adjusted to reality.

A stock level is not a number that is maintained. It is the sum of the movements.
This is what makes the historical record in the client's own Excel shape possible:
the history of an item on a day is simply its movements for that day, in order.

## Handover

Money physically passed from one [[Staff Member]] to the owner, for one
[[Location]] on one day.

A handover holds an **expected** amount and an **actual** amount, being what was
really handed over. The difference between them is the control the client asked for,
and it is checked per person and per day.

Where the expected amount comes from depends on the location:

- **Restaurant** — the sum of that person's recorded [[Sale]]s for the day. An
  independent expectation, because it was built from individually recorded sales.
- **Canteen** — the [[Takings]] the attendant recorded. For M-Pesa this is still a
  real check, because the M-Pesa messages are evidence she does not control. For
  cash it is weaker, and the weekly count is what tests it — see `docs/formulas.md`.

Cash and M-Pesa are handed over and checked separately.

## Cash Movement

Money entering or leaving the owner's own hands, and the basis of the running cash
balance.

Money in is a [[Handover]]. Money out is a payment the owner makes — stock from
suppliers, gas, charcoal, electricity. Only the owner pays money out, which is what
makes a single expected-cash figure meaningful.

Money the owner takes for personal use is recorded as a cash movement out **and** a
debt owed back to the business, so the expected balance stays truthful.

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
