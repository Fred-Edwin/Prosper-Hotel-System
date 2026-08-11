# 31 — Running cash balance (cash and M-Pesa, separately)

**Type:** logic (test-first)
**Blocked by:** None (reads only from records `cash` already owns:
`Handover`, `Expense` — ticket 16's four categories are already stored
with enough shape to compute this)

**Status:** in-progress (rejected by /review, 2026-08-11 — see finding below)

**Review finding (blocking):** `RunningBalanceStrip` in
`money-out-destination.tsx` only ever mounts when the expense list's own
`state.status === "ready"`, because `MoneyOutContentView` early-returns
`LoadingTable`/`ErrorState`/`PermissionDenied` for the list before
reaching the JSX that renders the balance strip. This means the balance's
own loading/error states are unreachable, and its `denied` branch is dead
code — contradicting the component's own comment ("independent of the
expense list, since one failing to load shouldn't hide the other") and
the acceptance criterion that the balance have its own loading/error
states. Fix: render `<RunningBalanceStrip>` before/outside the expense
list's early-return branches so it always reflects `balanceState`
regardless of the list's state.

**Scope note:** `Expense` had no payment-method field — confirmed against
`prisma/schema.prisma` before writing acceptance criteria, per the Context
note above. Asked the user, who chose to add `paymentMethod` to `Expense`
now (migration `20260811132510_add_expense_payment_method`, defaulted to
`cash` on existing rows) rather than deferring or approximating the
money-out split. `record-expense-sheet.tsx` now requires picking cash or
M-Pesa for every new expense.

## Goal

Make the expected cash and expected M-Pesa balances real, computable
figures — ticket 16 explicitly deferred this ("a follow-on ticket once
handover (in) and this ticket (out) both exist to read across"), and
both sides now exist.

## Context

- formulas.md §9, the exact formula and worked example:
  ```
  handovers received
  − stock bought
  − running costs
  − equipment and furniture
  − owner's drawings
  = what should be in hand
  ```
  computed **separately** for cash and M-Pesa — formulas.md's first rule,
  restated everywhere: "Cash and M-Pesa are never added together."
- proposal.md §6: "the system maintains a single running cash balance,"
  §10.6 has the canonical calculation reference.
- Relevant module: `src/modules/cash/logic.ts` — `recordHandover`
  (money in), `recordExpense`/`listExpenses` (money out, four
  categories, ticket 16), `drawingDebtOwed`/`sumUnreversedDrawingDebt`
  (existing drawings total). All four already live here; no cross-module
  read needed.
- Reversed expenses (ticket 16's `reverseExpense`) must be excluded from
  the running total — same "cancelled entries count nowhere" rule
  formulas.md states up front. Confirm `listExpenses`/whatever query this
  ticket adds already filters reversed entries before summing, rather
  than assuming and re-checking after.
- M-Pesa handovers vs. M-Pesa expenses: confirm `Expense`'s schema
  actually distinguishes cash vs. M-Pesa payment method (check
  `prisma/schema.prisma`'s `Expense` model) before assuming the split is
  possible — if a payment's method isn't recorded, this ticket may need
  to add that field, which changes its shape from pure-read to
  read-plus-schema. Resolve this before writing acceptance criteria that
  assume the split already exists.

## Scope

**In:**
- A function (e.g. `getRunningCashBalance(locationScope)`) returning
  expected cash and expected M-Pesa separately, per formulas.md §9's
  formula, reading:
  - money in: sum of non-void handovers' actual cash / actual M-Pesa
    (both locations combined — proposal.md §6 describes one running
    balance for the business, not per-location)
  - money out: sum of unreversed Stock + Running cost + Equipment +
    Drawings expenses, split by whichever payment method they were paid
    in (see Context note above — resolve the schema question first)
- Surfaced on the `money-out` admin destination as a running total
  alongside the existing payment list (ticket 16's screen).
- Owner-only read, same access pattern as the rest of `money-out`.

**Out:**
- Wiring this into the Dashboard's "Cash position" / "M-Pesa balance"
  slots — ticket 33, once this ticket's function exists to call.
- Settling the drawings debt — ticket 32; this ticket only reads the
  existing debt total, doesn't change how it's paid down.
- Any historical/point-in-time balance ("what was the balance on a past
  date") — this ticket computes the current balance only; historical
  is a Stage 8 reporting concern.
- Per-location cash balance — proposal.md §6 describes one balance for
  the business.

## Acceptance criteria

- [x] `getRunningCashBalance` returns expected cash and expected M-Pesa
      as two separate figures, matching formulas.md §9's worked example
      when given equivalent constructed data.
- [x] Reversed expenses are excluded from money-out; voided sales don't
      affect this (handovers are the money-in source, not sales
      directly) — confirm voided sales already can't inflate a
      handover's actual amount (they shouldn't, per ticket 10's reversal
      model) rather than adding a redundant check here.
- [x] Equipment and drawings both reduce the balance (cash physically
      leaves) even though neither reduces profit — confirm this doesn't
      get accidentally conflated with a profit calculation anywhere in
      this ticket's code or tests.
- [x] **Screen:** `money-out`'s destination shows the running cash and
      M-Pesa balances, read-only, above or alongside the existing
      payment list.
- [x] Loading and error states via `components/patterns/states.tsx`.
- [x] Storybook: extend `money-out-destination.stories.tsx` with the
      balance figures visible in at least one story.

## Verification

- Integration tests, test-first: the formula against a constructed
  scenario covering every term (handovers in, each expense category out,
  a reversed expense excluded, cash/M-Pesa kept separate throughout).
- `pnpm lint`, `pnpm exec tsc --noEmit`.
- Manual check against `references/ui-rules.md`.
