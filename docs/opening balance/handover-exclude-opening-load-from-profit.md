# Handover: keep the 2026-08-14 opening-balance load out of profit/COGS reporting

## Role

You're a backend engineer working on Prosper Hotel's reporting module
(`src/modules/reporting/`). Read root `CLAUDE.md` and `AGENTS.md` first —
this Next.js version has breaking-change docs in
`node_modules/next/dist/docs/`. This is a reporting-logic change, not a
schema change — no migration expected. Read `docs/formulas.md` in full
before touching `reporting/logic.ts`; the whole module is built around the
formulas documented there, and this ticket needs to fit them, not
special-case around them.

## The question this answers

The user asked, in conversation, not as a filed bug: "can we make the app
only consider financial data like profits, revenue, cost of goods from
tomorrow [2026-08-15], because that's when the app is going to be in use,
so we don't display the wrong profits and stuff." This is a genuine "could
we" — not yet decided to build. Confirm the user still wants it before
starting; this doc is the design thinking to hand them if they say yes, not
a go-ahead in itself.

## Background: why 8/14 produces a nonsense profit figure

On 2026-08-14, the local and production databases were wiped and reloaded
with real legacy data: a fresh catalog (see
`scripts/import-v2-catalog.ts`) and a same-day closing-stock snapshot (see
`scripts/load-closing-stock.ts`), loaded as `StockMovementReason.corrected`
stock-count corrections — not real deliveries, not real sales. See
`scripts/opening balance/handover-prompt.md` for the full reasoning on why
`corrected` was the right movement type (short version: `received` would
have fabricated purchase costs and corrupted `lastKnownCostMinor`/COGS
going forward; `corrected` doesn't touch either).

The consequence: `docs/formulas.md` §6's cost-of-goods-sold formula is
`opening + bought − closing`. For 2026-08-14, opening = 0 (nothing existed
before the load) and bought = 0 (a correction isn't a purchase), so
COGS = `0 + 0 − closing` = a large **negative** number. The Dashboard's
Day view, when it lands on 8/14, shows a nonsensically large "net profit"
(revenue − COGS − running costs, with COGS negative flips the sign) that
has nothing to do with real trading — confirmed live: KSh 10,635.95 "net
profit" on a day with KSh 0 revenue.

This was flagged to the user at load time as an accepted, expected
artifact of day one (see conversation history / `docs/gotchas.md` if it
was logged there). This ticket is about whether to go further and
structurally hide it, now that the user is reconsidering.

## The key fact that makes this tractable

`docs/formulas.md` §1: **"Yesterday's closing is today's opening."**
Closing stock is derived by summing all movements up to a point in time
(`sumMovementsByProductAtLocationAsOf` /
`sumIngredientMovementsAtLocationAsOf` in `stock/queries.ts` — no reason
filter, every movement counts toward the running total). This means the
8/14 correction's *quantity and value* automatically become 8/15's
opening stock without any special handling — nothing needs to be
duplicated or re-seeded for tomorrow to start from the right numbers.

**The only problem is 8/14's own *movement history* appearing inside a
report whose date range includes that day.** If the fix only needs to
keep 8/14 out of *period-based* profit/COGS calculations (not out of the
underlying stock-level ledger), it's a narrower, safer change than it
first sounds.

## Two shapes this could take — pick one with the user, don't assume

### Shape A — change the default landing date only (small, safe)

Dashboard/reports default to opening on a sensible day (e.g. "today" if
there's been real trading activity since 8/15, otherwise skip landing on
8/14 specifically) rather than literally excluding 8/14 from calculations.
The owner can still manually pick 8/14 in the date picker and see the real
(negative-COGS) numbers if they want to.

- Touches: whatever component currently defaults the Dashboard/Ledger date
  range to "today" (see the recent commit `8d207d9 fix: ledger page
  defaults to today and persists tab/date across refresh` — read that
  diff first, this ticket likely touches the same code).
- Risk: low. No formula changes, no data hidden, just a smarter default.
- Downside: doesn't fully satisfy "only consider financial data from
  tomorrow" — a report spanning 8/1–8/20 (a month view, for instance)
  would still include 8/14's artifact.

### Shape B — exclude 8/14's movements from profit/COGS math app-wide (bigger)

Every period-based profit/COGS calculation in `reporting/logic.ts`
(`computeRestaurantCostOfGoods`, `computeCanteenCostOfGoods`,
`getDashboardProfit`, `getRevenueProfitTrend`, `getLedgerSummary`,
`getProductLedger`, `getStoreLedger`, `getExceptions`, and
`computeTransferCost` — grep `periodStart`/`periodEnd` in
`reporting/logic.ts` for the full list, all take a period) would need a
lower bound clamped to no earlier than 2026-08-15, regardless of what
date range is requested. So a month view spanning 8/1–8/20 would compute
COGS/profit only using 8/15–8/20's movements — 8/14 is invisible to every
money calculation, permanently.

**What must NOT change under Shape B:** the *stock level* itself. The
owner needs to see "we have 355 Smokies" starting 8/15 — that's real
inventory the business owns, loaded from a real physical count. Only the
*movement history entries* dated 8/14 should be excluded from COGS/profit
math; the resulting on-hand quantity/value they produced must still be
readable as 8/15's opening figure. This is very close to how §1's
"closing = opening" mechanic already works — the risk in Shape B is
accidentally breaking that inheritance while trying to hide the movements,
not the concept itself.

- Touches: every function above needs a `max(periodStart, OPENING_BALANCE_CUTOFF)`
  clamp, where `OPENING_BALANCE_CUTOFF` is 2026-08-15T00:00 (or wherever
  the business's local timezone puts midnight — check
  `docs/architecture.md` for the timezone convention already in place,
  don't assume UTC).
- Where does the cutoff constant live? Probably a single exported constant
  in `reporting/logic.ts` or `reporting/schema.ts` — not hardcoded
  per-function. Whoever builds this should decide the one place it's
  defined so it's trivial to find and (eventually) delete once it stops
  mattering.
- Risk: higher. Touches most of the reporting module's core functions.
  Needs careful test coverage: a period that starts before the cutoff and
  ends after must produce the same COGS/profit as if it had started
  exactly at the cutoff. A period entirely before the cutoff (someone
  manually picks 8/14) should probably show either zero or an explicit
  "no data before opening" state — ask the user which, don't guess.
  Existing integration tests for the functions above (see
  `reporting/tests/`) will need new cases for "period spans the cutoff."
- **Is this even still needed once real trading has accumulated?** Once
  enough real days pass, a "This month" or "This year" report will
  naturally dilute 8/14's one-day artifact to near-invisibility on its
  own, without any code change. Worth asking the user whether this is a
  permanent rule or a temporary one they'd want removed later (e.g. "keep
  this until 2026-09-01, then take it out") — a permanent hardcoded
  cutoff date sitting in the codebase forever is a small but real form of
  technical debt if it's actually meant to be temporary.

## Recommendation to relay to the user, if asked

Shape A is very likely the safer, smaller, more honest option: it
keeps the real number available (nothing is hidden or misrepresented),
just doesn't put it in front of the owner by default. Shape B is more
literally what they asked for ("only consider... from tomorrow") and may
be worth it if the owner is expected to run broad date-range reports
(month/year) soon, where Shape A wouldn't help. Don't build either without
confirming which one the user actually wants — this doc lays out the
tradeoff, it doesn't resolve it.

## Out of scope

- No schema change, no new migration.
- Don't touch the stock-level/opening-balance mechanic itself (§1's
  closing→opening inheritance) — that's correct and load-bearing as-is.
- Don't touch production directly — build and test locally, confirm with
  the user, then ship through the normal `main`-merge pipeline
  (`docs/release.md`).
