@AGENTS.md

# Prosper Hotel

A stock, sales and cash system for a restaurant and canteen trading as one
business across two locations. Staff use their own phones mid-shift; the
owner reviews from a laptop. Replaces spreadsheets that already work — see
`docs/design.md`'s philosophy before touching UI.

## Where things are
- Domain vocabulary → `CONTEXT.md` (read before naming anything)
- Architecture and seams → `docs/architecture.md`
- Scope and out-of-scope → `docs/scope.md`
- Design intent → `docs/design.md`
- Hit something strange? → `docs/gotchas.md`
- Infra learnings (deploy, backups, rollback, Sentry) → `docs/architecture.md`
  under Environments/Observability

## Structure
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

## Module rules
- Cross-module imports go through the module's `index.ts` only. Never import
  another module's `queries.ts`/`logic.ts`/`schema.ts` directly.
- New module? Copy the shape of `src/modules/people/` or `src/modules/stock/`
  — auth/permissions and a movement-sum module respectively, both real.
- The six modules are fixed: `catalogue`, `stock`, `sales`, `cash`, `people`,
  `reporting`. See `docs/architecture.md` for what each owns.

## Code rules
- Errors: a route returns `Response.json({ error: reason }, { status })`;
  logic functions return a discriminated `{ ok: true, ... } | { ok: false,
  reason }` result rather than throwing for expected failure — see
  `stock/logic.ts` and `people/logic.ts`.
- Data access: `queries.ts` holds bare Prisma calls, `logic.ts` composes them
  and enforces rules (permissions, validation). Never call `db` from `ui/` or
  `routes.ts` directly.
- Location access: every location-scoped read/write calls
  `canAccessLocation()` from `people/index.ts` — see `stock/logic.ts` for the
  pattern. Never scope by hand.
- This Next.js version uses native `instrumentation.ts` /
  `instrumentation-client.ts` for Sentry, not the older config-file
  convention — check `node_modules/next/dist/docs/` before assuming an API,
  per `AGENTS.md`.

## Testing
- Integration tests against a real test database (`TEST_DATABASE_URL`).
  Never mock our own code. See `stock/tests/stock.integration.test.ts`.
- Integration test files run sequentially (`fileParallelism: false` in
  `vitest.config.ts`) — they share one DB and `LocationCode` only has two
  values, so parallel files racing to create/clean up rows collide.
- Test-first for logic (permissions, calculations), test-after for plumbing
  (routes, wiring). The ticket says which.
- Seams are the six module interfaces, listed in `docs/architecture.md`.
  Don't test at a seam that isn't there.
- E2E (Playwright, `e2e/`): critical paths only. `e2e/auth.setup.ts` logs in
  through the real `/login` page once and saves storage state — every other
  spec reuses it. Selectors use `data-testid` only, never text or CSS
  classes. No fixed waits.

## UI rules
- Compose from `components/ui/` and `components/patterns/`. Never add to
  either without asking.
- Every page opens inside a shell from `components/layout/` (admin or
  staff — the shell follows the task, not the role).
- If a needed pattern doesn't exist, STOP and ask. Don't invent one — see
  `docs/architecture.md`'s note on the stock-list screen for how that
  played out once.
- All values from theme tokens. No arbitrary values, no raw hex.
- One accent element per screen — the primary action. See
  `docs/design.md`'s Colour section before adding a second one.
- Every list/table needs empty (first-use and filtered are different),
  loading (skeleton, not spinner), error, and permission-denied states —
  compose from `components/patterns/states.tsx`.
- Every component gets a Storybook story covering its states.
- Never remove `focus-visible` styles or `aria-*` attributes.

## Working rules
- Stop and ask rather than guessing, especially at a genuine branch point
  (a design gap, an ambiguous permission rule, anything touching real
  infrastructure).
- Solved something non-obvious that cost real time? Add it to
  `docs/gotchas.md`.
- Never write to `CONTEXT.md` unless asked.
- Anything touching real infrastructure (droplet, DNS, GitHub secrets,
  production deploys) — confirm scope with the user first.

## Commands
`pnpm dev` · `pnpm test` (integration) · `pnpm test:e2e` · `pnpm lint` ·
`pnpm exec tsc --noEmit` · `pnpm build` · `pnpm seed` · `pnpm storybook` ·
push to `main` deploys automatically

## Never
- Commit directly to `main`
- Add a dependency without asking
- Create a new top-level folder
- Build a feature beyond what the current ticket asks for
