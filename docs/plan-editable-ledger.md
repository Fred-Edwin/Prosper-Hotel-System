# Plan — The editable ledger

**Status:** proposed, not started
**Created:** 2026-08-17
**Decided by:** Edwinfred (owner-facing requirement), see "Decisions taken" below

The owner edits any figure she can see, in place, from the ledger. One click on a
cell, type the new value, done. Corrections cascade forward automatically. Every
edit is recorded in a trail she never has to fill in.

---

## 1. Decisions taken before this plan

These are settled. They are recorded here because two of them overturn shipped
architectural decisions.

**D1 — Direct in-place editing replaces the effective-date correction doctrine.**
`docs/architecture.md`'s "Changing a closed day" section said the owner *does not*
edit closed figures — she records a new entry carrying a past effective date. That
is now reversed. She edits the figure directly. Superseded, not merely relaxed.

**D2 — Handovers are frozen, and outside the cascade.** A handover's
`expectedCashMinor` / `expectedMpesaMinor` are never recomputed, ever, by anything.
They are a record of an event between two people, not a derived measurement — and
the owner is not the authority on what was in a cashier's hand last Tuesday. Her
*actual* figures are editable (a typo about a real event); the *expected* side is
permanent. Where a later edit has moved that day's sales, the handover row says so
in words, showing both figures.

**D3 — Full amendment trail, captured silently.** Every edit records what changed,
from what, to what, by whom, when. She is never asked to type a reason. The trail
surfaces in Activity.

**D4 — Quantity stays derived from the movement ledger.** ADR 0001 holds. There is
still no stored stock quantity. This plan does *not* introduce one — it is the
reason the cascade is nearly free, and reversing it would be the one change that
makes this feature hard.

**D5 — The existing backdated-correction feature is deleted, not kept alongside.**
`recordSaleCorrection`, `recordSaleCorrectionRoute`, `record-correction-dialog.tsx`
and `Sale.effectiveAt` / `isCorrection` / `correctionReason` all go. Confirmed by
the owner 2026-08-17. Two mechanisms for correcting the same figure would drift, and
this one is already half-broken: it stamps a past `effectiveAt` that **no report
reads** — every revenue and profit aggregate filters on `occurredAt` — so a
correction for last Tuesday lands in today's profit. Executed by T11.

**D6 — Far-back edits warn, but are never blocked.** An edit whose cascade reaches
back more than **31 days** shows a confirm step naming the span
(*"This changes figures for the last 5 months"*). Confirmed by the owner 2026-08-17.
It is a disclosure, not a permission gate — she is still the authority, and there is
no threshold at which an edit is refused. Implemented as C7's second escalation case.

---

## 2. Why this is cheaper than it sounds

Three facts about the current codebase, all verified, all load-bearing for this plan:

**The frozen daily close was never built.** ADR 0001 and `architecture.md` both
describe a per-item daily closing balance frozen at close of day. It does not exist
— no `DailyClose` model in `prisma/schema.prisma`, no such table, no code path.
Every quantity is summed live from the full movement history on each read
(`sumMovementsByProductAtLocationAsOf`, `stock/queries.ts:131`).

**So the cascade already happens.** `buildProductLedgerRow`
(`reporting/logic.ts:789-838`) chains days with `runningOpening = dayClosing`, and
each day's figures come from that day's movement sums. Change a movement row and
every subsequent day's opening, every closing, every cost-of-goods figure and the
profit built on it all re-derive on the next read. **No recalculation engine is
needed.** This plan builds no cache invalidation, no rebuild job, no
recompute-forward loop.

> **Found during T3, 2026-08-17 — a gap in the cascade claim above.** The Product
> ledger fetched movements by an explicit reason list that **omitted `corrected`
> entirely**, while opening/closing (the `...AsOf` reads) sum *every* movement
> regardless of reason. So a `corrected` row moved closing without appearing in any
> column that explained why, silently breaking `closing == opening + in − out`.
> This predates the editable ledger — `reverseTransfer` and `correctStockCount`
> have written `corrected` rows since ticket 21 — and would have surfaced as a
> spurious C3 failure blamed on T3. The ledger now carries a signed **Corrected**
> column, rendered `+4` rather than `4` so an adjustment is never mistaken for
> another delivery.

**Money snapshots are already correct.** `SaleLine.priceMinor`,
`StockMovement.costBasisMinor` / `sellingValueMinor` and
`StockCountLine.expectedQuantity` freeze their value at write time, so editing a
price today does not reshape a past record. Keep every one of these.

The work is therefore: give the owner a write path to each editable figure, add the
trail, and fix the places where the existing code can't express an edit at all.

---

## 3. What is editable, and what each cell actually writes

This is the core of the plan and the part most likely to go wrong if left vague.
A ledger cell is not a database column. Each cell needs a stated mapping from
"she typed 5" to "these rows changed."

### 3.1 The three kinds of cell

**Kind A — cell is backed by real movement rows.** Product ledger's `received`,
`produced`, `transferredIn`, `transferredOut`, `sold`, `nonSales`; Store ledger's
`purchasedQty`, `issuedToKitchen`, `transferredIn/Out`, `spoilage`.

