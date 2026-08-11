# 25 — Canteen cost of goods sold, and dashboard wiring

**Type:** logic (test-first)
**Blocked by:** 21 (transfer cost split, formulas.md §5, needs real
transfer movements), 22 (canteen goods need `lastKnownCostMinor` to
value the own-goods estimate rate), 23 (takings is the revenue figure
the estimate rate multiplies), 24 (count-derived sales is what a count
measures the estimate against, and is what "corrects" it)
**Status:** done

**Claimed:** Claude Code — 2026-08-11.

## What this delivers

formulas.md §5 (transfer cost split) and §6 (canteen cost of goods sold,
both halves — restaurant food counted daily, own goods estimated between
counts and corrected at each count). This is the calculation layer that
makes the dashboard's already-designed canteen revenue/cost slots
(`docs/design.md`-locked dashboard, currently rendering fixture data —
see `dashboard.canteenCostRate`, `dashboard.costOfGoods`,
`dashboard.lastCanteenCount` in the design reference) show real figures.

Per this project's cross-feature-screens rule: the dashboard shell and
its canteen slots already exist and are already routed — this ticket is
responsible for wiring real data into those specific slots, not building
a new screen.

## Context

- Relevant module: `src/modules/reporting/` for the read/computation
  that assembles the dashboard figures (per `docs/architecture.md`,
  reporting "reads through other modules' interfaces, never their
  internals") — pull from `stock` (movements, counts), `cash` (takings),
  `catalogue` (`lastKnownCostMinor`, recipe cost) via each module's
  `index.ts` only.
- formulas.md §5 ("Food sent from the restaurant to the canteen" — the
  transfer rate = kitchen ingredients consumed ÷ what its food sold for,
  applied to transferred food's selling value) and §6 ("The canteen —
  two parts": exact daily cost for restaurant-supplied food using the
  ordinary opening+in−closing−wasted formula; estimated cost for the
  canteen's own goods using the last-count-measured rate × today's
  takings from those goods).
- The dashboard component consuming this data: `src/app/dashboard/`
  (existing shell, currently fixture-backed per the design reference's
  `dashboard-body.tsx`) — this ticket wires the canteen-specific slots
  only (revenue.canteen, the two-part cost breakdown, `canteenCostRate`,
  `ProvisionalNote lastCount`), not the whole dashboard.
- Ticket 14 (`src/modules/cash/ui/dashboard-handovers.tsx`) is the
  precedent for adapting a design-reference fixture component into a
  real, fetching one.
- "The count corrects the estimate" (formulas.md, same section) — the
  correction is *shown*, not applied quietly: `Estimated since last
  count` / `Measured at the count` / `Correction`, per the doc's own
  example shape.

## Scope

**In:**
- A function computing the restaurant→canteen transfer cost per
  formulas.md §5: rate = kitchen ingredients consumed ÷ kitchen food's
  selling value (over some period — clarify with the owner if unclear
  whether this is daily or matches the reporting period being viewed;
  default to the same day being reported on, consistent with §6's daily
  restaurant-food-cost figure).
- A function computing the canteen's daily cost of goods sold, both
  halves: restaurant-supplied food (exact, `opening + transferred in −
  closing − wasted`, using the day's actual movements) and the
  canteen's own goods (estimated, `today's takings from those goods ×
  rate measured at the last count`).
- A function computing "the correction" shown at each count: estimated
  total since the last count vs. the measured total from ticket 24's
  count-derived detail, and the difference — displayed, not silently
  folded into any other figure (formulas.md: "shown rather than applied
  quietly").
- Wire `revenue.canteen` (from ticket 23's takings), the cost breakdown,
  `canteenCostRate`, and `lastCanteenCount`/provisional labelling into
  the existing dashboard's canteen slots, replacing their fixture
  values.
- Label every provisional figure as provisional wherever it appears on
  the dashboard (formulas.md: "provisional figures are labelled
  wherever they appear").

**Out:**
- Any new screen or nav link — this ticket only fills existing dashboard
  slots.
- Full reporting module build-out beyond the dashboard's Profit panel
  (stock valuation, amounts owed, profit by arbitrary period — Stage 8
  remainder).

**Scope expanded 2026-08-11, by user decision:** restaurant COGS wiring
was confirmed *not* already real anywhere in the codebase (`reporting/`
was still `export {}`; no function computed formulas.md §6's restaurant
formula, running costs, or a location-wide revenue total). The user
wants the full Profit waterfall (`dashboard-r3.tsx`'s revenue / cost of
goods sold / running costs / net profit strip) live with real data, not
partially placeholder — so this ticket now also computes:
- Restaurant cost of goods sold (formulas.md §6, restaurant formula:
  opening ingredients + bought − closing − food sent to canteen).
- Running costs total (sum of unreversed `Expense` rows, category
  `running`, for the period).
- Restaurant revenue (today's non-void recorded sales at the restaurant
  location) and business-total revenue (restaurant + canteen takings).
- Gross and net profit assembly (formulas.md §7) from the above plus
  this ticket's own canteen COGS work.

## Acceptance criteria

- [x] Transfer cost matches formulas.md §5's worked example exactly when
      given equivalent inputs (kitchen consumption, food's selling
      value, transferred food's selling value).
- [x] Restaurant-supplied canteen food cost matches formulas.md §6's
      worked example (opening + transferred in − closing − wasted).
- [x] Canteen own-goods estimated cost matches formulas.md §6's worked
      example (today's takings from those goods × last-measured rate).
- [x] Where a recipe exists for a transferred item, its recipe cost is
      used instead of the derived rate (formulas.md §5's note).
- [x] The count-correction figure (estimated vs. measured vs.
      difference) is computed and exposed for display once ticket 24
      data exists for a period.
- [x] Business total is unaffected by the transfer rate chosen (same
      figure subtracted from restaurant, added to canteen) — assert this
      invariant directly in a test.
- [x] **Screen:** the dashboard's existing canteen revenue/cost slots
      (design-reference `dashboard-body.tsx`'s revenue and cogs detail
      panels) show real computed figures instead of fixtures; provisional
      figures carry a visible provisional label/badge.
- [x] Loading and error states for the newly-wired slots follow
      `components/patterns/states.tsx`, matching ticket 14's precedent.
- [x] Storybook: update the dashboard's story (or the relevant panel's,
      if split out as its own component per ticket 14's pattern) to
      cover a provisional state and a just-corrected-by-count state.

**Scope expanded 2026-08-11, by user decision:** restaurant cost of
goods sold, running costs and net profit assembly were added to this
ticket's scope (see the Out-of-scope note above) — the full Profit
waterfall (`dashboard-r3.tsx`'s revenue / cost of goods sold / running
costs / net profit strip) is real end to end, not partially placeholder.

## Verification

- Integration tests, test-first: each formula against formulas.md's own
  worked examples, the business-total invariant, first-count/no-prior-
  count graceful handling (mirrors ticket 24's caveat).
- `pnpm lint`, `pnpm exec tsc --noEmit`.
- Manual check against `references/ui-rules.md`.
- Update `docs/screens.md` if a new story file is introduced for the
  wired panel.
