# 05 — Staff nav placeholders, and a real post-login default route

**Type:** plumbing (test-after)
**Blocked by:** 04 (introduces the shared `NotBuilt` state this ticket reuses)
**Status:** done

## What this delivers

`staff-page-client.tsx` only handles the `stock` key from `staffNav` —
every other link a role has (`sell`, `takings`, `handover`, `receive`,
`issue`, `count`, `wastage`, depending on role) renders nothing when
tapped. This ticket wires every remaining `staffNav` entry to the shared
`NotBuilt` state from ticket 04, so every link in every role's launcher
does something honest when tapped.

Separately: since Catalogue was the only built admin destination, the
post-login redirect currently sends admin-capable roles to `/catalogue`
as a stopgap — but Catalogue is owner-only, and now that `/dashboard`
exists (ticket 04) it's the correct landing page per design.md ("Admin
has seven destinations... Dashboard" is the default zoom level). This
ticket fixes the redirect so admin-capable roles land on `/dashboard`,
and `/catalogue` becomes a normal nav destination, reachable only via the
nav, no longer a landing page.

Together, these mean: log in as any role, on staff or admin, and every
nav link goes somewhere real — either working functionality or an honest
placeholder — with nothing 404ing or rendering blank.

## Lifecycle

No new record type. `NotBuilt` is reused from ticket 04 — no new
create/read/update/delete/undo surface.

## Acceptance criteria

- [ ] Every `staffNav` link for every role (`cashier`, `store-manager`,
      `attendant`) renders `NotBuilt` when tapped, except `stock`, which
      keeps its existing real `StockList`.
- [ ] `NotBuilt`'s body names the specific task (e.g. "New sale isn't
      built yet"), not a generic placeholder message.
- [ ] The post-login redirect (wherever session establishment currently
      decides the landing route) sends admin-capable roles to
      `/dashboard`, not `/catalogue`.
- [ ] `/catalogue` no longer needs to be reachable directly after login —
      it's reachable via the admin nav like every other destination, and
      its existing owner-only route gating is unchanged.
- [ ] Staff-only roles still land on `/staff` as before — this ticket
      does not change staff routing, only admin's default.

## Out of scope

- Building any of the placeholder staff tasks for real (sell, takings,
  handover, etc.) — those land in their own roadmap stages.
- Changing which roles count as "admin-capable" — uses whatever
  distinction already exists in the session/auth code.
- Any change to `/catalogue`'s own permission gating.