Editing one of these means: the day's total for that reason should become N. The
day may be backed by zero, one, or several movement rows — **and that count decides
the mechanism.**

*Rule, revised 2026-08-17 (see "Why the total, not the rows" below):*

**She edits the day's total for that reason, and the app makes the total equal what
she typed. She is never asked which underlying row was wrong.**

| Rows behind the cell | What we do |
|---|---|
| **Exactly one** | Edit that row's quantity in place. The common case. |
| **Several** | Edit the **most recent** row by the difference. Deterministic, never a prompt. |
| **Zero** | Write one new movement for the full amount, `isAmendment = true`. |

Worked example, one row. Beef stew, restaurant, 2026-08-16, `received` is 3 — one
movement of +3 recorded by the store manager. She types 5. That row becomes 5, and
an `Amendment` records `received 16 Aug: 3 → 5, by owner`. The movement list shows
**one delivery of 5**, because one delivery is what happened.

Worked example, several rows. `received` is 3, made of three separate +1 deliveries.
She types 5. The most recent +1 becomes +3; the day's total is 5. The amendment
records the **day-level** change (`received 16 Aug: 3 → 5`), because that is the
fact she stated.

*Why the total, and not the rows.* An earlier draft did two things this one doesn't:
it always wrote a second offsetting movement rather than editing anything, and where
a day had several rows it made her expand and pick one. Both rejected on the owner's
instruction, and both were wrong for the same reason — **they made her think about
the app's internal record-keeping instead of the fact she knows.** She is looking at
a day and a quantity. "Which of the three deliveries was misrecorded" is a question
she usually cannot answer and never asked to be asked; the balancing row, meanwhile,
made the arithmetic right while showing two deliveries where one happened.

*What the trail must therefore record.* Because the edit is stated at day level, the
`Amendment` row is **day-level**: reason, date, product, old total, new total. It
does **not** merely say "movement abc123.quantity changed" — that would be a true
statement about a row and a useless one about her business. `ledgerContext` and
`effectiveDate` on `Amendment` exist for exactly this. Reading "what did this day
originally say" must go through `Amendment`, never through the movement rows.

*Accepted cost, stated plainly.* Picking the most recent row means one row now
carries a quantity that wasn't what that particular delivery brought. This is a real
loss of per-row fidelity, accepted deliberately: the day total is correct, the trail
is truthful about what she changed, and the alternative was a prompt she explicitly
rejected. Nothing in the app reads a single `received` row as authoritative about one
delivery — receipts are grouped by `receiptId` and read as a group.

**Kind B — cell is a derived total with no rows of its own.** Product ledger's
`opening` and `closing`; Store ledger's `openingQty` / `closingQty`.

`opening` is the sum of *everything before this date*. `closing` is opening plus
the day's movements. Neither is stored, so neither can be written directly.

*Rule:* an edit to one of these becomes a single dated **`corrected` movement**:

- **Opening = N on date D** → a `corrected` movement dated at **exactly
  `D 00:00:00.000`**, for `N − currentOpening`. Every day from D forward shifts by
  the same delta, which is exactly the waterfall required.

  **D−1's closing moves with D's opening, and there is no gap between them.** Day
  windows are contiguous — `daysInPeriod` makes D−1 the half-open interval
  `(D−1 00:00, D 00:00]`, while opening at D is `occurredAt <= D 00:00` — so any
  instant that raises D's opening is necessarily inside D−1's window. Stamping it
  "the last instant before D" (23:59:59.999) changes nothing; it is still inside
  D−1.

  It must move: D−1's closing and D's opening are the same quantity seen from two
  sides. Leaving them different would have the ledger say stock was 1 at the end
  of the 15th and 5 at the start of the 16th with nothing in between, which is
  the unexplained jump the reconciliation invariant exists to forbid. Days
  strictly before D−1 are untouched. The correction appears in D−1's `corrected`
  column, so the change is explained on screen rather than unaccounted for.

  *(An earlier draft of this bullet asked for the adjustment to "sit in the gap
  between D−1's close and D's open" while days before D kept their figures
  unchanged. That pair of requirements is unsatisfiable; T3 established the rule
  above.)*
- **Closing = N on date D** → a `corrected` movement dated at the last instant of
  D, for `N − currentClosing`. D's opening and D's own movements are unchanged;
  D+1's opening becomes N and cascades on.

Worked example, the one from the requirement. Beef stew opening on 2026-08-16 shows
1; she types 5. We write `corrected +4` at 2026-08-15T23:59:59.999. 2026-08-16
opening is 5, its closing rises by 4, 2026-08-17's opening rises by 4, and so on
through today. Cost of goods sold for each affected day and the profit built on it
re-derive from those same rows.

*Why a new row is right here, unlike Kind A.* Kind A's rejected balancing row was
dishonest because it posed as a *second delivery*. Kind B's row poses as nothing —
it is a correction, `reason = "corrected"`, and it must be **labelled as such
wherever movements are listed**: "opening corrected by owner, +4", never rendered
as a delivery or a production. There is no pre-existing row to edit instead (that
is what "derived" means), and the correction is itself a real, datable fact about
the owner's knowledge of the shelf. So the row is truthful — provided the UI never
disguises it. That labelling is a requirement of T5/T6, not a nicety.

