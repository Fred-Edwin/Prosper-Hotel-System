# 47 — Dashboard revenue and profit chart

**Type:** plumbing (test-after)
**Blocked by:** 46 (needs profit-by-period to exist so the chart has more
than one day's figure to plot)
**Status:** planned

## Goal

Replace the Dashboard's "Revenue and profit" card's `SectionNotBuilt`
placeholder with a real trend chart — the last of the Dashboard's
figure-driven cards (Profit panel and the four cash tiles are already
real; this is the only chart left unbuilt).

## Context

- Design precedent: `~/prosper-hotel-design-reference/src/components/design/dashboard/charts.tsx`
  — one axis (revenue as context, profit as emphasis, deliberately no
  dual axis), no pie chart, **closed days are gaps not zeroes** (a `null`
  breaks the line rather than drawing to the floor — a zero on a closed
  day would misrepresent non-trading as zero trading).
- Current placeholder: `src/app/dashboard/dashboard-body.tsx`'s "Revenue
  and profit" `Card` — swap `SectionNotBuilt` for the real chart,
  everything else about the card (position, chrome) is already locked in
  per that file's own comment.
- Data source: ticket 46's per-day profit figures, extended to a rolling
  window (e.g. last 14 or 30 days — check the design reference's
  `trend`/`DayPoint` fixture shape for the exact window it was designed
  against, and match it rather than picking arbitrarily).
- The dataviz skill's mark specs (2px lines with round caps, markers ≥8px
  with a 2px surface ring, hairline gridlines) — load the `dataviz` skill
  before writing any chart code, per its own trigger condition.
- **A day with no handover recorded is not necessarily "closed" for
  charting purposes** — check ticket 28's `isDayClosedFor` definition
  (per-person, per-location) against what "closed" means for a
  business-wide chart; a day with zero sales because it's a slow day is
  real data, not a gap. Confirm the distinction with Edwinfred if
  genuinely ambiguous rather than silently picking one reading.

## Scope

**In:**
- A `getRevenueProfitTrend` reporting function: given a location filter
  (or combined) and a rolling window, returns one point per day
  (revenue, net profit), with days the business didn't trade at all
  represented as gaps, not zeroes.
- Wiring the chart into the Dashboard's existing card position.
- Loading, empty (no trading history yet), and error states, matching
  `components/patterns/states.tsx`.

**Out:**
- Any other Dashboard card — "Needs you", "By location", stock/store
  movements are separate tickets.
- A dedicated full-history chart screen — this is the Dashboard's
  at-a-glance card only; the Ledger (already built) is where history is
  browsed in full.

## Acceptance criteria

- [ ] Chart renders revenue and net profit as a two-series line over the
      rolling window, one axis, no dual scale.
- [ ] A day with genuinely no trading (not just no handover recorded)
      shows as a gap in the line, not a zero.
- [ ] Loading, empty, and error states are present and match the rest of
      the Dashboard's cards.
- [ ] Owner-only, same gate as the rest of the Dashboard.
- [ ] Storybook story: populated, a gap day present, empty, loading,
      error.

## Verification

- Integration tests, test-after (composition over ticket 46's
  already-tested per-period profit logic; the new part is the rolling-
  window assembly and gap detection, which does have real branching —
  write that part's tests first if it turns out non-trivial):
  `getRevenueProfitTrend` against a constructed fixture with a genuine
  no-trading day in the window.
- `pnpm lint`, `pnpm exec tsc --noEmit`.
- Manual check against `references/ui-rules.md` and the `dataviz` skill's
  mark specs.
- Update `docs/screens.md` only if the story file's states materially
  change (no new destination to add).
