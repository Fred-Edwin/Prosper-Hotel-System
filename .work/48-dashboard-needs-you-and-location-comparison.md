# 48 — Dashboard "Needs you" and "By location"

**Type:** logic (test-first)
**Blocked by:** 46 (Location comparison reads per-location profit, which
46 builds)
**Status:** planned

## Goal

Replace the Dashboard's "Needs you" and "By location" cards'
`SectionNotBuilt` placeholders with real content: an exceptions list the
owner should act on, and a restaurant-vs-canteen performance comparison.

## Context

- Design precedent: `~/prosper-hotel-design-reference/src/components/design/dashboard/sections.tsx`'s
  `Exceptions` and `LocationComparison`. Read both fully before building
  — `Exceptions` combines three source types (handover shortfalls,
  pending expenses, voided sales) into one list; `LocationComparison` is
  a per-location profit table/stacked-card view, matching the shape
  `docs/design.md`'s Ledgers-and-tables section describes.
- Current placeholders: `src/app/dashboard/dashboard-body.tsx`'s "Needs
  you" and "By location" `Card`s — swap `SectionNotBuilt` for real
  content, position/chrome already locked per that file's comment.
- **The reference's "pending expense" exception has no equivalent in this
  codebase.** `Expense` (`prisma/schema.prisma`) has no `status`/pending
  concept — expenses are recorded directly, not submitted for
  confirmation. Drop that source from `Exceptions` rather than inventing
  a pending-approval workflow proposal.md never asked for; confirm this
  reading with Edwinfred before building if it seems like a real gap
  rather than a deliberate simplification.
- Handover shortfalls: reuse the existing handover-comparison logic
  (`cash`'s handover recording, ticket 13/27) rather than re-deriving
  expected-vs-actual.
- Voided sales: `Sale.voided`/`voidedAt`/`voidedBy` already exist
  (ticket 10) — query today's voids directly.
- Location comparison: reuse ticket 46's per-location profit split
  directly — this card is a thinner rendering of the same data ticket 46
  already computes, not a new calculation.

## Scope

**In:**
- A `getExceptions` reporting function: today's handover shortfalls
  (cash and/or M-Pesa actual ≠ expected) and today's voided sales, each
  with enough detail to act on (who, where, amount, reason). Owner-only.
- Wiring "Needs you" to this data — a zero-state ("Everything agreed
  today. Nothing needs you.") when there's nothing to show, matching the
  reference.
- Wiring "By location" to ticket 46's per-location profit split —
  restaurant vs. canteen revenue, cost of goods, gross profit, running
  costs, net profit, margin, with the canteen's provisional marking
  carried through.
- Loading and error states for both cards.

**Out:**
- Pending-expense confirmation as an exception source — no such concept
  exists yet, see Context above.
- Any action buttons' actual behavior ("Look into it", "View") beyond
  linking to where that record already lives (e.g. Activity for a void,
  the handover screen for a shortfall) — building new confirmation flows
  behind these buttons is out of scope; a link to the existing screen is
  enough.
- A third+ location — comparison is restaurant vs. canteen only, matching
  every other two-location assumption in this codebase.

## Acceptance criteria

- [ ] "Needs you" lists today's handover shortfalls and voided sales,
      with the zero-state shown when there are none, for a constructed
      fixture with each source type present and absent.
- [ ] "By location" shows restaurant and canteen figures side by side
      (or stacked on narrow screens, matching the reference's `stacked`
      variant), reconciling with ticket 46's combined total.
- [ ] Canteen's provisional marking appears in the location comparison,
      consistent with its treatment everywhere else in this codebase.
- [ ] Both cards are owner-only, same gate as the rest of the Dashboard.
- [ ] Storybook stories: "Needs you" — populated (all source types),
      empty, loading, error. "By location" — populated, loading, error.

## Verification

- Integration tests, test-first: `getExceptions` against a constructed
  fixture with a handover shortfall, a voided sale, and neither (zero
  state); location comparison reconciling with ticket 46's combined
  total for a constructed multi-location fixture.
- `pnpm lint`, `pnpm exec tsc --noEmit`.
- Manual check against `references/ui-rules.md`.
- Update `docs/screens.md` only if the story files' states materially
  change (no new destination to add).