**Kind C — cell is a scalar on a single record.** Cash ledger transaction amounts
(`Expense.amountMinor`, `Repayment.amountMinor`, `DrawingRepayment.amountMinor`),
handover *actuals*, sale line quantities and prices, days worked, staff/customer
name and phone.

*Rule:* edit the column in place, inside a transaction that also writes the
amendment row. These are genuinely single stored values; an offsetting row would be
a fiction — a "balancing +200 gas payment" invents a purchase that never happened.

### 3.1a The rule underneath all three

> **Edit the thing she is looking at, whenever there is exactly one thing to edit.**
> **Add a row only when there is nothing to edit** (Kind B: the figure is derived)
> **or when it is ambiguous which thing she meant** (Kind A with several rows).
> **A row we add is labelled a correction — never dressed as a delivery, a
> production, or a payment.**

So Kind A and Kind C behave the same way in the common case, and Kind B is the
genuine exception rather than stock being treated differently from money. The
earlier framing — "quantities get balancing rows, scalars get edits" — was wrong,
and the amendment trail is what makes in-place editing safe in all three.

### 3.2 The editability table

Every figure on all four ledger tabs. Anything marked "no" needs a stated reason,
so there are no silent gaps for the UI to discover later.

| Ledger / figure | Editable | Kind | Writes |
|---|---|---|---|
| **Product** opening | yes | B | `corrected` movement before day start |
| **Product** produced / received / transferred in / out | yes | A | day total becomes N; most-recent row absorbs the difference |
| **Product** sold | yes | A | **see 3.3** — restaurant asks stock-only vs stock-and-money; canteen moves both |
| **Product** non-sales (wasted/consumed/given away) | yes | A | edit the movement in place; asks which of the three if creating one |
| **Product** closing | yes | B | labelled `corrected` movement at day end |
| **Product** unit cost / selling price | yes | C | `Product.lastKnownCostMinor` / `priceMinor` — **see 3.4, not retroactive** |
| **Product** sales value / cost of sales / profit / closing value | **no** | — | pure arithmetic of editable inputs; editing them is ambiguous. Fix the quantity or the price instead. |
| **Store** opening / closing | yes | B | labelled `corrected` ingredient movement |
| **Store** purchased qty | yes | A | edit the receipt's movement in place |
| **Store** purchased value | yes | C | `unitCostMinor` on that day's receipt rows |
| **Store** issued / transferred in / out / spoilage | yes | A | edit the movement in place |
| **Store** unit cost, previous unit cost | **no** | — | `previousUnitCostMinor` is read off the **last delivery before the period** (`getPreviousDeliveryCostAtLocation`), not reconstructed algebraically; current cost is latest-price with FIFO layers, not a running average. Both still read-only — edit a delivery's cost instead. *(Corrected by T10: the costing change replaced the running average, so the original reason given here no longer held even though the verdict did.)* |
| **Non-sales** quantity, cost basis, selling value | yes | A / C | edit the movement and its values in place |
| **Cash** transaction amount | yes | C | the underlying `Expense` / `Repayment` / `DrawingRepayment` |
| **Cash** transaction method (cash/M-Pesa) | yes | C | same records |
| **Cash** handover actual cash / actual M-Pesa | yes | C | `Handover.actualCashMinor` / `actualMpesaMinor` |
| **Cash** handover expected | **no — permanently** | — | **D2.** Frozen record of a check that happened. |
| **Cash** opening / closing cash & M-Pesa | **no** | — | derived from the transactions above; edit a transaction |
| Sale line quantity / price, delivery fee | yes | C | `SaleLine`, `Sale.deliveryFeeMinor`, with stock and total kept consistent |
| Staff / customer name, phone | yes | C | closes **BUG-01** |
| Days worked | yes | C | `DaysWorked` |

### 3.3 The one genuinely hard case: `sold`

`sold` is the only figure that is simultaneously a stock movement *and* a financial
record. A `sold` movement has a paired `Sale` / `SaleLine` / `PaymentLine` behind
it (restaurant), or was produced by a count (canteen, via
`recordCountDerivedSale`).

Editing the ledger's `sold` cell from 30 to 28 must not leave stock saying 28 and
revenue saying 30. But unlike every other cell, **doing nothing is also a choice**:
either revenue stays and disagrees with stock, or it drops and the app erases money
a customer physically handed over. There is no neutral option, so the app asks —
**once, on this cell only.**

*Rule, revised 2026-08-17 (an earlier draft made restaurant `sold` read-only with a
link to the individual sales; rejected by the owner — she is editing a day's total,
not hunting through eleven sales).*

**Restaurant.** The cell is directly editable. On commit, two buttons:

> **Sold: 30 → 28.** Revenue recorded for these is KSh 9,000.
> - **Stock only** — 2 never left the shelf (miscount, breakage). Revenue unchanged.
> - **Stock and money** — these 2 were never sold. Revenue drops to KSh 8,400.

