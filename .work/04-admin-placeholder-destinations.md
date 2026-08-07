# 04 — Admin shell: a real route for every destination

**Type:** plumbing (test-after)
**Blocked by:** None

## What this delivers

Ticket 03 wired the Catalogue destination end-to-end and, as a byproduct,
ported the full component library into this repo (`components/ui/`,
`components/patterns/`, both shells, both nav lists). But the admin nav
(`components/layout/admin-nav.ts`) lists seven destinations and only
Catalogue has a page — clicking Dashboard, Ledger, Stock, Money out,
People, or Activity currently 404s.

This ticket makes every admin destination a real route: real session
check, real `AdminShell` wiring with the correct `active` key, and a
body. Where the underlying module has nothing built yet (Dashboard,
Ledger, Money out, People, Activity — all later roadmap stages), the body
is the new `NotBuilt` state. Stock is the one exception worth a real
look: `stock/index.ts` already exposes `getCurrentStockAtLocation()` from
the tracer slice, so this ticket may wire a genuine minimal admin stock
view (on-hand quantities, no cost/value columns, no filters/toolbar) if
that fits from existing primitives without inventing new UI — otherwise
it gets `NotBuilt` like the rest. Decide once building, don't guess here.

The point: the owner can open every nav link, on the deployed site, and
see either working functionality or an honest "not built yet" — never a
404 or a blank page.

## Lifecycle

No new record type. `NotBuilt` is a stateless display component, not
data — no create/read/update/delete/undo applies.

## Acceptance criteria

- [ ] `components/patterns/states.tsx` gains a `NotBuilt` component,
      visually distinct from `EmptyFirstUse` (different icon and/or
      tone), so a genuinely empty built screen is never confused with an
      unbuilt one. Has a Storybook story.
- [ ] `/dashboard`, `/ledger`, `/money-out`, `/people`, `/activity` each
      have a route: real `getSession()` check, redirect to `/login` if
      absent, `AdminShell` with the correct `active` destination key, and
      a `NotBuilt` body naming the destination.
- [ ] `/stock` has a route wired the same way. Its body is either a real
      minimal on-hand view (reusing `getCurrentStockAtLocation` through
      `stock/index.ts`, never `stock/queries.ts` or `stock/logic.ts`
      directly) or `NotBuilt`, whichever the ticket determines fits
      without inventing UI beyond existing primitives.
- [ ] Every route enforces whatever role gating design.md/architecture.md
      already establish for that destination (e.g. owner-only where
      catalogue-style data is owner-gated); where no gating has been
      decided yet, the route is reachable by any authenticated
      admin-capable role and that's noted as a stopgap, not decided here.
- [ ] Non-owner/non-permitted roles hitting a gated route see
      `PermissionDenied`, not a redirect that hides the reason.
- [ ] No destination 404s from the admin shell nav.

## Out of scope

- Any real logic, schema, or data for Dashboard, Ledger, Money out,
  People, or Activity — those land in their own roadmap stage.
- Deciding per-destination role gating beyond what's already established
  — if a destination's audience is genuinely undecided, flag it rather
  than inventing a permission rule.
- The staff shell (ticket 05).
- Changing the post-login default route (ticket 05).
