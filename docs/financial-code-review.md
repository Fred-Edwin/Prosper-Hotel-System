# Financial code review — Phase 2

**Scope:** the four surfaces named in `docs/handover-phase2-financial-review.md`
— the unit convention, `reporting/logic.ts`, `stock/logic.ts`, and
`cash/logic.ts` + `sales/logic.ts` — checked against `docs/proposal.md` §10.
Read-only; nothing in `src/` was changed.

---

## 1. Verdict

**Not ready to hand over as-is, but close.** The architecture is sound —
derived-not-stored figures, explicit `reversed`/`voided` flags instead of
deletes, and location scoping are all applied consistently, and most of
§10's rules are implemented exactly as specified. But there is one
confirmed, severe double-count (BUG-10, already logged) whose root cause
is exactly as suspected — a missing subtraction, not a display bug — and
it corrupts three downstream figures, not one. There is also a second,
previously-unlogged defect of the same "forgot to exclude a state" shape,
this time on credit balances rather than stock. Both are contained,
single-function fixes. Once BUG-10, BUG-11, and BUG-12 (below) are fixed
and the two lower-severity findings are at least acknowledged, I'd call
the financial logic sound enough for real money.

---

## 2. Findings, ranked by financial blast radius

### Finding 1 — `recordCountDerivedSales` never subtracts cash/M-Pesa sales (BUG-10, confirmed root cause)

**File:** `src/modules/stock/logic.ts:1189-1198`

```ts
const sold =
  previousCounted +
  received +
  sums.transferredIn -
  creditSold -              // only credit sales are subtracted
  sums.wasted -
  sums.consumed -
  sums.givenAway -
  sums.transferredOut -
  line.countedQuantity;
```

The formula's inputs (`sumMovementsByProductReasonAtLocationInPeriod` at
line 1128) never query the `"sold"` reason at all — only
`["received", "transferred", "wasted", "consumed", "given_away"]`. The
only sales term subtracted is `creditSold`, sourced from
`creditSaleQuantityByProductAtLocation` (correctly `voided: false`
filtered, `sales/queries.ts:154-184`). Every cash or M-Pesa sale recorded
through `recordCounterSale` at the canteen (`reason: "sold"`,
`sales/logic.ts:140-145`) is invisible to this formula.

**Failure scenario:** canteen has 100 biscuit packets at the last count.
Between then and the next count, the attendant sells 2 packets for cash
through the till (`"sold"`, qty −2) and no packets are sold on credit. At
the next count, 98 remain. `sold = 100 + 0 + 0 − 0 − 0 − 0 − 0 − 0 − 98 =
2` — correct, by luck, only because credit and cash sales happen to be
disjoint events with no other movements. But if instead the attendant
also received 100 more packets from a supplier mid-period and those 2
cash-sold packets are among the 198 now on hand, the discrepancy the
formula assigns to `sold_derived` includes the 2 already recorded as
`"sold"` — `foldReasonLines` (`reporting/logic.ts:945`) then sums `sold`
+ `sold_derived` into one bucket, so the product ledger shows both the
real 2 and an inferred quantity that already contains those same 2. This
is exactly BUG-10's repro (102 vs 2) reproduced from the formula, not
just observed empirically.

**Downstream contamination — this is wider than the product ledger.**
`recordCountDerivedSales` is the sole writer of `sold_derived` movements.
Its output also feeds:
- `getProductLedger` (`reporting/logic.ts:1055-1058`): `soldQty`,
  `salesValueMinor`, `costOfSalesMinor`, `profitMinor` are all inflated
  for any product with double-counted cash sales.
- `ownGoodsRateFromCount` (`reporting/logic.ts:315-352`), which computes
  §10.4's canteen own-goods cost rate from
  `derivedSales.lines[].quantity` and `.revenueMinor`. A double-counted
  `sold_derived` quantity inflates both the numerator (cost at count) and
  denominator (revenue) of the rate feeding **every day's** canteen COGS
  estimate until the next count — not a one-off ledger display error, but
  a corrupted rate baked into daily profit for the whole intercount
  period.