Not a confirmation dialog and not a reason prompt: two buttons naming two different
real situations. The choice is recorded on the amendment
(`sold 16 Aug: 30 → 28, stock only`), which makes the trail state her *intent*, not
just an arithmetic delta — worth more six weeks later than a bare number change.

- **Stock only** → adjust the movement, leave `Sale`/`PaymentLine` untouched.
- **Stock and money** → adjust the movement *and* reduce the day's sale value by the
  implied amount, most-recent-sale-first, same determinism as §3.1's several-rows rule.

**Canteen.** No prompt. The figure is count-derived — no separately recorded revenue
exists to disagree with — so editing it moves the movement and its paired
count-derived sale together, in one transaction. This asymmetry follows ADR 0004
(the two locations record trade at different granularity) and keeps that ADR intact.

**Both cases cascade identically.** The choice governs *revenue only*. Stock
cascades either way, so cost of goods sold and profit move under "stock only" too
(less consumed → lower cost → slightly higher profit). This is correct and must be
what the disclosure in §6/C7 says, because it is the part she will not expect.

### 3.4 Price and cost edits are not retroactive — and one existing bug is

Editing `Product.priceMinor` or `lastKnownCostMinor` changes the figure **from now
on**. Past `SaleLine.priceMinor` and past `costBasisMinor` are snapshots and stay put.

But two current read paths break that promise already, independently of this work:
`getIngredientStockValueAtLocation` values *historical* ingredient stock at the
ingredient's *current* `lastKnownCostMinor` (`stock/logic.ts:1805-1815`), and
`resolveProductCostBasis` reads the product's *current* cost/price
(`stock/logic.ts:105-122`). So editing a price today silently moves last month's
reported cost of goods sold.

This is pre-existing, but the editable ledger will make it obvious and will get
blamed for it. **Ticket 8 addresses it. It is not optional** — shipping editable
prices on top of retroactive valuation is how the owner loses trust in the numbers.

---

## 4. Schema changes

```prisma
// New. One row per field-level edit, any record type. Generic on purpose:
// covers stock quantities, expense amounts, prices, names, days worked, and
// whatever comes next, without a column per model. Closes BUG-01.
model Amendment {
  id            String      @id @default(cuid())
  recordType    String      // "StockMovement" | "Expense" | "Product" | ...
  recordId      String
  field         String      // "quantity" | "amountMinor" | "name" | ...
  previousValue String      // stringified; display-only, never recomputed from
  newValue      String
  // What the owner was looking at when she edited, so Activity can say
  // "opening for beef stew on 16 Aug" rather than naming a movement id.
  ledgerContext String?
  effectiveDate DateTime?   // the ledger day she was editing, where applicable
  staffMemberId String
  staffMember   StaffMember @relation(fields: [staffMemberId], references: [id])
  createdAt     DateTime    @default(now())

  @@index([recordType, recordId])
  @@index([createdAt])
  @@map("amendments")
}

// StockMovement + IngredientMovement both gain:
  //  Reversal support — these are the only money-touching models in the
  //  schema without it. Every other one has it (Sale.voided,
  //  Expense.reversed, Repayment.reversed, Transfer.cancelledAt).
  reversed     Boolean   @default(false)
  reversedAt   DateTime?
  reversedBy   String?
  //  True on a row the owner's editing created rather than ordinary trading —
  //  a Kind B opening/closing correction, or the fallback adjustment where a
  //  day had several rows. The UI MUST label these as corrections and never
  //  render them as a delivery/production/sale (§3.1's Kind B note). It is
  //  real stock movement, so it is NOT excluded from any sum.
  //  Note: an in-place edit to an existing row does NOT set this — that row
  //  is still the original event, and its change lives in Amendment.
  isAmendment  Boolean   @default(false)

// Handover gains:
  //  D2: set when a later edit moved this day's sales after the handover was
  //  checked. Display only — expected figures are never recomputed.
  salesEditedAfterCheck Boolean @default(false)
```

Every sum over movements must then filter `reversed: false`. That filter is the
single highest-risk change in this plan — see §6.

---

## 5. Docs to amend

Not optional, and not left to the end. A doc that contradicts the code is how the
next person reintroduces the thing we just removed.

| Doc | Change |
|---|---|
| `docs/architecture.md` ✅ done | Replace "Changing a closed day" wholesale. Amend the "Data lifecycle" list — reversal is no longer the *only* mechanism. Amend "Stock levels" to state plainly that the frozen daily close was never built and is not planned. |
| `docs/adr/0001-...md` | Add an amendment: decision stands, quantity stays derived; the "frozen daily closing balance" consequence is withdrawn as never implemented, and the live-sum property is what makes editing viable. |
| **new** `docs/adr/0008-in-place-ledger-editing.md` ✅ written | The reversal itself: what the effective-date doctrine was, why it's being dropped, why handovers are the one exception, and §3.1a's rule — edit the thing she's looking at; add a row only where there is nothing to edit or it's ambiguous which; label any row we add as a correction. Record that the always-balancing-row design was considered and rejected for misrepresenting the event. Written so the reasoning survives, not just the outcome. |
| `docs/formulas.md` | §1 note that corrections cascade forward. §10 note the frozen-expected rule and the "sales edited since" marker. |
| `docs/bugs.md` ✅ done | BUG-01 resolved by ticket 2, as planned. The trail is written in `people/logic.ts`'s `updateStaffMember` / `updateCustomer` wrappers — not in `queries.ts`, whose functions stay bare Prisma calls per the data-access convention. |
| `CONTEXT.md` | New term: **Amendment**. Owner-only. **Ask before writing — CLAUDE.md forbids unprompted edits to this file.** |
| `docs/screens.md` | Ledger tabs gain edit affordances; new amendment-history view. |
| `docs/conventions.md` | The Kind A / B / C rule from §3.1, so future figures get classified rather than improvised. |

