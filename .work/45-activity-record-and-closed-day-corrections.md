# 45 — Activity record and amending a closed day

**Type:** logic (test-first)
**Blocked by:** 28 (day-close state — this ticket builds the correction
mechanism that ticket 28 deliberately deferred; needs `isDayClosedFor`
and the closed-day enforcement it added)
**Status:** done

## Goal

Give the owner a real Activity destination — every action across the
business, filterable by person and date — and the means to correct a
closed day's sale without editing the original: a backdated correction
entered today but effective on the day it corrects, visible in that same
trail as the one action type where "when it happened" and "when it was
recorded" genuinely differ.

## Context

- **This is the last deferred piece of two earlier decisions**, now
  landing together because they're the same mechanism seen from two
  sides: `docs/roadmap.md`'s Stage 5 note moved "amending a closed day"
  here because its natural home is Ledger/Activity; ticket 28's Out of
  scope deferred "the owner's actual correction mechanism" here for the
  same reason, having already built the `isDayClosedFor` enforcement this
  ticket now gives an owner-facing outlet for.
- **The mechanism, stated precisely in `docs/architecture.md`'s Data
  lifecycle section** ("Changing a closed day"): the owner does not edit
  closed figures — she records a *new entry that carries an effective
  date in the past*, with a reason and attribution. The closed day keeps
  its original numbers. "**Every entry carries two dates: effective and
  entered.** Normally identical. For a correction they differ, and that
  gap is the information." Both proposal.md §8 and §9 restate this from
  the correction side and the audit-trail side respectively — read both
  before building, they're two views of one rule.
- **proposal.md §8's own example is the scope-setter:** "a closed day is
  later found to omit a sale... recorded as a correction effective on
  that day and entered on the date it was identified. Current stock is
  adjusted accordingly." Build the general mechanism, but wire it into
  **`sales` only** in this ticket — that's the concrete case proposal.md
  names, and a sale's existing stock-decrement path already gives "stock
  adjusted accordingly" for free once the correction creates a real
  (backdated) sale. Extending backdated correction to takings, handovers,
  or expenses is explicitly future work (see Out below), not silently
  assumed here.
- Design precedent, already through review in the reference worktree:
  `~/prosper-hotel-design-reference/src/components/design/activity/page.tsx`
  — the full Activity table (recorded/effective-date columns with the
  backdated row highlighted, kind badge with corrections/voids given
  visual weight over other kinds, person/kind filters, search including
  the reason text, pagination "1–50 of 1,284" rather than infinite
  scroll, inline reason text rather than hover-only). Nav entry
  (`active="activity"`) and page shell (`src/app/activity/page.tsx`,
  currently `NotBuiltPageClient`) already exist — swap the placeholder,
  don't add a new route.
- **What already has a "who/when" to surface, no new field needed:**
  every existing movement/sale/handover/takings/expense record already
  carries `staffMemberId` (or equivalent) and a timestamp — the Activity
  table's baseline rows (non-correction) are read-only composition over
  what already exists, via each module's `index.ts`. Corrections
  (void, ticket 10/28's cancellation) already carry who/when too
  (`Sale.voidedBy`/`voidedAt`) — surface these as their own `kind`,
  matching the reference's warning-coloured badge treatment for
  `correction`/`void`.
- **What's genuinely new:** `Sale` has no `effectiveAt` distinct from
  `occurredAt`, and no correction-linkage field. Add both: an
  `effectiveAt` column (defaults to `occurredAt` for every existing and
  ordinarily-recorded sale — normally identical, per architecture.md), and
  a way to mark a sale as a correction (reason text, and which day it
  corrects — `effectiveAt` already carries that once set explicitly).
- Owner-only for recording a correction, matching every other owner-only
  write in this codebase (`requireOwner()` pattern in `cash/logic.ts`).
  Reading Activity is also owner-only, per the design reference's
  `PermissionDenied` copy ("the full trail across the business is
  restricted to Lucy").

## Scope

**In:**
- `Sale.effectiveAt` (defaults to `occurredAt`), and correction
  attribution fields (reason, and a flag/relation marking it as a
  backdated correction rather than an ordinary sale).
- A `recordSaleCorrection` (or equivalent) logic function: owner-only,
  creates a new `Sale` with `occurredAt` = now, `effectiveAt` = the
  backdated date, a required reason, decrementing stock exactly as an
  ordinary sale does (reuse the existing sale-recording stock-movement
  path, don't fork it). The corrected day's original sale(s) are
  untouched — this is additive, never a mutation of the original.
- A `getActivity` reporting function: given optional person/kind/date-
  range filters and pagination, returns one row per action across
  `sales` (including voids and corrections), `stock` (wastage/
  consumption/complimentary/counts), `cash` (handovers, takings,
  expenses, repayments), `people` (days worked) — recorded-at,
  effective-at, kind, who, what, where (location), amount where
  applicable. Reads through each module's `index.ts` only.
- The Activity page: real data replacing `NotBuiltPageClient`, matching
  the reference's table, filters, search (including reason text), and
  pagination.
- A minimal UI for the owner to record a sale correction — reachable from
  Activity or the Product ledger (wherever fits without inventing a new
  destination; a small form/dialog, not a new page).
- Corrections appear in Activity with the effective/entered gap
  highlighted, matching the reference's warning treatment.

**Out:**
- Backdated correction for takings, handovers, expenses, or any entry
  type other than sales — proposal.md's own example is sales-only; adding
  the mechanism elsewhere is a follow-on ticket once this one proves the
  pattern, not assumed here.
- Export button — visible per the reference, left as a disabled/no-op
  control with a tooltip, same call as ticket 38 made for the Ledger's
  export button.
- Written-off debts, price amendments as their own recordable action —
  proposal.md §9 lists them as activity-trail *content*, but they're
  already recordable through `people`/`catalogue`'s existing forms; this
  ticket surfaces them in the trail if they already carry who/when, it
  does not build new write paths for them.

## Acceptance criteria

- [x] The owner can record a correction to a specific closed day's sales:
      it appears as a new `Sale` with today's `occurredAt`, the backdated
      `effectiveAt`, a required reason, and adjusts current stock exactly
      as an ordinary sale would.
- [x] The original closed day's sales are unchanged — querying that day's
      historical figures still returns exactly what was recorded then.
- [x] A non-owner cannot record a correction (route-level check).
- [x] Activity lists every action type in scope (sales, voids,
      corrections, wastage/consumption/complimentary, counts, handovers,
      takings, expenses, repayments, days worked) with who, when
      recorded, when effective, and where, for a constructed multi-
      person, multi-location fixture.
- [x] A correction's row visually distinguishes itself (effective date ≠
      entered date, highlighted) from an ordinary same-day entry.
- [x] Filtering by person and by date range narrows correctly and
      combines; search matches on description/reason text.
- [x] Pagination works correctly past one page (construct a fixture with
      more than one page's worth of rows).
- [x] Non-owner roles are redirected/denied, matching the existing
      `/activity` page gate.
- [x] Storybook story for the Activity page: populated (including a
      correction row), loading, empty (first use), permission-denied,
      filtered-empty; and for the correction-recording UI: form, and its
      validation (reason required).

## Verification

- Integration tests, test-first: `recordSaleCorrection` (stock
  adjustment, original day untouched, reason required, owner-only) and
  `getActivity` (composition across modules, filter/search/pagination
  correctness, correction rows correctly flagged) against constructed
  fixtures.
- `pnpm lint`, `pnpm exec tsc --noEmit`.
- Manual check against `references/ui-rules.md`.
- Add the new story to `docs/screens.md`'s Reporting section (or a new
  Activity section if that reads better once built).
