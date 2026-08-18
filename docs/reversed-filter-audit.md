# The `reversed: false` audit

**Created:** 2026-08-17 by ticket T1 of `docs/plan-editable-ledger.md` (control C4).

Adding `reversed` to `stock_movements` and `ingredient_movements` makes every
pre-existing read over those tables wrong by omission until it is updated. This
file is the enumeration, committed so the next person can check it rather than
re-derive it.

**The plan's §C4 said "18 call sites — 16 in `stock/queries.ts`, 2 in
`stock/logic.ts` (both `reversedTransferId` lookups, which need no filter)."
That count was wrong.** The real surface is **21 read sites needing a filter**,
and the three the plan missed are the most dangerous ones in the list — the
availability checks that decide whether a sale or transfer is allowed to
proceed. They are marked ⚠ below.

`create` calls are excluded throughout: writing a row is not reading one.

## `stock/queries.ts` — 18 read sites

| Line | Function | Filter | Note |
|---|---|---|---|
| 116 | `sumMovementsByProductAtLocation` | ✅ yes | running stock total |
| 136 | `sumMovementsByProductAtLocationAsOf` | ✅ yes | ledger opening/closing |
| 218 | `findReceiptsAtLocation` (ingredient) | ✅ yes | a reversed delivery is not a delivery |
| 222 | `findReceiptsAtLocation` (product) | ✅ yes | as above |
| 267 | `findReceiptById` (ingredient) | ✅ yes | as above |
| 271 | `findReceiptById` (product) | ✅ yes | as above |
| 280 | `sumMovementsByIngredientAtLocation` | ✅ yes | running ingredient total |
| 303 | `sumMovementsByProductReasonAtLocationInPeriod` | ✅ yes | ledger in/out columns |
| 328 | `sumIngredientMovementsAtLocationAsOf` | ✅ yes | store ledger opening/closing |
| 349 | `sumIngredientsBoughtMinorAtLocationInPeriod` | ✅ yes | cost of goods sold input |
| 370 | `sumIngredientsIssuedByIngredientAtLocationInPeriod` | ✅ yes | store ledger issued |
| 394 | `sumIngredientsPurchasedByIngredientAtLocationInPeriod` | ✅ yes | store ledger purchased |
| 425 | `sumIngredientMovementsByReasonAtLocationInPeriod` | ✅ yes | store ledger by reason |
| 449 | `sumProductMovementsByReasonAtLocationInPeriod` | ✅ yes | product ledger by reason |
| 506 | `findNonSalesMovementsAtLocationInPeriod` (product) | ✅ yes | non-sales ledger |
| 523 | `findNonSalesMovementsAtLocationInPeriod` (ingredient) | ✅ yes | non-sales ledger |
| 586 | `findAllNonSalesMovementsInPeriod` (product) | ✅ yes | dashboard non-sales |
| 600 | `findAllNonSalesMovementsInPeriod` (ingredient) | ✅ yes | dashboard non-sales |

## Availability checks — the three the plan missed ⚠

These decide whether a sale or a transfer may proceed. Without the filter a
reversed movement still counts as stock on hand, so the app would authorise
selling or transferring stock that the reversal says is not there. This is the
only place in the audit where a missed filter causes a *write* to be wrong
rather than a report.

| Line | Function | Filter | Note |
|---|---|---|---|
| `sales/logic.ts:153` | `recordSale` availability check | ✅ yes ⚠ | gates `insufficient_stock` |
| `stock/logic.ts:580` | `recordTransfers` product availability | ✅ yes ⚠ | gates `insufficient_stock` |
| `stock/logic.ts:616` | `recordTransfers` ingredient availability | ✅ yes ⚠ | gates `insufficient_stock` |

## Deliberately unfiltered — 4 sites

| Line | Function | Why no filter |
|---|---|---|
| `stock/logic.ts:882` | `reverseTransfer` existing-reversal lookup | asks "does a reversal row exist", by `reversedTransferId`. Filtering would let a transfer be reversed twice. |
| `stock/logic.ts:883` | as above (ingredient) | as above |
| `stock/logic.ts:999` | `listTransfersAtLocation` reversal lookup | marks the original as reversed in the history view; must see reversal rows |
| `stock/logic.ts:1002` | as above (ingredient) | as above |

## The rule for anything added later

> Any read that answers **"how much is there"** or **"what happened"** filters
> `reversed: false`. Any read that answers **"was this already reversed"** must
> not.

## Both rows of a reversal are marked, not just the original

`reverseMovement` sets `reversed: true` on **the original and its offsetting
`corrected` row**. This is easy to get wrong in the obvious direction, and the
obvious direction is a bug:

- Mark only the original → the offsetting −10 stays visible to every sum while
  the +10 it cancels is filtered out. The reversal is subtracted a second time
  and stock goes negative.
- Mark both → the pair is excluded together and nets to nothing by **absence**.

So a reversed delivery of 10 leaves stock at 0 because neither row counts, not
because they cancel. The audit tests assert exactly that, deliberately, rather
than asserting a net of zero that both designs would satisfy.

`isAmendment` is orthogonal and does **not** exclude a row from anything. An
amendment row created by the owner's in-place editing is real stock movement
and is counted in every sum (plan §4); it is flagged only so the UI labels it a
correction rather than dressing it as a delivery.

---

## Re-checked 2026-08-18 (editable-ledger T10)

**No change. The enumeration above is still complete.**

T6 (Store ledger) and T7 (Cash and non-sales ledgers) made three more tabs editable
without adding a single new "how much is there" read. Verified by diffing
`stock/queries.ts`, `cash/queries.ts` and `people/queries.ts` across the T6/T7/T9/T12
commits: no new exported query functions appear, only signature widenings from
`PrismaClient` to `Db` so the ledger reads can run inside T12's rolled-back preview
transaction. A parameter type change cannot affect which rows a `where` clause
matches.

T12's cascade preview reads through the *same* four `get*Ledger` functions the
committing path uses, so it inherits their filters rather than introducing a parallel
set of reads. That was a design goal in its own right and it pays off here: a second
read path would have been a second enumeration to keep current.

Two write-side facts worth recording alongside the read audit:

- **`amendScalar` refuses a reversed record as `not_found`** (T7). No ledger cell
  offers the edit, since a reversed row appears in no total — but the route takes a
  record id, so it was reachable, and it would have written a trail entry describing a
  change to a figure nobody can see.
- **`amendDayTotal` and `amendDerivedPosition` filter `reversed: false`** when reading
  the movements they amend. An amendment computed against rows that count nowhere would
  set the day's total to a figure the ledger never shows.
