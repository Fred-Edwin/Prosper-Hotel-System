# 28 — Day-close state and same-day-edit enforcement

**Type:** logic (test-first)
**Blocked by:** 27 (canteen handover — this ticket needs both locations'
handover recording to be real, since closing is defined by handover
being recorded)
**Status:** done

## Goal

Replace the same-day stopgap used by tickets 10, 13, 23, and 27 with a
real "closed" state, so post-close edits become owner-only instead of
silently still being allowed forever.

## Context

- proposal.md §8: "Same day, before close... no authorisation is
  required." / "After close of day. Amendments are restricted to the
  owner." Every ticket that touches an editable, dated entry already
  built its same-day rule "structured so the owner-only-after-close
  half can be added without reshaping this one" (see `.work/10-*.md`'s
  Out of scope, `.work/13-*.md`'s Out of scope, `.work/23-*.md`'s
  upsert-if-exists-today notes) — this ticket is that addition, not a
  redesign.
- **Definition of "closed" (confirmed with Edwinfred):** a person's day,
  at their location, is closed the moment their `Handover` for that day
  is recorded (ticket 13/27's `recordHandover`) — per-person, per-
  location, not a global end-of-day switch and not a separate explicit
  "close" action. `Handover` already carries `staffMemberId`,
  `locationId`, `occurredAt` (`prisma/schema.prisma` lines 396–411) —
  no new column needed to detect closure, only to enforce against it.
- Existing owner-check pattern: `requireOwner()` in
  `src/modules/cash/logic.ts` (line 35: `requester.staff.role ===
  "owner"`) — reuse this exact pattern rather than inventing a second
  one; `stock/logic.ts` checks role inline in several places (e.g. line
  374) using the same underlying rule.
- Entry points that currently apply the same-day stopgap and need to
  switch to the real check:
  - `voidSale` (`src/modules/sales/logic.ts`, ticket 10)
  - `recordHandover` actual-amount edits (`src/modules/cash/logic.ts`,
    tickets 13/27)
  - `recordTakings` same-day edit (`src/modules/cash/logic.ts`, ticket
    23)
  - Check `stock/logic.ts` for any other same-day-edit language from
    tickets 15/16/18/19/20 before assuming this list is exhaustive —
    grep for "same day" / "same-day" comments across `src/modules/`.

## Scope

**In:**
- A helper (e.g. `isDayClosedFor(staffMemberId, locationId, date)`) that
  reads whether a `Handover` row exists for that person/location/day —
  placed in `cash` (where `Handover` lives) and exported through
  `cash/index.ts` for the other modules to read, following the existing
  cross-module-read precedent (`stock → catalogue`, `stock → sales`).
- Every entry point listed above (and any other same-day-edit path found
  during the grep) checks this helper: if the day is closed for that
  staff member/location, the edit is rejected for non-owners with a
  clear `{ ok: false, reason: "day_closed" }`-shaped result; owners may
  still proceed (this ticket enables the check, not yet the owner's
  correction *mechanism* — see Out below).
- Route/UI error states updated to show "This day is closed — ask the
  owner" wherever the existing same-day edit actions live (void button,
  handover-edit form, takings-edit form) — reusing
  `components/patterns/states.tsx`'s permission-denied pattern, no new
  screen.
- `canAccessLocation()` continues to gate independently of this — a
  closed-day check is in addition to, not a replacement for, location
  access.

**Out:**
- The owner's actual correction mechanism (recording an effective-dated
  entry against a closed day) — moved to Stage 8 alongside the Ledger
  destination, per `docs/roadmap.md`'s Stage 5 revision note. This
  ticket only makes "closed" a real, enforced state; it does not yet
  give the owner a way to act on a closed day beyond what she could
  already do (record a new, forward-dated entry).
- Any UI for the owner to browse or search closed days — that's Ledger/
  Activity (Stage 8), not built here.
- Cross-location or whole-business "is the day closed" concept — closing
  is per-person, per-location, by design (matches how handovers already
  work).

## Acceptance criteria

- [x] `isDayClosedFor` returns true once a `Handover` exists for that
      staff member, location, and day; false otherwise (including for a
      different person or location on the same day).
- [x] After a handover is recorded, that staff member can no longer void
      a same-day sale, edit that day's takings, or edit their handover
      actuals, at that location — the action is rejected with a clear
      reason, not silently ignored.
- [x] The owner can still perform all of the above regardless of closed
      state (existing behaviour, confirmed unchanged).
- [x] A different staff member at the same location, same day, is
      unaffected by another person's closed handover — closing is
      per-person, not per-location-wide.
- [x] Before a handover is recorded, all existing same-day edit behaviour
      (tickets 10, 13, 23, 27) is unchanged — this is additive
      enforcement, not a rewrite of the existing rules.
- [x] **Screens:** the void action, handover-edit form, and takings-edit
      form each show a clear closed-day message when blocked — as inline
      destructive text next to the action, matching the existing
      submit-error pattern in each screen (not a whole-screen
      `PermissionDenied`, since the action stays visible and usable for
      other same-day attempts).
- [x] Storybook: extended `todays-sales.stories.tsx`, `handover.stories.tsx`,
      `takings.stories.tsx` with a `DayClosed` variant each, rather than
      new story files.

## Implementation notes

- `recordTakings`'s closed-check has no `staffMemberId` on `Takings` to key
  off — confirmed with Edwinfred to key off the *requester's own* handover
  (`isDayClosedFor(requester.staff.id, locationId, today)`), not
  location-wide, since closing is per-person by design.
- `reverseExpense`'s existing `not_same_day` check was confirmed out of
  scope — it's owner-only already, so a closed-day check is moot there;
  left untouched.
- `sales/logic.ts` now imports `isDayClosedFor` from `@/modules/cash`
  (new `sales → cash` cross-module read, alongside the existing
  `cash → sales` read in `computeExpected`). Verified no runtime circular
  import issue (tsc clean, full integration suite green).

## Verification

- Integration tests, test-first: `isDayClosedFor` against a constructed
  handover; each of the four entry points rejecting post-close for a
  non-owner and allowing it for the owner; per-person isolation
  (colleague's handover doesn't close your day).
- `pnpm lint`, `pnpm exec tsc --noEmit`.
- Manual check against `references/ui-rules.md` for the updated states.
- Grep `src/modules/` for other same-day language before finishing, to
  confirm the entry-point list above was exhaustive; update this ticket
  file if another one is found during implementation.
