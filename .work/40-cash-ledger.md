# 40 — Cash ledger

**Type:** logic (test-first)
**Blocked by:** 38 (needs the Ledger shell and its period picker to host
this tab in)
**Status:** in-progress (claude, 2026-08-12)

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

- [ ] Each day's closing balance equals its opening balance plus that
      day's money in less that day's money out, for both cash and M-Pesa
      independently, against a constructed fixture with all five
      categories (handover, repayment, stock, running, asset, drawing)
      represented.
- [ ] A day's closing balance equals the next day's opening balance
      (the running balance actually runs across the period).
- [ ] Filtering by category narrows both the day rows (does that day have
      any matching transaction) and the expanded transaction list to
      that category.
- [ ] Expanding a day shows its individual transactions with method
      (cash/M-Pesa), category, description, amount, and who recorded it.
- [ ] Owner-only, same gate as the rest of `reporting`.
- [ ] Empty (no transactions in period) and filtered-empty states are
      distinct, via `components/patterns/states.tsx`.
- [ ] Storybook story: populated table, day expanded, empty, filtered-
      empty, loading.

## Verification

- Integration tests, test-first: `getCashLedger` against constructed
  fixtures with handovers, repayments, and all four expense categories
  across a multi-day period, checking the running-balance arithmetic for
  cash and M-Pesa independently.
- `pnpm lint`, `pnpm exec tsc --noEmit`.
- Manual check against `references/ui-rules.md`.
- Add the story to `docs/screens.md`'s Reporting section.
