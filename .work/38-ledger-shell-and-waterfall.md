# 38 — Ledger destination shell and stats waterfall

**Type:** plumbing (test-after)
**Blocked by:** None (reads through existing `reporting`/`stock`/`sales`/`cash`
interfaces — `getDashboardProfit` and friends already compute every figure
the waterfall needs for one day; this ticket extends that to an
arbitrary period and wires the shell)
**Status:** in-progress (claimed by /build, 2026-08-12)

## Goal

Replace the Ledger destination's `NotBuiltPageClient` placeholder with the
real page shell — period picker, the cost-of-goods-sold stats waterfall,
and the four-tab layout — so `/ledger` is a real owner-facing screen for
the first time.

## Context

- Design precedent, already through review in the reference worktree:
  `~/prosper-hotel-design-reference/src/components/design/ledger/ledger-r3.tsx`
  (page shell, tabs, expand-on-rotate) and `stats.tsx` (the waterfall).
  Per `docs/gotchas.md`'s note, check that worktree before assuming
  anything here is undesigned — it isn't.
- Current placeholder: `src/app/ledger/page.tsx` (owner-only redirect
  already correct, swap `NotBuiltPageClient` for the real component).
- Nav entry already exists: `src/components/layout/admin-nav.ts`'s
  `ledger` key — no nav change needed.
- Waterfall figures (opening stock, purchases, closing stock, cost of
  goods sold, sales value, gross profit, non-sales at cost/at price) are
  documented in proposal.md §10.1–10.5 and already computed *for one day*
  by `src/modules/reporting/logic.ts` (`getDashboardProfit`,
  `computeRestaurantCostOfGoods`, `computeCanteenCostOfGoods`). This
  ticket's job is generalizing those to an arbitrary `{ periodStart,
  periodEnd }` (they already take day-shaped bounds — check whether the
  existing functions are already period-agnostic before adding new ones)
  and combining both locations into one whole-business total, which
  `getDashboardProfit` currently does not do.
- "Non-sales at cost / at selling price" — reuse `stock`'s wastage
  valuation from ticket 37 (`resolveProductCostBasis`) rather than
  re-deriving cost resolution.
- `docs/design.md`'s Ledgers and tables and Charts sections — no pie
  charts, the waterfall states the arithmetic as one continuous band.

## Scope

**In:**
- A `getLedgerSummary` reporting function: given a period and (optionally)
  a location filter, returns opening/purchases/closing/COGS, sales value,
  gross profit, and non-sales-at-cost/at-price for the whole business.
  Owner-only, same gate as the rest of `reporting`.
- A route exposing it, and the Ledger page composing the waterfall
  component against real data for the selected period.
- Period picker (today / this week / this month / custom range) — no
  server-side date-range validation is needed beyond `periodStart <
  periodEnd`.
- Tab shell for all four sub-ledgers (Product, Store, Non-sales, Cash),
  with the tabs themselves present and clickable, but **only the Product
  ledger tab need show real data in this ticket** — see ticket 39. Store
  and Non-sales tabs may show their already-designed empty/loading state
  (per `/tickets`' cross-feature note: an unbuilt sub-ledger correctly
  shows its designed loading/empty state, not an error, until its owning
  ticket lands). Cash ledger's real data is ticket 40.
- Clicking a waterfall term switches to the sub-ledger tab that explains
  it (design reference's `explains` field) — for terms whose sub-ledger
  isn't wired yet, this still switches tabs, landing on that tab's
  not-yet-real state.
- Rotate-to-expand prompt on narrow screens, matching the reference.

**Out:**
- Product, Store, Non-sales, Cash ledger table data — tickets 39, 40 (and
  a follow-on for Store/Non-sales, cut after this tranche).
- Export button (visible per the reference, but wiring a real CSV/PDF
  export is not in proposal.md's spec — leave as a disabled/no-op button
  with a tooltip, don't build a feature the ticket didn't ask for).
- Low stock, activity record, amending a closed day, profit-by-period
  beyond what the waterfall itself shows, pay reporting — separate
  tickets, not this one.

## Acceptance criteria

- [ ] `/ledger` renders the real shell for the owner: period picker,
      waterfall, four tabs — no more `NotBuiltPageClient`.
- [ ] Non-owner roles are still redirected away, unchanged from today.
- [ ] Waterfall figures are correct for a constructed scenario spanning
      both locations and a multi-day period (not just "today") — opening
      + purchases − closing = cost of goods sold, and gross profit =
      sales value − cost of goods sold, checked against known fixture
      data.
- [ ] Non-sales consumption is shown but documented as already included
      in cost of goods sold, not deducted again (per the reference's
      caption and proposal.md §10.5) — text present, not just a comment.
- [ ] Canteen's own-goods cost portion is marked provisional in the UI
      wherever it appears in the waterfall, consistent with the
      dashboard's existing provisional marking.
- [ ] Switching the period recomputes the waterfall; switching location
      filter (if exposed) recomputes it scoped to that location.
- [ ] Storybook story for the Ledger shell covering: waterfall with data,
      loading, empty (no movements in period), and the not-yet-wired tab
      states for Store/Non-sales.

## Verification

- Integration tests, test-after (this is composition/wiring over
  already-tested `reporting` logic, plus one new period-generalization
  function that does have real branching — write that function's tests
  first): `getLedgerSummary` against constructed multi-day, both-location
  fixture data.
- `pnpm lint`, `pnpm exec tsc --noEmit`.
- Manual check against `references/ui-rules.md`.
- Add the new story to `docs/screens.md`'s Reporting section.
