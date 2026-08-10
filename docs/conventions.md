# Conventions — Prosper Hotel

The checkable rules `/build`, `/review`, and `/tickets` enforce. This file
is the expansion of `CLAUDE.md`'s Module rules / Code rules / UI rules
sections — `CLAUDE.md` stays the terse always-loaded summary; this is
where a skill points for the full version and worked examples.

## Folder structure: feature-first, not layer-based

```
src/modules/<feature>/   feature-first. Each owns schema, queries, logic,
                         routes, ui/, tests/. index.ts is the interface.
src/shared/              db client, auth session helper, test DB client.
                         Cross-cutting only.
components/ui/           shadcn primitives. Do not add to this.
components/patterns/     page templates — record table, detail page, form,
                         summary strip, states. Do not add to this.
components/layout/       the two shells (admin, staff) — nav, header, frame.
```

The six modules are fixed: `catalogue`, `stock`, `sales`, `cash`, `people`,
`reporting`. See `docs/architecture.md`'s "Modules" and "Seams" sections
for what each owns and how they're allowed to talk to each other. Don't
add a seventh.

**Canonical worked examples**, not a hand-crafted reference module:
`src/modules/people/` (auth/permissions) and `src/modules/stock/`
(a movement-sum module). Copy their shape for any new module.

## The promotion rule (module → shared)

Something moves from a module into `src/shared/` only once a second module
needs it unchanged. One module's private helper does not get promoted
speculatively. `src/shared/` today holds only the db client, the auth
session helper, and the test DB client — cross-cutting infrastructure, not
a dumping ground.

## Cross-module imports

Go through the module's `index.ts` only. Never import another module's
`queries.ts`, `logic.ts`, or `schema.ts` directly — `index.ts` is the
entire public interface. If something a module needs isn't exported from
another module's `index.ts`, that's a signal to add it there deliberately,
not to reach past it.

## Error handling

- A route returns `Response.json({ error: reason }, { status })`.
- A logic function returns a discriminated `{ ok: true, ... } | { ok:
  false, reason }` result rather than throwing, for expected failure.
  See `src/modules/stock/logic.ts` and `src/modules/people/logic.ts`.
- Reserve thrown exceptions for genuinely unexpected failure (a bug, an
  invariant violation) — not for validation or permission failures a
  caller should handle.

## Data access

`queries.ts` holds bare Prisma calls only — no branching, no permission
checks. `logic.ts` composes those queries and enforces rules (permissions,
validation, cross-field checks). Never call `db` from `ui/` or
`routes.ts` directly — always through a module's `logic.ts`.

## Location scoping

Every location-scoped read or write calls `canAccessLocation()` from
`src/modules/people/index.ts`. See `src/modules/stock/logic.ts` for the
pattern. Never scope by hand (e.g. comparing `location` fields directly)
— `canAccessLocation()` is the single enforcement point and the thing a
future permission change only has to edit once.

## Rule-of-three for reuse

Two similar implementations can stay separate. A third occurrence of the
same shape is the signal to extract a shared pattern — not before (that's
premature abstraction) and not after (that's accumulated duplication a
review should catch).

## Testing

- Integration tests run against a real test database (`TEST_DATABASE_URL`)
  — never mock our own code. See
  `src/modules/stock/tests/stock.integration.test.ts`.
- Integration test files run sequentially (`fileParallelism: false` in
  `vitest.config.ts`) — they share one database and `LocationCode` only
  has two values, so parallel files racing to create/clean up rows would
  collide.
- Test-first for logic (permissions, calculations); test-after for
  plumbing (routes, wiring). The ticket states which applies.
- Seams are the six module interfaces (`docs/architecture.md`'s "Seams"
  section). Don't write a test at a seam that isn't one of those six.
- E2E (Playwright, `e2e/`): critical paths only. `e2e/auth.setup.ts` logs
  in once through the real `/login` page and saves storage state; every
  other spec reuses it. Selectors use `data-testid` only — never text or
  CSS classes. No fixed waits.

## UI

- Compose from `components/ui/` (shadcn primitives) and
  `components/patterns/` (page templates). Never add to either without
  asking first.
- Every page opens inside a shell from `components/layout/` — admin or
  staff, chosen by the task, not the role performing it.
- If a needed pattern doesn't exist, stop and ask. Don't invent one ad
  hoc — see `docs/architecture.md`'s note on the stock-list screen for
  what happened the one time this wasn't followed.
- All values come from theme tokens. No arbitrary values, no raw hex.
- One accent element per screen — the primary action. See
  `docs/design.md`'s Colour section before adding a second one.
- Every list/table needs empty (first-use and filtered are distinct
  states), loading (skeleton, not spinner), error, and permission-denied
  states — compose from `components/patterns/states.tsx`.
- Every component gets a Storybook story covering its states.
- Never remove `focus-visible` styles or `aria-*` attributes.
- Full checkable rule list: `.claude/skills/references/ui-rules.md`.

## Screens and Storybook

There is no separate `docs/screens.md` inventory in this project — the
screen inventory lives as the set of `.stories.tsx` files alongside their
components (`pnpm storybook` to browse). A screen is "approved" once its
story exists and passes `/design` or `/build`'s per-screen checklist; there
is no separate sign-off ledger to keep in sync with it.

## Next.js version note

This Next.js version uses native `instrumentation.ts` /
`instrumentation-client.ts` for Sentry, not the older config-file
convention. Check `node_modules/next/dist/docs/` before assuming any API
from training data, per `AGENTS.md` — this applies beyond just Sentry.