- `computeCountCorrection` (`reporting/logic.ts:424-426`), which uses the
  same `derivedSales.lines[].revenueMinor` for "measured at the count" —
  §10.4's correction figure is corrupted the same way.

**Secondary issue in the same function, same root cause class:** there is
no floor at zero. If a correction or count timing causes `line
.countedQuantity` to exceed what the formula predicts (e.g., stock was
corrected upward mid-period, or a transfer was double-recorded upstream),
`sold` goes negative and is still written (`if (sold === 0) continue` only
skips exactly zero, `stock/logic.ts:1200`), producing a negative
`sold_derived` movement — quantity manufactured out of nowhere in the
ledger, with a manufactured negative `sellingValueMinor`.

**§10 rule violated:** §10.4 ("the canteen's own goods... estimated
between counts") and §10.2's requirement that COGS reflect stock actually
used up — a double-counted `sold_derived` overstates units sold, which
overstates COGS (more units × cost) and understates closing stock value.

**Proposed fix:** subtract cash/M-Pesa `"sold"` movements in the same
window, the same way `creditSold` is already subtracted — i.e. query
`"sold"` alongside `"received"/"transferred"/"wasted"/"consumed"
/"given_away"` and add a `soldViaTill` term to the formula. This also
means the design assumption at `stock/logic.ts:1044-1047` ("individual
sales aren't recorded [at the canteen]") needs correcting in the comment,
since it's false and the wrong assumption is *why* the bug exists —
fixing only the formula without correcting the comment risks the same
mistake recurring. Contained to `recordCountDerivedSales`; no schema
change needed (the `"sold"` reason already exists and is already
location-scoped).

**Confidence:** confirmed by tracing the full call chain from the
formula's inputs through to `getProductLedger` and
`ownGoodsRateFromCount`. Not run against live data (no `pnpm test` write
permitted in this review, and reproducing needs mutating the DB), but the
formula's missing term is unambiguous from the code alone — this is not a
"looks right" read, it's confirmed by the absence of `"sold"` in the
`sumMovementsByProductReasonAtLocationInPeriod` reason list at
`stock/logic.ts:1128`.

---

### Finding 2 — Voided credit sales still count toward a customer's balance (new, not yet logged)

**Files:** `src/modules/sales/queries.ts:80-86` (`sumCreditForCustomer`),
`src/modules/sales/queries.ts:90-96` (`sumCreditAcrossAllCustomers`),
`src/modules/sales/queries.ts:11-21` (`markSaleVoided`).

```ts
export async function sumCreditForCustomer(db: PrismaClient, customerId: string): Promise<number> {
  const result = await db.paymentLine.aggregate({
    where: { customerId, method: "credit" },   // no voided exclusion
    _sum: { amountMinor: true },
  });
  return result._sum.amountMinor ?? 0;
}
```

`markSaleVoided` only updates the `Sale` row (`voided`, `voidedAt`,
`voidedBy`) — it never touches `PaymentLine`. `sumCreditForCustomer` and
`sumCreditAcrossAllCustomers` query `PaymentLine` directly with no join
back to `Sale.voided`, so a voided credit sale's payment line keeps
counting as debt forever. This is exactly the gap `docs/bugs.md`'s BUG-11
entry flagged as "may be worth its own bug entry" — I'm confirming it is
one, and it's the same *shape* of bug as BUG-10: a state (voided /
`sold_derived`) that should exclude an already-counted movement, doesn't.

Worth noting: the codebase clearly knows this exclusion is required
elsewhere — `sumCreditSaleQuantityByProductAtLocation`
(`sales/queries.ts:154-168`) and `sumSalesRevenueMinorAtLocationInPeriod`
(`sales/queries.ts:190-201`) both correctly filter `voided: false` by
querying `Sale` directly. The two credit-balance functions instead query
`PaymentLine`, which has no `voided` field of its own and no filter
through its `sale` relation — the comment at `sales/queries.ts:100-101`
even claims "symmetric to how credit sums exclude void sales," which is
false for the function it's describing.

**Failure scenario:** a customer buys KSh 2,000 of goods on credit. The
staff member realises it was entered against the wrong customer and voids
it the same day (a legitimate same-day void, per §8). The owner's People
→ Customers page still shows KSh 2,000 owed by that customer indefinitely
— there is no way to clear it short of recording a compensating
repayment, which would falsely show as debt paid off in the credit
history (`getCustomerCreditHistory`, `sales/logic.ts:317+`) rather than a
correction. The Dashboard's "Owed to you" figure
(`getTotalCustomerBalance`) is inflated by the same amount, business-wide.

**§10 rule violated:** §10.7 "Amounts owed. Credit extended less
repayments" — a voided sale was never really "credit extended," so it
should not appear in this figure. This isn't explicitly spelled out for
the void case in §10, but it follows directly from §8's "a staff member
may cancel an entry they made" combined with §10.7's definition — a
cancelled entry should count nowhere, matching the comment's own (wrong)
claim about symmetry.

**Proposed fix:** filter `sumCreditForCustomer` and
`sumCreditAcrossAllCustomers` through the `Sale` relation (`where: {
customerId, method: "credit", sale: { voided: false } }`), mirroring the
pattern already used two functions away in the same file. Contained,
no schema change — `PaymentLine` already has a `sale` relation to filter
through.

**Confidence:** confirmed by reading — the query has no `voided`
exclusion anywhere in its `where` clause, and `PaymentLine` has no
`voided` column of its own to have silently covered it. Logged as **new
bug BUG-12** in `docs/bugs.md`.

---

### Finding 3 — Missing canteen own-goods rate silently costs those goods at zero, not "unavailable"

**File:** `src/modules/reporting/logic.ts:264-286`

```ts
const rate = await ownGoodsRateFromCount(/* ... */);   // null if no rate available
// ...
const estimatedMinor = rate != null ? Math.round(takingsTotalMinor * rate) : 0;
```

When there's no previous count, or the previous count had no own-goods
lines, `ownGoodsRateFromCount` correctly returns `null` — matching the
comment at line 209 ("the estimate is unavailable rather than guessed").
But the caller then silently substitutes `0` for the estimate rather than
propagating unavailability. `estimatedMinor: 0` is indistinguishable from
"own goods genuinely cost nothing this period," which is never true.

The per-location `provisional` flag (`getDashboardProfit`,
`reporting/logic.ts:578`) does correctly flip to `true` when
`canteenCostRate == null`, so the *label* is honest. But the *number*
underneath the "provisional" badge isn't a provisional estimate — it's a
specific, wrong value (zero cost) masquerading as an estimate, and it
flows straight into `grossProfitMinor`/`netProfitMinor` at both the
canteen and business-total level.

**Failure scenario:** a brand-new canteen location (or one that just
reset its own-goods count history) takes KSh 4,000 in takings for own
goods on day one, before any count has ever been taken. `estimatedMinor =
0`, so canteen COGS for own goods is KSh 0 and canteen gross profit is
overstated by the entire KSh 4,000 × 72%-ish true cost rate — the badge
says "provisional" but the owner has no way to know the number is a
zero-cost placeholder rather than a real (if rough) estimate.

**§10 rule violated:** §10.4's own principle — "the estimate is
unavailable rather than guessed" is stated as the design intent in the
code's own comment, but the implementation guesses zero instead of
surfacing unavailability.

**Proposed fix:** thread a genuine `unavailable: true` state through
`CanteenCostOfGoodsResult` (already close — `canteenCostRate: null` is
there) so the UI can show "cost of own goods not yet available" instead
of a KSh 0 line, and so `grossProfitMinor` for the canteen is either
withheld or clearly marked non-computable rather than silently correct-
looking. This is a real product decision (what should the dashboard show
when a figure genuinely can't be computed yet?), not a one-line fix —
flagging as needing a small design call, likely during the BUG-10 fix
since both touch the same function.

**Confidence:** confirmed by reading — `rate != null ? ... : 0` is
unambiguous.

---

### Finding 4 — Product ledger's day-by-day breakdown silently drops stock corrections, and the drift compounds forward

**File:** `src/modules/reporting/logic.ts:935-951` (`foldReasonLines`),
`1061-1089` (`getProductLedger`'s day loop).

`foldReasonLines` only recognises `produced`, `received`, `transferred`,
`sold`/`sold_derived`, `wasted`/`consumed`/`given_away` — the `"corrected"`
reason (written by `correctStockCount`, `stock/logic.ts:1435-1448`, and by
`voidSale`'s stock reversal, `sales/logic.ts:430-435`) falls through with
no effect on any `ReasonSums` field. The **period-level** opening/closing
quantities shown per row are unaffected (they come from real as-of reads,
`stock/logic.ts` sum functions, which include every reason). But the
**per-day** breakdown (`productDays`) computes each day's closing as:

```ts
const dayClosing =
  runningOpening + daySums.produced + daySums.received + daySums.transferredIn
  - daySums.sold - daySums.transferredOut - daySums.nonSales;
// no correction term
productDays.push({ ...});
runningOpening = dayClosing;   // next day's "opening" is this computed value, not a fresh read
```

Because `runningOpening` for day *N+1* is day *N*'s **computed**
`dayClosing`, not a fresh as-of query, a correction on any day makes every
subsequent day's opening/closing in that expanded view wrong by the same
delta — the error doesn't stay local to the day it happened on.

**Failure scenario:** a product's real stock is 50. The owner corrects a
canteen count on day 3 of a 7-day ledger view, adding 10 units (a `+10`
`"corrected"` movement — e.g. stock was undercounted previously). Day 3's
computed closing omits the +10, so it under-reports that day's closing by
10, and every day from 4 to 7 shows an opening/closing 10 units short of
what the period-level row (and the real database) says. The row-level
totals at the top are still correct; only the expandable day-by-day
detail is wrong, which is likely to be read as *more* trustworthy (more
granular) than the summary, not less.

**§10 rule violated:** not a named §10 formula directly (corrections
aren't in the §10.1-10.6 worked examples), but violates the ledger's own
"reconcile by construction" design intent stated in the comment at
`reporting/logic.ts:956-958`, and indirectly §10.5/§8's requirement that
corrections be visible, not silently absorbed.

**Proposed fix:** either (a) add a `corrected` bucket to `ReasonSums` and
include it in both the row-level and day-level closing formulas, or (b)
re-anchor each day's opening from a fresh as-of read instead of chaining
off the previous day's computed value (more DB calls, but immune to any
future reason this loop doesn't yet know about). (a) is cheaper; (b) is
more robust against the same class of bug recurring for a reason added
later. Contained either way.

**Confidence:** confirmed by reading — `foldReasonLines`'s reason list is
exhaustive-looking but omits `"corrected"` with no default branch to catch
it, and the day-chaining pattern is unambiguous in the loop.

---

### Finding 5 — `computeTransferCost`'s cost-conservation invariant holds only because both call sites happen to pass identical date windows

**File:** `src/modules/reporting/logic.ts:77-127` (`computeTransferCost`),
called from `computeRestaurantCostOfGoods:160` and
`computeCanteenCostOfGoods:234-237`.

The handover specifically asked me to verify the invariant "cost out of
one location must exactly equal cost into the other." It does hold today
— but not because a transfer's cost is computed once and read twice.
`computeTransferCost` recomputes the rate and per-line cost **fresh on
every call**, from `getIngredientsIssuedMinor` and
`getSalesRevenueAtLocation` at the restaurant for the given window. The
restaurant-side and canteen-side COGS functions each call it
independently. The invariant holds today only because both call sites
(`getDashboardProfit:515-516` and one other, at `reporting/logic.ts:814-
815`) pass the exact same `{ dayStart, dayEnd }` object to both — a
convention, not a structural guarantee. Nothing stops a future caller
(e.g. a ledger view computing restaurant COGS for one window and canteen
COGS for a different one) from silently breaking the "same figure
subtracted from one side, added to the other" property §10.2 states as a
business invariant.

**Confidence:** confirmed by reading; not an active bug (no call site
today violates it), but exactly the kind of invariant the handover
flagged as worth asserting explicitly. Recommending a runtime assertion,
not a fix — see Recommendations.

---

## 3. What I checked and found correct

- **Unit convention (§10, all currency figures).** Grepped every `* 100`
  / `/ 100` site in `src/` (23 matches). Every currency-scaling one is
  `customer-detail.tsx:57` (BUG-11) — confirmed the *only* site anywhere
  in the codebase that multiplies a raw input by 100. Checked every other
  UI input that produces a `Minor` field
  (`ingredient-form.tsx`, `product-form.tsx`, `staff-form.tsx`,
  `receive-delivery.tsx`, `record-expense-sheet.tsx`, `new-sale.tsx`) —
  none scale. Also grepped for any arithmetic scaling *on* a `Minor`
  field anywhere in `src/` (`Minor\s*[*/]` and the reverse) — zero
  matches outside the known bug. The remaining `* 100` sites are margin
  percentages (`recipes-tab.tsx:62`, `recipe-list.tsx:77`,
  `dashboard-profit.tsx:338,367`) or chart-geometry percentages
  (`ledger-shell.tsx:496`, `dashboard-revenue-profit-chart.tsx:234`) —
  correctly percentages of already-unscaled shilling values, not currency
  conversions.
- **Restaurant COGS (§10.2).** `computeRestaurantCostOfGoods`
  (`reporting/logic.ts:146-178`) implements opening + bought − closing −
  transfer exactly as specified, with transfer cost correctly reusing
  `computeTransferCost`'s own per-line figure rather than re-deriving one
  from selling price.
- **Profit's three exclusions (§10.3).** Confirmed equipment/assets are
  excluded from profit — `getRunningCosts`/`sumRunningCostsMinorInPeriod`
  filters `category: "running"` only (`cash/queries.ts:181-197`), so
  `category: "asset"` and `category: "drawing"` expenses never enter
  `runningCostsMinor`. Confirmed owner's drawings are excluded the same
  way. Confirmed unsold stock isn't deducted from profit a second time —
  `getNonSalesConsumptionValue`/`getNonSalesLedger` (`stock/logic.ts`)
  are read-only reporting views over movements already counted in COGS
  via the opening/closing stock-value calculation; nothing in either
  function writes to or adjusts a profit figure.
- **Expected cash (§10.6).** `getRunningCashBalance`
  (`cash/logic.ts:591-610`) = handovers + repayments − **all**
  expenses, unfiltered by category — confirmed via
  `sumExpensesMinorByMethod` (`cash/queries.ts:324-341`), which has no
  `category` filter at all, so stock, running, asset, and drawing
  expenses all reduce cash exactly as §10.6 requires ("everything paid
  out reduces this figure"), while `sumRunningCostsMinorInPeriod` (used
  in profit) filters to `running` only. This is the "right way round"
  the handover called out as the whole point of §10 — confirmed correct
  in both directions. Cash and M-Pesa are tracked as separate fields
  throughout (`cashMinor`/`mpesaMinor`) with no point where they're
  summed together before storage.
- **Handover expected amount (§10.7 / §5).** Restaurant:
  `computeExpected` (`cash/logic.ts:84-101`) sums that day's non-void
  sales for `requester` only (verified `listTodaysSalesForStaff`,
  `sales/logic.ts:368-384`, scopes by `requester.staff.id`, not by role
  or location alone) — genuinely per-person. Canteen:
  `computeExpectedFromTakings` correctly uses declared takings, not
  summed sales. Credit lines are excluded from both (only `cash`/`mpesa`
  payment methods are summed). Cash and M-Pesa checked as separate
  fields throughout.
- **Payment splitting (§10, sale payment lines).**
  `priceAndCreateSale` (`sales/logic.ts:116-121`) rejects any sale where
  `paidMinor !== totalMinor` — payment lines are structurally forced to
  sum to the sale total before the sale is even created.
- **Void reversal — stock side.** `voidSale`
  (`sales/logic.ts:396-440`) writes a `"corrected"` movement with the
  original sale's quantity restored, and the original `Sale`/lines are
  never deleted, only flagged (`voided`, `voidedAt`, `voidedBy`) —
  satisfies §8's "never delete" for stock-affecting entries.
- **Void reversal — revenue side.** Confirmed `voided: false` is applied
  correctly in the functions that need it: `sumSalesRevenueMinorAtLocationInPeriod`
  (`sales/queries.ts:190-201`, feeds §10.1 restaurant revenue),
  `sumCreditSaleQuantityByProductAtLocation` (feeds BUG-10's credit-sold
  term), and `computeExpected`'s explicit `if (sale.voided) continue`.
  Only the credit-*balance* queries (Finding 2) miss this.
- **Weighted-average cost on delivery (§10, formulas.md §3).**
  `runningAverageMinor` (`catalogue/logic.ts:282-293`) correctly resets
  to the new unit price when `quantityOnHand <= 0` rather than dividing
  through a non-positive on-hand figure, matching the spec's "where
  nothing is on hand yet... simply the price paid." Same function serves
  both ingredients and products; confirmed both call sites
  (`recordIngredientReceipt`, `stock/logic.ts:653-750`) pass the
  pre-delivery on-hand quantity, and correctly chain same-call multi-line
  deliveries for the same item (`stock/logic.ts:725,746`) so a second
  line for the same product in one call sees the first line's delivery
  as already on hand.
- **Transfers — quantity conservation (§10.2).** `recordTransfers`
  (`stock/logic.ts:391-503`) writes the outgoing (`-quantity`) and
  incoming (`+quantity`) movements atomically inside one
  `db.$transaction`, tagged with a shared `transferId` — exact quantity
  symmetry is structural, not just conventional. `reverseTransfer`
  (`stock/logic.ts:505-538`) correctly negates the original lines and
  tags `reversedTransferId`, with a guard against double-reversal
  (`existingReversal` check).
- **Transfers — cost conservation.** See Finding 5 — holds today, flagged
  as fragile rather than broken.
- **Stock corrections (§8, §10.5).** `correctStockCount`
  (`stock/logic.ts:1404-1469`) is owner-gated, writes a forward-dated
  `"corrected"` movement rather than editing any prior record, and
  correctly distinguishes shortfall (valued at cost, like wastage) from
  surplus (no selling value recognised until actually sold) — matches
  the comment's own stated reasoning and §10.5's "not deducted from
  profit a second time" principle, since a correction is a new event, not
  a retroactive edit.
- **`getActivity` — correction vs. consumption (CONTEXT.md's flagged
  trap).** Confirmed `kind: "correction"` (sale corrections,
  `reporting/logic.ts:1725-1738`) and `kind: "movement"` (non-sales
  consumption, filtered to `wasted`/`consumed`/`given_away` at
  `reporting/logic.ts:1775`) are structurally distinct branches reading
  from different sources (`Sale.isCorrection` vs. movement `reason`) —
  no path conflates them.
- **Drawings' three behaviours (§10.3, §10.6, CONTEXT.md).** Confirmed
  all three: `recordExpense` with `category: "drawing"` both creates the
  cash-reducing `Expense` and a parallel `DrawingDebt`
  (`cash/logic.ts:307-321`); the debt is excluded from
  `sumRunningCostsMinorInPeriod`'s `category: "running"` filter (doesn't
  reduce profit); `drawingDebtOwed` nets debt against
  `sumUnreversedDrawingRepayment` (recorded as owed back).
- **Reversal flags generally.** Every reversible cash entity
  (`Expense.reversed`, `DrawingRepayment.reversed`) is filtered
  consistently at every read site I checked — no entry point sums an
  unreversed and a reversed record together.
- **Repayment backend logic (BUG-11's non-UI half).**
  `recordRepayment` (`sales/logic.ts:274-304`) compares `amountMinor`
  against `getCustomerBalance`'s correctly-unscaled result — confirms the
  entire defect is the UI's stray `* 100`, nothing wrong on the backend
  in isolation (Finding 2 aside).

---

## 4. What I could not verify

- **Live arithmetic against §10's worked numbers.** I did not run
  `pnpm seed` + a scripted formula check against the literal 9,600 /
  6,820 / 23,200 figures §10 walks through, since tracing the code
  directly answered every question with higher confidence than
  re-deriving the same formulas in a throwaway script would have added.
  If you want the extra confidence, a script seeding exactly §10.2's
  worked numbers and asserting `computeRestaurantCostOfGoods` returns
  9,600 would be cheap and is a good regression-test candidate (see
  Recommendations) — I did not write it per the handover's "where a test
  would settle it, say so rather than writing it."
- **Recipe-based yield variance reporting (§10.7's "actual output differs
  from expected yield").** Out of the four named surfaces; not reviewed.
- **Pay calculation (§10.7 "days worked × daily rate", `people` module).**
  Outside the four named surfaces and outside `people/logic.ts`'s stated
  scope for this review; `payWages` (`cash/logic.ts:338-363`) reads
  `getPayForStaff` from `people` and pays it as a running-cost expense,
  which is structurally correct, but I did not verify
  `getPayForStaff`'s own days-worked × rate arithmetic.
- **Per-item margin for cooked food with a recipe (§10.7).**
  `resolveProductCostBasis` and `getCurrentRecipe` are used consistently
  wherever I encountered them, but I did not trace recipe cost
  calculation (`recipe-builder.tsx`, `createRecipe`) end-to-end — it's in
  `catalogue`, one module over from the four named surfaces, and only
  touched here incidentally via the weighted-average cost check.
- **Concurrent-write races.** All four modules read a quantity/balance
  then write based on it, without row locking beyond what a single
  `$transaction` provides (transfers only). Two simultaneous count
  corrections, or a repayment racing a new credit sale, could in theory
  read stale balances — not evaluated, since the handover scoped this to
  arithmetic correctness rather than concurrency, and Prosper Hotel's
  actual usage pattern (one staff member per device, sequential entry)
  makes this a low-probability path. Flagging so it's a documented gap,
  not a silent one.

---

## 5. Recommendations

1. **Rename `*Minor` before handover, or drop the suffix.** It is
   actively misleading — every currency field in this codebase is plain
   whole shillings, and the suffix's own naming convention (borrowed from
   a cents-based convention this codebase doesn't use) is *why* BUG-11
   happened. The grep in Finding-adjacent checking above confirms no
   other site currently misreads it, but that's luck holding today, not
   a structural guard — the next person to touch a money field, or the
   next agent working from training data that assumes `Minor` = cents,
   has the exact same trap in front of them. I'd suggest a mechanical
   rename (`priceMinor` → `priceShillings` or just `price`) as a
   dedicated ticket, not bundled into the BUG-10/11/12 fixes — it touches
   the schema and every module, so it deserves its own review pass and a
   migration, not to ride along with a bugfix diff. **Recommend doing
   this before handover**, not after — a maintainability fix is far
   cheaper before the client's own data is in the system.
2. **Regression tests worth adding**, once BUG-10/11/12 land, so they
   can't silently regress:
   - A canteen count scenario with cash sales *and* a count in between,
     asserting `sold_derived` quantity/value excludes what `"sold"`
     already recorded (BUG-10's exact repro).
   - A voided credit sale asserting `getCustomerBalance` drops to zero
     (BUG-12).
   - `computeRestaurantCostOfGoods` against §10.2's literal 9,600, and
     `getDashboardProfit`'s net profit against §10.3's literal 6,820 —
     cheap to write once seed data matches the worked example, and would
     have caught both BUG-10 and BUG-11's category of defect structurally
     rather than by manual QA luck, which is the whole reason this review
     exists.
   - A transfer + reversal round-trip asserting the restaurant's
     COGS-reduction exactly equals the canteen's COGS-addition for the
     same window (Finding 5) — cheap to assert now, before any future
     caller has a chance to violate it.
3. **Assert the transfer cost-conservation invariant in code**, not just
   in tests — e.g. have `computeCanteenCostOfGoods` accept the already-
   computed `TransferCostResult` from its caller instead of calling
   `computeTransferCost` a second time with a separately-passed date
   range. This would make Finding 5 structurally impossible rather than
   conventionally true, at the cost of a small signature change to
   `getDashboardProfit`'s two COGS calls.
4. **Surface "unavailable" distinctly from "zero" for the canteen
   own-goods estimate** (Finding 3) — worth resolving as part of the
   BUG-10 fix, since both live in the same function family and a client
   handover is a natural point to also close this gap rather than leave
   a second known-wrong-when-empty state in the same code path.

---

## 6. Resolution — BUG-11, BUG-12, Finding 3, Finding 5 (2026-08-13)

Fixed directly (Edwinfred chose direct fixes over the ticket pipeline
for this pass, with regression tests required and no independent
`/review`), on branch `fix/phase3a-financial-fixes`. Finding 1/BUG-10
and Finding 4 are out of scope here — separate agent.

**BUG-11.** Removed `customer-detail.tsx:57`'s `* 100`. Added a
convention comment to `src/shared/money.ts` (every `*Minor` field is
whole shillings; nothing should scale by 100). Regression test added
for "repayment of exactly the balance succeeds and zeroes it," alongside
the existing "balance + 1 is rejected" test. Verified live.

**BUG-12.** Both `sumCreditForCustomer` and `sumCreditAcrossAllCustomers`
now filter `sale: { voided: false }`, matching
`sumCreditSaleQuantityByProductAtLocation`'s existing pattern in the same
file. Regression test: credit sale raises the balance, void returns it
(and the business-wide total) to zero.

**Finding 3.** Threaded `null` (not `0`) through
`computeCanteenCostOfGoods`'s `estimatedMinor`/`totalMinor` whenever
`canteenCostRate` is `null`, and propagated that nullability through
`getDashboardProfit` and `getLedgerSummary` — cost of goods, gross
profit, and net profit are all `null` at any level (canteen, business
total) that depends on the unavailable rate. **Business-wide total
decision:** show the restaurant's exact figures under "By location"
labelled non-provisional, and let the business-wide total itself go
unavailable (`null`) rather than silently showing a restaurant-only
number as if it were the whole business — a partial sum risked being
misread as the real total, so it renders as "—" with a note pointing to
the restaurant's real figures instead. UI: no existing pattern rendered
an unavailable money figure, so this was flagged to Edwinfred rather
than invented — decided on an inline em-dash in place of the `KSh`
figure (`Term`/`LocationCell`/waterfall tiles in `dashboard-profit.tsx`
and `ledger-shell.tsx`), no new badge. While fixing this, found a live
crash in `dashboard-revenue-profit-chart.tsx` (`money(p.netProfit!)`) —
a non-null assertion that was only ever safe because `netProfitMinor`
used to be zero-substituted; now genuinely nullable, it crashed the
chart on any traded day without a canteen rate. Fixed alongside.
Regression test: a canteen with takings but no prior count returns
unavailable (not zero) for cost of goods and profit at every level; a
count then lands and the same figures become real numbers.

**Finding 5.** Regression test added (transfer + reversal round-trip:
business total unchanged, restaurant COGS-reduction exactly equals
canteen COGS-addition). The structural fix was also attempted and
landed, since it stayed contained: `computeRestaurantCostOfGoods` and
`computeCanteenCostOfGoods` now accept an optional `precomputedTransfer`
parameter (falling back to computing it themselves, so both stay
independently callable/testable); `getDashboardProfit` and
`getLedgerSummary` — the only two real callers — compute
`computeTransferCost` once and pass the same result to both COGS calls.
The invariant is now structural, not conventional.

**A fourth instance of the same bug shapes?** No new "zero as a
guessed default" site found beyond the four sites the review already
named (BUG-11, Finding 3, and the two false starts already excluded).
No new "forgot to exclude voided/reversed" site found beyond BUG-12 —
every other query the review checked (§3's list) still holds. Worth
noting for whoever picks up the `*Minor` rename: fixing BUG-11 and
Finding 3 required threading `number | null` through several result
types that were previously plain `number` — a future rename pass should
double check it doesn't silently reintroduce a zero-default while
touching those same call sites.

`pnpm test` (402/402), `pnpm lint` (clean, pre-existing warnings only),
`pnpm exec tsc --noEmit` (clean), and `pnpm build` all green. Verified
live in a browser as owner: repayment fix on the People → Customers
page, and the unavailable-figure treatment on both the Dashboard's
Profit panel and the Ledger's waterfall.