---

## 5a. Decisions settled during the build

Recorded by T10. None of these were in the plan when it was written, and every one
of them would otherwise survive only in a commit message.

### The editing interaction

- **Single click focuses a cell; typing a digit opens the editor.** Not
  double-click.
- **The affordance is hover/focus-only — nothing at rest.** An always-visible
  underline on editable cells *was* built, reviewed and rejected on 2026-08-17: it
  marked fourteen columns, which is everything, and a marker on everything marks
  nothing.
- **The amendment-history marker is the deliberate exception** and *is* visible at
  rest (T9). The two answer different questions. "You could change this" only
  matters while she is reaching for a cell, so hover is the right moment. "This was
  changed" is something she needs to **scan** for — the point is finding edited
  figures without knowing in advance which they are, and a hover-only marker would
  mean hovering every cell to discover them. The rejection above still holds for
  its own case: fourteen editable columns meant marking everything, where twelve
  amendments across an eighteen-day period touch five cells.
- **Phone is read-only** throughout.

### What confirms, and what it says

- **Every edit confirms before it is written** (owner decision, 2026-08-18),
  superseding T4's three-escalation rule *and* T6.4's "no confirm on purchase
  edits". The escalations became extra warning text on a dialog that appears
  regardless. T6.4's reasoning is superseded rather than contradicted: the dialog
  is no longer a question about which reading she meant, it is a check that she
  typed the number she intended.
- **The one exception is §3.3's `sold` choice**, which already opens a dialog
  naming both figures and asking her to pick a revenue treatment. Confirming again
  would be two modals for one edit — friction without a second check.
- **The confirm previews the real cascade** (T12), from the server, and shows the
  "this also changes" section **only** when something beyond the edited cell moves.
- **No edit on any tab is accepted silently**, with one deliberate exception: an
  unchanged value writes nothing and says nothing, so she can press Enter through
  cells while reading without generating noise.

| What happened | What she sees |
|---|---|
| Value unchanged | Nothing — no write occurred |
| Edit, no cascade | Toast confirming the change, with Undo |
| Edit that cascaded | Toast quoting the real downstream figures |
| Purchase edit | Toast naming the derived figure that moved |
| Cascade beyond 31 days | Extra warning on the confirm, naming the span (D6) |

### What is deliberately *not* editable

- **Period-total quantities.** A figure spanning many days offers no honest date to
  stamp an amendment against. The tooltip says which: "Edit a day's figure — expand
  the row."
- **Payment method on the Cash tab** (T7). The write layer supports it and the
  allow-list carries it, but an editable choice inside a table cell exists nowhere
  in the app, and a two-value toggle is not worth inventing a UI pattern for: the
  method moves **no figure the ledger shows**, only which balance column the amount
  lands in.
- **Cash opening/closing balances**, because **no stored figure exists behind
  them** — they are derived from the day's transactions, so there is nothing to
  amend. Contrast the **Store** tab, where opening and closing *are* editable
  because stock has a `corrected` movement reason to carry the correction. Cash has
  no honest equivalent: a balance correction with nothing to attribute it to would
  be a number appearing from nowhere.

  > The owner asked about this. If she raises it again it is a **real design
  > question, not a no** — the answer would be to give cash an explicit
  > adjustment transaction type, which is a feature, not a tweak.

### Write-layer rules established by the build

- **`amendScalar` refuses a reversed record as `not_found`.** A reversed row counts
  nowhere, so no ledger cell offers the edit — but the route takes a record id, so
  it was reachable, and it would have written a trail entry describing a change to
  a figure that appears in no total.
- **The purchase-edit rule** (T6.4): editing quantity holds unit cost and moves
  value; editing value holds quantity and moves unit cost. **Unit cost is the
  figure that moves, because it is the one nobody typed.** Quantity and value are
  what a delivery note actually states.

### Three defects T9 had to fix before a history marker could land

All three were real defects rather than missing plumbing, and each would have
silently produced a wrong or unfindable trail:

1. **`amendScalar` never set `effectiveDate`.** Every scalar edit therefore claimed
   to apply to the day it was typed, so an expense from the 11th corrected on the
   18th read as an edit to the 18th — and T7.3's "sales edited since" marker, which
   queries `effectiveDate`, could never have fired for one at all. The caller knows
   the ledger day and now states it. Amendments genuinely about no day, like a
   selling price, still store null rather than guessing.
