---
name: foundation
description: Build the project skeleton — feature-first folders, database, auth, test harness, Storybook, seed data, deploy pipeline — plus one real end-to-end slice, then write CLAUDE.md. Run once per project after Planning and Design System.
disable-model-invocation: true
---

# Foundation

**Make the first Build ticket boring.**

Whatever isn't decided here gets decided by an agent mid-ticket, differently each time. That is the actual mechanism behind inconsistent architecture — not that agents write bad code, but that they answer structural questions nobody answered, forty times, inconsistently.

Read `<skills>/reference/MODULES.md` and `<skills>/reference/TESTING.md`.

**Resolving `<skills>/`.** It is the directory holding the skill folders — `~/.claude/skills/` for a global install, or `<project>/.claude/skills/` for a per-project one. **It is not inside this skill's own folder, and it is not in the project root.** Check the global path first, then the project-local one.

**If a reference file cannot be found, stop and tell the user.** Do not proceed from memory — these files hold the discipline the skill depends on, and running without them silently produces work that looks right and isn't.

## Before starting

Read `CONTEXT.md`, `docs/architecture.md`, `docs/scope.md`, `docs/design.md`, and any ADRs. Everything here implements decisions already made.

Walk the ten items **in order** — each depends on the last. Confirm with the user at any genuine branch point; don't ask about things Planning already settled.

---

## 1. Repo, project init, `CLAUDE.md` skeleton

Initialise. Set up the linter, formatter, and typechecker. Create a placeholder `CLAUDE.md` — it gets written properly at the end.

## 2. Folder structure — feature-first

Mirror the module boundaries from `docs/architecture.md`.

```
src/
├── modules/
│   ├── <module>/
│   │   ├── index.ts      ← THE INTERFACE. The only importable file
│   │   ├── schema.ts
│   │   ├── queries.ts
│   │   ├── logic.ts
│   │   ├── routes.ts
│   │   ├── ui/
│   │   └── tests/
│   └── …
├── shared/               ← db client, auth, errors, logging
└── components/
    ├── ui/               ← shadcn primitives
    ├── patterns/         ← page templates: record table, detail page, form,
    │                        summary strip, the five states
    └── layout/           ← the app shell(s) — nav, header, content frame
```

**Module names come from `CONTEXT.md`**, not from technical roles. `billing/`, not `controllers/`.

**`components/patterns/` and `components/layout/` are migrated from Design, not written fresh.** If `docs/design.md` names them, they already exist under `src/components/patterns/` and `src/components/design/<shell>/` in the design branch — move them, don't reinvent them. See step 6.

**Add a lint rule banning deep cross-module imports** — `modules/*/…` may only be imported via `modules/*/index.ts`. The boundary must be enforced by tooling; discipline erodes.

Only `shared/` for genuine cross-cutting infrastructure used by nearly everything. If two modules need something, it usually belongs to one of them.

## 3. Database, schema, migration tooling

One real table, one real migration. **Test the rollback once.**

Apply the Group B data-lifecycle decision — if records are soft-deleted with an audit trail, that shape goes into the schema now, not later.

## 4. Data access layer

The pattern every later query copies. Keep it inside modules; `shared/` holds only the client and connection.

## 5. Auth and permissions

The Group B identity decision, made real. **Before UI, because auth shapes every route.**

Roles and permission checks working end to end, not stubbed.

## 6. App shell and page templates

**Migrate, don't rebuild.** Design already produced these under
`src/components/design/` on the design branch — `components/patterns/` is
already populated (record table, detail page, form, summary strip, the five
states) and each shell already exists (e.g. `shell/admin-shell.tsx`,
`staff/shell-home.tsx`). Move the pattern files to `components/patterns/` and
each shell to `components/layout/` unchanged, then wire them to real routing
and real data.

**What does not survive the move:**
- Fixture data (`@/lib/fixtures`) — replaced by the real data access layer
- Variant and state switchers, and anything gated on
  `process.env.NODE_ENV === "production"` — those were judgment tools for a
  human comparing options, not app code
- The destination bodies under `components/design/<destination>/` (dashboard,
  ledger, stock, money-out, people, catalogue, activity, till) — their
  *content* becomes the first screen of the matching module in step 2 onward,
  built against the real schema. Only the shell and the patterns they
  composed are reusable as-is.

Confirm every destination still renders through the real shell before moving
on — a page that only ever worked against fixture data has not actually been
migrated.

## 7. Test harness

Running, with **one exemplar test of each kind that will be used**:

- **Integration** against a real test database — the default and the majority
- **Unit** — only if there's genuinely tricky pure logic
- **One E2E** through Playwright

Exemplars, not coverage. **The first test of any kind is ten times harder than the rest** — if tickets have to invent test setup, they skip tests. That friction, not reluctance, is why TDD fails to take hold.

**Write the confirmed seam list into `docs/architecture.md`** if `/plan` didn't already.

## 8. Storybook

Configured and running, with stories for the primitives already added. Each story covers the component's states: default, hover, disabled, loading, error, empty.

