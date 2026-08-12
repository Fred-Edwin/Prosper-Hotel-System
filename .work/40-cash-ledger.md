# 40 — Cash ledger

**Type:** logic (test-first)
**Blocked by:** 38 (needs the Ledger shell and its period picker to host
this tab in)
**Status:** done

## Review findings (2026-08-12, rejected)

- **Blocking correctness bug:** `getCashLedger` (`src/modules/reporting/logic.ts`,
  around line 1041) computes each day's category-column totals
  (`handoversMinor`, `repaymentsMinor`, `stockMinor`, `runningMinor`,
  `assetsMinor`, `drawingsMinor`) from the day's *unfiltered* transaction
  set, but only the `transactions` array used for day-expansion is
  filtered (`filteredTransactions`, ~line 1063). When a category/search
  filter is active, a day row's summary columns can show money in a
  category with zero matching transactions underneath it when expanded —
  e.g. filter to "Stock" on a day that also had a handover: the
  "Handovers" column stays non-zero, but expanding the row shows no
  handover line to explain it. Violates this ticket's own acceptance
  criterion: "Filtering by category narrows both the day rows... and the
  expanded transaction list to that category" — only the transaction list
  narrows today. Fix: derive the column sums (`sumFor` and the
  `cashIn`/`cashOut`/`mpesaIn`/`mpesaOut` running-balance inputs, if they
  are meant to reflect the filter too — confirm intent) from
  `filteredTransactions` instead of `transactions`, or explicitly decide
  the columns should stay unfiltered and add a test asserting that on a
  day where the filter excludes some but not all transactions.
- The existing test for this criterion
  (`src/modules/reporting/tests/cash-ledger.integration.test.ts:221`)
  doesn't catch this — its fixture never asserts on the category columns
  under an active filter, only on `transactions` length/category. Add
  that assertion once fixed.

### Fix (2026-08-12)

Derived the category column sums (`handoversMinor`, `repaymentsMinor`,
`stockMinor`, `runningMinor`, `assetsMinor`, `drawingsMinor`) from
`filteredTransactions` instead of the day's unfiltered `transactions`, so a
filtered day row only shows money in categories with matching transactions
underneath it. The running/opening/closing cash and M-Pesa balance inputs
(`cashIn`/`cashOut`/`mpesaIn`/`mpesaOut`, `runningCash`/`runningMpesa`) stay
derived from unfiltered `transactions` — those are a true reconciliation
figure, already covered by this ticket's own acceptance criteria against
unfiltered fixtures, and must not move under a filter.

Extended the existing filter test
(`cash-ledger.integration.test.ts:221`) to assert `stockMinor` is non-zero
and `handoversMinor` is zero on the filtered day row. Full integration
suite (26 files, 341 tests), lint, and `tsc --noEmit` all pass.
- Everything else reviewed clean: module seams, reconciliation/running-
  balance arithmetic, the `DrawingRepayment.paymentMethod` and
  `getRunningCashBalance` fixes, UI composition and states, Storybook +
  `docs/screens.md`. Non-blocking note: the "before period" balance query
  uses `new Date(0)` as its lower bound (unbounded history scan on every
  request) — fine now, worth revisiting at scale.

## Build notes

- Resolved the opening/closing ambiguity per `getRunningCashBalance`'s
  (ticket 31) existing precedent: two independent running balances
  (`cashMinor`/`mpesaMinor`), never blended — no reference-fixture
  guessing needed once that precedent was found.