2. **`amendDayTotal` recorded the movement row that absorbed the edit, not the
   item.** That contradicted the comment directly above it: the trail is day-level
   because the day's total is the fact she stated. Two edits to one day's total
   could land on different rows and read as unrelated, and no history could find
   either, because the ledger renders an item and a day and never a movement id.
3. **The cell key needs the ledger day for a day-total edit and not for a scalar.**
   A day-total's `recordId` names an item, which has a different cell on every day;
   a scalar's names one row, which is the whole identity. With the day in both, one
   figure's history split in two the moment anything about the day differed.

---

## 6. What makes this mistake-proof

The requirement is a system that silently rewrites financial history on one click.
The danger is not that it fails loudly — it is that it succeeds wrongly and nobody
notices for a month. Each control below exists for a specific way that happens.

**C1 — One write path per kind, not per cell.** Three functions total:
`amendDayTotal` (Kind A — sets a day's total for one reason), `amendDerivedPosition`
(Kind B — writes the labelled correction row), `amendScalar` (Kind C). Every cell
routes to one of them. A new editable figure declares its kind and gets the semantics
for free. Prevents: fifteen bespoke edit handlers drifting apart, which is exactly how
BUG-10 happened (two code paths for one figure).

`amendDayTotal` takes **product/ingredient + location + date + reason + new total** —
*not* a movement id. Row selection (§3.1's most-recent rule) lives inside it, in
`logic.ts`, so it is one tested decision rather than something each ledger tab
re-derives. The UI never names a movement row. An earlier draft inverted this and
made the UI resolve the row; that died with expand-to-pick.

**C2 — Amendment and effect in one transaction, always.** The trail row and the
data change commit together or not at all. An untrailed edit is worse than no edit;
D3 is a hard guarantee, not best-effort. `db.$transaction` around every one of the
three functions, asserted in tests.

**C3 — The reconciliation invariant, as an automated test.** For any product,
location and date range: `closing == opening + in − out`, computed independently of
`buildProductLedgerRow`, and it must hold **after an arbitrary sequence of random
amendments**. This is the single most valuable test in the plan — it is what
catches a Kind B correction landing on the wrong side of a date boundary, the
`reversed: false` filter missed in one of the 18 sum sites, and off-by-one-day
errors in the Kind B boundary timestamps. Property-based, not example-based:
generate edits, assert the identity.

**C4 — A `reversed: false` audit, mechanically.** Adding `reversed` to the movement
tables means every existing sum is wrong by omission until updated. Ticket 1 commits
that enumeration as a checklist and asserts, per aggregate by name, that a reversed
movement is invisible to it. Prevents: the Finding 4 / BUG-12 failure mode — the
same filter applied in four places and missed in the fifth.

**The surface is 21 sites needing a filter** (established by T1; an earlier draft
here said 18): 18 read sites in `stock/queries.ts`, plus three the plan originally
missed — the availability checks at `sales/logic.ts:153`, `stock/logic.ts:580` and
`stock/logic.ts:616`. Those three are the most dangerous in the list: they gate
`insufficient_stock`, so a missed filter there makes a *write* wrong rather than a
report, authorising the sale or transfer of stock a reversal says is not there.
Four further sites are deliberately unfiltered (the `reversedTransferId` lookups,
which must see reversal rows to refuse a double reversal). The committed
enumeration is `docs/reversed-filter-audit.md`.

**C5 — Cross-figure consistency tests at the seams.** After editing a `sold` cell:
stock, revenue and cost of goods sold must all agree. After editing an expense: the
cash ledger, the running balance and profit must agree. These are the specific
places where "it looked right on the screen I was editing" hides a break two
screens away.

**C6 — Handover isolation, asserted.** A test that edits a day's sales and asserts
`expectedCashMinor` is byte-identical afterward, and that
`salesEditedAfterCheck` flipped to true. D2 must be enforced by a test, because it
is the one rule a future well-meaning "fix the inconsistent handover" change would
break.

**C7 — Two-stage cascade disclosure, on every edit.** Revised 2026-08-17: this was
previously a confirm dialog on Kind B only. It now applies to **every** edit, because
the surprise isn't the cascade she asked for — it's that *a stock edit moves profit*.
She will expect stock to change. She will not expect cost of goods sold and profit to
change, and they always do (§3.3's closing note).

*Stage one, while typing — a quiet line under the cell, not a dialog:*

> `Received: 3 → 5` · also changes closing for 16 Aug onward, cost of goods sold, profit

*Stage two, after saving — a toast with **real figures**, and Undo:*

> Updated. Beef stew closing rose by 2 across 3 days. Profit for 16 Aug changed by
> KSh 45. **[Undo]**

Stage two matters more than stage one: actual numbers are checkable, categories
aren't. And **Undo is the highest-value UX decision available here** — it turns each
edit from a commitment into an experiment, which does more for her confidence than
any warning copy. Undo is itself an amendment (C8), never a delete.

*Three cases escalate to a real confirm step:*

| Case | Why |
|---|---|
| Opening / closing (Kind B) | cascades to *every* following day, not one |
| An edit whose cascade reaches back **more than 31 days** | could move months of figures — **D6**. Name the span: *"This changes figures for the last 5 months."* Warn, never block. |
| A day that already has a handover | the handover's expected figure deliberately will **not** move (D2), so the ledger and that day's check will now disagree — **the only place in this design where two figures are meant to differ.** Unexplained, it reads exactly like a bug. |

That third case is the one to get right. Everything else is informational; this one
prevents a false bug report against correct behaviour.

**No reason field, anywhere, ever.** Disclosure is information, not permission. She
must be able to edit ten cells in sequence without a single "confirm" click outside
the three cases above.

**C8 — Every amendment is itself amendable.** No terminal states. A wrong edit is
fixed by another edit, never by a database intervention. Consequence: nothing in
this plan may ever mark a row "final."

**C9 — Owner-only, at the logic layer.** Every one of the three write functions
gates on `requireOwner` *inside* `logic.ts`, not at the route — the existing
convention (`correctStockCount`, `stock/logic.ts:1708`). Routes are not a security
boundary here.

**C10 — Nothing ships behind a half-migrated read path.** Ticket order below is
load-bearing: reversal support and the audit (T1) land before any UI can write,
and the retroactive-valuation fix (T8) lands before price editing is exposed.

---

## 7. Tickets

Ordered by dependency. Each is independently shippable and leaves the app working.

**T1 — Movement reversal + the `reversed: false` audit.** Schema fields on both
movement tables; `reverseMovement` in `stock/logic.ts` (owner-only, writes an
offsetting `corrected` row, marks the original); update every aggregate over both
tables to exclude reversed rows, with the C4 checklist and per-aggregate tests.
Closes the "a wrong delivery can never be undone" gap. **No UI.** Test-first.

**T2 — The `Amendment` model and the trail.** Model, `recordAmendment` helper,
`getActivity` reads it as a new source. Retro-fit the existing silent overwrites in
`updateStaffMemberRecord` / `updateCustomerRecord` to write amendments — **closes
BUG-01**. Test-first.

**T3 — The three write functions.** `amendScalar`, `amendDayTotal`,
`amendDerivedPosition`, each owner-gated, each transactional with its amendment
row. Includes the C3 property-based reconciliation test, the Kind B boundary-
timestamp tests, §3.1's most-recent-row selection, and §3.3's stock-only vs
stock-and-money branch for restaurant `sold`. **No UI.** Test-first. *This is the
keystone ticket — the largest and the one to review hardest.*

**T4 — `EditableNum` and the interaction layer.** See §9 for what the current UI
does and doesn't already provide. Four parts:

1. **`EditableNum`** — wraps the existing `Num` (`product-ledger.tsx:166`), which
   every ledger figure already renders through, so this is one component rather than
   fifty scattered cells. **Double-click to edit** (a single stray click must never
   begin altering financial history), Enter commits, Escape cancels, Tab moves on.
   Five states per `docs/design.md`: idle-editable (dotted underline, *neutral* — see
   §9's accent note), hover/focus, editing, saving (value dimmed but still visible,
   never a spinner replacing the number), not-editable-with-a-reason (tooltip:
   *"Profit is calculated. Edit the quantity or price."*). Storybook story per state.
2. **Save + refresh plumbing** — per-cell in-flight state, error rollback, and a
   re-fetch on success. *This is the part that gets underestimated:* an edit changes
   **other** cells (closing, every later day's opening, the money columns), so the
   cascade shows up here as a UI problem. Updating only the cell she typed in is wrong.
3. **Notification layer** — C7's inline preview line, the toast with real figures, Undo.
4. **The three confirm cases** from C7's table.

**No density change and no mode toggle.** An earlier draft proposed both; the owner
reviewed the actual cell sizing (`px-2 py-2`, ~32px rows) and confirmed it is fine
for mouse editing on a laptop. `docs/design.md`'s "density over comfort" therefore
stands unmodified, and the Reading experience is *literally* unchanged — same markup.

**New pattern → per CLAUDE.md's UI rules, stop and confirm before building.** Build
one `EditableNum` in Storybook with real seed data and hand over the live URL (see
`storybook-port-per-worktree`). One variant, not three — it's a small pattern now.

**T5 — Product ledger editable.** Wire T4 into `product-ledger.tsx` per the §3.2
table, including §3.3's restaurant `sold` two-button choice and C7's escalations.

**T6 — Store ledger editable.** Same, per §3.2.

**T7 — Cash ledger + non-sales ledger editable.** Includes handover actuals, the
frozen-expected treatment and the "sales edited since" marker (C6).

**T8 — Historical valuation fix.** Make ingredient and product valuation read the
cost in force *at the time* rather than the current one, so price edits stop
silently reshaping past cost of goods sold. **Must land before T5/T6 expose price
editing** — or T5/T6 ship with price cells read-only until it does.

**T9 — Amendment history UI.** Per-record "this was edited" affordance in the
ledger, and the amendment feed in Activity.

**T10 — Doc amendments and ADR 0008.** Everything in §5. Lands with or immediately
after T3, not at the end — the ADR is the record of *why*, and it is worth least
when written last.

**T11 — Delete the superseded correction mechanism.** Per **D5** — approved
2026-08-17, no further confirmation needed. Removes:

- `recordSaleCorrection` (`sales/logic.ts:291`) and `recordSaleCorrectionRoute`
- `record-correction-dialog.tsx` + its stories, and the `/api/sales/corrections` route
- `Sale.effectiveAt`, `isCorrection`, `correctionReason` (migration drops the columns)
- their reads in `getActivity` (`reporting/logic.ts:1565-1584`) and the
  `createSaleRecord` write path (`sales/queries.ts:76-100`)
- the covering tests in `sales.integration.test.ts:1290-1344` and
  `activity.integration.test.ts:301`

**Sequenced last, and this matters:** T2's amendment trail must be live and T9's
history UI shipped *before* the old path goes, so there is never a window where a
correction is unrecordable. Verify with `pnpm test` and `pnpm exec tsc --noEmit` that
nothing else referenced the dropped fields — grep first, since `effectiveAt` also
appears in generated Prisma client code that regenerates from the schema.

---

## 8. Open questions

*Questions 1 and 2 (retiring `effectiveAt`, and the cascade horizon) were resolved
2026-08-17 — see D5 and D6.*

1. **Concurrency** — two ledger tabs open, both editing the same cell. Recommend:
   last-write-wins with both amendments recorded, since the trail makes it
   recoverable. Anything stronger needs optimistic-concurrency plumbing this
   requirement doesn't obviously justify.
2. **Store-tab granularity** — the Store ledger has no day expansion (§9). T6 must
   either add it or restrict Store editing to period-level figures. Decide before
   starting T6.
3. **Ingredient movement sign — resolved, but the schema lies.**
   `IngredientMovement.quantity` *is* signed: `recordIngredientIssue` writes
   `quantity: -line.quantity` (`stock/logic.ts:1142`). The schema comment still
   says "Unsigned in this ticket — receiving is the only reason written so far,"
   which is stale and actively misleading for anyone editing an ingredient
   movement's quantity. **T1 fixes the comment.** No behaviour change; flagged
   because a wrong sign here flips an issue into a receipt rather than correcting it.

---

## 9. What the current UI already gives us

Assessed 2026-08-17 against the real components, so T4 is scoped against fact.

**Already there, and load-bearing:**

- **Day expansion.** `product-ledger.tsx` already expands a product row into per-day
  rows via a chevron. Most editing happens at day level, so the mechanism she needs
  exists. Store/Cash tabs differ — see the gap list below.
- **One numeric cell component.** Every figure renders through `Num`
  (`product-ledger.tsx:166`). T4 wraps *one* component, not fifty call sites.
- **A frozen first column** (`FROZEN`, line 150) — she can scroll a 16-column table
  sideways without losing the product name.
- **Five documented table states** already composed from `components/patterns/states`.

**Not there, and genuinely new work:**

- **No interaction of any kind.** `Num` takes a number and returns styled text.
  No hover affordance, no focus handling, no keyboard model, no per-cell saving or
  error state. The whole interaction layer is new.
- **No shadcn component to adopt.** `components/ui/table.tsx` is 40 lines of styled
  `<table>`/`<tr>`/`<td>` wrappers with zero logic — shadcn/ui ships no editable
  table, so there is nothing to swap in. Confirmed by reading the file, not assumed.
- **No refresh-after-save path.** The tables fetch once per period. An edit invalidates
  *other* cells, so T4.2 must re-fetch. This is the underestimated half of the UI work.

**Constraints to honour rather than break:**

- **Density stays.** `docs/design.md`: *"Density over comfort. Lucy reads a whole
  trading period at once."* Cells are `px-2 py-2` (~32px rows), above the ~24px
  pointer-target floor for a laptop. Confirmed adequate by the owner. Do not enlarge
  cells, and do not introduce a separate editing mode to make room — there is no room
  problem to solve.
- **One accent per screen.** `docs/design.md`'s Colour section. If every editable cell
  carries an accent affordance the widest table in the app becomes noise and nothing
  reads as primary. **Editable cells get a neutral affordance** (dotted underline,
  muted); the accent belongs to Undo in the toast.
- **Laptop-first for editing.** `docs/design.md`: admin is *"laptop first, responsive
  down to a phone"*, and on phones tables scroll horizontally. Reconciling a month of
  figures is a sit-down task; inline-editing 16 columns under a thumb is how the wrong
  cell gets changed. **Phone = read-only, with a line saying so.** Match the tool to
  the task rather than treating it as a shortfall.

**Rough effort split, so this isn't mistaken for the hard part.** `EditableNum`
itself is ~20% of the UI work; refresh-after-save and the notification layer are the
other ~80%. And the UI overall is roughly a third of the project — T1–T3 (reversal
support, the trail, the three write functions, the 18-site audit, the property-based
reconciliation test) are the bulk and carry the real risk.

**Gap to close before T6/T7.** Only the Product tab has day expansion. The Store
ledger renders one row per ingredient for the whole period with no per-day breakdown
(`reporting/logic.ts`'s note: *"no day-expansion, unlike Product/Cash"*), and the
Cash ledger is day-shaped already. So T6 must either add day expansion to the Store
tab or restrict Store editing to period-level figures. **Decide in T6, not during it.**
