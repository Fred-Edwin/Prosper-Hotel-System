# Plan — editable ledger, remaining tickets (T6, T7, T9, T10, T11)

**Status:** drafted 2026-08-17, T1–T5 and T8 already shipped on
`feat/editable-ledger`
**Companion to:** `docs/plan-editable-ledger.md` — that document holds the
decisions (D1–D6) and the three-kinds model (§3). This one holds what is
actually left to build, scoped against the code as it now stands rather than
as the original plan assumed it.

---

## 0. What reading the code changed about the estimates

Four findings that move scope, all verified against the working tree.

**F1 — The write layer is already ingredient-aware. T6 writes no new write
logic.** `amendDayTotal` (`stock/logic.ts:2614`) and `amendDerivedPosition`
(`:2812`) both take `itemType: "product" | "ingredient"` and branch to
`ingredientMovement` at every write site. `amendScalar`'s allow-list already
carries `Ingredient: ["lastKnownCostMinor", "lowStockLevel"]`. T3 built the
ingredient half ahead of T6. **T6 is therefore a read-layer and UI ticket.**
The plan's "T6 roughly doubles if day expansion is wanted" was estimated
before this was known; the doubling applies to the read/UI half only.

**F2 — `amendLedgerRoute` refreshes the wrong table for ingredient edits.**
The route (`reporting/routes.ts:407`) dispatches `itemType` correctly to the
write functions, but its before/after reads are hardcoded to
`getProductLedger` (lines 448, 501). An ingredient edit writes correctly and
then returns *product* rows, so the Store table would refresh itself with
another table's data. Pre-existing since T4; unreachable until T6 makes the
Store tab editable. **Fixed in T6.3.**

