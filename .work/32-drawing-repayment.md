# 32 — Settling the owner's drawing debt

**Type:** logic (test-first)
**Blocked by:** None (extends ticket 16's existing `DrawingDebt`
record; does not need ticket 31's balance to exist first — they read
independently, though both surface on the same screen)

**Status:** done (2026-08-11)

## Goal

Let the owner record a repayment against her outstanding drawings debt
— proposal.md §6: "the outstanding balance is available at any time," a
balance that today only ever grows, since ticket 16 built the debt but
no way to pay it down.

## Context

- proposal.md §6: "Owner's drawings are additionally recorded as an
  amount owed to the business, and the outstanding balance is available
  at any time." Doesn't specify repayment mechanics — resolved with
  Edwinfred: a new, symmetric record type, not a reuse of the expense
  path.
- Relevant module: `src/modules/cash/logic.ts` — `recordExpense`
  (drawing category, ticket 16), `drawingDebtOwed`/
  `sumUnreversedDrawingDebt`, `createDrawingDebt`/
  `findDrawingDebtByExpenseId`/`markDrawingDebtReversed` in
  `src/modules/cash/queries.ts`. This ticket adds a parallel,
  append-only `DrawingRepayment` record — same shape discipline as
  `DrawingDebt` (never edited, only ever added to or marked reversed).
- `prisma/schema.prisma`'s `DrawingDebt` model (find its exact fields
  before designing `DrawingRepayment` — mirror its shape: amount,
  timestamp, who recorded it).

## Scope

**In:**
- A `DrawingRepayment` model: amount, timestamp, recorded-by. Owner-only
  to create, matching every other drawings-adjacent write.
- A `recordDrawingRepayment` logic function: rejects non-positive
  amounts; rejects a repayment larger than the current outstanding debt
  (can't "overpay" a debt that isn't real accounting, per formulas.md's
  scope — confirm this rule against Edwinfred's intent if it isn't
  obvious from proposal.md, since proposal.md doesn't state it
  explicitly).
- `drawingDebtOwed` (or a new equivalent) now nets debt minus unreversed
  repayments, so "outstanding balance" reflects reality.
- Extends the existing `money-out` destination with a repayment action
  and the updated outstanding-balance figure — no new nav destination.
- Reversal of a repayment (owner-only, same-day, mirrors ticket 16's
  expense-reversal pattern) — a mistaken repayment shouldn't silently
  understate what's still owed.

**Out:**
- Any change to how a drawing debt itself is created — ticket 16's
  `recordExpense` (Drawing category) is unchanged.
- Wiring the updated figure into the Dashboard's "Your drawings" slot —
  ticket 33.
- Interest, schedules, or any accounting beyond a simple running
  subtraction — proposal.md §12 excludes payroll/accounting complexity
  generally, and drawings repayment is the same spirit (a debt tracker,
  not a ledger of financial instruments).

## Acceptance criteria

- [x] A repayment can be recorded with a positive amount; the
      outstanding drawings balance decreases by that amount.
- [x] A repayment larger than the current outstanding balance is
      rejected.
- [x] A non-positive repayment amount is rejected.
- [x] Only the owner can record or reverse a repayment.
- [x] A repayment can be reversed same-day by the owner: the original
      stays readable and marked reversed, and the outstanding balance
      reflects the reversal (goes back up).
- [x] Reversing an already-reversed repayment is rejected.
- [x] **Screen:** `money-out`'s destination gains a repayment action and
      shows the current outstanding drawings balance, reachable from
      wherever the existing drawings-category entries are shown.
- [x] Loading, empty (no debt outstanding), and error states via
      `components/patterns/states.tsx`.
- [x] Storybook: extend `money-out-destination.stories.tsx` with a
      repayment-flow variant and a zero-balance variant.

## Verification

- Integration tests, test-first: repayment reduces balance correctly,
  over-repayment rejected, non-positive rejected, owner-only gate,
  reversal restores the balance, double-reversal rejected.
- `pnpm lint`, `pnpm exec tsc --noEmit`.
- Manual check against `references/ui-rules.md`.
