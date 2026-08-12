# 50 — Wire HelpPanel into the admin shell's page header

**Type:** plumbing (test-after)
**Blocked by:** None — `HelpPanel` and its `helpContent` map are already
built and approved (`docs/screens.md`'s `Patterns/HelpPanel` row).
**Status:** in-progress (claimed by build session, 2026-08-12)

## Goal

Every admin destination shows a working "?" help trigger in its page
header, opening the correct approved content for that page.

## Context

- Pattern: `src/components/patterns/help-panel.tsx`,
  `src/components/patterns/help-content.ts` — already built, do not
  redesign or redraft content.
- `src/components/layout/headers.tsx`'s `PageHeader` already exposes an
  `actions?: React.ReactNode` prop, rendered top-right, passed through
  from `AdminShell`'s `...headerProps`
  (`src/components/layout/admin-shell.tsx`). No admin page currently
  uses this slot — confirmed by grep, zero existing `actions=` usages.
  This ticket is the first to use it.
- The seven destination files, each rendering `<AdminShell title="...">`:
  - `src/app/dashboard/dashboard-page-client.tsx` → topic `"dashboard"`
  - `src/app/ledger/ledger-page-client.tsx` → topic `"ledger"`
  - `src/app/stock/stock-page-client.tsx` → topic `"stock"`
  - `src/modules/cash/ui/money-out-destination.tsx` → topic `"money-out"`
  - `src/app/people/people-page-client.tsx` → topic `"people"`
  - `src/app/catalogue/catalogue-page-client.tsx` → topic `"catalogue"`
  - `src/app/activity/activity-page-client.tsx` → topic `"activity"`
- Each topic key above already exists in `help-content.ts` with the
  correct sectioned content (Catalogue, Ledger, and People each carry
  all their tabs' content in one entry — confirmed content, don't
  re-derive).

## Scope

**In:**
- Pass `<HelpPanel topic="..." />` as the `actions` prop on all seven
  admin destination files, using the topic keys listed above.
- No `bottomOffset` needed — admin shell has no bottom-anchored primary
  action convention.

**Out:**
- Staff shell wiring (ticket 51 and 52).
- Any change to `HelpPanel`, `help-content.ts`, or `PageHeader` itself —
  this ticket only consumes the existing `actions` slot.
- The `/stock/count` sub-page (reached from Stock, not itself one of the
  seven nav destinations) — out of scope here, folded into ticket 52 if
  it needs its own trigger (it shares Stock's staff-side counterpart).

## Acceptance criteria

- [ ] Each of the seven admin destinations shows a "?" icon top-right of
      its page header.
- [ ] Tapping it opens the slide-over (desktop width) with that
      destination's correct `help-content.ts` entry — verify Catalogue,
      Ledger, and People each show all their tabs' sections in one
      scroll, not just the currently-selected tab's.
- [ ] Below the mobile breakpoint (768px), the same trigger opens a
      bottom sheet instead — confirm this still works from within the
      admin shell's own mobile degradation (per `docs/design.md`'s
      "Mobile" section — admin shell degrades, it doesn't become a third
      shell).
- [ ] No existing page-level action or layout shifts as a result of
      adding the slot (there are none yet, but confirm `actions` renders
      cleanly against `PageHeader`'s existing layout).

## Verification

- `pnpm lint`, `pnpm exec tsc --noEmit`.
- Manual check in the browser: each of the seven pages, both viewport
  widths, confirm correct topic content per page.
- No test suite changes expected — this is pure composition of two
  already-tested/approved pieces (`PageHeader`'s slot, `HelpPanel`
  itself); nothing here has new branching logic to unit test.
- `docs/screens.md` unchanged — no new destination or story, existing
  `Patterns/HelpPanel` row already covers the component.
