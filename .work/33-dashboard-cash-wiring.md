# 33 — Wire cash position, M-Pesa balance, owed-to-you, and drawings into the Dashboard

**Type:** plumbing (test-after)
**Blocked by:** 31 (running cash balance — feeds two of the four
slots this ticket wires), 32 (drawing repayment — the "Your drawings"
slot should reflect the netted balance, not just the raw debt total)

**Status:** done (2026-08-11)

**Implementation note:** "Owed to you" needed the thin new query the
Context section anticipated — `sumCreditAcrossAllCustomers` in
`sales/queries.ts` plus an owner-gated `getTotalCustomerBalance` in
`sales/logic.ts` (mirrors `cash`'s `getRunningCashBalance` gating), since
no summed-across-all-customers variant existed (only
`sumCreditForCustomer(customerId)`). Cash position and M-Pesa balance
needed no new backend — ticket 31 already built and exported
`getRunningCashBalance` with a live route; Your drawings needed none
either — ticket 32's `drawingDebtOwed`/`/api/cash/drawing-debt` already
existed. Cash position and M-Pesa balance share one fetch of
`getRunningCashBalance` (`dashboard-cash-figures.tsx`) rather than two,
since they're the same underlying call. No sparkline or ledger link on
any of the four cards, unlike the design-reference prototype's richer
treatment — both need capabilities (trend history, a new nav
destination) explicitly ruled out of scope by tickets 31/32.

## Goal

Replace four of the Dashboard's `SectionNotBuilt` placeholders with real
figures — `src/app/dashboard/dashboard-body.tsx`'s own comment already
names this exact gap ("cash position needs `cash`'s own dashboard
reads... Each of those sections keeps its locked position and card
chrome but renders `SectionNotBuilt` instead of content").

## Context

- `src/app/dashboard/dashboard-body.tsx` lines 45–58: four locked slots
  in one row — "Cash position," "M-Pesa balance," "Owed to you," "Your
  drawings" — each currently `<SectionNotBuilt section="..." />`. This
  ticket replaces all four bodies; the grid/card chrome around them is
  already correct and must not change (per the file's own comment: "each
  later ticket only has to replace one card's body — never re-derive the
  layout").
- Data sources, one per slot:
  - **Cash position** ← ticket 31's `getRunningCashBalance` (cash side).
  - **M-Pesa balance** ← ticket 31's `getRunningCashBalance` (M-Pesa
    side) — same function, second field, not a separate computation.
  - **Owed to you** ← `getCustomerBalance` in `src/modules/sales/index.ts`
    (already built, ticket 08) — sum across all customers, both
    locations, per formulas.md §11 ("the sum across all customers, both
    locations"). No new logic needed; confirm a summed-across-all-
    customers variant exists or needs a thin new query (check
    `sales/queries.ts` before assuming one must be added).
  - **Your drawings** ← ticket 32's netted `drawingDebtOwed` (debt minus
    unreversed repayments).
- Precedent for this exact kind of ticket: ticket 25 ("wire the
  dashboard's Profit waterfall to real figures") — same shape, same
  file, same "replace `SectionNotBuilt` with real content" pattern.
  Follow whatever loading/error convention ticket 25 established for the
  Profit slot rather than inventing a new one for these four.

## Scope

**In:**
- Replace the four `SectionNotBuilt` slots in `dashboard-body.tsx` with
  real figures, each reading from the source listed above.
- Cash and M-Pesa shown as separate figures throughout (never summed),
  per formulas.md's first rule.
- Loading/error states per slot, matching ticket 25's established
  pattern for the Profit panel.

**Out:**
- Any change to the four slots' layout, card chrome, or position in the
  grid — locked by the existing design, per the file's own comment.
- The other still-`SectionNotBuilt` sections on this same page (Revenue
  and profit chart, Needs you, Location comparison, Stock movements,
  Store movements) — untouched, out of scope, belong to later tickets.
- Any new logic in `cash` or `sales` — this ticket is pure composition
  over what tickets 31, 32, and existing `sales` exports already provide.

## Acceptance criteria

- [x] "Cash position" and "M-Pesa balance" slots show ticket 31's real
      running balance, kept as two separate figures.
- [x] "Owed to you" shows the real total customer debt across both
      locations.
- [x] "Your drawings" shows the real, netted outstanding drawings
      balance (debt minus repayments).
- [x] The other five dashboard sections remain untouched
      (`SectionNotBuilt`, same as before this ticket).
- [x] Loading and error states are present for all four slots, consistent
      with ticket 25's Profit-panel convention.
- [x] No layout/grid changes — a visual diff of the dashboard shows only
      the four cards' inner content changing.

## Verification

- No new logic to test-first (Type: plumbing) — composition only.
- `pnpm lint`, `pnpm exec tsc --noEmit`.
- Manual check against `references/ui-rules.md`, and a visual check of
  the live Dashboard against the pre-ticket layout to confirm nothing
  outside the four cards moved.