- Found `DrawingRepayment` (ticket 32) had no `paymentMethod` field,
  unlike every other cash record. Confirmed with Edwinfred: added
  `paymentMethod` to `DrawingRepayment` (schema + migration + logic +
  `drawing-repayment-card.tsx`'s form) rather than assuming cash-only.
- Found `getRunningCashBalance` (ticket 31) never netted repayments in as
  money-in, even after ticket 32 added them — a pre-existing gap that
  would have made this ledger's closing balance and the dashboard's
  running balance disagree. Confirmed with Edwinfred: fixed in this
  ticket, with new integration test coverage.

## Goal

Make the Ledger's Cash tab real: one row per day with a running cash and
M-Pesa balance and every money-in/money-out category as a column,
expandable to individual transactions, completing proposal.md §10.6's
expected-cash figure as a browsable record rather than a single number.

## Context

- Design precedent: `~/prosper-hotel-design-reference/src/components/design/ledger/tables.tsx`'s
  `CashLedgerTable` — one row per day (opening/handovers/repayments/
  stock/running/assets/drawings/closing), category filter, search by
  description/recorded-by, day-expansion to individual transactions with
  payment method (cash/M-Pesa) shown per line.
- **Cash and M-Pesa are never pooled** (`docs/design.md`, proposal.md
  §10.6) — this ledger's opening/closing balance columns must be reported
  as two separate running balances, not one blended figure. Check how
  the reference fixture handles this (it may need adapting — the
  reference's `d.opening`/`d.closing` look like one number; this
  project's real data has two) and confirm with Edwinfred if the design
  reference is ambiguous here rather than guessing which reading is
  right.
- Data sources already built: `cash`'s `getTakingsAtLocation` (canteen
  takings in), handover records (money in from cashiers), `getRunningCosts`
  and `Expense`/`ExpenseCategory` (stock, running, asset, drawing money
  out — `src/modules/cash/schema.ts`), drawing repayments (`Repayment`,
  per `sales`/`cash` — check ticket 32's implementation for the
  repayment record shape).
- `docs/architecture.md`'s note that `reporting` reads through module
  interfaces only — pull handovers/takings/expenses/repayments through
  `cash`'s and `sales`'s `index.ts`, never their `queries.ts`.

## Scope

**In:**
- A `getCashLedger` reporting function: given a period, returns one row
  per day with the running cash balance and running M-Pesa balance
  separately, plus that day's handovers-in, repayments-in, and
  stock/running/asset/drawing money-out, and a day's individual
  transactions for expansion (each with method, category, description,
  amount, recorded-by).
- Route + wiring the Cash ledger tab in the Ledger shell (ticket 38) to
  this real data.
- Category filter and search (description, recorded-by), matching the
  reference's toolbar.
- Day-expansion to individual transactions.
- A period total row (opening balance at period start, closing balance
  at period end, summed categories in between), matching the reference's
  footer row.

**Out:**
- Product, Store, Non-sales ledgers — other tickets.
- Any write path (recording a payment, editing an expense) — this is a
  read-only report over records those modules already own.

## Acceptance criteria

- [x] Each day's closing balance equals its opening balance plus that
      day's money in less that day's money out, for both cash and M-Pesa
      independently, against a constructed fixture with all five
      categories (handover, repayment, stock, running, asset, drawing)
      represented.
- [x] A day's closing balance equals the next day's opening balance
      (the running balance actually runs across the period).
- [x] Filtering by category narrows both the day rows (does that day have
      any matching transaction) and the expanded transaction list to
      that category.
- [x] Expanding a day shows its individual transactions with method
      (cash/M-Pesa), category, description, amount, and who recorded it.
- [x] Owner-only, same gate as the rest of `reporting`.
- [x] Empty (no transactions in period) and filtered-empty states are
      distinct, via `components/patterns/states.tsx`.
- [x] Storybook story: populated table, day expanded, empty, filtered-
      empty, loading.

## Verification

- Integration tests, test-first: `getCashLedger` against constructed
  fixtures with handovers, repayments, and all four expense categories
  across a multi-day period, checking the running-balance arithmetic for
  cash and M-Pesa independently.
- `pnpm lint`, `pnpm exec tsc --noEmit`.
- Manual check against `references/ui-rules.md`.
- Add the story to `docs/screens.md`'s Reporting section.
