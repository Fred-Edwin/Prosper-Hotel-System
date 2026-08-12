# 51 — Add an actions slot to the staff shell header

**Type:** plumbing (test-after)
**Blocked by:** None
**Status:** done

## Goal

The staff shell's task header can render a page-level action (starting
with the HelpPanel trigger), the same way the admin shell's `PageHeader`
already can.

## Context

- `src/components/layout/staff-shell.tsx`'s `StaffShellHome` renders
  each task's header (back-chevron, title from `activeLink.label`,
  subtitle, sign-out) with **no actions/right-side slot at all** —
  confirmed by reading the component; unlike
  `src/components/layout/headers.tsx`'s `PageHeader` (admin), there is
  no equivalent prop here today.
- `src/components/layout/staff-nav.ts` is where each task's nav entry
  (and its `label`) is defined — `active` key ↔ `helpContent` topic key
  mapping will matter for ticket 52, not this one.
- This ticket only adds the slot and its rendering; it does not wire any
  specific screen's content (that's ticket 52).

## Scope

**In:**
- Add a `right?: React.ReactNode` (or `actions?`, match `PageHeader`'s
  naming for consistency) prop to `StaffShellHome`, rendered in the
  header row alongside the existing back-chevron/title/sign-out
  elements — top-right, consistent with the admin shell's placement per
  the approved design decision (`docs/scope.md`'s HelpPanel entry:
  "top-right of the page header, both shells").
- Thread this prop through from wherever `StaffShellHome` is invoked
  (`src/app/staff/staff-page-client.tsx`) so each task screen can pass
  its own content once ticket 52 wires it in.

**Out:**
- Actually passing `<HelpPanel />` into the new slot for any specific
  screen — that's ticket 52.
- Any change to the admin shell (`headers.tsx`/`admin-shell.tsx`) —
  already has this capability.
- Changing the staff header's existing back-chevron/sign-out behavior.

## Acceptance criteria

- [x] `StaffShellHome` accepts an optional right-side content prop and
      renders it top-right of the task header when provided.
- [x] When not provided (every existing call site, until ticket 52
      lands), the header renders exactly as it does today — no visual
      regression.
- [x] The slot is reachable from `staff-page-client.tsx`'s per-task
      rendering, so a future ticket can pass different content per
      active task.
- [x] Storybook story for `StaffShellHome` (or the existing
      `Shells/StaffShell` story) covers the header both with and without
      the new slot populated.

## Verification

- `pnpm lint`, `pnpm exec tsc --noEmit`.
- Manual check: staff shell, any task, header renders unchanged with
  the slot empty; a throwaway test node in the slot confirms placement
  and that it doesn't crowd the back-chevron/title on narrow viewports.
- No integration test needed — pure UI plumbing, no branching logic.