**Add it now.** Retrofitting stories across forty components is a slog; writing one alongside each new component is nothing.

## 9. Seed data

One command — `pnpm seed` or equivalent.

- Several users **of each role**, so "log in as a manager and check they can't see this" is a login, not a setup project
- A few hundred rows of realistic data — real names, real dates, real messiness
- **Deliberate edge cases**: a 200-character name, a record with nulls, a customer with zero related records, one with 400

**This is what makes manual testing actually happen.** The reason it gets skipped is friction — an empty database means clicking through signup and setup before you can look at what you built. Rich seed data means the app is always in a state where you can just look at it.

Secondary benefit: edge cases stay permanently in view. The long name breaking a column shows up on day three, not month four.

## 10. Ship setup

All five, plus the Playwright preconditions.

- **Deploy on merge to main**, automatically. Any manual step gets skipped when busy
- **Preview deploys** — apply the decision from Planning Group B. If the stack is split across hosts, the resolved option goes here
- **Rollback: one command, and test it once.** This is what makes deploying unscary. Untested rollback is a plan, not a capability
- **Error tracking and uptime monitoring, live.** Without them, bugs arrive as a client phone call
- **Backups configured, and one restore tested.** An untested backup is a belief

**Migrations run automatically on deploy and must be backward-compatible** — a migration must never break the currently-running code, because rollback doesn't undo a migration.

### Playwright preconditions for `/verify`

Three things, because they eliminate the three standard causes of flaky browser tests:

- **Saved auth state** — a setup script logs in once and saves browser state; every test reuses it. One broken login must never produce forty failures
- **`data-testid` convention documented** — tests target these, never CSS classes or visible text
- **No fixed waits** — always wait for a condition. Most flakiness is fighting the auto-waiting

---

## Then: the tracer slice

Build **one real feature end to end**. Typically: log in, see a list of something from the real database.

Through every layer — schema, data access, route, UI, test — deployed and live.

**This is not a ticket.** It establishes the pattern that every ticket copies.

## Then: write `CLAUDE.md`

**Target under 150 lines.** It's read every session, so length is a direct tax.

**It contains only what an agent cannot work out by reading the code.**

Four rules:
- **Point, don't repeat** — say *where* the glossary is, not what's in it
- **Prohibitions are cheaper than instructions** — "never invent a component" is one line and closes a whole category of drift
- **Point at exemplars** — "copy the shape of `src/modules/billing/`" beats describing the shape
- **Delete anything the linter enforces**

```markdown
# <Project>

<one paragraph: what this is, who uses it>

## Where things are
- Domain vocabulary → CONTEXT.md (read before naming anything)
- Architecture and seams → docs/architecture.md
- Scope and out-of-scope → docs/scope.md
- Design intent → docs/design.md
- Hit something strange? → docs/gotchas.md

## Structure
src/modules/<feature>/   feature-first. Each owns schema, queries, logic,
                         routes, ui, tests
src/shared/              db client, auth, errors. Cross-cutting only
components/ui/           shadcn primitives. Do not add to this
components/patterns/     page templates — record table, detail page, form,
                         summary strip, states. Do not add to this
components/layout/       the app shell(s) — nav, header, content frame

## Module rules
- Cross-module imports go through the module's index.ts only.
  Never import another module's internals.
- New module? Copy the shape of src/modules/<exemplar>/

## Code rules
- Errors: <the one pattern>
- Data access: <the one pattern>
- <framework specifics that aren't obvious from the code>

## Testing
- Integration tests against a real test database. Never mock our own code.
- Test-first for logic, test-after for plumbing. The ticket says which.
- Seams are listed in docs/architecture.md. Don't test at new ones.

## UI rules
- Compose from components/ui/ and components/patterns/. Never add to either.
- Every page opens inside a shell from components/layout/.
- If a needed pattern doesn't exist, STOP and ask. Never invent one.
- All values from theme tokens. No arbitrary values (p-[13px]), no raw hex.
- Icons: <set> only. 16px inline, 20px standalone.
- One accent element per screen — the primary action.
- Transitions 100–200ms, ease-out, transform/opacity only.
- Every component gets a Storybook story covering its states.
- Every list and table needs empty, loading, and error states.
- Never remove focus-visible styles or aria-* attributes.

## Working rules
- Stop and ask rather than guessing. Always.
- Solved something non-obvious that cost real time? Add it to docs/gotchas.md.
- Never write to CONTEXT.md unless asked.

## Commands
dev · test · typecheck · build · seed · deploy

## Never
- Commit directly to main
- Add a dependency without asking
- Create a new top-level folder
```

Also **update `docs/architecture.md`** with what building actually taught you. The plan meets reality here.

## Done when

One real feature works end to end in production, with a passing test — **and you can describe how to add the second one.**

That last clause is the real test. If you can't, the pattern isn't established yet.

## Never

- **Never build features beyond the one slice**
- **Never build components not yet needed**
- **Never add abstraction for anticipated needs.** Speculative generality in the foundation is the worst kind, because everything inherits it

Then tell the user to run **`/tickets`**.