**F3 — The Store ledger has no `corrected` column, and T3 proved that
breaks reconciliation.** `STORE_OUT_REASONS` is `["issued", "transferred",
"wasted"]` (`reporting/logic.ts:1104`) — no `corrected`. But opening/closing
come from `getIngredientQuantityAtLocationAsOf`, which sums *every*
movement regardless of reason. This is character-for-character the gap T3
found on the Product side: a `corrected` row moves closing without appearing
in any column that explains why, silently breaking
`closing == opening + in − out`. On the Product tab that was pre-existing
(ticket 21's `reverseTransfer`/`correctStockCount` wrote such rows); on the
Store tab it becomes reachable the moment `amendDerivedPosition` can be
called with `itemType: "ingredient"` — i.e. the moment T6 ships. **In scope
for T6, not a follow-up.**

**F4 — §3.2's stated reason for `previousUnitCostMinor` being read-only is
now false.** The table says it is "reconstructed algebraically
(`reporting/logic.ts:1013`)" from a running average. The costing change
replaced that: it is now read straight off the last delivery before the
period via `getPreviousDeliveryCostAtLocation`, and the comment at
`reporting/logic.ts:1129-1134` says so explicitly. The cell stays read-only;
the *reason* changes. **T10 corrects the table.**

---

## T6 — Store ledger editable, with day expansion

**Decision taken 2026-08-17 (owner):** add day expansion to the Store tab
and make it fully editable, rather than restricting Store editing to
period-level figures. This closes open question 2 in the companion plan.

The Store ledger is entirely ingredient valuation, so it sits directly on
the FIFO/latest-price costing change. Every value column below reads through
the post-change path; none of this ticket re-derives cost.

### T6.1 — Day expansion in `getStoreLedger` (test-first)

Add `days: StoreLedgerDay[]` to `StoreLedgerRow`, mirroring
`buildProductLedgerRow` (`reporting/logic.ts:866`) rather than inventing a
second chaining idiom:

```ts
export type StoreLedgerDay = {
  date: string;          // isoDate, same as ProductLedgerDay
  openingQty: number;
  purchasedQty: number;
  purchasedValueMinor: number;
  issuedToKitchen: number;
  transferredIn: number;
  transferredOut: number;
  spoilage: number;
  corrected: number;     // signed — see F3
  closingQty: number;
};
```

Reuse the existing `daysInPeriod` helper unchanged — the day windows must be
the same `(D 00:00, D+1 00:00]` intervals the Product ledger and the amend
functions already agree on. Do not write a second one.

Needs a `foldIngredientReasonLines` alongside `foldReasonLines`: the Store
columns are a different set, and `purchased` arrives from a different query
(`getIngredientsPurchasedByIngredient`) than the out-reasons.

**The `corrected` column (F3).** Add `"corrected"` to the reasons the Store
ledger fetches, as its own signed column, rendered `+4` rather than `4`
exactly as the Product tab does. It is neither an in nor an out reason — an
opening edit may raise or lower the position.

**Test-first, and this is the test that matters:** the reconciliation
property `closing == opening + purchased + transferredIn + corrected −
issued − transferredOut − spoilage`, per day and across the period, holding
after an arbitrary sequence of Kind A and Kind B ingredient amendments. This
is the Store-side analogue of T3's property-based test; model it on that
one. Include the day-boundary cases from
`stock/tests/amend-ledger.integration.test.ts`'s header comment: an opening
edit at D lands at `D 00:00:00.000` and must move D−1's closing with it.

### T6.2 — Per-day ingredient fetching

`getStoreLedger` currently fetches once per period. It needs the per-day
loop, with movements pre-fetched **once per day per location** and filtered
per ingredient in the fold — not fetched per ingredient. The Product side's
`dayMovements` parameter is the shape to copy; the comment at
`buildProductLedgerRow` states the batching rule explicitly.

Per-day purchased qty/value is needed too, since `purchasedValueMinor` is a
day-level editable cell.

Watch the query count: days × locations, not days × locations × ingredients.
A 31-day period across two locations is 62 movement reads and 62 purchase
reads, matching what the Product tab already does.

### T6.3 — Fix the route's refresh read (F2)

Branch `amendLedgerRoute`'s before/after reads on `itemType`: ingredient
edits read `getStoreLedger`, product edits `getProductLedger`. The response
shape stays `{ rows, previousRows }` so T4's client layer needs no change.

Guard against the periodStart/periodEnd mismatch: the Store ledger takes the
same period inputs, so this is a substitution, not a new contract.

### T6.4 — UI: chevron and editable cells

**Requires sign-off before building, per CLAUDE.md's UI rules.** Two things
depart from precedent:

- **The chevron is new to this tab, and the design reference deliberately
  has none** (`store-ledger.tsx`'s header comment says so, and so does
  `reporting/logic.ts:1097-1100`). The owner's decision overrides the
  reference here. Mirror the Product tab's chevron exactly — same markup,
  same interaction — rather than introducing a second expansion idiom.
- **`purchasedQty` and `purchasedValueMinor` are two cells over one fact.**
  Editing quantity without value leaves an implied unit cost nobody typed.
  **Rule: editing quantity holds unit cost constant, so value moves with
  it.** She is correcting "we got 12kg, not 10kg"; the price per kg did not
  change. Editing value directly is Kind C on the receipt rows and moves
  unit cost, which is the other thing she might mean, and she has a separate
  cell for it. Record this in T10 — it is not in the companion plan.

Editability per §3.2, at day level:

| Cell | Kind | Writes |
|---|---|---|
| opening / closing | B | `corrected` ingredient movement via `amendDerivedPosition` |
| purchased qty | A | day total, unit cost held constant |
| purchased value | C | `unitCostMinor` on that day's receipt rows |
| issued / transferred in / out / spoilage | A | `amendDayTotal` |
| corrected | **no** | it *is* the correction column; edit opening/closing instead |
| unit cost / previous unit cost | **no** | F4 — edit a delivery's cost |
| closing value | **no** | arithmetic of editable inputs |

Period-total quantity cells stay **read-only**, per the settled rule that a
figure spanning many days has no honest date to stamp an amendment against.
The tooltip says which: "Edit a day's figure — expand the row."

Phone stays read-only, per T4's `readOnly` prop.

Build as a Storybook story on port 6320 with real seed data, hand over the
live URL, then wire it live. One composition, not variants — this mirrors an
existing table rather than exploring a new shape.

### T6.5 — Stories and verification

Stories covering the new day-expanded states (collapsed, expanded, saving,
per-cell error, read-only phone, empty-filtered). `pnpm test`,
`pnpm exec tsc --noEmit`, `pnpm lint`.

---

## T7 — Cash ledger + non-sales ledger editable

Two tables, one ticket, because both are almost entirely Kind C — scalars on
single records, edited in place inside a transaction that writes the
amendment. No new write function is needed: `amendScalar` covers it once its
allow-list grows.

### T7.1 — Extend `amendScalar`'s allow-list (test-first)

`EDITABLE_SCALARS` currently holds only `Product` and `Ingredient`, and the
function's body branches on those two literally
(`stock/logic.ts:2901` onward). T7 adds:

```
Expense:           ["amountMinor", "paymentMethod"]
Repayment:         ["amountMinor", "paymentMethod"]
DrawingRepayment:  ["amountMinor", "paymentMethod"]
Handover:          ["actualCashMinor", "actualMpesaMinor"]
```

Two structural changes fall out of this:

- **The record dispatch must stop being an if/else over two models.** Replace
  the hardcoded `Product`/`Ingredient` branch with a lookup from record type
  to Prisma delegate, so adding a model is an allow-list entry rather than
  another branch. The allow-list stays the security boundary — that comment
  in the source is correct and must survive the refactor.
- **`paymentMethod` is not a number.** `amendScalar` currently validates
  `Number.isFinite(newValue)` and types `newValue: number`. Method is an
  enum. Either widen the signature to `number | string` with per-field type
  validation driven off the allow-list, or add a sibling `amendEnum`.
  **Recommend widening**, with the allow-list carrying the expected type per
  field — one function, one security boundary, and the trail already stores
  `previousValue`/`newValue` as strings.

**Never editable, and the code must refuse it:** `Handover.expectedCashMinor`
and `expectedMpesaMinor`. Per **D2** these are frozen permanently. Leaving
them out of the allow-list is sufficient mechanically, but add an explicit
test asserting `field_not_editable` for them — this is a decision, not an
omission, and a future allow-list edit should have to delete a failing test
to break it.

### T7.2 — Cash ledger day-level wiring

`getCashLedger` is already day-shaped (`reporting/logic.ts:1397`), so there
is no expansion gap here. The transactions array per day is what becomes
editable.

Two things to handle carefully:

- **Handover transaction ids are synthetic.** `getCashLedger` emits
  `${h.id}:cash` and `${h.id}:mpesa` as separate rows from one `Handover`
  (lines ~1455-1478). The edit path must map those back to the real record
  and the right column, not pass the composite id to `amendScalar`. Carry
  `recordType`/`recordId`/`field` on the transaction rather than parsing the
  id string at the client.
- **Opening/closing cash and M-Pesa stay read-only** per §3.2 — derived from
  the transactions. Tooltip: "Edit a transaction."

Column totals (`handoversMinor`, `stockMinor`, …) are per-day sums of the
filtered transactions and are **read-only**: same reasoning as period totals,
plus they are already the sum of individually editable rows.

### T7.3 — C6, the "sales edited since" marker

Per **D2**, where a later edit has moved a day's sales, the handover row says
so in words, showing both figures. The expected side never recomputes.

Detect by querying `listAmendmentsInPeriod` (already exported from
`people/index.ts`) for amendments whose `effectiveDate` falls on the
handover's day and whose `recordType` is `StockMovement` with
`field === "sold"`, or a sales-side scalar. Render as text beside the
handover, not as a recomputed number.

### T7.4 — Non-sales ledger

`getNonSalesLedgerReport` (`reporting/logic.ts:1295`) returns one row per
movement — already the finest grain, no expansion needed. Per §3.2 quantity,
cost basis and selling value are all editable.

**Settled in conversation, not yet in the companion plan:** a non-sales edit
happens in place when exactly one of wasted/consumed/given-away is non-zero,
and defers to the expanded breakdown when they mix. T4 already carries the
three reasons separately on `ProductLedgerDay` for exactly this
(`wasted`/`consumed`/`givenAway`, with a comment citing §3.1's "ambiguous
which thing she meant"). Reuse that; do not re-derive the rule. Fold into
T10.

Quantity is Kind A via `amendDayTotal`. `costBasisMinor` and
`sellingValueMinor` are Kind C on the movement — which means
`EDITABLE_SCALARS` also needs `StockMovement` and `IngredientMovement`
entries for those two fields. Note this is the one place a *movement* takes a
scalar edit rather than a day-total edit, because these are snapshotted money
figures, not quantities.

### T7.5 — Stories and verification

Per-table stories for the new editable states. Full verification sweep.

---

## T9 — Amendment history UI

The read layer exists: `listAmendmentsForRecord` and `listAmendmentsInPeriod`
are already exported from `people/index.ts`, and the `Amendment` model
carries `@@index([recordType, recordId])` and `@@index([createdAt])` — the
two access patterns this ticket needs. T2 built for this.

### T9.1 — Per-cell "this was edited" affordance

A cell whose figure has been amended shows a marker. Constraints:

- **Not an accent.** `docs/design.md` allows one accent per screen and it
  belongs to Undo in the toast (T4 established this). Neutral treatment.
- **Not always-visible clutter.** The always-visible underline was built and
  rejected on 2026-08-17 for exactly this reason across 14 columns. A
  history marker is rarer than an editable cell, so a persistent marker is
  defensible where a persistent underline was not — but it must be quiet.
  **Confirm the treatment with the owner before building**, and show it in
  Storybook against a realistically-amended period, not one marked cell.
- The marker opens the history: what changed, from what, to what, by whom,
  when. `effectiveDate` displayed, `createdAt` for ordering — the model
  comment states this distinction.

### T9.2 — Amendment feed in Activity

`ActivityKind` already has `"amendment"` as a member, added by T2 with a
comment distinguishing it from the superseded `"correction"` kind. Confirm
whether T2 wired the rows or only the type — if only the type, T9 wires
`getActivity` to read `listAmendmentsInPeriod` and emit those rows, reading
through `people/index.ts` only, per reporting-owns-no-data.

### T9.3 — Stories and verification

---

## T10 — Doc amendments and ADR 0008

Everything in the companion plan's §5, plus the following, which accumulated
after that section was written and would otherwise be lost:

1. **The three "Corrected 2026-08-17" blocks** in the companion plan are
   currently annotations overturning surrounding text. Fold them into the
   text so a reader is not trusting a paragraph that a later block reverses.
   The load-bearing one is §3.1's Kind B rule: **there is no gap between
   D−1's close and D's open** — day windows are contiguous, so D−1's closing
   moves with D's opening. Implemented and tested.
2. **Boundary semantics**, currently only in a test header comment: a ledger
   day D is `(D 00:00, D+1 00:00]` (gt/lte) while opening at D is
   `<= D 00:00` (lte), so a Kind B correction lands at exactly
   `D 00:00:00.000` for opening and `D+1 00:00:00.000` for closing. This
   belongs in `formulas.md` or `architecture.md`, not only in a test.
3. **The settled UI decisions**, none of which are in the plan: single click
   focuses and typing a digit opens the editor (not double-click); the
   affordance is hover/focus-only with nothing at rest (the always-visible
   underline was built, reviewed and rejected as too noisy across 14
   columns); phone is read-only.
4. **Non-sales edits** happen in place when one reason is non-zero and defer
   to the breakdown when they mix (T7.4).
5. **Period-total quantities are read-only** because they span many days and
   offer no honest date to stamp an amendment against (T6.4).
6. **Purchased quantity edits hold unit cost constant** (T6.4).
7. **F4 — §3.2's reason for `previousUnitCostMinor` being read-only is
   stale.** It is no longer algebraically reconstructed from a running
   average; it is read off the last delivery before the period. Cell stays
   read-only, reason changes.
8. **The costing change itself** — bought-in cost is latest-price with FIFO
   layers, not a running average; `formulas.md` §3 was rewritten and T8's
   tests revised. Anything in the editable-ledger docs still describing a
   running average needs correcting; §3.2's Store row does.
9. **`docs/reversed-filter-audit.md`** — confirm T6 and T7 added no new
   "how much is there" read without a `reversed: false` filter, and update
   the enumeration if they did.
10. **ADR 0008** records *why* in-place editing replaced the effective-date
    correction doctrine (D1), and supersedes the relevant part of ADR 0001's
    and `architecture.md`'s "Changing a closed day". The companion plan notes
    the ADR "is worth least when written last" — it is now being written
    last, so write it from the decisions as recorded in D1–D6 rather than
    reconstructing intent.

Also update `docs/architecture.md`'s "Changing a closed day" section itself,
and `docs/gotchas.md` with anything from T6/T7 that cost real time.

---

## T11 — Delete the superseded correction mechanism

Per **D5**, approved 2026-08-17, no further confirmation needed.

**Sequenced last on purpose, and this is a correctness constraint, not
tidiness:** T2's trail is live and T9's history UI must ship before the old
path goes, so there is never a window where a correction is unrecordable.
Until T11 runs, **both mechanisms are live** — which is itself a reason not
to ship the branch early.

Removal surface, verified present in the tree:

- `recordSaleCorrection` (`sales/logic.ts`) and `recordSaleCorrectionRoute`
  (`sales/routes.ts`), plus their `sales/index.ts` exports
- `src/app/api/sales/corrections/route.ts`
- `record-correction-dialog.tsx` and its stories
- `Sale.effectiveAt`, `isCorrection`, `correctionReason`
  (`prisma/schema.prisma`, `sales/schema.ts`) — migration drops the columns
- their reads in `getActivity` (`reporting/logic.ts`) and the
  `createSaleRecord` write path (`sales/queries.ts`)
- covering tests in `sales/tests/sales.integration.test.ts` and
  `reporting/tests/activity.integration.test.ts`

`ActivityKind`'s `"correction"` member goes with it — T2's comment on the
`"amendment"` member already flags the pair.

**Grep before deleting**, since `effectiveAt` also appears in generated
Prisma client code under `src/generated/prisma/` that regenerates from the
schema and must not be hand-edited. Verify with `pnpm test` and
`pnpm exec tsc --noEmit`.

---

## Before the branch ships

Independent of the tickets above, and not covered by any of them:

- **The two migrations** (`20260817150627` reversal fields, `20260817151824`
  the Amendment table) have only run against empty test and dev databases.
  They are additive with defaults, but verify against production-shaped data
  before the branch reaches `main`. T11 adds a third, and that one is
  **destructive** — it drops columns — so it needs the same check with more
  care.
- **Do not push without asking.** Pushing `main` deploys straight to
  production.
- **Both correction mechanisms are live until T11.** The branch is not
  shippable before then.

---

## Sequencing

T6 → T7 → T9 → T10 → T11, as originally planned. T9 before T11 is the hard
constraint; T10 before T11 is preferable, since the ADR explains the deletion
and is better written while the reasoning is at hand.

T6.3 (the route fix) is small and blocking, and could land first
independently if T6's UI checkpoint stalls on sign-off.
